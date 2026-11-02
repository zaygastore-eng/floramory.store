import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// TODO: Configure FONNTE_API_TOKEN in Supabase secrets before enabling WhatsApp dispatch.
const FONNTE_API_TOKEN = Deno.env.get("FONNTE_API_TOKEN") || "";
const FONNTE_ENDPOINT = "https://api.fonnte.com/send";
const DISPATCH_TIMEOUT_MS = 9_000;
const WA_REGEX = /^62\d{8,13}$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeWhatsApp(raw: unknown): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8") && !digits.startsWith("62")) return `62${digits}`;
  return digits;
}

function cleanMessageField(value: unknown): string {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function maskPhoneNumber(phone: string): string {
  const digits = normalizeWhatsApp(phone);
  if (!digits) return "";
  if (digits.startsWith("62")) {
    const rest = digits.slice(2);
    const prefix = rest.slice(0, 3);
    const suffix = rest.slice(-4);
    return `+62 ${prefix}-xxxx-${suffix}`;
  }
  const prefix = digits.slice(0, 4);
  const suffix = digits.slice(-4);
  return `+${prefix}-xxxx-${suffix}`;
}

async function dispatchWhatsApp(to: string, message: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    const response = await fetch(FONNTE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: FONNTE_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: to, message }),
      signal: controller.signal,
    });
    if (response.status !== 200) {
      console.error(`[WA_DISPATCH_ERROR] Fonnte returned HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch (error) {
    const reason = error instanceof DOMException && error.name === "AbortError"
      ? `request timed out after ${DISPATCH_TIMEOUT_MS}ms`
      : "network request failed";
    console.error(`[WA_DISPATCH_ERROR] ${reason}.`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOtp(admin: ReturnType<typeof createClient>, productId: string): Promise<Response> {
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,is_catalog,recipient_whatsapp,nama_pembeli,dari,order_id")
    .eq("id", productId)
    .maybeSingle();
  if (productError) {
    console.error("[VAULT_OTP_ERROR] Could not load product:", productError.message);
    return json({ ok: false, message: "Gagal memuat data kado." }, 500);
  }
  if (!product) return json({ ok: false, message: "Produk tidak ditemukan." }, 404);
  if (product.is_catalog !== false) {
    return json({ ok: false, message: "Kode pembuka hanya tersedia untuk kado fisik." }, 400);
  }

  let recipientWhatsapp = normalizeWhatsApp(product.recipient_whatsapp);
  let recipientName = String(product.nama_pembeli || "");
  let senderName = String(product.dari || "");
  let buyerWhatsapp = "";

  if (product.order_id) {
    const { data: order, error: orderError } = await admin
      .from("preorder_orders")
      .select("recipient_whatsapp,recipient_name,sender_name,customer_name,whatsapp")
      .eq("id", product.order_id)
      .maybeSingle();
    if (orderError) {
      console.error("[VAULT_OTP_ERROR] Could not load linked order:", orderError.message);
      return json({ ok: false, message: "Gagal memuat data pemesan." }, 500);
    }
    if (order) {
      recipientName = recipientName || String(order.recipient_name || "");
      senderName = senderName || String(order.sender_name || order.customer_name || "");
      buyerWhatsapp = normalizeWhatsApp(order.whatsapp);

      if (!recipientWhatsapp || !WA_REGEX.test(recipientWhatsapp)) {
        const orderRecipientWa = normalizeWhatsApp(order.recipient_whatsapp);
        if (orderRecipientWa && WA_REGEX.test(orderRecipientWa)) {
          recipientWhatsapp = orderRecipientWa;
          const { error: backfillError } = await admin
            .from("products")
            .update({ recipient_whatsapp: recipientWhatsapp })
            .eq("id", product.id);
          if (backfillError) {
            console.error("[VAULT_OTP_ERROR] Could not backfill recipient WhatsApp:", backfillError.message);
          }
        }
      }
    }
  }

  let targetType: "recipient" | "buyer";
  let targetPhone = "";

  if (recipientWhatsapp && WA_REGEX.test(recipientWhatsapp)) {
    targetType = "recipient";
    targetPhone = recipientWhatsapp;
  } else if (buyerWhatsapp && WA_REGEX.test(buyerWhatsapp)) {
    targetType = "buyer";
    targetPhone = buyerWhatsapp;
  } else {
    return json(
      { ok: false, message: "Nomor WhatsApp belum didaftarkan untuk kado ini." },
      422
    );
  }

  const now = Date.now();
  const { count: recentCount, error: recentError } = await admin
    .from("vault_otp")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id)
    .gt("created_at", new Date(now - 60_000).toISOString());
  if (recentError) {
    console.error("[VAULT_OTP_ERROR] Could not check OTP rate limit:", recentError.message);
    return json({ ok: false, message: "Gagal memeriksa batas pengiriman kode." }, 500);
  }
  if ((recentCount || 0) >= 1) {
    return json({ ok: false, message: "Mohon tunggu 60 detik sebelum meminta kode baru." }, 429);
  }

  const { count: dailyCount, error: dailyError } = await admin
    .from("vault_otp")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id)
    .gt("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
  if (dailyError) {
    console.error("[VAULT_OTP_ERROR] Could not check daily OTP limit:", dailyError.message);
    return json({ ok: false, message: "Gagal memeriksa batas pengiriman kode." }, 500);
  }
  if ((dailyCount || 0) >= 3) {
    return json({ ok: false, message: "Batas pengiriman kode harian (3x) tercapai. Hubungi Floramory." }, 429);
  }

  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const otpCode = String(100_000 + (random[0] % 900_000));
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await admin.from("vault_otp").insert({
    product_id: product.id,
    otp_code: otpCode,
    expires_at: expiresAt,
    used: false,
  });
  if (insertError) {
    console.error("[VAULT_OTP_ERROR] Could not save OTP:", insertError.message);
    return json({ ok: false, message: "Gagal membuat kode pembuka." }, 500);
  }

  const rName = cleanMessageField(recipientName) || "Penerima";
  const sName = cleanMessageField(senderName) || "Pengirim";
  const maskedPhone = maskPhoneNumber(targetPhone);

  const message = targetType === "recipient"
    ? `Halo Kak ${rName}! 🎁 Ada kado kenangan istimewa dari ${sName} yang siap dibuka.\n\nGunakan kode pembuka berikut di layarmu:\n🔑 ${otpCode}\n\n(Kode berlaku 10 menit)`
    : `Halo Kak ${sName}! 🎁 Kode pembuka kado untuk ${rName} siap digunakan:\n🔑 ${otpCode}\n\nBerikan kode ini kepada penerima untuk membuka Memory Vault.`;

  if (!FONNTE_API_TOKEN) {
    console.warn(`[WA_MOCK_DISPATCH] FONNTE_API_TOKEN is not configured. Vault OTP for product ${product.id} (${targetType} ${maskedPhone}): ${otpCode}`);
    return json({
      ok: true,
      waStatus: "mock_dispatched",
      targetType,
      maskedPhone,
      message: targetType === "buyer"
        ? `Kode rahasia telah dikirim ke WhatsApp pengirim (${maskedPhone}).`
        : `Kode rahasia telah dikirim ke WhatsApp penerima (${maskedPhone}).`,
      debugOtp: otpCode,
    });
  }

  if (!(await dispatchWhatsApp(targetPhone, message))) {
    return json({
      ok: false,
      message: targetType === "buyer"
        ? "Gagal mengirim kode OTP ke WhatsApp pengirim."
        : "Gagal mengirim kode OTP ke WhatsApp penerima.",
    }, 502);
  }
  return json({
    ok: true,
    waStatus: "dispatched",
    targetType,
    maskedPhone,
    message: targetType === "buyer"
      ? `Kode rahasia telah dikirim ke WhatsApp pengirim (${maskedPhone}).`
      : `Kode rahasia telah dikirim ke WhatsApp penerima (${maskedPhone}).`,
  });
}

async function verifyOtp(
  admin: ReturnType<typeof createClient>,
  productId: string,
  otpCode: string
): Promise<Response> {
  if (!/^\d{6}$/.test(otpCode)) {
    return json({ ok: false, verified: false, message: "Kode OTP tidak valid atau sudah kadaluarsa." }, 400);
  }
  const now = new Date().toISOString();
  const { data: otp, error: lookupError } = await admin
    .from("vault_otp")
    .select("id")
    .eq("product_id", productId)
    .eq("otp_code", otpCode)
    .eq("used", false)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    console.error("[VAULT_OTP_ERROR] Could not verify OTP:", lookupError.message);
    return json({ ok: false, verified: false, message: "Gagal memverifikasi kode OTP." }, 500);
  }
  if (!otp) {
    return json({ ok: false, verified: false, message: "Kode OTP tidak valid atau sudah kadaluarsa." }, 400);
  }

  const { data: usedOtp, error: updateError } = await admin
    .from("vault_otp")
    .update({ used: true })
    .eq("id", otp.id)
    .eq("used", false)
    .gt("expires_at", now)
    .select("id")
    .maybeSingle();
  if (updateError) {
    console.error("[VAULT_OTP_ERROR] Could not mark OTP as used:", updateError.message);
    return json({ ok: false, verified: false, message: "Gagal menyimpan verifikasi OTP." }, 500);
  }
  if (!usedOtp) {
    return json({ ok: false, verified: false, message: "Kode OTP tidak valid atau sudah kadaluarsa." }, 400);
  }
  return json({ ok: true, verified: true, message: "Kode berhasil diverifikasi." });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ ok: false, message: "Method tidak diizinkan." }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, message: "Server belum dikonfigurasi dengan benar." }, 500);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Format data tidak valid." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ ok: false, message: "Format data tidak valid." }, 400);
  }
  const body = payload as Record<string, unknown>;
  const productId = String(body.product_id || "").trim().toUpperCase();
  if (!productId || productId.length > 120) {
    return json({ ok: false, message: "ID produk tidak valid." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (body.action === "request") return await requestOtp(admin, productId);
    if (body.action === "verify") {
      return await verifyOtp(admin, productId, String(body.otp_code || "").trim());
    }
    return json({ ok: false, message: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("[VAULT_OTP_ERROR]", error instanceof Error ? error.message : "Unexpected error.");
    return json({ ok: false, message: "Gagal memproses permintaan kode OTP." }, 500);
  }
});
