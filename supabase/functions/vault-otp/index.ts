import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

async function verifyPin(
  admin: ReturnType<typeof createClient>,
  productId: string,
  pin: string
): Promise<Response> {
  if (!/^\d{6}$/.test(pin)) {
    return json(
      {
        ok: false,
        verified: false,
        message: "PIN harus berupa 6 digit angka.",
      },
      400
    );
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,vault_pin,pin_attempts,pin_locked_until")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    console.error("[VAULT_PIN_ERROR] Could not load product:", productError.message);
    return json({ ok: false, verified: false, message: "Gagal memverifikasi PIN." }, 500);
  }

  if (!product) {
    return json({ ok: false, verified: false, message: "Produk tidak ditemukan." }, 404);
  }

  if (product.pin_locked_until) {
    const lockedUntil = new Date(product.pin_locked_until);
    if (lockedUntil.getTime() > Date.now()) {
      return json(
        {
          ok: false,
          verified: false,
          locked: true,
          message:
            "Terlalu banyak percobaan salah. Akun terkunci sementara, silakan coba lagi dalam 15 menit.",
        },
        429
      );
    }
  }

  const isMatch = Boolean(product.vault_pin && product.vault_pin.trim() === pin);

  if (isMatch) {
    const { error: resetError } = await admin
      .from("products")
      .update({
        pin_attempts: 0,
        pin_locked_until: null,
      })
      .eq("id", product.id);

    if (resetError) {
      console.error("[VAULT_PIN_ERROR] Could not reset pin attempts:", resetError.message);
      return json({ ok: false, verified: false, message: "Gagal menyimpan verifikasi PIN." }, 500);
    }

    return json({ ok: true, verified: true, message: "PIN valid." }, 200);
  }

  const currentAttempts = Number(product.pin_attempts) || 0;
  const newAttempts = currentAttempts + 1;
  const isLocked = newAttempts >= 5;
  const pinLockedUntil = isLocked
    ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    : null;
  const updatedAttempts = isLocked ? 0 : newAttempts;

  const { error: updateError } = await admin
    .from("products")
    .update({
      pin_attempts: updatedAttempts,
      pin_locked_until: pinLockedUntil,
    })
    .eq("id", product.id);

  if (updateError) {
    console.error("[VAULT_PIN_ERROR] Could not update pin attempts:", updateError.message);
    return json({ ok: false, verified: false, message: "Gagal mencatat percobaan PIN." }, 500);
  }

  return json(
    {
      ok: false,
      verified: false,
      attemptsRemaining: Math.max(0, 5 - newAttempts),
      message:
        "PIN tidak cocok. Silakan periksa kembali angka di balik stiker gosok kartu kamu.",
    },
    400
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, message: "Method tidak diizinkan." }, 405);
  }

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

  const rawPin = body.pin !== undefined ? body.pin : body.otp_code;
  const pin = String(rawPin || "").trim();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    return await verifyPin(admin, productId, pin);
  } catch (error) {
    console.error(
      "[VAULT_PIN_ERROR]",
      error instanceof Error ? error.message : "Unexpected error."
    );
    return json({ ok: false, message: "Gagal memproses verifikasi PIN." }, 500);
  }
});
