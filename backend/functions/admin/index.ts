// ============================================================
// Floramory — Supabase Edge Function: admin
// ============================================================
// Pintu sesi admin + proxy PostgREST. Token Supabase TIDAK PERNAH
// disimpan di localStorage: sesi disimpan dalam cookie HttpOnly
// (Secure, SameSite=Strict) yang hanya bisa dibaca sisi server,
// sehingga XSS tidak bisa mencuri token.
//
// Alur:
//   Browser -> /api/* (Vercel rewrite / Vite proxy, same-origin)
//   -> Edge Function ini -> Supabase Auth / PostgREST
//
// Sesi cookie (host = origin frontend via proxy):
//   fm_at   = access_token  (1 jam,   HttpOnly, Secure, SameSite=Strict)
//   fm_rt   = refresh_token (30 hari, HttpOnly, Secure, SameSite=Strict)
//   fm_csrf = token anti-CSRF (dibaca JS, bukan HttpOnly) untuk mencegah
//             cross-site request memakai cookie sesi (defense in depth).
//
// Action yang diterima (method POST, JSON):
//   { action: "login",  email, password }
//   { action: "logout" }
//   { action: "status" }
//   { action: "proxy",  method, path, query?, body?, prefer? }
//
// Keamanan:
//   - Login memakai grant_type=password terhadap Supabase Auth (server-side),
//     lalu memvalidasi is_admin() sebelum mengeluarkan cookie.
//   - Proxy hanya mengizinkan path PostgREST tertentu dan mewajibkan sesi
//     valid + is_admin + header CSRF, lalu meneruskan pakai token PENGUNJUNG
//     asli (RLS tetap berlaku).
//   - Rate limit login per-IP (in-memory) untuk mencegah brute force.
//
// Deploy: supabase functions deploy admin
// Jangan deploy dengan --no-verify-jwt (frontend mengirim anon key sbg JWT).
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const ACCESS_COOKIE = "fm_at";
const REFRESH_COOKIE = "fm_rt";
const CSRF_COOKIE = "fm_csrf";
const ACCESS_TTL = 60 * 60; // 1 jam
const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 hari

const PROXY_PATHS = new Set([
  "/rest/v1/products",
  "/rest/v1/preorder_orders",
  "/rest/v1/app_settings",
]);

// Supabase Storage: hanya bucket product-images yang boleh diakses via
// proxy (unggah foto produk/QR). Baca publik tetap lewat CDN langsung.
const STORAGE_BUCKET = "product-images";
const STORAGE_OBJECT_PREFIX = `/storage/v1/object/${STORAGE_BUCKET}/`;

// Batas ukuran unggahan (biner, setelah decode base64). Frontend membatasi
// file asli 5 MB; edge memberi sedikit toleransi untuk hasil kompresi.
const UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

function isAllowedProxyPath(path: string): boolean {
  if (PROXY_PATHS.has(path)) return true;
  return path.startsWith(STORAGE_OBJECT_PREFIX);
}

// Rate limit login (in-memory, per-IP)
const MAX_LOGIN_ATTEMPTS = 5; // per 15 menit
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginLimiter = new Map<string, number[]>();

function json(
  data: unknown,
  status = 200,
  setCookies: string[] = [],
  extraHeaders: HeadersInit = {}
): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value !== undefined && value !== null) headers.set(key, String(value));
  }
  return new Response(JSON.stringify(data), { status, headers });
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

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const events = (loginLimiter.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (events.length >= MAX_LOGIN_ATTEMPTS) {
    loginLimiter.set(ip, events);
    return true;
  }
  events.push(now);
  loginLimiter.set(ip, events);
  return false;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
  }
  return out;
}

function isLocalHost(req: Request): boolean {
  const host = req.headers.get("host") || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0");
}

function cookieBase(req: Request): string {
  const secure = isLocalHost(req) ? "" : "Secure";
  return `Path=/; HttpOnly; SameSite=Strict; ${secure}`.trim().replace(/\s+/g, " ").trim();
}

function setTokenCookies(req: Request, accessToken: string, refreshToken: string): string[] {
  const base = cookieBase(req);
  const csrf = crypto.randomUUID();
  const csrfBase = base.replace("; HttpOnly", "");
  return [
    `${ACCESS_COOKIE}=${accessToken}; Max-Age=${ACCESS_TTL}; ${base}`,
    `${REFRESH_COOKIE}=${refreshToken}; Max-Age=${REFRESH_TTL}; ${base}`,
    `${CSRF_COOKIE}=${csrf}; Max-Age=${REFRESH_TTL}; ${csrfBase}`,
  ];
}

function clearTokenCookies(req: Request): string[] {
  const base = cookieBase(req);
  const basePublic = base.replace("; HttpOnly", "");
  return [
    `${ACCESS_COOKIE}=; Max-Age=0; ${base}`,
    `${REFRESH_COOKIE}=; Max-Age=0; ${base}`,
    `${CSRF_COOKIE}=; Max-Age=0; ${basePublic}`,
  ];
}

function safeEqual(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

async function authUser(accessToken: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token || !data.refresh_token) return null;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch {
    return null;
  }
}

async function checkIsAdmin(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

interface ResolvedSession {
  token: string;
  setCookies: string[];
}

async function resolveSession(req: Request): Promise<ResolvedSession | null> {
  const cookies = parseCookies(req);
  const accessToken = cookies[ACCESS_COOKIE];
  const refreshToken = cookies[REFRESH_COOKIE];

  if (accessToken && (await authUser(accessToken)).ok) {
    return { token: accessToken, setCookies: [] };
  }

  if (refreshToken) {
    const refreshed = await refreshTokens(refreshToken);
    if (refreshed) {
      return {
        token: refreshed.accessToken,
        setCookies: setTokenCookies(req, refreshed.accessToken, refreshed.refreshToken),
      };
    }
  }

  return null;
}

async function handleLogin(req: Request, body: Record<string, unknown>): Promise<Response> {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return json({ message: "Email dan password wajib diisi." }, 400);

  if (isLoginRateLimited(getClientIp(req))) {
    return json({ message: "Terlalu banyak percobaan login. Coba lagi nanti." }, 429);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.refresh_token) {
      return json(
        { message: data.error_description || data.msg || "Email atau password salah." },
        401
      );
    }

    if (!(await checkIsAdmin(data.access_token))) {
      return json(
        { message: "Akun Anda tidak terdaftar sebagai admin. Hubungi pemilik untuk didaftarkan di tabel admin_users." },
        403
      );
    }

    return json(
      { ok: true },
      200,
      setTokenCookies(req, data.access_token, data.refresh_token)
    );
  } catch {
    return json({ message: "Gagal menghubungi layanan autentikasi." }, 502);
  }
}

async function handleLogout(req: Request): Promise<Response> {
  return json({ ok: true }, 200, clearTokenCookies(req));
}

async function handleStatus(req: Request): Promise<Response> {
  const session = await resolveSession(req);
  if (!session) {
    return json({ authenticated: false, isAdmin: false }, 200, clearTokenCookies(req));
  }
  const isAdmin = await checkIsAdmin(session.token);
  return json({ authenticated: true, isAdmin }, 200, session.setCookies);
}

async function handleProxy(req: Request, body: Record<string, unknown>): Promise<Response> {
  const cookies = parseCookies(req);

  // Validasi CSRF (double-submit): header harus cocok dengan cookie fm_csrf.
  const csrfCookie = cookies[CSRF_COOKIE] || "";
  const csrfHeader = req.headers.get("x-csrf-token") || "";
  if (!csrfCookie || !csrfHeader || !safeEqual(csrfCookie, csrfHeader)) {
    return json({ message: "Token keamanan tidak valid. Silakan muat ulang halaman." }, 403);
  }

  const session = await resolveSession(req);
  if (!session) {
    return json({ message: "Sesi admin sudah kadaluarsa. Silakan login kembali." }, 401, clearTokenCookies(req));
  }
  if (!(await checkIsAdmin(session.token))) {
    return json({ message: "Anda tidak memiliki akses admin." }, 403, session.setCookies);
  }

  const method = String(body.method || "GET").toUpperCase();
  const path = String(body.path || "");
  if (!isAllowedProxyPath(path)) {
    return json({ message: "Jalur tidak diizinkan." }, 403, session.setCookies);
  }
  if (!/^(GET|POST|PATCH|DELETE|PUT)$/.test(method)) {
    return json({ message: "Metode tidak diizinkan." }, 405, session.setCookies);
  }

  const query = typeof body.query === "string" ? body.query : "";
  const url = `${SUPABASE_URL}${path}${query ? `?${query}` : ""}`;

  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${session.token}`,
  };
  const isStorageUpload =
    path.startsWith(STORAGE_OBJECT_PREFIX) &&
    (method === "POST" || method === "PUT" || method === "PATCH");

  let fetchBody: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (isStorageUpload) {
      // Upload biner: frontend mengirim base64 + tipe MIME. Decode di sini
      // agar isi objek di storage adalah file gambar asli (bukan teks).
      const contentType = typeof body.contentType === "string" ? body.contentType : "";
      headers["Content-Type"] = contentType || "application/octet-stream";
      if (body.upsert === true) headers["x-upsert"] = "true";

      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.fromBase64(typeof body.body === "string" ? body.body : "");
      } catch {
        return json({ message: "Data gambar tidak valid." }, 400, session.setCookies);
      }
      if (bytes.byteLength > UPLOAD_MAX_BYTES) {
        return json({ message: "Ukuran gambar melebihi batas (maks. 5 MB)." }, 413, session.setCookies);
      }
      fetchBody = bytes;
    } else {
      headers["Content-Type"] = "application/json";
      fetchBody =
        typeof body.body === "string" ? body.body : JSON.stringify(body.body ?? {});
    }
  }
  if (typeof body.prefer === "string" && body.prefer) {
    headers["Prefer"] = body.prefer;
  }

  let resp: Response;
  try {
    resp = await fetch(url, { method, headers, body: fetchBody });
  } catch {
    return json({ message: "Gagal menghubungi database." }, 502, session.setCookies);
  }

  const text = await resp.text().catch(() => "");
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const contentRange = resp.headers.get("Content-Range") || "";
  return json(
    data,
    resp.status,
    session.setCookies,
    contentRange ? { "Content-Range": contentRange } : {}
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ message: "Method tidak diizinkan." }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ message: "Format data tidak valid." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ message: "Format data tidak valid." }, 400);
  }

  if (!SUPABASE_URL || !ANON_KEY) {
    return json({ message: "Server belum dikonfigurasi dengan benar." }, 500);
  }

  const payload = body as Record<string, unknown>;
  switch (payload.action) {
    case "login":
      return handleLogin(req, payload);
    case "logout":
      return handleLogout(req);
    case "status":
      return handleStatus(req);
    case "proxy":
      return handleProxy(req, payload);
    default:
      return json({ message: "Aksi tidak dikenal." }, 400);
  }
});