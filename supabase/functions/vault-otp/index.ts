import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkDbRateLimit } from "../_shared/rate-limit.ts";

// ============================================================
// A Chapter — Edge Function: vault-otp
// ============================================================
// Satu-satunya pintu untuk membaca isi Memory Vault. Kolom sensitif
// (surat, foto, audio, video, nama penerima) sudah dicabut dari role
// anon, jadi PIN benar-benar menjadi gerbang akses — bukan sekadar
// lapisan UI.
//
// Aksi:
//   { action: "preview", product_id }
//     -> metadata aman + has_pin/has_vault. Jika produk tidak punya
//        PIN, isi vault ikut dikembalikan (memang tidak terkunci).
//   { action: "open", product_id, pin }        -> verifikasi PIN
//   { action: "open", product_id, token }      -> buka ulang sesi 30 menit
//
// PIN disimpan sebagai SHA-256(PIN + ":" + product_id) di kolom
// products.vault_pin_hash (diisi trigger database). Perbandingan
// dilakukan constant-time. Setelah 5 percobaan salah, produk terkunci
// 15 menit.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const UNLOCK_SECRET = Deno.env.get("VAULT_UNLOCK_SECRET") || SERVICE_ROLE_KEY;

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

const PRODUCT_SELECT = [
  "id",
  "nama_produk",
  "tier",
  "harga",
  "deskripsi",
  "foto_produk",
  "foto_qr",
  "is_catalog",
  "status",
  "nama_pembeli",
  "dari",
  "pesan_personal",
  "foto_vault",
  "audio_url",
  "audio_durasi",
  "video_url",
  "vault_pin",
  "vault_pin_hash",
  "pin_attempts",
  "pin_locked_until",
].join(",");

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const UNLOCK_TTL_MS = 30 * 60 * 1000;

// Rate limit per-IP (in-memory). Melindungi preview & percobaan PIN
// dari enumerasi cepat. Lockout PIN per produk tetap menjadi lapisan
// utama di database.
const MAX_REQUESTS_PER_IP = 40;
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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPin(productId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${pin.trim()}:${productId}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(UNLOCK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function signUnlockToken(productId: string): Promise<string> {
  const expiresAt = Date.now() + UNLOCK_TTL_MS;
  const payload = `${productId}.${expiresAt}`;
  return `${payload}.${await hmac(payload)}`;
}

async function verifyUnlockToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [productId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!productId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const expected = await hmac(`${productId}.${expiresAtRaw}`);
  return safeEqual(expected, signature) ? productId : null;
}

type ProductRow = Record<string, unknown>;

function publicProduct(product: ProductRow): Record<string, unknown> {
  return {
    id: product.id,
    nama_produk: product.nama_produk,
    tier: product.tier,
    harga: product.harga,
    deskripsi: product.deskripsi,
    foto_produk: product.foto_produk,
    foto_qr: product.foto_qr,
    is_catalog: product.is_catalog,
    // Nama penerima & pengirim dibutuhkan untuk dedikasi di halaman
    // sebelum PIN dimasukkan. Isi surat/media tetap terkunci.
    nama_pembeli: product.nama_pembeli,
    dari: product.dari,
  };
}

function vaultProduct(product: ProductRow): Record<string, unknown> {
  return {
    ...publicProduct(product),
    pesan_personal: product.pesan_personal,
    foto_vault: product.foto_vault,
    audio_url: product.audio_url,
    audio_durasi: product.audio_durasi,
    video_url: product.video_url,
  };
}

function hasPin(product: ProductRow): boolean {
  const hash = String(product.vault_pin_hash || "").trim();
  const plain = String(product.vault_pin || "").trim();
  return Boolean(hash || plain);
}

function hasVault(product: ProductRow): boolean {
  return Boolean(
    String(product.foto_vault || "").trim() ||
      String(product.audio_url || "").trim() ||
      String(product.video_url || "").trim() ||
      String(product.pesan_personal || "").trim()
  );
}

function isLocked(product: ProductRow): boolean {
  const lockedUntil = String(product.pin_locked_until || "").trim();
  if (!lockedUntil) return false;
  const timestamp = new Date(lockedUntil).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function normalizeProductId(value: unknown): string {
  const id = String(value || "").trim().toUpperCase();
  return id.length > 0 && id.length <= 120 ? id : "";
}

async function loadProduct(
  admin: ReturnType<typeof createClient>,
  productId: string
): Promise<{ product: ProductRow | null; error: boolean }> {
  const { data, error } = await admin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[VAULT_PIN_ERROR] Could not load product:", error.message);
    return { product: null, error: true };
  }
  return { product: (data as ProductRow | null) ?? null, error: false };
}

async function handlePreview(
  req: Request,
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>
): Promise<Response> {
  const productId = normalizeProductId(body.product_id);
  if (!productId) return json(req, { ok: false, message: "ID produk tidak valid." }, 400);

  const { product, error } = await loadProduct(admin, productId);
  if (error) return json(req, { ok: false, message: "Gagal memuat brankas." }, 500);
  if (!product) return json(req, { ok: false, message: "Brankas tidak ditemukan." }, 404);

  const locked = isLocked(product);
  const payload: Record<string, unknown> = {
    ok: true,
    product: publicProduct(product),
    has_pin: hasPin(product),
    has_vault: hasVault(product),
    locked,
  };

  // Produk tanpa PIN memang tidak pernah terkunci (mis. katalog biasa).
  if (!hasPin(product)) {
    payload.unlocked = true;
    payload.product = vaultProduct(product);
  }

  return json(req, payload);
}

async function handleOpen(
  req: Request,
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>
): Promise<Response> {
  const productId = normalizeProductId(body.product_id);
  if (!productId) return json(req, { ok: false, message: "ID produk tidak valid." }, 400);

  const pin = String(body.pin ?? body.otp_code ?? "").trim();
  const token = String(body.token ?? "").trim();
  if (!pin && !token) {
    return json(req, { ok: false, verified: false, message: "PIN atau sesi brankas wajib diisi." }, 400);
  }

  const { product, error } = await loadProduct(admin, productId);
  if (error) return json(req, { ok: false, verified: false, message: "Gagal memuat brankas." }, 500);
  if (!product) return json(req, { ok: false, verified: false, message: "Brankas tidak ditemukan." }, 404);

  const canonicalId = String(product.id || productId);

  // Jalur sesi: token HMAC 30 menit, diterbitkan setelah PIN valid.
  if (token) {
    const tokenProductId = await verifyUnlockToken(token);
    if (tokenProductId && tokenProductId === canonicalId) {
      return json(req, {
        ok: true,
        verified: true,
        product: vaultProduct(product),
        token: await signUnlockToken(canonicalId),
      });
    }
    if (!pin) {
      return json(
        req,
        { ok: false, verified: false, message: "Sesi brankas sudah kedaluwarsa. Masukkan PIN kembali." },
        401
      );
    }
  }

  if (!/^\d{6}$/.test(pin)) {
    return json(req, { ok: false, verified: false, message: "PIN harus berupa 6 digit angka." }, 400);
  }

  if (isLocked(product)) {
    return json(
      req,
      {
        ok: false,
        verified: false,
        locked: true,
        message: `Terlalu banyak percobaan salah. Coba lagi dalam ${LOCK_MINUTES} menit.`,
      },
      429
    );
  }

  // Lockout lama yang sudah lewat: mulai dari nol lagi.
  let attempts = Number(product.pin_attempts) || 0;
  if (product.pin_locked_until && !isLocked(product)) attempts = 0;

  const storedHash = String(product.vault_pin_hash || "").trim();
  const legacyPin = String(product.vault_pin || "").trim();
  const expectedHash = storedHash || (legacyPin ? await hashPin(canonicalId, legacyPin) : "");
  const submittedHash = await hashPin(canonicalId, pin);
  const isMatch = expectedHash.length === 64 && safeEqual(expectedHash, submittedHash);

  if (isMatch) {
    const { error: resetError } = await admin
      .from("products")
      .update({ pin_attempts: 0, pin_locked_until: null })
      .eq("id", product.id);

    if (resetError) {
      console.error("[VAULT_PIN_ERROR] Could not reset pin attempts:", resetError.message);
      return json(req, { ok: false, verified: false, message: "Gagal menyimpan verifikasi PIN." }, 500);
    }

    return json(req, {
      ok: true,
      verified: true,
      product: vaultProduct(product),
      token: await signUnlockToken(canonicalId),
    });
  }

  const nextAttempts = attempts + 1;
  const locked = nextAttempts >= MAX_ATTEMPTS;
  const lockedUntil = locked
    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
    : null;

  const { error: updateError } = await admin
    .from("products")
    .update({
      pin_attempts: nextAttempts,
      pin_locked_until: lockedUntil,
    })
    .eq("id", product.id);

  if (updateError) {
    console.error("[VAULT_PIN_ERROR] Could not update pin attempts:", updateError.message);
    return json(req, { ok: false, verified: false, message: "Gagal mencatat percobaan PIN." }, 500);
  }

  return json(
    req,
    {
      ok: false,
      verified: false,
      locked,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - nextAttempts),
      message: locked
        ? `Terlalu banyak percobaan salah. Brankas terkunci ${LOCK_MINUTES} menit.`
        : "PIN tidak cocok. Silakan periksa kembali angka di balik stiker gosok kartu kamu.",
    },
    locked ? 429 : 400
  );
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

  const clientIp = getClientIp(req);
  if (isIpRateLimited(clientIp)) {
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
  const action = String(body.action || (body.pin || body.token ? "open" : "preview")).toLowerCase();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!(await checkDbRateLimit(admin, "vault-otp-ip", clientIp, MAX_REQUESTS_PER_IP, 10 * 60))) {
    return json(req, { ok: false, message: "Terlalu banyak permintaan. Silakan coba lagi nanti." }, 429);
  }

  try {
    if (action === "preview") return await handlePreview(req, admin, body);
    if (action === "open" || action === "verify") return await handleOpen(req, admin, body);
    return json(req, { ok: false, message: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error(
      "[VAULT_PIN_ERROR]",
      error instanceof Error ? error.message : "Unexpected error."
    );
    return json(req, { ok: false, message: "Gagal memproses verifikasi PIN." }, 500);
  }
});
