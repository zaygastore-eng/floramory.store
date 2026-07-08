const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjLp_qo1CZVcWWq7CMkstImftaN5DeI6wZpZ3TDlge8_DtDTtF3qjj4DkJn7era5lJQYqggbBzIT8G/pub?output=csv";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
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
  foto_url: string;
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

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuote && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === "," && !inQuote) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !inQuote) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
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
  return Boolean(getStoredSession()?.access_token);
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

  const session = getStoredSession();
  if (!session?.access_token) {
    throw new Error("Login admin Supabase diperlukan untuk menyimpan nomor WhatsApp");
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

function normalizeProduct(obj: Partial<Product> & Record<string, unknown>): Product {
  return {
    id: String(obj.id || "").trim(),
    nama_produk: String(obj.nama_produk || "").trim(),
    tier: String(obj.tier || "lite").trim().toLowerCase(),
    harga: String(obj.harga || "").trim(),
    bunga: String(obj.bunga || "").trim(),
    deskripsi: String(obj.deskripsi || "").trim(),
    bahan: String(obj.bahan || "").trim(),
    ukuran: String(obj.ukuran || "").trim(),
    nama_pembeli: String(obj.nama_pembeli || "").trim(),
    dari: String(obj.dari || "").trim(),
    pesan_personal: String(obj.pesan_personal || "").trim(),
    foto_produk: String(obj.foto_produk || obj.foto_url || "").trim(),
    foto_qr: String(obj.foto_qr || obj.foto_QR || obj.foto_url || "").trim(),
    foto_url: String(obj.foto_url || obj.foto_produk || "").trim(),
    status: String(obj.status || "active").trim(),
  };
}

function productPayload(product: Product, status = product.status || "active") {
  return {
    id: product.id.trim(),
    nama_produk: product.nama_produk.trim(),
    tier: product.tier.trim().toLowerCase(),
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

async function fetchProductsFromApi(): Promise<Product[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/products`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.products)) return null;
    return data.products.map(normalizeProduct).filter((p: Product) => p.id);
  } catch {
    return null;
  }
}

async function fetchProductsFromSupabase(): Promise<Product[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=*&status=eq.active&order=created_at.desc`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.map(normalizeProduct).filter((p: Product) => p.id);
  } catch {
    return null;
  }
}

export async function fetchAllProducts(): Promise<Product[]> {
  if (cachedProducts && Date.now() - cacheTime < CACHE_TTL) {
    return cachedProducts;
  }

  const supabaseProducts = await fetchProductsFromSupabase();
  if (supabaseProducts) {
    cachedProducts = supabaseProducts;
    cacheTime = Date.now();
    return cachedProducts;
  }

  const apiProducts = await fetchProductsFromApi();
  if (apiProducts) {
    cachedProducts = apiProducts;
    cacheTime = Date.now();
    return cachedProducts;
  }

  const res = await fetch(SHEETS_CSV_URL);
  if (!res.ok) throw new Error("Gagal mengambil data dari Google Sheets");
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
  );
  const products: Product[] = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] || "").trim();
    });
    return normalizeProduct(obj);
  });

  cachedProducts = products.filter((p) => p.id);
  cacheTime = Date.now();
  return cachedProducts;
}

export async function fetchManagedProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    return fetchAllProducts();
  }

  const session = getStoredSession();
  if (!session?.access_token) {
    throw new Error("Login admin Supabase diperlukan untuk melihat daftar produk");
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`,
    { headers: supabaseHeaders(session.access_token) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data)) {
    throw new Error(data.message || data.details || "Gagal memuat daftar produk");
  }

  return data.map(normalizeProduct).filter((p: Product) => p.id);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const all = await fetchAllProducts();
  return (
    all.find((p) => p.id.toUpperCase() === id.toUpperCase()) ?? null
  );
}

export async function createProduct(product: Product): Promise<Product> {
  if (isSupabaseConfigured()) {
    const session = getStoredSession();
    if (!session?.access_token) {
      throw new Error("Login admin Supabase diperlukan untuk menyimpan produk");
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
      throw new Error(data.message || data.details || "Gagal menyimpan produk ke Supabase");
    }
    cachedProducts = null;
    return normalizeProduct(Array.isArray(data) ? data[0] : data);
  }

  const res = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Gagal menyimpan produk");
  }
  cachedProducts = null;
  return normalizeProduct(data.product || product);
}

export async function updateProduct(id: string, product: Product): Promise<Product> {
  if (!isSupabaseConfigured()) {
    throw new Error("Update produk hanya tersedia saat Supabase aktif");
  }

  const session = getStoredSession();
  if (!session?.access_token) {
    throw new Error("Login admin Supabase diperlukan untuk mengubah produk");
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
    throw new Error(data.message || data.details || "Gagal mengubah produk");
  }
  cachedProducts = null;
  return normalizeProduct(Array.isArray(data) ? data[0] : data);
}

export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Hapus produk hanya tersedia saat Supabase aktif");
  }

  const session = getStoredSession();
  if (!session?.access_token) {
    throw new Error("Login admin Supabase diperlukan untuk menghapus produk");
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
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      customer_name: order.customer_name.trim(),
      whatsapp: order.whatsapp.trim(),
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

  return normalizePreOrder(Array.isArray(data) ? data[0] : data);
}

export async function fetchPreOrders(): Promise<PreOrder[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const session = getStoredSession();
  if (!session?.access_token) {
    throw new Error("Login admin Supabase diperlukan untuk melihat pre-order");
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

  const session = getStoredSession();
  if (!session?.access_token) {
    throw new Error("Login admin Supabase diperlukan untuk mengubah pre-order");
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
    lite: "Floramory Lite",
    signature: "Floramory Signature",
    home: "Floramory Home",
  };
  return labels[tier.toLowerCase()] || "Floramory";
}

export function tierEmoji(tier: string): string {
  const emojis: Record<string, string> = {
    lite: "💍",
    signature: "🎓",
    home: "🌙",
  };
  return emojis[tier.toLowerCase()] || "🌸";
}

export function tierBg(tier: string): string {
  const bgs: Record<string, string> = {
    lite: "#eef4ed",
    signature: "#fdf0ee",
    home: "#fef9ef",
  };
  return bgs[tier.toLowerCase()] || "#eef4ed";
}

export function tierBadgeClass(tier: string): string {
  const classes: Record<string, string> = {
    lite: "badge-lite",
    signature: "badge-signature",
    home: "badge-home",
  };
  return classes[tier.toLowerCase()] || "badge-lite";
}
