import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// A Chapter — Vercel Serverless Function: prerender SEO halaman statis
// ============================================================
// SPA React mengisi konten di browser. Crawler mesin pencari modern
// menjalankan JavaScript, tetapi preview media sosial (WhatsApp,
// Facebook, X, LinkedIn) hanya membaca HTML awal. Fungsi ini
// menyuntikkan judul, deskripsi, canonical, dan Open Graph yang
// spesifik per halaman sebelum shell index.html dikirim.
//
// Alur:
//   GET /about             -> rewrite vercel.json -> /api/seo?route=about
//   GET /shop              -> /api/seo?route=shop
//   GET /smart-qr-vault    -> /api/seo?route=smart-qr-vault
//   GET /vault             -> /api/seo?route=vault
//
// Client React tetap berjalan normal untuk interaktivitas.
// ============================================================

interface RouteSeo {
  title: string;
  description: string;
  path: string;
}

const ROUTES: Record<string, RouteSeo> = {
  about: {
    title: "The Atelier Story — A Chapter",
    description:
      "Dilahirkan di Surabaya, A Chapter menggabungkan seni lukis botani abad ke-17 dengan sains preservasi modern untuk mengabadikan babak terindah hidup manusia.",
    path: "/about",
  },
  shop: {
    title: "The Chapter Collection — A Chapter",
    description:
      "Jelajahi koleksi karya botani abadi A Chapter: framed keepsake, single stem, dan gift card dengan Smart-QR Memory Vault.",
    path: "/shop",
  },
  "smart-qr-vault": {
    title: "Smart QR Memory Vault — A Chapter",
    description:
      "Satu karya botani abadi, satu micro-chip rahasia. Pindai dengan kamera ponsel untuk membuka foto, rekaman suara, video memoir, dan surat personal.",
    path: "/smart-qr-vault",
  },
  vault: {
    title: "Smart QR Memory Vault — A Chapter",
    description:
      "Pindai micro-chip pada karya botani A Chapter untuk membuka brankas kenangan digital: foto, suara, video memoir, dan surat cinta personal.",
    path: "/vault",
  },
};

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

function replaceMeta(html: string, name: string, isProperty: boolean, value: string): string {
  const attr = isProperty ? "property" : "name";
  const pattern = new RegExp(`<meta[^>]*${attr}=["']${name}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${name}" content="${escapeAttr(value)}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n  </head>`);
}

function injectRouteMeta(html: string, seo: RouteSeo, origin: string): string {
  const pageUrl = new URL(seo.path, origin).href;
  const ogImage = new URL("/opengraph.jpg", origin).href;

  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(seo.title)}</title>`);
  out = replaceMeta(out, "description", false, seo.description);
  out = replaceMeta(out, "robots", false, "index, follow");
  out = replaceMeta(out, "og:title", true, seo.title);
  out = replaceMeta(out, "og:description", true, seo.description);
  out = replaceMeta(out, "og:url", true, pageUrl);
  out = replaceMeta(out, "og:image", true, ogImage);
  out = replaceMeta(out, "twitter:title", false, seo.title);
  out = replaceMeta(out, "twitter:description", false, seo.description);
  out = replaceMeta(out, "twitter:image", false, ogImage);

  const canonical = `<link rel="canonical" href="${escapeAttr(pageUrl)}" />`;
  if (/<link[^>]*rel=["']canonical["'][^>]*>/i.test(out)) {
    out = out.replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, canonical);
  } else {
    out = out.replace("</head>", `  ${canonical}\n  </head>`);
  }
  return out;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const headers = req.headers || {};
  const proto =
    (Array.isArray(headers["x-forwarded-proto"]) ? headers["x-forwarded-proto"][0] : headers["x-forwarded-proto"]) ||
    "https";
  const host =
    (Array.isArray(headers["x-forwarded-host"]) ? headers["x-forwarded-host"][0] : headers["x-forwarded-host"]) ||
    headers.host ||
    "";
  const origin = `${proto}://${host}`;

  const url = new URL(req.url || "/", origin);
  const route = (url.searchParams.get("route") || "").trim().toLowerCase();
  const seo = ROUTES[route];

  let shell: string;
  try {
    shell = readFileSync(join(process.cwd(), "frontend", "dist", "index.html"), "utf8");
  } catch (error) {
    console.error("Failed to read the SEO HTML shell:", error);
    res.status(502).send("Terjadi kesalahan server.");
    return;
  }

  if (!shell) {
    res.status(502).send("Terjadi kesalahan server.");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(seo ? injectRouteMeta(shell, seo, origin) : shell);
}
