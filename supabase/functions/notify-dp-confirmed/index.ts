import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
      .select("id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) {
      console.error("[DP_NOTIFICATION_ERROR] Could not load order:", error.message);
      return json({ message: "Gagal memuat pesanan." }, 500);
    }
    if (!order) return json({ message: "Pesanan tidak ditemukan." }, 404);

    console.log(
      "[DP_CONFIRMED] Order " +
        order.id +
        " confirmed. Direct WhatsApp link ready for manual dispatch."
    );
    return json({
      ok: true,
      waStatus: "manual_ready",
      message: "Status DP berhasil dikonfirmasi. Gunakan tombol Kirim Link WA di Admin untuk menghubungi pemesan.",
    });
  } catch (error) {
    console.error("[DP_NOTIFICATION_ERROR]", error instanceof Error ? error.message : "Unexpected error.");
    return json({ message: "Gagal memproses notifikasi pembayaran." }, 500);
  }
});
