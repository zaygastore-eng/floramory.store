import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkDbRateLimit } from "../_shared/rate-limit.ts";

// ============================================================
// A Chapter — Edge Function: order-status
// ============================================================
// Pelacakan status pesanan mandiri oleh pelanggan menggunakan
// nomor pesanan (GRP-... atau ORD-...) + 4 digit terakhir nomor
// WhatsApp pemesan.
//
// Keamanan:
//   - Rate limit in-memory + DB per IP.
//   - Tidak pernah mengembalikan alamat lengkap, no. WA penuh,
//     atau angka PIN Memory Vault.
//   - Tautan /vault-setup hanya dikembalikan bila DP 50% sudah
//     terverifikasi, vault belum dikunci, dan belum kedaluwarsa.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

const ORDER_NUMBER_REGEX = /^(?:GRP|ORD)-[A-Z0-9-]{4,32}$/;
const LAST4_REGEX = /^\d{4}$/;

const MAX_REQUESTS_PER_IP = 30;
const IP_WINDOW_MS = 10 * 60 * 1000;
const ipLimiters = new Map<string, number[]>();

const DP_VERIFIED_STATUSES = new Set([
  "dp_verified",
  "in_production",
  "in_progress",
  "completed",
  "paid",
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizePhoneDigits(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "");
}

function isExpired(expiresAt: unknown): boolean {
  const raw = String(expiresAt || "").trim();
  if (!raw) return false;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) && ts < Date.now();
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
    return json(req, { ok: false, message: "Terlalu banyak permintaan. Coba lagi nanti." }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, message: "Format data tidak valid." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(req, { ok: false, message: "Format data tidak valid." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const orderNumber = String(payload.order_number || "")
    .trim()
    .toUpperCase()
    .replace(/^#/, "");
  const phoneLast4 = normalizePhoneDigits(payload.phone_last4);

  if (!ORDER_NUMBER_REGEX.test(orderNumber) || !LAST4_REGEX.test(phoneLast4)) {
    return json(
      req,
      {
        ok: false,
        message: "Masukkan nomor pesanan (mis. GRP-... atau ORD-...) dan 4 digit terakhir WhatsApp Anda.",
      },
      400
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!(await checkDbRateLimit(admin, "order-status-ip", clientIp, MAX_REQUESTS_PER_IP, 10 * 60))) {
    return json(req, { ok: false, message: "Terlalu banyak permintaan. Coba lagi nanti." }, 429);
  }

  try {
    const selectCols = [
      "id",
      "order_number",
      "group_number",
      "customer_name",
      "whatsapp",
      "product_name",
      "nuansa",
      "inisial",
      "status",
      "dp_amount",
      "total_amount",
      "group_dp_amount",
      "group_total_amount",
      "created_at",
      "dp_verified_at",
      "vault_locked_at",
      "vault_setup_token",
      "vault_setup_expires_at",
    ].join(",");

    const filterCol = orderNumber.startsWith("GRP-") ? "group_number" : "order_number";
    const { data, error } = await admin
      .from("preorder_orders")
      .select(selectCols)
      .eq(filterCol, orderNumber)
      .order("group_item_index", { ascending: true });

    if (error) {
      console.error("[ORDER_STATUS_ERROR]", error.message);
      return json(req, { ok: false, message: "Gagal memeriksa status pesanan." }, 500);
    }

    const rows = Array.isArray(data) ? data : [];
    const matched = rows.filter((row) => {
      const digits = normalizePhoneDigits((row as Record<string, unknown>).whatsapp);
      return digits.length >= 4 && safeEqual(digits.slice(-4), phoneLast4);
    });

    if (matched.length === 0) {
      return json(
        req,
        {
          ok: false,
          message: "Pesanan tidak ditemukan atau 4 digit terakhir nomor WhatsApp tidak sesuai.",
        },
        404
      );
    }

    const first = matched[0] as Record<string, unknown>;
    const items = matched.map((raw) => {
      const row = raw as Record<string, unknown>;
      const status = String(row.status || "new").trim().toLowerCase();
      const dpVerified = DP_VERIFIED_STATUSES.has(status);
      const locked = Boolean(row.vault_locked_at);
      const expired = isExpired(row.vault_setup_expires_at);
      const setupToken = String(row.vault_setup_token || row.id || "").trim();

      return {
        order_number: String(row.order_number || ""),
        product_name: String(row.product_name || ""),
        nuansa: String(row.nuansa || ""),
        inisial: String(row.inisial || ""),
        status,
        dp_verified_at: row.dp_verified_at || null,
        vault_locked: locked,
        vault_setup_url:
          dpVerified && !locked && !expired && setupToken
            ? `/vault-setup?token=${encodeURIComponent(setupToken)}`
            : null,
      };
    });

    return json(req, {
      ok: true,
      summary: {
        group_number: String(first.group_number || first.order_number || orderNumber),
        customer_name: String(first.customer_name || ""),
        status: String(first.status || "new").trim().toLowerCase(),
        total_amount: Number(first.group_total_amount || first.total_amount || 0),
        dp_amount: Number(first.group_dp_amount || first.dp_amount || 0),
        created_at: first.created_at || null,
        dp_verified_at: first.dp_verified_at || null,
        item_count: items.length,
      },
      items,
    });
  } catch (err) {
    console.error("[ORDER_STATUS_ERROR]", err instanceof Error ? err.message : "Unexpected error.");
    return json(req, { ok: false, message: "Gagal memeriksa status pesanan." }, 500);
  }
});
