const SHEETS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjLp_qo1CZVcWWq7CMkstImftaN5DeI6wZpZ3TDlge8_DtDTtF3qjj4DkJn7era5lJQYqggbBzIT8G/pub?output=csv";

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

export async function fetchAllProducts(): Promise<Product[]> {
  if (cachedProducts && Date.now() - cacheTime < CACHE_TTL) {
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
    return {
      id: obj.id || "",
      nama_produk: obj.nama_produk || "",
      tier: (obj.tier || "lite").toLowerCase(),
      harga: obj.harga || "",
      bunga: obj.bunga || "",
      deskripsi: obj.deskripsi || "",
      bahan: obj.bahan || "",
      ukuran: obj.ukuran || "",
      nama_pembeli: obj.nama_pembeli || "",
      dari: obj.dari || "",
      pesan_personal: obj.pesan_personal || "",
      foto_url: obj.foto_url || "",
    };
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
