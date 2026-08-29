// Utilitas SEO SPA: karena halaman dirender di browser (tanpa SSR statis),
// meta sosial (Open Graph / Twitter) tidak bisa berisi URL absolut produk
// yang belum diketahui saat build. Semua URL absolut di-resolve dari
// window.location.origin saat runtime; browser modern & sebagian besar
// crawler (Google, Bing) menjalankan JS sehingga metadata tetap terbaca.
// Catatan: preview media sosial (FB/Twitter/LinkedIn) umumnya TIDAK
// menjalankan JS — untuk hasil 100% kontrol perlu prerender/SSR di server
// (lihat docs), yang membutuhkan perubahan arsitektur deploy.

function resolveAbsolute(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  try {
    return new URL(pathOrUrl, window.location.origin).href;
  } catch {
    return pathOrUrl;
  }
}

function setMeta(name: string, content: string, isProperty = false): void {
  const selector = isProperty
    ? `meta[property="${name}"]`
    : `meta[name="${name}"]`;
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute("content", content);
}

// Cannot dipakai di index.html statik karena Vite membaca atribut `href`
// link dan menghancurkan build untuk path direktori; tag dibuat saat runtime.
function setCanonical(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

// Setelah app dimuat: isi url/gambar absolut utk halaman umum (mis. /).
export function ensureBaseMeta(): void {
  const origin = window.location.origin;
  const url = `${origin}/`;
  setMeta("og:url", url, true);
  setCanonical(url);
  const ogImage = resolveAbsolute("/opengraph.jpg");
  setMeta("og:image", ogImage, true);
  setMeta("twitter:image", ogImage);
}

export interface ProductSeoInfo {
  nama_produk: string;
  id: string;
  deskripsi?: string;
  imageUrl?: string;
}

// Terapkan metadata spesifik produk pada halaman /produk?id=...
export function applyProductMeta(product: ProductSeoInfo): void {
  const title = `${product.nama_produk} — Floramory`;
  const desc = (product.deskripsi || `Produk ${product.nama_produk} dari Floramory.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const productUrl = resolveAbsolute(`/produk?id=${encodeURIComponent(product.id)}`);
  const ogImage = product.imageUrl?.startsWith("http")
    ? resolveAbsolute(product.imageUrl)
    : resolveAbsolute("/opengraph.jpg");

  document.title = title;
  setMeta("description", desc);
  setMeta("og:title", title, true);
  setMeta("og:description", desc, true);
  setMeta("og:url", productUrl, true);
  setMeta("og:image", ogImage, true);
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", title);
  setMeta("twitter:description", desc);
  setMeta("twitter:image", ogImage);
  setCanonical(productUrl);
}