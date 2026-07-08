const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjLp_qo1CZVcWWq7CMkstImftaN5DeI6wZpZ3TDlge8_DtDTtF3qjj4DkJn7era5lJQYqggbBzIT8G/pub?output=csv";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

export async function fetchAllProducts(): Promise<Product[]> {
  if (cachedProducts && Date.now() - cacheTime < CACHE_TTL) {
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

export async function fetchProductById(id: string): Promise<Product | null> {
  const all = await fetchAllProducts();
  return (
    all.find((p) => p.id.toUpperCase() === id.toUpperCase()) ?? null
  );
}

export async function createProduct(product: Product): Promise<Product> {
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
