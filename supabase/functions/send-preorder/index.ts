// ============================================================
// Floramory — Supabase Edge Function: send-preorder
// ============================================================
// Satu-satunya jalur masuk data pre-order. Berjalan dengan
// service_role sehingga MELEWATI RLS — karena itu kunci jalur
// insert publik ke tabel preorder_orders (migrasi 0004).
//
// Sejak fitur multi-karya, satu permintaan berisi `items[]`
// (produk + qty + nuansa + inisial). Fungsi ini:
//   1. Membuat satu baris `preorder_groups` (satu transaksi).
//   2. Mengekspansi qty menjadi baris `preorder_orders`
//      (1 baris = 1 karya fisik = 1 QR / 1 Memory Vault).
//   3. Menghitung total & DP 50% di level grup.
//   4. Mengirim satu email ringkasan ke atelier.
//
// Melindungi dari spam dengan, berlapis:
//   1. Proteksi bot: user-agent + field honeypot + time-trap
//      (form yang diisi < MIN_FILL_MS dianggap bot).
//   2. Rate limit: per-IP (in-memory + DB) dan per-nomor WA (DB, 24 jam).
//   3. Validasi server: panjang input, normalisasi no. WA, dan
//      produk harus ada + berstatus active.
//
// Deploy:
//   supabase functions deploy send-preorder
//   (default verify_jwt=true — browser mengirim anon key sebagai JWT,
//    jadi request tanpa JWT proyek valid langsung ditolak gateway).
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkDbRateLimit } from "../_shared/rate-limit.ts";
import { emailLayout, escapeHtml, sendAdminEmail } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Aturan anti-spam --------------------------------------------------
const MAX_GROUPS_PER_PHONE = 3; // per 24 jam (DB, lintas-IP)
const MAX_REQUESTS_PER_IP = 6; // per 10 menit (in-memory)
const IP_WINDOW_MS = 10 * 60 * 1000;
const PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_FILL_MS = 1200; // waktu minimal mengisi form (time-trap)
const MAX_BODY_BYTES = 12 * 1024 * 1024; // 12 MB (mendukung upload bukti transfer foto)

// Batas teknis (bukan batas UI): melindungi server dari payload ekstrem.
const MAX_GROUP_ITEMS = 50; // baris karya dalam satu daftar
const MAX_ITEM_QTY = 20; // jumlah per baris
const MAX_GROUP_UNITS = 80; // total karya fisik setelah qty diekspansi

const MAX_LENGTH: Record<string, number> = {
  customer_name: 120,
  whatsapp: 20,
  product_id: 120,
  product_name: 160,
  nuansa: 40,
  inisial: 10,
};

const ALLOWED_NUANSA = new Set(["crimson-romance", "bridgerton-blue", "classic-ivory"]);

const BOT_USER_AGENTS =
  /bot|crawler|spider|curl|wget|libwww|python|node|axios|go-http|java\/|okhttp|postman|http-client|phantomjs|headless|selenium|puppeteer|scrapy|nuclei/i;

const WA_REGEX = /^62\d{8,13}$/;

const ipLimiters = new Map<string, number[]>();

interface ItemInput {
  product_id: string;
  qty: number;
  nuansa: string;
  inisial: string;
  personal_message: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.replace(/^::ffff:/, "");
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() || "";
    if (first) return first.replace(/^::ffff:/, "");
  }
  return "unknown";
}

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const events = (ipLimiters.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (events.length >= MAX_REQUESTS_PER_IP) {
    ipLimiters.set(ip, events);
    return true;
  }
  events.push(now);
  ipLimiters.set(ip, events);
  return false;
}

function normalizeWhatsApp(raw: unknown): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8") && !digits.startsWith("62")) return `62${digits}`;
  return digits;
}

function getPriceAmount(raw: unknown): number {
  const digits = String(raw || "").replace(/\D/g, "");
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : 0;
}

function createOrderNumber(): string {
  return `ORD-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function createGroupNumber(): string {
  return `GRP-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

// Token privat untuk konsol pengirim (/vault-setup). Dipisahkan dari
// order id agar tautan yang bocor tidak otomatis memberi akses tulis
// ke pesanan lain, dan agar bisa kedaluwarsa.
function createSetupToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const withoutDataUrl = base64.trim().replace(/^data:[^,]*;base64,/i, "");
  const cleanBase64 = withoutDataUrl
    .replace(/\s/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (!cleanBase64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
    throw new Error("Invalid base64 data");
  }

  const unpaddedBase64 = cleanBase64.replace(/=+$/, "");
  const remainder = unpaddedBase64.length % 4;
  if (remainder === 1) throw new Error("Invalid base64 length");
  const padding = (4 - remainder) % 4;
  const existingPadding = cleanBase64.length - unpaddedBase64.length;
  if (existingPadding > 0 && (cleanBase64.length % 4 !== 0 || existingPadding !== padding)) {
    throw new Error("Invalid base64 padding");
  }

  const binary = atob(unpaddedBase64 + "=".repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getStr(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? String(payload[key]) : "";
}

function toQty(raw: unknown): number {
  const qty = Math.floor(Number(raw));
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

/** Mengambil inisial dari teks lama seperti "Inisial: R | Nuansa: ...". */
function parseLegacyInisial(text: string): string {
  const match = /inisial\s*:\s*([^\s|]+)/i.exec(text);
  return match ? match[1].trim().slice(0, 10) : "";
}

/**
 * Menormalkan payload lama (satu produk) maupun payload baru (`items[]`)
 * menjadi daftar item yang seragam.
 */
function parseItems(body: Record<string, unknown>): ItemInput[] {
  const rawItems = Array.isArray(body.items) ? body.items : null;

  if (!rawItems) {
    // Kompatibilitas mundur: request single-product lama tidak mengirim
    // nuansa/inisial terstruktur, jadi ambil dari kolom lama bila ada.
    const legacyNuansa = getStr(body, "nuansa").trim();
    const legacyInisial =
      getStr(body, "inisial").trim() ||
      parseLegacyInisial(getStr(body, "recipient_name")) ||
      parseLegacyInisial(getStr(body, "custom_request"));

    return [{
      product_id: getStr(body, "product_id").trim(),
      qty: 1,
      nuansa: ALLOWED_NUANSA.has(legacyNuansa) ? legacyNuansa : "crimson-romance",
      inisial: legacyInisial,
      personal_message: getStr(body, "personal_message").trim(),
    }];
  }

  return rawItems.map((entry) => {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    return {
      product_id: getStr(item, "product_id").trim(),
      qty: toQty(item.qty),
      nuansa: getStr(item, "nuansa").trim(),
      inisial: getStr(item, "inisial").trim(),
      personal_message: getStr(item, "personal_message").trim(),
    };
  });
}

function validatePayload(body: Record<string, unknown>, items: ItemInput[]): string[] {
  const errors: string[] = [];

  const customerName = getStr(body, "customer_name").trim();
  if (!customerName) {
    errors.push("Nama lengkap wajib diisi.");
  }

  const whatsapp = normalizeWhatsApp(getStr(body, "whatsapp"));
  if (!WA_REGEX.test(whatsapp)) {
    errors.push("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
  }

  if (items.length === 0) {
    errors.push("Silakan pilih minimal satu karya.");
  }
  if (items.length > MAX_GROUP_ITEMS) {
    errors.push(`Terlalu banyak baris karya (maksimal ${MAX_GROUP_ITEMS}).`);
  }

  let totalUnits = 0;
  items.forEach((item, index) => {
    const label = `Karya ${index + 1}`;

    if (!item.product_id) {
      errors.push(`${label}: silakan pilih produk.`);
    }
    if (item.qty < 1 || item.qty > MAX_ITEM_QTY) {
      errors.push(`${label}: jumlah harus antara 1 dan ${MAX_ITEM_QTY}.`);
    }
    if (!item.nuansa || !ALLOWED_NUANSA.has(item.nuansa)) {
      errors.push(`${label}: nuansa warna tidak valid.`);
    }
    if (!item.inisial) {
      errors.push(`${label}: inisial wajib diisi.`);
    }
    totalUnits += item.qty;
  });

  if (totalUnits > MAX_GROUP_UNITS) {
    errors.push(`Total karya melebihi batas ${MAX_GROUP_UNITS} dalam satu reservasi.`);
  }

  for (const [key, max] of Object.entries(MAX_LENGTH)) {
    const value = getStr(body, key).trim();
    if (value.length > max) {
      errors.push(`Kolom "${key}" terlalu panjang (maksimal ${max} karakter).`);
    }
  }

  for (const item of items) {
    if (item.inisial.length > MAX_LENGTH.inisial) {
      errors.push(`Inisial terlalu panjang (maksimal ${MAX_LENGTH.inisial} karakter).`);
      break;
    }
  }

  return errors;
}

async function handleUploadPaymentProof(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>
): Promise<Response> {
  const token = getStr(body, "payment_token").trim();
  const groupNumber = getStr(body, "group_number").trim();
  const groupId = getStr(body, "group_id").trim();
  const rawImage = getStr(body, "image").trim();

  if (!token || token.length < 16) {
    return json({ message: "Token pembayaran tidak valid." }, 401);
  }
  if (!rawImage) {
    return json({ message: "Bukti transfer belum dipilih." }, 400);
  }

  let query = admin
    .from("preorder_groups")
    .select("id, group_number, status, payment_token");
  if (groupNumber) {
    query = query.eq("group_number", groupNumber);
  } else if (groupId) {
    query = query.eq("id", groupId);
  } else {
    return json({ message: "Nomor reservasi tidak valid." }, 400);
  }

  const { data: group, error: groupError } = await query.maybeSingle();
  if (groupError || !group) {
    return json({ message: "Reservasi tidak ditemukan." }, 404);
  }
  if (group.payment_token && group.payment_token !== token) {
    return json({ message: "Akses pembayaran tidak diizinkan." }, 403);
  }

  // Decode base64 gambar
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64ToUint8Array(rawImage);
  } catch {
    return json({ message: "Format gambar bukti transfer tidak valid." }, 400);
  }

  if (bytes.byteLength > 8 * 1024 * 1024) {
    return json({ message: "Ukuran bukti transfer melebihi batas 8 MB." }, 413);
  }

  let mimeType = "image/jpeg";
  let ext = "jpg";
  const headerMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64,/i.exec(rawImage);
  if (headerMatch) {
    const declared = headerMatch[1].toLowerCase();
    if (["image/jpeg", "image/jpg"].includes(declared)) {
      mimeType = "image/jpeg";
      ext = "jpg";
    } else if (declared === "image/png") {
      mimeType = "image/png";
      ext = "png";
    } else if (declared === "image/webp") {
      mimeType = "image/webp";
      ext = "webp";
    }
  }

  const filePath = `payments/${group.group_number}/proof_${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("product-images")
    .upload(filePath, bytes, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error("[PAYMENT_PROOF_UPLOAD_ERROR]", uploadError.message);
    return json({ message: "Gagal mengunggah bukti transfer. Coba lagi." }, 502);
  }

  const { data: pubData } = admin.storage.from("product-images").getPublicUrl(filePath);
  const publicUrl = pubData.publicUrl;
  const now = new Date().toISOString();

  await admin
    .from("preorder_groups")
    .update({
      payment_proof_url: publicUrl,
      payment_submitted_at: now,
      updated_at: now,
    })
    .eq("id", group.id);

  await admin
    .from("preorder_orders")
    .update({
      payment_proof_url: publicUrl,
      updated_at: now,
    })
    .eq("group_id", group.id);

  return json({
    ok: true,
    success: true,
    payment_proof_url: publicUrl,
    message: "Bukti pembayaran berhasil diunggah.",
  });
}

async function handleGetPaymentInfo(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>
): Promise<Response> {
  const token = getStr(body, "payment_token").trim();
  const groupNumber = getStr(body, "group_number").trim();
  const groupId = getStr(body, "group_id").trim();

  let query = admin
    .from("preorder_groups")
    .select(
      "id, group_number, customer_name, whatsapp, total_amount, dp_amount, status, payment_token, payment_proof_url, created_at"
    );

  if (groupNumber) {
    query = query.eq("group_number", groupNumber);
  } else if (groupId) {
    query = query.eq("id", groupId);
  } else {
    return json({ message: "Nomor reservasi tidak valid." }, 400);
  }

  const { data: group, error } = await query.maybeSingle();
  if (error || !group) {
    return json({ message: "Reservasi tidak ditemukan." }, 404);
  }
  if (group.payment_token && group.payment_token !== token) {
    return json({ message: "Token pembayaran tidak valid." }, 403);
  }

  const { data: orders } = await admin
    .from("preorder_orders")
    .select("id, order_number, product_name, nuansa, inisial, total_amount, dp_amount, status")
    .eq("group_id", group.id)
    .order("group_item_index", { ascending: true });

  return json({
    ok: true,
    group: {
      id: group.id,
      group_number: group.group_number,
      customer_name: group.customer_name,
      whatsapp: group.whatsapp,
      total_amount: group.total_amount,
      dp_amount: group.dp_amount,
      status: group.status,
      payment_proof_url: group.payment_proof_url,
      created_at: group.created_at,
    },
    items: orders || [],
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ message: "Method tidak diizinkan." }, 405);
  }

  // 1) Proteksi bot: berlakukan JWT (gateway) + blokir user-agent bot.
  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent || BOT_USER_AGENTS.test(userAgent)) {
    return json({ message: "Permintaan ditolak." }, 400);
  }

  // 2) Rate limit per-IP (in-memory).
  const clientIp = getClientIp(req);
  if (isIpRateLimited(clientIp)) {
    return json({ message: "Terlalu banyak permintaan. Silakan coba lagi nanti." }, 429);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ message: "Server belum dikonfigurasi dengan benar." }, 500);
  }

  // 3) Baca & batasi ukuran body.
  let payload: unknown;
  const raw = await req.text().catch(() => "");
  if (!raw) return json({ message: "Data kosong." }, 400);
  if (raw.length > MAX_BODY_BYTES) {
    return json({ message: "Ukuran data terlalu besar." }, 413);
  }
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ message: "Format data tidak valid." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ message: "Format data tidak valid." }, 400);
  }
  const body = payload as Record<string, unknown>;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const action = getStr(body, "action").trim();
  if (action === "upload_payment_proof") {
    return await handleUploadPaymentProof(admin, body);
  }
  if (action === "get_payment_info") {
    return await handleGetPaymentInfo(admin, body);
  }

  // 4) Field honeypot: hanya diisi bot -> balas sukses palsu, jangan simpan.
  if (getStr(body, "website").trim().length > 0) {
    return json({ ok: true }, 200);
  }

  // 5) Time-trap: form dikirim terlalu cepat setelah muncul -> bot.
  const fillMs = Number(body.fill_ms);
  if (!Number.isFinite(fillMs) || fillMs < MIN_FILL_MS) {
    return json({ message: "Permintaan terlalu cepat. Silakan coba lagi." }, 400);
  }

  // 6) Validasi server.
  const items = parseItems(body);
  const errors = validatePayload(body, items);
  if (errors.length > 0) {
    return json({ ok: false, errors: errors.map((message) => ({ message })) }, 422);
  }

  const whatsapp = normalizeWhatsApp(getStr(body, "whatsapp"));
  const customerName = getStr(body, "customer_name").trim();
  const isVip = body.is_vip === true;

  // 6b) Rate limit per-IP lintas instance (DB). In-memory di atas hanya
  // berlaku per instance; lapisan ini konsisten di semua replika.
  if (!(await checkDbRateLimit(admin, "send-preorder-ip", clientIp, MAX_REQUESTS_PER_IP, 10 * 60))) {
    return json({ message: "Terlalu banyak permintaan. Silakan coba lagi nanti." }, 429);
  }

  // 7) Validasi produk: semua harus ada dan berstatus active (tidak percaya client).
  const productIds = Array.from(new Set(items.map((item) => item.product_id)));
  const { data: productRows, error: productError } = await admin
    .from("products")
    .select("id, nama_produk, harga")
    .in("id", productIds)
    .eq("status", "active");
  if (productError) {
    return json({ message: "Produk tidak ditemukan." }, 400);
  }

  const productMap = new Map<string, { id: string; nama_produk: string; harga: string }>();
  for (const row of productRows || []) {
    productMap.set(String(row.id), row);
  }

  for (const item of items) {
    if (!productMap.has(item.product_id)) {
      return json({ message: "Ada produk yang tidak valid atau sudah tidak tersedia." }, 400);
    }
  }

  // 8) Hitung total & DP 50% di level grup.
  const pricedItems = items.map((item) => {
    const product = productMap.get(item.product_id)!;
    const unitAmount = getPriceAmount(product.harga);
    return {
      ...item,
      product_name: String(product.nama_produk || "").trim(),
      unitAmount,
      lineAmount: unitAmount * item.qty,
    };
  });

  if (pricedItems.some((item) => item.unitAmount <= 0)) {
    return json({ message: "Harga produk belum dikonfigurasi dengan benar." }, 400);
  }

  const totalAmount = pricedItems.reduce((sum, item) => sum + item.lineAmount, 0);
  const dpAmount = Math.ceil(totalAmount * 0.5);
  const totalUnits = pricedItems.reduce((sum, item) => sum + item.qty, 0);
  const groupNumber = createGroupNumber();

  // 9) Rate limit per nomor WhatsApp (24 jam, lintas-IP) via DB.
  //    Dihitung per grup, bukan per karya, agar satu reservasi 3 karya
  //    tidak langsung menghabiskan kuota.
  const since = new Date(Date.now() - PHONE_WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("preorder_groups")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp", whatsapp)
    .gte("created_at", since);
  if (!countError && (count ?? 0) >= MAX_GROUPS_PER_PHONE) {
    return json(
      { message: "Terlalu banyak pre-order dari nomor ini. Hubungi kami via WhatsApp langsung." },
      429
    );
  }

  const paymentToken = createSetupToken();

  // 10) Simpan grup (service_role melewati RLS).
  const { data: group, error: groupError } = await admin
    .from("preorder_groups")
    .insert({
      group_number: groupNumber,
      payment_token: paymentToken,
      customer_name: customerName,
      whatsapp,
      is_vip: isVip,
      total_amount: totalAmount,
      dp_amount: dpAmount,
      status: "waiting_dp",
    })
    .select("id")
    .single();
  if (groupError || !group) {
    console.error("[PREORDER_GROUP_INSERT_ERROR]", groupError?.message || "no row");
    return json({ message: "Gagal menyimpan pre-order." }, 500);
  }

  // 11) Ekspansi qty -> satu baris order per karya fisik (1 QR / 1 vault).
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const orderRows: Record<string, unknown>[] = [];
  let unitIndex = 0;

  for (const item of pricedItems) {
    const nuansaLabel = item.nuansa;
    const customRequestSummary =
      `Inisial: ${item.inisial} | Nuansa: ${nuansaLabel} | VIP Waiting List: ${isVip ? "Ya (Klaim Early-Bird Privilege)" : "Belum Terdaftar"}`;

    for (let copy = 0; copy < item.qty; copy += 1) {
      unitIndex += 1;
      orderRows.push({
        customer_name: customerName,
        whatsapp,
        recipient_whatsapp: "",
        product_id: item.product_id,
        product_name: item.product_name,
        custom_request: customRequestSummary,
        recipient_name: "",
        sender_name: customerName,
        personal_message: item.personal_message || "",
        nuansa: item.nuansa,
        inisial: item.inisial,
        group_id: group.id,
        group_number: groupNumber,
        group_item_index: unitIndex,
        group_item_count: totalUnits,
        group_total_amount: totalAmount,
        group_dp_amount: dpAmount,
        status: "waiting_dp",
        order_number: createOrderNumber(),
        total_amount: item.unitAmount,
        dp_amount: Math.ceil(item.unitAmount * 0.5),
        wa_sent: false,
        vault_setup_token: createSetupToken(),
        vault_setup_expires_at: expiresAt,
      });
    }
  }

  const insertResult = await admin
    .from("preorder_orders")
    .insert(orderRows)
    .select("id, order_number");

  const insertedRows = insertResult.data;
  const insertError = insertResult.error;
  if (insertError || !insertedRows || insertedRows.length === 0) {
    console.error("[PREORDER_INSERT_ERROR]", insertError?.message || "no rows");
    // Bersihkan grup agar tidak menyisakan transaksi tanpa item.
    await admin.from("preorder_groups").delete().eq("id", group.id);
    return json({ message: "Gagal menyimpan pre-order." }, 500);
  }

  const orderIds = insertedRows.map((row) => String(row.id));
  const orderNumbers = insertedRows.map((row) => String(row.order_number));

  // Notifikasi email ke atelier. Tidak pernah menggagalkan pemesanan.
  const itemLines = pricedItems
    .map((item, index) => {
      const label = item.qty > 1 ? `${item.qty}× ${item.product_name}` : item.product_name;
      return `${index + 1}. ${label} — ${item.nuansa} (${item.inisial}) = Rp ${item.lineAmount.toLocaleString("id-ID")}`;
    })
    .join("\n");

  await sendAdminEmail(
    `Pre-order grup #${groupNumber} — ${totalUnits} karya`,
    emailLayout("Pre-order grup baru masuk", [
      ["Nomor Grup", escapeHtml(groupNumber)],
      ["Pelanggan", escapeHtml(customerName)],
      ["WhatsApp", `<a href="https://wa.me/${escapeHtml(whatsapp)}">${escapeHtml(whatsapp)}</a>`],
      ["Jumlah Karya", escapeHtml(String(totalUnits))],
      ["Rincian", escapeHtml(itemLines).replace(/\n/g, "<br />")],
      ["Total", `Rp ${totalAmount.toLocaleString("id-ID")}`],
      ["DP 50%", `Rp ${dpAmount.toLocaleString("id-ID")}`],
    ], "Buka panel Admin untuk memverifikasi pembayaran grup dan memproses semua karya.")
  );

  console.log(
    "[PREORDER_GROUP_CREATED] Group " +
      groupNumber +
      " with " +
      totalUnits +
      " item(s). Redirecting customer to manual WhatsApp confirmation."
  );

  return json({
    success: true,
    ok: true,
    groupId: group.id,
    groupNumber,
    paymentToken,
    id: orderIds[0],
    orderId: orderIds[0],
    orderIds,
    orderNumber: orderNumbers[0],
    orderNumbers,
    totalAmount,
    dpAmount,
    itemCount: totalUnits,
    waStatus: "manual_redirect",
  }, 201);
});
