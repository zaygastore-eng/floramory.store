import { normalizeWhatsApp } from "@/lib/site";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
const SUPABASE_AUTH_KEY = "fm_supabase_auth";
const FALLBACK_WA_NUMBER = String(import.meta.env.VITE_WA_NUMBER || "6281234567890");

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

interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { email?: string };
}

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function isSessionExpired(session: SupabaseSession | null | undefined): boolean {
  if (!session?.expires_at) return false;

  const expiresAt = Number(session.expires_at);
  if (!Number.isFinite(expiresAt)) return false;

  return Date.now() / 1000 >= expiresAt - 60;
}

async function refreshSupabaseSession(session: SupabaseSession): Promise<SupabaseSession | null> {
  if (!isSupabaseConfigured() || !session?.refresh_token) {
    signOutAdmin();
    return null;
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    signOutAdmin();
    return null;
  }

  const refreshedSession: SupabaseSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || session.refresh_token,
    expires_at: data.expires_at,
    user: data.user || session.user,
  };

  storeSession(refreshedSession);
  return refreshedSession;
}

async function getValidSession(): Promise<SupabaseSession | null> {
  const session = getStoredSession();
  if (!session?.access_token) return null;

  if (!isSessionExpired(session)) {
    return session;
  }

  return refreshSupabaseSession(session);
}

function supabaseHeaders(accessToken?: string): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

function getStoredSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(session: SupabaseSession) {
  localStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify(session));
}

export function hasSupabaseConfig(): boolean {
  return isSupabaseConfigured();
}

export function hasSupabaseSession(): boolean {
  const session = getStoredSession();
  if (!session?.access_token) return false;
  return !isSessionExpired(session);
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi");
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.msg || "Login Supabase gagal");
  }

  storeSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user: data.user,
  });
}

export function signOutAdmin() {
  localStorage.removeItem(SUPABASE_AUTH_KEY);
}

export async function fetchWhatsAppNumber(): Promise<string> {
  if (!isSupabaseConfigured()) return FALLBACK_WA_NUMBER;

  try {
    const session = await getValidSession();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.wa_number&select=value&limit=1`,
      { headers: supabaseHeaders(session?.access_token) }
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

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const clean = value.trim();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(session.access_token),
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      key: "wa_number",
      value: clean,
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.details || "Gagal menyimpan nomor WhatsApp");
  }
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

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,nama_produk,tier,harga,bunga,deskripsi,bahan,ukuran,nama_pembeli,dari,pesan_personal,foto_produk,foto_qr,status&status=eq.active&order=created_at.desc`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.map(normalizeProduct).filter((p: Product) => p.id && p.nama_produk);
  } catch {
    return null;
  }
}

export async function fetchAllProducts(): Promise<Product[]> {
  if (cachedProducts && Date.now() - cacheTime < CACHE_TTL) {
    return cachedProducts;
  }

  const supabaseProducts = await fetchProductsFromSupabase();
  if (supabaseProducts && supabaseProducts.length > 0) {
    cachedProducts = supabaseProducts;
    cacheTime = Date.now();
    return cachedProducts;
  }

  return cachedProducts || [];
}

export async function fetchManagedProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    return fetchAllProducts();
  }

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`,
    { headers: supabaseHeaders(session.access_token) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data)) {
    throw new Error(data.message || data.details || "Gagal memuat daftar produk");
  }

  return data.map(normalizeProduct).filter((p: Product) => p.id && p.nama_produk);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  if (!id || !isSupabaseConfigured()) return null;

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

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(session.access_token),
      Prefer: "return=representation",
    },
    body: JSON.stringify(productPayload(product, "active")),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorText = String(data.message || data.details || "");
    if (isTierConstraintError(errorText)) {
      const retry = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
        method: "POST",
        headers: {
          ...supabaseHeaders(session.access_token),
          Prefer: "return=representation",
        },
        body: JSON.stringify(productPayload(product, "active", true)),
      });
      const retryData = await retry.json().catch(() => ({}));
      if (retry.ok) {
        cachedProducts = null;
        return normalizeProduct(Array.isArray(retryData) ? retryData[0] : retryData);
      }
      throw new Error(retryData.message || retryData.details || errorText || "Gagal menyimpan produk ke Supabase");
    }
    throw new Error(errorText || "Gagal menyimpan produk ke Supabase");
  }
  cachedProducts = null;
  return normalizeProduct(Array.isArray(data) ? data[0] : data);
}

export async function updateProduct(id: string, product: Product): Promise<Product> {
  if (!isSupabaseConfigured()) {
    throw new Error("Update produk hanya tersedia saat Supabase aktif");
  }

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(session.access_token),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...productPayload(product, product.status || "active"),
      id,
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorText = String(data.message || data.details || "");
    if (isTierConstraintError(errorText)) {
      const retry = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          ...supabaseHeaders(session.access_token),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          ...productPayload(product, product.status || "active", true),
          id,
          updated_at: new Date().toISOString(),
        }),
      });
      const retryData = await retry.json().catch(() => ({}));
      if (retry.ok) {
        cachedProducts = null;
        return normalizeProduct(Array.isArray(retryData) ? retryData[0] : retryData);
      }
      throw new Error(retryData.message || retryData.details || errorText || "Gagal mengubah produk");
    }
    throw new Error(errorText || "Gagal mengubah produk");
  }
  cachedProducts = null;
  return normalizeProduct(Array.isArray(data) ? data[0] : data);
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Hapus produk hanya tersedia saat Supabase aktif");
  }

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supabaseHeaders(session.access_token),
    body: JSON.stringify({
      status: "archived",
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.details || "Gagal menghapus produk");
  }
  cachedProducts = null;
}

export async function createPreOrder(order: PreOrder): Promise<PreOrder> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi untuk menerima pre-order");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/preorder_orders`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      customer_name: order.customer_name.trim(),
      whatsapp: normalizeWhatsApp(order.whatsapp),
      product_id: order.product_id.trim(),
      product_name: order.product_name.trim(),
      custom_request: order.custom_request.trim(),
      recipient_name: order.recipient_name.trim(),
      sender_name: order.sender_name.trim(),
      personal_message: order.personal_message.trim(),
      status: "new",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.details || "Gagal mengirim pre-order");
  }

  return normalizePreOrder({ ...order });
}

function isTierConstraintError(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return /products_tier_check|check.*tier|tier.*check|invalid.*tier|constraint.*tier/.test(lower);
}

export async function fetchPreOrders(): Promise<PreOrder[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/preorder_orders?select=*&order=created_at.desc`,
    { headers: supabaseHeaders(session.access_token) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data)) {
    throw new Error(data.message || data.details || "Gagal memuat pre-order");
  }

  return data.map(normalizePreOrder);
}

export async function updatePreOrderStatus(id: string, status: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase belum dikonfigurasi");
  }

  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Sesi admin Supabase sudah kadaluarsa. Silakan login kembali.");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/preorder_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supabaseHeaders(session.access_token),
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.details || "Gagal mengubah status pre-order");
  }
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
