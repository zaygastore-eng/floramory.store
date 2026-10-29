import * as Sentry from "@sentry/react";
import { normalizeWhatsApp } from "@/lib/site";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
const FALLBACK_WA_NUMBER = String(import.meta.env.VITE_WA_NUMBER || "6285235242425");

const FUNCTIONS_BASE_URL = String(import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "")
  .replace(/\/$/, "");
const FUNCTIONS_BASE = FUNCTIONS_BASE_URL ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : `${SUPABASE_URL}/functions/v1`);
const PREORDER_FUNCTION = `${FUNCTIONS_BASE}/send-preorder`;
const ADMIN_FUNCTION = `${FUNCTIONS_BASE}/admin`;

export interface Product {
  id: string;
  nama_produk: string;
  tier: string;
  harga: string;
  bunga: string;
  deskripsi: string;
  bahan: string;
  ukuran: string;
  nama_pembeli: string;
  dari: string;
  pesan_personal: string;
  foto_produk: string;
  foto_qr: string;
  status?: string;
}

export interface PreOrder {
  id?: string;
  customer_name: string;
  whatsapp: string;
  product_id: string;
  product_name: string;
  custom_request: string;
  recipient_name: string;
  sender_name: string;
  personal_message: string;
  status?: string;
  created_at?: string;
}

let cachedProducts: Product[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;
// Cache katalog kosong lebih singkat agar produk baru dari admin
// tetap cepat muncul, tapi tetap mencegah fetch berulang saat kosong.
const EMPTY_CACHE_TTL = 15_000;

// Katalog publik diambil bertahap (pagination): tiap request ke
// Supabase dibatasi 20 baris via limit/offset, bukan mengunduh
// seluruh tabel sekaligus. MAX_PAGES hanya penjaga agar loop
// tidak berjalan tak terbatas (20 x 50 = maks. 1000 produk).
const PUBLIC_PRODUCTS_PAGE_SIZE = 20;
const PUBLIC_PRODUCTS_MAX_PAGES = 50;

// Admin: halaman per request + kolom eksplisit (bukan select=*).
const MANAGED_PRODUCTS_PAGE_SIZE = 50;
const MANAGED_PRODUCTS_MAX_PAGES = 20; // 50 x 20 = maks 1000 produk
const PREORDER_PAGE_SIZE = 25;

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function supabaseHeaders(accessToken?: string): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const chunk = part.trim();
    if (chunk.startsWith(prefix)) {
      return decodeURIComponent(chunk.slice(prefix.length));
    }
  }
  return "";
}

function adminCsrfToken(): string {
  const token = readCookie("fm_csrf");
  if (!token) throw new Error("Token keamanan tidak tersedia. Silakan muat ulang halaman.");
  return token;
}

async function adminCall(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<{ status: number; data: Record<string, unknown>; headers: Headers }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi");
  }

  const res = await fetch(ADMIN_FUNCTION, {
    method: "POST",
    credentials: "include",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "X-CSRF-Token": action === "proxy" ? adminCsrfToken() : "",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

// --- Unggah foto produk ke Supabase Storage ---
// Foto dikompresi & di-resize di sisi browser dulu (WebP), sehingga
// ukuran yang masuk ke storage terbatas dan format sudah modern.
// File asli dibatasi maks. 5 MB — diperiksa lagi di edge function.
export const IMAGE_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
export const IMAGE_UPLOAD_MAX_DIMENSION = 1600;

// Validasi MIME whitelist saat upload — format lain (svg, heic, ikon
// aneh) ditolak karena tidak bisa dikompresi konsisten ke WebP.
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

function resizeImageToWebP(file: File, maxDim: number): Promise<Blob> {
  return createImageBitmap(file).then((bitmap) => {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return Promise.reject(new Error("Canvas tidak didukung di browser ini."));
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) return resolve(blob);
          canvas.toBlob(
            (fallback) => {
              if (fallback) return resolve(fallback);
              reject(new Error("Gagal mengompresi gambar. Coba format JPG/PNG."));
            },
            "image/jpeg",
            0.85
          );
        },
        "image/webp",
        0.82
      );
    });
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      resolve(raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw);
    };
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(blob);
  });
}

export type ProductImageField = "produk" | "qr";

// Unggah lewat edge function admin (sesi cookie, tanpa mengekspos token
// user di browser). Mengembalikan URL public Supabase Storage yang akan
// otomatis di-optimasi CDN oleh productImageUrl().
export async function uploadProductImage(
  productId: string,
  field: ProductImageField,
  file: File
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi");
  }
  const id = productId.trim();
  if (!id) throw new Error("Isi ID produk terlebih dahulu sebelum unggah foto.");
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Tipe file tidak didukung. Gunakan JPG/PNG/WebP/AVIF/GIF.");
  }
  if (file.size > IMAGE_UPLOAD_LIMIT_BYTES) {
    throw new Error("Ukuran gambar maks. 5 MB.");
  }

  const compressed = await resizeImageToWebP(file, IMAGE_UPLOAD_MAX_DIMENSION);
  const base64 = await blobToBase64(compressed);
  const safeId = encodeURIComponent(id);
  const path = `/storage/v1/object/product-images/${safeId}/${field}.webp`;

  const { status, data } = await adminCall("proxy", {
    method: "PUT",
    path,
    body: base64,
    contentType: compressed.type || "image/webp",
    upsert: true,
  });

  if (status >= 400) {
    const msg =
      String(data.message || data.Message || data.error || "").trim() ||
      "Gagal mengunggah gambar. Periksa sesi admin.";
    throw new Error(msg);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${safeId}/${field}.webp`;
}

export function hasSupabaseConfig(): boolean {
  return isSupabaseConfigured();
}

export interface AdminSessionStatus {
  authenticated: boolean;
  isAdmin: boolean;
}

export async function statusAdminSession(): Promise<AdminSessionStatus> {
  if (!isSupabaseConfigured()) {
    return { authenticated: false, isAdmin: false };
  }
  try {
    const { data } = await adminCall("status");
    return {
      authenticated: data.authenticated === true,
      isAdmin: data.isAdmin === true,
    };
  } catch {
    return { authenticated: false, isAdmin: false };
  }
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi");
  }

  const { status, data } = await adminCall("login", { email, password });
  if (status !== 200) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Login Supabase gagal"
    );
  }
}

export async function signOutAdmin(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await adminCall("logout");
  } catch {
    return;
  }
}

async function adminRequest(
  method: string,
  path: string,
  opts: { query?: string; body?: unknown; prefer?: string } = {}
): Promise<any> {
  const { status, data } = await adminCall("proxy", {
    method,
    path,
    query: opts.query || "",
    body: opts.body !== undefined ? opts.body : null,
    prefer: opts.prefer || "",
  });

  if (status === 401) {
    throw new Error("Sesi admin sudah kadaluarsa. Silakan login kembali.");
  }
  if (status === 403) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Akses admin ditolak."
    );
  }
  if (status >= 400) {
    const msg = String(data.message || data.details || data.hint || "");
    throw new Error(msg || "Gagal memproses permintaan admin.");
  }

  return data;
}

export async function fetchWhatsAppNumber(): Promise<string> {
  if (!isSupabaseConfigured()) return FALLBACK_WA_NUMBER;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.wa_number&select=value&limit=1`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return FALLBACK_WA_NUMBER;
    const data = await res.json();
    const value = Array.isArray(data) ? data[0]?.value : "";
    return String(value || FALLBACK_WA_NUMBER).trim();
  } catch {
    return FALLBACK_WA_NUMBER;
  }
}

export async function updateWhatsAppNumber(value: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const clean = value.trim();
  await adminRequest("POST", "/rest/v1/app_settings", {
    query: "on_conflict=key",
    prefer: "resolution=merge-duplicates",
    body: {
      key: "wa_number",
      value: clean,
      updated_at: new Date().toISOString(),
    },
  });
}

function normalizeTierValue(tier: string): string {
  const normalized = String(tier || "classic").trim().toLowerCase();
  const tierMap: Record<string, string> = {
    lite: "classic",
    home: "masterpiece",
  };
  return tierMap[normalized] || normalized;
}

function tierToDbValue(tier: string): string {
  const normalized = normalizeTierValue(tier);
  const legacyMap: Record<string, string> = {
    classic: "lite",
    signature: "signature",
    masterpiece: "home",
  };
  return legacyMap[normalized] || normalized;
}

function normalizeProduct(obj: Partial<Product> & Record<string, unknown>): Product {
  return {
    id: String(obj.id || "").trim(),
    nama_produk: String(obj.nama_produk || "").trim(),
    tier: normalizeTierValue(String(obj.tier || "classic")),
    harga: String(obj.harga || "").trim(),
    bunga: String(obj.bunga || "").trim(),
    deskripsi: String(obj.deskripsi || "").trim(),
    bahan: String(obj.bahan || "").trim(),
    ukuran: String(obj.ukuran || "").trim(),
    nama_pembeli: String(obj.nama_pembeli || "").trim(),
    dari: String(obj.dari || "").trim(),
    pesan_personal: String(obj.pesan_personal || "").trim(),
    foto_produk: String(obj.foto_produk || "").trim(),
    foto_qr: String(obj.foto_qr || obj.foto_QR || "").trim(),
    status: String(obj.status || "active").trim(),
  };
}

function productPayload(product: Product, status = product.status || "active", useLegacyTier = false) {
  return {
    id: product.id.trim(),
    nama_produk: product.nama_produk.trim(),
    tier: useLegacyTier ? tierToDbValue(product.tier) : normalizeTierValue(product.tier),
    harga: product.harga.trim(),
    bunga: product.bunga.trim(),
    deskripsi: product.deskripsi.trim(),
    bahan: product.bahan.trim(),
    ukuran: product.ukuran.trim(),
    nama_pembeli: product.nama_pembeli.trim(),
    dari: product.dari.trim(),
    pesan_personal: product.pesan_personal.trim(),
    foto_produk: product.foto_produk.trim(),
    foto_qr: product.foto_qr.trim(),
    status,
  };
}

function normalizePreOrder(obj: Partial<PreOrder> & Record<string, unknown>): PreOrder {
  return {
    id: String(obj.id || "").trim(),
    customer_name: String(obj.customer_name || "").trim(),
    whatsapp: String(obj.whatsapp || "").trim(),
    product_id: String(obj.product_id || "").trim(),
    product_name: String(obj.product_name || "").trim(),
    custom_request: String(obj.custom_request || "").trim(),
    recipient_name: String(obj.recipient_name || "").trim(),
    sender_name: String(obj.sender_name || "").trim(),
    personal_message: String(obj.personal_message || "").trim(),
    status: String(obj.status || "new").trim(),
    created_at: String(obj.created_at || "").trim(),
  };
}

async function fetchProductsFromSupabase(): Promise<Product[] | null> {
  if (!isSupabaseConfigured()) return null;

  const all: Product[] = [];
  try {
    for (let page = 0; page < PUBLIC_PRODUCTS_MAX_PAGES; page++) {
      const offset = page * PUBLIC_PRODUCTS_PAGE_SIZE;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=id,nama_produk,tier,harga,bunga,deskripsi,bahan,ukuran,nama_pembeli,dari,pesan_personal,foto_produk,foto_qr,status&status=eq.active&order=created_at.desc&limit=${PUBLIC_PRODUCTS_PAGE_SIZE}&offset=${offset}`,
        { headers: supabaseHeaders() }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      const rows = data
        .map(normalizeProduct)
        .filter((p: Product) => p.id && p.nama_produk);
      all.push(...rows);
      if (rows.length < PUBLIC_PRODUCTS_PAGE_SIZE) break;
    }
    // [] (katalog kosong) = sukse; null = gagal/error.
    return all;
  } catch (error) {
    if (import.meta.env.PROD) {
      console.error(error);
    }
    return null;
  }
}

export async function fetchAllProducts(): Promise<Product[]> {
  const cached = cachedProducts;
  // Katalog kosong juga di-cache (dengan umur lebih pendek) supaya
  // request berikutnya tidak mengulang fetch ke Supabase saat belum
  // ada produk. Kegagalan (null) TIDAK di-cache.
  const ttl = cached && cached.length === 0 ? EMPTY_CACHE_TTL : CACHE_TTL;
  if (cached && Date.now() - cacheTime < ttl) {
    return cached;
  }

  const supabaseProducts = await fetchProductsFromSupabase();
  if (supabaseProducts !== null) {
    cachedProducts = supabaseProducts;
    cacheTime = Date.now();
    return cachedProducts;
  }

  return cachedProducts || [];
}

// Kolom eksplisit (bukan select=*). created_at/updated_at terakhir
// tidak diambil: tidak dipakai UI admin.
const MANAGED_PRODUCTS_SELECT =
  "id,nama_produk,tier,harga,bunga,deskripsi,bahan,ukuran,nama_pembeli,dari,pesan_personal,foto_produk,foto_qr,status";

export async function fetchManagedProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    return fetchAllProducts();
  }

  const all: Product[] = [];
  for (let page = 0; page < MANAGED_PRODUCTS_MAX_PAGES; page++) {
    const offset = page * MANAGED_PRODUCTS_PAGE_SIZE;
    const data = await adminRequest("GET", "/rest/v1/products", {
      query:
        `select=${MANAGED_PRODUCTS_SELECT}&order=created_at.desc&limit=${MANAGED_PRODUCTS_PAGE_SIZE}&offset=${offset}`,
    });
    if (!Array.isArray(data)) {
      throw new Error("Gagal memuat daftar produk");
    }
    const rows = data
      .map(normalizeProduct)
      .filter((p: Product) => p.id && p.nama_produk);
    all.push(...rows);
    if (rows.length < MANAGED_PRODUCTS_PAGE_SIZE) break;
  }
  return all;
}

export async function fetchProductById(id: string): Promise<Product | null> {
  if (!id || id.length > 120 || !isSupabaseConfigured()) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&status=eq.active&select=id,nama_produk,tier,harga,bunga,deskripsi,bahan,ukuran,nama_pembeli,dari,pesan_personal,foto_produk,foto_qr,status&limit=1`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const normalized = normalizeProduct(row);
    return normalized.id ? normalized : null;
  } catch {
    return null;
  }
}

export async function createProduct(product: Product): Promise<Product> {
  if (!isSupabaseConfigured()) {
    throw new Error("Simpan produk hanya tersedia saat Supabase aktif");
  }

  try {
    const data = await adminRequest("POST", "/rest/v1/products", {
      prefer: "return=representation",
      body: productPayload(product, "active"),
    });
    cachedProducts = null;
    return normalizeProduct(Array.isArray(data) ? data[0] : data);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : "";
    if (isTierConstraintError(errorText)) {
      const retry = await adminRequest("POST", "/rest/v1/products", {
        prefer: "return=representation",
        body: productPayload(product, "active", true),
      });
      cachedProducts = null;
      return normalizeProduct(Array.isArray(retry) ? retry[0] : retry);
    }
    throw error;
  }
}

export async function updateProduct(id: string, product: Product): Promise<Product> {
  if (!isSupabaseConfigured()) {
    throw new Error("Update produk hanya tersedia saat Supabase aktif");
  }

  const body = {
    ...productPayload(product, product.status || "active"),
    id,
    updated_at: new Date().toISOString(),
  };

  try {
    const data = await adminRequest("PATCH", `/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
      prefer: "return=representation",
      body,
    });
    cachedProducts = null;
    return normalizeProduct(Array.isArray(data) ? data[0] : data);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : "";
    if (isTierConstraintError(errorText)) {
      const retry = await adminRequest("PATCH", `/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
        prefer: "return=representation",
        body: {
          ...productPayload(product, product.status || "active", true),
          id,
          updated_at: new Date().toISOString(),
        },
      });
      cachedProducts = null;
      return normalizeProduct(Array.isArray(retry) ? retry[0] : retry);
    }
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Hapus produk hanya tersedia saat Supabase aktif");
  }

  await adminRequest("PATCH", `/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    body: {
      status: "archived",
      updated_at: new Date().toISOString(),
    },
  });
  cachedProducts = null;
}

export interface PreOrderSubmitMeta {
  honeypot?: string;
  fillMs?: number;
}

export async function createPreOrder(
  order: PreOrder,
  meta: PreOrderSubmitMeta = {}
): Promise<PreOrder> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi untuk menerima pre-order");
  }

  const res = await fetch(PREORDER_FUNCTION, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_name: order.customer_name.trim(),
      whatsapp: normalizeWhatsApp(order.whatsapp),
      product_id: order.product_id.trim(),
      product_name: (order.product_name || "").trim(),
      custom_request: (order.custom_request || "").trim(),
      recipient_name: (order.recipient_name || "").trim(),
      sender_name: (order.sender_name || "").trim(),
      personal_message: (order.personal_message || "").trim(),
      website: meta.honeypot || "",
      fill_ms: Number.isFinite(meta.fillMs) ? meta.fillMs : 0,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 429) {
    throw new Error(data.message || "Terlalu banyak permintaan. Silakan coba lagi nanti.");
  }

  if (!res.ok) {
    const firstError =
      Array.isArray(data.errors) && data.errors.length > 0
        ? data.errors[0]?.message
        : undefined;
    throw new Error(firstError || data.message || "Gagal mengirim pre-order");
  }

  return normalizePreOrder({ ...order, id: data.id || "" });
}

function isTierConstraintError(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return /products_tier_check|check.*tier|tier.*check|invalid.*tier|constraint.*tier/.test(lower);
}

// Kolom eksplisit (bukan select=*). updated_at tidak dipakai UI.
const PREORDER_SELECT =
  "id,customer_name,whatsapp,product_id,product_name,custom_request,recipient_name,sender_name,personal_message,status,created_at";

export interface PreOrderPage {
  orders: PreOrder[];
  hasMore: boolean;
  total: number | null;
}

function parseContentRangeTotal(value: string | null): number | null {
  if (!value) return null;
  const match = /^\d+-\d+\/(\d+|\*)$/.exec(value.trim());
  if (!match) return null;
  const total = match[1];
  return total === "*" ? null : Number(total);
}

export async function fetchPreOrders(offset = 0): Promise<PreOrderPage> {
  if (!isSupabaseConfigured()) {
    return { orders: [], hasMore: false, total: null };
  }

  const { status, data, headers } = await adminCall("proxy", {
    method: "GET",
    path: "/rest/v1/preorder_orders",
    query:
      `select=${PREORDER_SELECT}&order=created_at.desc&limit=${PREORDER_PAGE_SIZE}&offset=${offset}`,
    prefer: "count=exact",
  });

  if (status === 401) {
    throw new Error("Sesi admin sudah kadaluarsa. Silakan login kembali.");
  }
  if (status === 403) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Akses admin ditolak."
    );
  }
  if (status >= 400) {
    const msg = String(data.message || data.details || data.hint || "");
    throw new Error(msg || "Gagal memuat pre-order.");
  }

  const orders = (Array.isArray(data) ? data : []).map(normalizePreOrder);
  const total = parseContentRangeTotal(headers.get("content-range"));
  const hasMore =
    total === null ? orders.length === PREORDER_PAGE_SIZE : offset + orders.length < total;

  return { orders, hasMore, total };
}

// Hitung pesanan baru (status 'new') lewat count=exact — hanya kolom id,
// bukan seluruh baris. Dipakai dashboard admin.
export async function fetchNewPreOrderCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const { status, headers } = await adminCall("proxy", {
      method: "GET",
      path: "/rest/v1/preorder_orders",
      query: "select=id&status=eq.new&limit=1&order=created_at.desc",
      prefer: "count=exact",
    });
    if (status >= 400) return 0;
    const total = parseContentRangeTotal(headers.get("content-range"));
    return typeof total === "number" ? total : 0;
  } catch {
    return 0;
  }
}

export async function updatePreOrderStatus(id: string, status: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi");
  }

  await adminRequest("PATCH", `/rest/v1/preorder_orders?id=eq.${encodeURIComponent(id)}`, {
    body: {
      status,
      updated_at: new Date().toISOString(),
    },
  });
}

export function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    classic: "Floramory Classic",
    signature: "Floramory Signature",
    masterpiece: "Floramory Masterpiece",
  };
  return labels[normalizeTierValue(tier)] || "Floramory";
}

export function tierEmoji(tier: string): string {
  const emojis: Record<string, string> = {
    classic: "🌸",
    signature: "🎓",
    masterpiece: "✨",
  };
  return emojis[normalizeTierValue(tier)] || "🌸";
}

export function tierBg(tier: string): string {
  const bgs: Record<string, string> = {
    classic: "#edf3fb",
    signature: "#f4f7fc",
    masterpiece: "#fff5c7",
  };
  return bgs[normalizeTierValue(tier)] || "#edf3fb";
}

export function tierBadgeClass(tier: string): string {
  const classes: Record<string, string> = {
    classic: "badge-classic",
    signature: "badge-signature",
    masterpiece: "badge-masterpiece",
  };
  return classes[normalizeTierValue(tier)] || "badge-classic";
}
