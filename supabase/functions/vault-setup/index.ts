import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ORDER_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

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

function isOrderId(value: unknown): value is string {
  return typeof value === "string" && ORDER_ID_REGEX.test(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "").trim().slice(0, maxLength);
}

function generateSecurePin(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(100_000 + (buffer[0] % 900_000));
}

async function loadOrder(admin: ReturnType<typeof createClient>, orderId: string) {
  const { data: order, error } = await admin
    .from("preorder_orders")
    .select("id,order_number,customer_name,recipient_name,sender_name,product_name,personal_message,foto_vault,audio_url,audio_durasi,video_url,status,vault_submitted_at,vault_pin")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("[VAULT_SETUP_ERROR] Could not load order:", error.message);
    return { order: null, error: true };
  }
  if (!order || String(order.status || "").toLowerCase() === "cancelled") {
    return { order: null, error: false };
  }
  return { order, error: false };
}

async function handleGet(admin: ReturnType<typeof createClient>, orderId: string): Promise<Response> {
  const result = await loadOrder(admin, orderId);
  if (result.error) return json({ ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json({ ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }
  const order = { ...result.order };
  Reflect.deleteProperty(order, "vault_pin");
  return json({ ok: true, order });
}

async function handleUpload(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const result = await loadOrder(admin, orderId);
  if (result.error) return json({ ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json({ ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }

  const fileType = body.file_type;
  const mimeType = typeof body.mime_type === "string" ? body.mime_type.toLowerCase().trim() : "";
  const fileBase64 = typeof body.file_base64 === "string" ? body.file_base64 : "";
  const isPhoto = fileType === "photo";
  if (!isPhoto && fileType !== "audio") {
    return json({ ok: false, message: "Tipe file tidak didukung." }, 400);
  }

  const allowed = isPhoto ? PHOTO_TYPES.has(mimeType) : Boolean(AUDIO_EXTENSIONS[mimeType]);
  const maxBytes = isPhoto ? PHOTO_MAX_BYTES : AUDIO_MAX_BYTES;
  if (!allowed) return json({ ok: false, message: "Format file tidak didukung." }, 415);
  if (!fileBase64 || fileBase64.length > Math.ceil(maxBytes * 4 / 3) + 8) {
    return json({ ok: false, message: "Ukuran file melebihi batas." }, 413);
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(fileBase64);
    if (binary.length === 0 || binary.length > maxBytes) {
      return json({ ok: false, message: "Ukuran file melebihi batas." }, 413);
    }
    bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return json({ ok: false, message: "Data file tidak valid." }, 400);
  }

  const bucket = isPhoto ? "product-images" : "vault-media";
  const filePath = isPhoto
    ? `vault/${orderId}/polaroid.webp`
    : `vault/${orderId}/audio.${AUDIO_EXTENSIONS[mimeType]}`;
  const { error: uploadError } = await admin.storage.from(bucket).upload(filePath, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (uploadError) {
    console.error("[VAULT_SETUP_UPLOAD_ERROR]", uploadError.message);
    return json({ ok: false, message: "Gagal mengunggah media. Silakan coba lagi." }, 502);
  }
  const { data } = admin.storage.from(bucket).getPublicUrl(filePath);
  return json({ ok: true, publicUrl: data.publicUrl });
}

async function handleSave(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const result = await loadOrder(admin, orderId);
  if (result.error) return json({ ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json({ ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }

  const existingPin = typeof result.order.vault_pin === "string" ? result.order.vault_pin.trim() : "";
  const pin = /^\d{6}$/.test(existingPin) ? existingPin : generateSecurePin();

  const audioDuration = Number(body.audio_durasi);
  const update = {
    personal_message: cleanText(body.personal_message, 2000),
    foto_vault: cleanText(body.foto_vault, 2048),
    audio_url: cleanText(body.audio_url, 2048),
    audio_durasi: Number.isFinite(audioDuration) ? Math.max(0, Math.min(86_400, Math.round(audioDuration))) : 0,
    video_url: cleanText(body.video_url, 2048),
    vault_submitted_at: new Date().toISOString(),
    vault_pin: pin,
  };
  const { error: updateError } = await admin
    .from("preorder_orders")
    .update(update)
    .eq("id", orderId);
  if (updateError) {
    console.error("[VAULT_SETUP_SAVE_ERROR] Could not save order vault:", updateError.message);
    return json({ ok: false, message: "Gagal menyimpan Memory Vault." }, 500);
  }

  const { error: productError } = await admin
    .from("products")
    .update({
      foto_vault: update.foto_vault,
      audio_url: update.audio_url,
      audio_durasi: update.audio_durasi,
      video_url: update.video_url,
      pesan_personal: update.personal_message,
      vault_pin: pin,
    })
    .eq("order_id", orderId);
  if (productError) {
    console.error("[VAULT_SETUP_SAVE_ERROR] Could not sync linked product:", productError.message);
    return json({ ok: false, message: "Kenangan tersimpan, tetapi sinkronisasi produk gagal. Hubungi atelier Floramory." }, 500);
  }

  return json({
    ok: true,
    message: "Kenangan berhasil disimpan ke Memory Vault!",
    pin,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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
  if (!isOrderId(body.order_id)) return json({ ok: false, message: "ID pesanan tidak valid." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    if (body.action === "get") return await handleGet(admin, body.order_id);
    if (body.action === "upload") return await handleUpload(admin, body.order_id, body);
    if (body.action === "save") return await handleSave(admin, body.order_id, body);
    return json({ ok: false, message: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("[VAULT_SETUP_ERROR]", error instanceof Error ? error.message : "Unexpected error.");
    return json({ ok: false, message: "Gagal memproses Memory Vault." }, 500);
  }
});
