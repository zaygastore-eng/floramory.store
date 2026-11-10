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
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(isProperty ? "property" : "name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setJsonLd(id: string, data: unknown): void {
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function clearJsonLd(id: string): void {
  document.getElementById(id)?.remove();
}

export interface PageSeoInfo {
  title: string;
  description: string;
  path: string;
  imageUrl?: string;
  robots?: string;
}

// Metadata untuk halaman statis (/shop, /about, /smart-qr-vault, dst).
export function applyPageMeta(info: PageSeoInfo): void {
  const url = resolveAbsolute(info.path);
  const ogImage = resolveAbsolute(info.imageUrl || "/opengraph.jpg");

  document.title = info.title;
  setMeta("description", info.description);
  setMeta("robots", info.robots || "index, follow");
  setMeta("og:type", "website", true);
  setMeta("og:title", info.title, true);
  setMeta("og:description", info.description, true);
  setMeta("og:url", url, true);
  setMeta("og:image", ogImage, true);
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", info.title);
  setMeta("twitter:description", info.description);
  setMeta("twitter:image", ogImage);
  setCanonical(url);
  clearJsonLd("product-jsonld");
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
  applyPageMeta({
    title: "A Chapter — Atelier of Botanical Keepsakes & Smart Memory Vault",
    description:
      "Aksesori preserved flower dengan Smart-QR Memory Vault. Simpan babak terindah hidupmu dalam keindahan botani abadi.",
    path: "/",
  });
}

export interface ProductSeoInfo {
  nama_produk: string;
  id: string;
  deskripsi?: string;
  imageUrl?: string;
  harga?: string;
}

function extractPrice(harga?: string): string | null {
  if (!harga) return null;
  const digits = harga.replace(/[^\d]/g, "");
  return digits || null;
}

// Terapkan metadata spesifik produk pada halaman /produk?id=...
export function applyProductMeta(product: ProductSeoInfo): void {
  const title = `${product.nama_produk} — A Chapter`;
  const desc = (product.deskripsi || `Produk ${product.nama_produk} dari A Chapter.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const productUrl = resolveAbsolute(`/produk?id=${encodeURIComponent(product.id)}`);
  const ogImage = product.imageUrl?.startsWith("http")
    ? resolveAbsolute(product.imageUrl)
    : resolveAbsolute("/opengraph.jpg");

  document.title = title;
  setMeta("description", desc);
  setMeta("robots", "index, follow");
  setMeta("og:type", "product", true);
  setMeta("og:title", title, true);
  setMeta("og:description", desc, true);
  setMeta("og:url", productUrl, true);
  setMeta("og:image", ogImage, true);
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", title);
  setMeta("twitter:description", desc);
  setMeta("twitter:image", ogImage);
  setCanonical(productUrl);

  const price = extractPrice(product.harga);
  setJsonLd("product-jsonld", {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nama_produk,
    description: desc,
    image: [ogImage],
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: "A Chapter",
    },
    url: productUrl,
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "IDR",
            price,
            availability: "https://schema.org/InStock",
            url: productUrl,
          },
        }
      : {}),
  });
}

// Halaman privat (vault penerima & form setup) tidak boleh diindeks mesin pencari.
export function applyNoIndexMeta(title: string): void {
  document.title = title;
  setMeta("robots", "noindex, nofollow");
  clearJsonLd("product-jsonld");
}