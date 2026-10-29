import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// Floramory — Vercel Serverless Function: prerender SEO /produk
// ============================================================
// Halaman /produk?id=... dirender client-side oleh React (SPA).
// Crawler Google/Bing menjalankan JS, tetapi preview media sosial
// (Facebook, Twitter/X, LinkedIn, WhatsApp) umumnya TIDAK — mereka
// hanya membaca HTML awal. Fungsi ini menyuntikkan meta Open Graph /
// Twitter / canonical yang spesifik per produk ke dalam shell
// index.html sebelum HTML dikirim, jadi preview berbagi tautan
// menampilkan judul, deskripsi, dan gambar produk yang benar.
//
// Alur:
//   GET /produk?id=X
//     -> rewrite vercel.json: /produk -> /api/produk
//     -> fungsi ini: baca shell frontend/dist/index.html,
//        ambil data produk dari PostgREST (RLS publik: hanya
//        produk status='active' yang terlihat), suntik meta, kirim.
//   Client React tetap berjalan normal untuk interaktivitas.
//
// Env (wajib ada di project Vercel):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//   (variabel yang sama dengan yang dipakai build frontend).
// ============================================================

const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON_KEY = String(process.env.VITE_SUPABASE_ANON_KEY || "");

interface Product {
  id: string;
  nama_produk: string;
  deskripsi: string;
  foto_produk: string;
  foto_qr: string;
}

type Req = { url?: string; headers?: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Ganti (atau tambahkan jika belum ada) satu tag <meta x="name" ...>.
function replaceMeta(html: string, name: string, isProperty: boolean, value: string): string {
  const attr = isProperty ? "property" : "name";
  const pattern = new RegExp(`<meta[^>]*${attr}=["']${name}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${name}" content="${escapeAttr(value)}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n  </head>`);
}

function injectProductMeta(html: string, product: Product, origin: string, productUrl: string): string {
  const title = `${product.nama_produk} — Floramory`;
  const description = (product.deskripsi || `Produk ${product.nama_produk} dari Floramory.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const imageRaw = product.foto_qr || product.foto_produk;
  const ogImage = imageRaw.startsWith("http") ? new URL(imageRaw, origin).href : `${origin}/opengraph.jpg`;

  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  out = replaceMeta(out, "description", false, description);
  out = replaceMeta(out, "og:title", true, title);
  out = replaceMeta(out, "og:description", true, description);
  out = replaceMeta(out, "og:url", true, productUrl);
  out = replaceMeta(out, "og:image", true, ogImage);
  out = replaceMeta(out, "twitter:title", false, title);
  out = replaceMeta(out, "twitter:description", false, description);
  out = replaceMeta(out, "twitter:image", false, ogImage);

  const canonical = `<link rel="canonical" href="${escapeAttr(productUrl)}" />`;
  if (/<link[^>]*rel=["']canonical["'][^>]*>/i.test(out)) {
    out = out.replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, canonical);
  } else {
    out = out.replace("</head>", `  ${canonical}\n  </head>`);
  }
  return out;
}

async function fetchProduct(id: string): Promise<Product | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/products` +
      `?id=eq.${encodeURIComponent(id)}` +
      "&select=id,nama_produk,deskripsi,foto_produk,foto_qr&limit=1";
    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Product[];
    return rows[0] || null;
  } catch {
    return null;
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const headers = req.headers || {};
  const proto =
    (Array.isArray(headers["x-forwarded-proto"]) ? headers["x-forwarded-proto"][0] : headers["x-forwarded-proto"]) ||
    "https";
  const host =
    (Array.isArray(headers["x-forwarded-host"]) ? headers["x-forwarded-host"][0] : headers["x-forwarded-host"]) ||
    req.headers?.host ||
    "";
  const origin = `${proto}://${host}`;

  const url = new URL(req.url || "/", origin);
  const id = url.searchParams.has("id")
    ? url.searchParams.get("id") || ""
    : url.searchParams.get("ID") || "";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(400).send(JSON.stringify({ error: "Invalid id parameter." }));
    return;
  }

  let shell: string;
  try {
    shell = readFileSync(join(process.cwd(), "frontend", "dist", "index.html"), "utf8");
  } catch (error) {
    console.error("Failed to read the prerender HTML shell:", error);
    res.status(502).send("Terjadi kesalahan server.");
    return;
  }
  if (!shell) {
    res.status(502).send("Terjadi kesalahan server.");
    return;
  }

  if (id) {
    const product = await fetchProduct(id);
    if (product) {
      const productUrl = new URL(`/produk?id=${encodeURIComponent(product.id)}`, origin).href;
      const out = injectProductMeta(shell, product, origin, productUrl);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(out);
      return;
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(shell);
}