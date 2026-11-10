import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
// A Chapter — Edge Function: vault-setup
// ============================================================
// Konsol privat pengirim untuk mengisi Memory Vault.
//
// Keamanan:
//   - Link memakai `vault_setup_token` acak (64 hex) yang terpisah
//     dari order id. Link lama berbasis UUID tetap diterima agar
//     tautan yang sudah beredar tidak langsung mati.
//   - Token punya masa berlaku (`vault_setup_expires_at`).
//   - Setelah penyimpanan pertama, `vault_locked_at` diisi dan semua
//     perubahan berikutnya ditolak (423) sampai admin membuka kunci.
//   - URL media divalidasi: hanya folder vault pesanan ini di Supabase
//     Storage atau penyedia embed yang dikenal (Spotify/YouTube/Drive).
//   - PIN 6 digit disimpan sebagai hash oleh trigger database.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ORDER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SETUP_TOKEN_REGEX = /^[A-Za-z0-9_-]{16,80}$/;

const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const AUDIO_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_URL_LENGTH = 2048;
const MAX_MESSAGE_LENGTH = 2000;

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/aac": "aac",
};
const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const EMBED_HOSTS = new Set([
  "open.spotify.com",
  "spotify.com",
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "drive.google.com",
]);

const DEFAULT_ORIGIN = "https://www.achapter.my.id";
const ALLOWED_ORIGINS = new Set([
  "https://www.achapter.my.id",
  "https://achapter.my.id",
  "http://localhost:5173",
  "http://localhost:5199",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5199",
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

const ORDER_SELECT = [
  "id",
  "order_number",
  "customer_name",
  "recipient_name",
  "sender_name",
  "product_name",
  "personal_message",
  "foto_vault",
  "audio_url",
  "audio_durasi",
  "video_url",
  "status",
  "vault_submitted_at",
  "vault_pin",
  "vault_setup_token",
  "vault_setup_expires_at",
  "vault_locked_at",
].join(",");

// Rate limit per-IP (in-memory) untuk mencegah penyalahgunaan token.
const MAX_REQUESTS_PER_IP = 60;
const IP_WINDOW_MS = 10 * 60 * 1000;
const ipLimiters = new Map<string, number[]>();

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "").trim().slice(0, maxLength);
}

function generateSecurePin(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(100_000 + (buffer[0] % 900_000));
}

function isLocked(order: Record<string, unknown>): boolean {
  return Boolean(order.vault_locked_at);
}

function isExpired(order: Record<string, unknown>): boolean {
  const expiresAt = String(order.vault_setup_expires_at || "").trim();
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

/**
 * Hanya izinkan URL media dari folder vault pesanan ini di Supabase,
 * atau penyedia embed yang dikenal. Mencegah penyerang menyisipkan
 * URL eksternal/pelacak ke dalam brankas penerima.
 */
function cleanMediaUrl(value: unknown, orderId: string, allowEmbedHosts: boolean): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > MAX_URL_LENGTH) return "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";

  const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).host : "";
  if (supabaseHost && url.host === supabaseHost) {
    return url.pathname.includes(`/vault/${orderId}/`) ? raw : "";
  }

  if (!allowEmbedHosts) return "";
  return EMBED_HOSTS.has(url.host) ? raw : "";
}

async function loadOrder(admin: ReturnType<typeof createClient>, token: string) {
  let query = admin.from("preorder_orders").select(ORDER_SELECT);

  // Token baru (64 hex) tidak boleh dibandingkan dengan kolom uuid `id`
  // karena PostgREST akan gagal cast. UUID hanya untuk tautan lama.
  if (ORDER_ID_REGEX.test(token)) {
    query = query.or(`id.eq.${token},vault_setup_token.eq.${token}`);
  } else {
    query = query.eq("vault_setup_token", token);
  }

  const { data: order, error } = await query.maybeSingle();
  if (error) {
    console.error("[VAULT_SETUP_ERROR] Could not load order:", error.message);
    return { order: null, error: true };
  }
  if (!order || String(order.status || "").toLowerCase() === "cancelled") {
    return { order: null, error: false };
  }
  return { order: order as Record<string, unknown>, error: false };
}

function rejectIfClosed(req: Request, order: Record<string, unknown>, forWrite: boolean): Response | null {
  if (isExpired(order)) {
    return json(
      req,
      {
        ok: false,
        expired: true,
        message: "Link konfigurasi sudah kedaluwarsa. Hubungi atelier A Chapter untuk tautan baru.",
      },
      410
    );
  }
  if (forWrite && isLocked(order)) {
    return json(
      req,
      {
        ok: false,
        locked: true,
        message: "Memory Vault sudah dikunci. Hubungi atelier A Chapter jika ingin mengubah kenangan.",
      },
      423
    );
  }
  return null;
}

async function handleGet(
  req: Request,
  admin: ReturnType<typeof createClient>,
  token: string
): Promise<Response> {
  const result = await loadOrder(admin, token);
  if (result.error) return json(req, { ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json(req, { ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }

  const order = { ...result.order };
  // PIN tidak perlu dikirim balik ke browser; admin membacanya dari panel.
  Reflect.deleteProperty(order, "vault_pin");

  const closed = rejectIfClosed(req, result.order, false);
  if (closed) return closed;

  return json(req, {
    ok: true,
    order,
    vault_locked: isLocked(result.order),
    vault_expired: isExpired(result.order),
  });
}

async function handleGetUploadUrl(
  req: Request,
  admin: ReturnType<typeof createClient>,
  token: string,
  body: Record<string, unknown>
): Promise<Response> {
  const result = await loadOrder(admin, token);
  if (result.error) return json(req, { ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json(req, { ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }
  const closed = rejectIfClosed(req, result.order, true);
  if (closed) return closed;

  const orderId = String(result.order.id);
  const fileType = body.file_type;
  const mimeType = typeof body.mime_type === "string" ? body.mime_type.toLowerCase().trim() : "";
  const isPhoto = fileType === "photo";
  const isAudio = fileType === "audio";
  const isVideo = fileType === "video";
  if (!isPhoto && !isAudio && !isVideo) {
    return json(req, { ok: false, message: "Tipe file tidak didukung." }, 400);
  }

  const allowed = isPhoto
    ? PHOTO_TYPES.has(mimeType)
    : isAudio
      ? Boolean(AUDIO_EXTENSIONS[mimeType])
      : Boolean(VIDEO_EXTENSIONS[mimeType]);
  if (!allowed) return json(req, { ok: false, message: "Format file tidak didukung." }, 415);

  const bucket = isPhoto ? "product-images" : "vault-media";
  const filePath = isPhoto
    ? `vault/${orderId}/polaroid.${PHOTO_EXTENSIONS[mimeType] || "webp"}`
    : isAudio
      ? `vault/${orderId}/audio.${AUDIO_EXTENSIONS[mimeType] || "mp3"}`
      : `vault/${orderId}/video.${VIDEO_EXTENSIONS[mimeType] || "mp4"}`;

  const { data: signData, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(filePath, { upsert: true });

  if (signError || !signData) {
    console.error("[VAULT_SETUP_SIGN_ERROR]", signError?.message);
    return json(req, { ok: false, message: "Gagal membuat izin unggah media. Silakan coba lagi." }, 502);
  }

  const { data: pubData } = admin.storage.from(bucket).getPublicUrl(filePath);

  return json(req, {
    ok: true,
    bucket,
    filePath,
    token: signData.token,
    signedUrl: signData.signedUrl,
    publicUrl: pubData.publicUrl,
  });
}

async function handleUpload(
  req: Request,
  admin: ReturnType<typeof createClient>,
  token: string,
  body: Record<string, unknown>
): Promise<Response> {
  const result = await loadOrder(admin, token);
  if (result.error) return json(req, { ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json(req, { ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }
  const closed = rejectIfClosed(req, result.order, true);
  if (closed) return closed;

  const orderId = String(result.order.id);
  const fileType = body.file_type;
  const mimeType = typeof body.mime_type === "string" ? body.mime_type.toLowerCase().trim() : "";
  const fileBase64 = typeof body.file_base64 === "string" ? body.file_base64 : "";
  const isPhoto = fileType === "photo";
  const isAudio = fileType === "audio";
  const isVideo = fileType === "video";
  if (!isPhoto && !isAudio && !isVideo) {
    return json(req, { ok: false, message: "Tipe file tidak didukung." }, 400);
  }

  const allowed = isPhoto
    ? PHOTO_TYPES.has(mimeType)
    : isAudio
      ? Boolean(AUDIO_EXTENSIONS[mimeType])
      : Boolean(VIDEO_EXTENSIONS[mimeType]);
  const maxBytes = isPhoto ? PHOTO_MAX_BYTES : isAudio ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
  if (!allowed) return json(req, { ok: false, message: "Format file tidak didukung." }, 415);
  if (!fileBase64 || fileBase64.length > Math.ceil((maxBytes * 4) / 3) + 8) {
    return json(req, { ok: false, message: "Ukuran file melebihi batas." }, 413);
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(fileBase64);
    if (binary.length === 0 || binary.length > maxBytes) {
      return json(req, { ok: false, message: "Ukuran file melebihi batas." }, 413);
    }
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return json(req, { ok: false, message: "Data file tidak valid." }, 400);
  }

  const bucket = isPhoto ? "product-images" : "vault-media";
  const filePath = isPhoto
    ? `vault/${orderId}/polaroid.${PHOTO_EXTENSIONS[mimeType] || "webp"}`
    : isAudio
      ? `vault/${orderId}/audio.${AUDIO_EXTENSIONS[mimeType] || "mp3"}`
      : `vault/${orderId}/video.${VIDEO_EXTENSIONS[mimeType] || "mp4"}`;

  const { error: uploadError } = await admin.storage.from(bucket).upload(filePath, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (uploadError) {
    console.error("[VAULT_SETUP_UPLOAD_ERROR]", uploadError.message);
    return json(req, { ok: false, message: "Gagal mengunggah media. Silakan coba lagi." }, 502);
  }
  const { data } = admin.storage.from(bucket).getPublicUrl(filePath);
  return json(req, { ok: true, publicUrl: data.publicUrl });
}

async function handleSave(
  req: Request,
  admin: ReturnType<typeof createClient>,
  token: string,
  body: Record<string, unknown>
): Promise<Response> {
  const result = await loadOrder(admin, token);
  if (result.error) return json(req, { ok: false, message: "Gagal memuat pesanan." }, 500);
  if (!result.order) {
    return json(req, { ok: false, message: "Pesanan tidak ditemukan atau sudah dibatalkan." }, 404);
  }
  const closed = rejectIfClosed(req, result.order, true);
  if (closed) return closed;

  const orderId = String(result.order.id);
  const existingPin = String(result.order.vault_pin || "").trim();
  const requestedPin = String(body.vault_pin || "").trim();
  const pin = /^\d{6}$/.test(requestedPin)
    ? requestedPin
    : /^\d{6}$/.test(existingPin)
      ? existingPin
      : generateSecurePin();

  const personalMessage = cleanText(body.personal_message, MAX_MESSAGE_LENGTH);
  const fotoVault = cleanMediaUrl(body.foto_vault, orderId, false);
  const audioUrl = cleanMediaUrl(body.audio_url, orderId, true);
  const videoUrl = cleanMediaUrl(body.video_url, orderId, true);

  // Jika klien mengirim URL yang tidak diizinkan, tolak dengan jelas
  // daripada menyimpan tautan asing ke brankas penerima.
  const rawFoto = String(body.foto_vault || "").trim();
  const rawAudio = String(body.audio_url || "").trim();
  const rawVideo = String(body.video_url || "").trim();
  if ((rawFoto && !fotoVault) || (rawAudio && !audioUrl) || (rawVideo && !videoUrl)) {
    return json(
      req,
      { ok: false, message: "Tautan media tidak valid. Unggah ulang berkas atau gunakan tautan resmi yang didukung." },
      422
    );
  }

  const audioDuration = Number(body.audio_durasi);
  const lockedAt = new Date().toISOString();
  const vaultUpdate = {
    personal_message: personalMessage,
    foto_vault: fotoVault,
    audio_url: audioUrl,
    audio_durasi: Number.isFinite(audioDuration)
      ? Math.max(0, Math.min(86_400, Math.round(audioDuration)))
      : 0,
    video_url: videoUrl,
    vault_submitted_at: lockedAt,
    vault_locked_at: lockedAt,
    vault_pin: pin,
  };

  // Produk lebih dulu: jika sinkronisasi gagal, pesanan belum terkunci
  // sehingga pengirim bisa mencoba lagi tanpa kehilangan akses.
  const { error: productError } = await admin
    .from("products")
    .update({
      foto_vault: vaultUpdate.foto_vault,
      audio_url: vaultUpdate.audio_url,
      audio_durasi: vaultUpdate.audio_durasi,
      video_url: vaultUpdate.video_url,
      pesan_personal: vaultUpdate.personal_message,
      vault_pin: pin,
    })
    .eq("order_id", orderId);
  if (productError) {
    console.error("[VAULT_SETUP_SAVE_ERROR] Could not sync linked product:", productError.message);
    return json(
      req,
      { ok: false, message: "Gagal menyimpan kenangan ke produk. Silakan coba lagi atau hubungi atelier A Chapter." },
      500
    );
  }

  const { error: updateError } = await admin
    .from("preorder_orders")
    .update(vaultUpdate)
    .eq("id", orderId);
  if (updateError) {
    console.error("[VAULT_SETUP_SAVE_ERROR] Could not save order vault:", updateError.message);
    return json(req, { ok: false, message: "Gagal menyimpan Memory Vault." }, 500);
  }

  return json(req, {
    ok: true,
    message: "Kenangan berhasil disimpan dan dikunci ke Memory Vault!",
    pin,
    locked: true,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { ok: false, message: "Method tidak diizinkan." }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(req, { ok: false, message: "Server belum dikonfigurasi dengan benar." }, 500);
  }

  if (isIpRateLimited(getClientIp(req))) {
    return json(req, { ok: false, message: "Terlalu banyak permintaan. Silakan coba lagi nanti." }, 429);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, message: "Format data tidak valid." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(req, { ok: false, message: "Format data tidak valid." }, 400);
  }

  const body = payload as Record<string, unknown>;
  const token = String(body.order_id || body.token || "").trim();
  if (!ORDER_ID_REGEX.test(token) && !SETUP_TOKEN_REGEX.test(token)) {
    return json(req, { ok: false, message: "Token pesanan tidak valid." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (body.action === "get") return await handleGet(req, admin, token);
    if (body.action === "get-upload-url") return await handleGetUploadUrl(req, admin, token, body);
    if (body.action === "upload") return await handleUpload(req, admin, token, body);
    if (body.action === "save") return await handleSave(req, admin, token, body);
    return json(req, { ok: false, message: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("[VAULT_SETUP_ERROR]", error instanceof Error ? error.message : "Unexpected error.");
    return json(req, { ok: false, message: "Gagal memproses Memory Vault." }, 500);
  }
});
