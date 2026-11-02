import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// TODO: Configure FONNTE_API_TOKEN in Supabase secrets before enabling WhatsApp dispatch.
const FONNTE_API_TOKEN = Deno.env.get("FONNTE_API_TOKEN") || "";
const FONNTE_ENDPOINT = "https://api.fonnte.com/send";
const DISPATCH_TIMEOUT_MS = 9_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function isAdminToken(token: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return false;
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  } catch {
    return false;
  }
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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ message: "Method tidak diizinkan." }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return json({ message: "Server belum dikonfigurasi dengan benar." }, 500);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ message: "Format data tidak valid." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ message: "Format data tidak valid." }, 400);
  }

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const isServiceRole = token === SERVICE_ROLE_KEY;
  if (!isServiceRole && !(await isAdminToken(token))) {
    return json({ message: "Akses admin ditolak." }, 403);
  }

  const orderId = String((payload as Record<string, unknown>).order_id || "").trim();
  if (!orderId) return json({ message: "ID pesanan wajib diisi." }, 400);

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error } = await admin
      .from("preorder_orders")
      .select("id,customer_name,whatsapp,order_number")
      .eq("id", orderId)
      .maybeSingle();
    if (error) {
      console.error("[DP_NOTIFICATION_ERROR] Could not load order:", error.message);
      return json({ message: "Gagal memuat pesanan." }, 500);
    }
    if (!order) return json({ message: "Pesanan tidak ditemukan." }, 404);
    if (!order.whatsapp) return json({ message: "Nomor WhatsApp pemesan tidak tersedia." }, 422);

    if (!FONNTE_API_TOKEN) {
      console.warn(`[WA_MOCK_DISPATCH] FONNTE_API_TOKEN is not configured; skipped DP notice for order ${order.id}.`);
      return json({ ok: true, waStatus: "skipped_no_token" });
    }

    const customerName = String(order.customer_name || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    const orderNumber = String(order.order_number || order.id).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    const message = [
      `Halo Kak ${customerName}! Pembayaran DP 50% untuk pesanan #${orderNumber} telah berhasil diverifikasi ✅`,
      "",
      "Sekarang Kakak sudah bisa mulai merangkai kenangan kado (Pesan, Foto & Suara) secara privat melalui link rahasia berikut:",
      `🔗 https://floramory.store/vault-setup?order=${encodeURIComponent(String(order.id))}`,
      "",
      "Seluruh isi kenangan Kakak aman dan terenkripsi rahasia. Terima kasih! 🌸",
    ].join("\n");

    if (!(await dispatchWhatsApp(String(order.whatsapp), message))) {
      return json({ ok: false, waStatus: "failed", message: "Gagal mengirim notifikasi WhatsApp." }, 502);
    }
    return json({ ok: true, waStatus: "dispatched" });
  } catch (error) {
    console.error("[DP_NOTIFICATION_ERROR]", error instanceof Error ? error.message : "Unexpected error.");
    return json({ message: "Gagal memproses notifikasi pembayaran." }, 500);
  }
});
