// ============================================================
// Floramory — Supabase Edge Function: send-preorder
// ============================================================
// Satu-satunya jalur masuk data pre-order. Berjalan dengan
// service_role sehingga MELEWATI RLS — karena itu kunci jalur
// insert publik ke tabel preorder_orders (migrasi 0004).
//
// Melindungi dari spam dengan, berlapis:
//   1. Proteksi bot: user-agent + field honeypot + time-trap
//      (form yang diisi < MIN_FILL_MS dianggap bot).
//   2. Rate limit: per-IP (in-memory) dan per-nomor WA (DB, 24 jam).
//   3. Validasi server: panjang input, normalisasi no. WA, dan
//      produk harus ada + berstatus active.
//
// Deploy:
//   supabase functions deploy send-preorder
//   (default verify_jwt=true — browser mengirim anon key sebagai JWT,
//    jadi request tanpa JWT proyek valid langsung ditolak gateway).
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Aturan anti-spam --------------------------------------------------
const MAX_ORDERS_PER_PHONE = 3; // per 24 jam (DB, lintas-IP)
const MAX_REQUESTS_PER_IP = 6; // per 10 menit (in-memory)
const IP_WINDOW_MS = 10 * 60 * 1000;
const PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_FILL_MS = 1200; // waktu minimal mengisi form (time-trap)
const MAX_BODY_BYTES = 50_000;

const MAX_LENGTH: Record<string, number> = {
  customer_name: 120,
  whatsapp: 20,
  product_id: 120,
  product_name: 160,
  custom_request: 2000,
  recipient_name: 120,
  sender_name: 120,
  personal_message: 2000,
};

const BOT_USER_AGENTS =
  /bot|crawler|spider|curl|wget|libwww|python|node|axios|go-http|java\/|okhttp|postman|http-client|phantomjs|headless|selenium|puppeteer|scrapy|nuclei/i;

const WA_REGEX = /^62\d{8,13}$/;

const ipLimiters = new Map<string, number[]>();

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

function getStr(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? String(payload[key]) : "";
}

function validatePayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  const customerName = getStr(payload, "customer_name").trim();
  if (!customerName) {
    errors.push("Nama lengkap wajib diisi.");
  }

  const whatsapp = normalizeWhatsApp(getStr(payload, "whatsapp"));
  if (!WA_REGEX.test(whatsapp)) {
    errors.push("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
  }

  const productId = getStr(payload, "product_id").trim();
  if (!productId) {
    errors.push("Silakan pilih produk terlebih dahulu.");
  }

  for (const [key, max] of Object.entries(MAX_LENGTH)) {
    const value = getStr(payload, key).trim();
    if (value.length > max) {
      errors.push(`Kolom "${key}" terlalu panjang (maksimal ${max} karakter).`);
    }
  }

  return errors;
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
  const errors = validatePayload(body);
  if (errors.length > 0) {
    return json({ ok: false, errors: errors.map((message) => ({ message })) }, 422);
  }

  const whatsapp = normalizeWhatsApp(getStr(body, "whatsapp"));
  const productId = getStr(body, "product_id").trim();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 7) Validasi produk: harus ada dan berstatus active (tidak percaya client).
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, nama_produk")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (productError) {
    return json({ message: "Produk tidak ditemukan." }, 400);
  }
  if (!product) {
    return json({ message: "Produk tidak valid atau sudah tidak tersedia." }, 400);
  }

  // 8) Rate limit per nomor WhatsApp (24 jam, lintas-IP) via DB.
  const since = new Date(Date.now() - PHONE_WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("preorder_orders")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp", whatsapp)
    .gte("created_at", since);
  if (!countError && (count ?? 0) >= MAX_ORDERS_PER_PHONE) {
    return json(
      { message: "Terlalu banyak pre-order dari nomor ini. Hubungi kami via WhatsApp langsung." },
      429
    );
  }

  // 9) Simpan (service_role melewati RLS).
  const { data: row, error: insertError } = await admin
    .from("preorder_orders")
    .insert({
      customer_name: getStr(body, "customer_name").trim(),
      whatsapp,
      product_id: productId,
      product_name: String(product.nama_produk || "").trim(),
      custom_request: getStr(body, "custom_request").trim(),
      recipient_name: getStr(body, "recipient_name").trim(),
      sender_name: getStr(body, "sender_name").trim(),
      personal_message: getStr(body, "personal_message").trim(),
      status: "new",
    })
    .select("id")
    .single();
  if (insertError) {
    return json({ message: "Gagal menyimpan pre-order." }, 500);
  }

  return json({ ok: true, id: row?.id }, 201);
});