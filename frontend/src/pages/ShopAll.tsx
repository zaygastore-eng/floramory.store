import { useState, useEffect, useRef } from "react";
import { applyPageMeta } from "@/lib/seo";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/ProductImage";
import ProductSpecimen from "@/components/ProductSpecimen";
import {
  fetchCatalogProducts,
  fetchProductDetailById,
  fetchWhatsAppNumber,
  getHomeContentCatalogProducts,
  type CatalogProduct,
  type Product,
} from "@/lib/api";
import { normalizeWhatsApp, formatHarga } from "@/lib/site";

function formatTheTitle(name: string): string {
  const clean = name.trim();
  if (/^(the|a|an)\s+/i.test(clean)) return clean;
  return `The ${clean}`;
}

export default function ShopAll() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"all" | "popular">("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCatalogProducts()
      .then(loaded => setProducts(loaded))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));

    fetchWhatsAppNumber().then(num => {
      setWhatsappNumber(normalizeWhatsApp(num) || "6285235242425");
    });
  }, []);

  useEffect(() => {
    applyPageMeta({
      title: "The Chapter Collection — A Chapter",
      description:
        "Jelajahi koleksi karya botani abadi A Chapter: framed keepsake, single stem, dan gift card dengan Smart-QR Memory Vault.",
      path: "/shop",
    });
  }, []);

  const handleSelectProduct = (cardProduct: CatalogProduct) => {
    setSelectedProduct({
      ...cardProduct,
      bunga: "",
      bahan: "",
      ukuran: "",
      nama_pembeli: "",
      dari: "",
      pesan_personal: "",
      foto_qr: "",
      audio_url: "",
      audio_durasi: 0,
      video_url: "",
      foto_vault: "",
      is_catalog: cardProduct.is_catalog ?? true,
    });

    fetchProductDetailById(cardProduct.id).then(fullProduct => {
      if (fullProduct) {
        setSelectedProduct(fullProduct);
      }
    });
  };

  const displayedProducts = filterMode === "popular"
    ? products.slice(0, 10).reverse()
    : products;

  // Keep the catalog wall full and editorial even when the live catalog is
  // sparse. Editorial pieces open a WhatsApp consultation instead of a PDP.
  const editorialChapters = getHomeContentCatalogProducts("framed");
  const showcaseProducts = (() => {
    const items = [...displayedProducts];
    for (const editorial of editorialChapters) {
      if (items.length >= 5) break;
      const exists = items.some(
        product => product.nama_produk.toLowerCase() === editorial.nama_produk.toLowerCase()
      );
      if (!exists) items.push(editorial);
    }
    return items;
  })();

  const openEditorialConsult = (product: CatalogProduct) => {
    const phone = normalizeWhatsApp(whatsappNumber) || "6285235242425";
    const message = `Halo A Chapter, saya tertarik untuk memesan karya botani ${product.nama_produk}. Mohon informasi ketersediaan dan proses reservasinya.`;
    const popup = window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
    if (popup) popup.opener = null;
  };

  const whatsappModalUrl = selectedProduct
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Halo A Chapter, saya ingin berkonsultasi mengenai kustomisasi untuk karya ${selectedProduct.nama_produk} (ID: ${selectedProduct.id}).`
      )}`
    : "";

  return (
    <div className="subpage-wrapper public-v2">
      <SiteHeader />

      <main className="subpage-main">
        {/* Category Hero Banner */}
        <section className="shop-hero-banner" aria-label="Catalog Collection Banner">
          <div className="shop-hero-inner">
            <span className="shop-hero-eyebrow">A Chapter · The Permanent Portfolio</span>
            <h1 className="shop-hero-title">
              Our Botanical Bouquets: Highest Quality &amp; Sustainable
            </h1>
            <p className="shop-hero-sub">
              Karya seni botani terpreservasi abadi yang dirangkai manual dengan standar laboratorium. Pilihan berkelanjutan yang bertahan bertahun-tahun.
            </p>
          </div>
        </section>

        {/* 5-Column Catalog Section */}
        <section className="shop-catalog-section" aria-label="Katalog Karya Lengkap">
          <div className="shop-catalog-container">
            {loading ? (
              <div className="catalog-loading">
                Memuat koleksi botani lengkap
                <span className="loading-dots"><span /><span /><span /></span>
              </div>
            ) : showcaseProducts.length === 0 ? (
              <div className="catalog-loading">
                Belum ada produk di katalog.
              </div>
            ) : (
              <div className="shop-5col-grid">
                {showcaseProducts.map((p, index) => {
                  const badge = index % 3 === 0 ? "Edition No. 01" : index % 3 === 1 ? "Best Seller" : "Rare Bloom";
                  const card = (
                    <>
                      <div className="product-img">
                        <div className="product-img-layer product-img-primary">
                          <ProductImage
                            src={p.foto_produk}
                            size="thumb"
                            alt={p.nama_produk}
                            width={600}
                            height={750}
                            loading="lazy"
                            fallback={
                              <div className="product-img-monogram" aria-label="A Chapter Botanical Atelier">
                                <span className="product-monogram-inner">A · C</span>
                              </div>
                            }
                          />
                        </div>
                        <div className="product-img-layer product-img-secondary" aria-hidden="true">
                          <ProductImage
                            src={p.foto_produk}
                            size="thumb"
                            alt={`${p.nama_produk} in ambient setting`}
                            width={600}
                            height={750}
                            loading="lazy"
                            fallback={<div className="product-img-monogram" />}
                          />
                        </div>
                        <span className="product-badge">{badge}</span>
                        <div className="product-qr-icon" aria-label="Micro-QR Memory Vault enabled">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
                          </svg>
                        </div>
                      </div>

                      <div className="product-info">
                        <div className="product-name">{formatTheTitle(p.nama_produk)}</div>
                        <div className="product-footer">
                          <span className="product-price">FROM {formatHarga(p.harga)},-</span>
                          <span className="product-btn">[ View Folio ]</span>
                        </div>
                      </div>
                    </>
                  );

                  return p.isFallback ? (
                    <button
                      key={p.id}
                      type="button"
                      className="product-card shop-card shop-card-fallback"
                      onClick={() => openEditorialConsult(p)}
                      aria-label={`Konsultasikan ${p.nama_produk} via WhatsApp`}
                    >
                      {card}
                    </button>
                  ) : (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="product-card shop-card"
                    >
                      {card}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Quick Category Alternatives */}
        <section className="shop-alternatives-section">
          <div className="shop-alternatives-inner">
            <h3 className="shop-alt-heading">Are you looking for something else?</h3>
            <div className="shop-alt-buttons">
              <button
                type="button"
                className={`shop-alt-btn${filterMode === "all" ? " active" : ""}`}
                onClick={() => setFilterMode("all")}
              >
                [ FLORAL GIFTS ]
              </button>
              <button
                type="button"
                className={`shop-alt-btn${filterMode === "popular" ? " active" : ""}`}
                onClick={() => setFilterMode("popular")}
              >
                [ MOST POPULAR ]
              </button>
              <Link href="/single-flowers" className="shop-alt-btn">
                [ SINGLE STEMS ]
              </Link>
              <Link href="/gift-card" className="shop-alt-btn">
                [ GIFT CARD ]
              </Link>
            </div>
          </div>
        </section>

        {/* Educational SEO & Care Story Block */}
        <section className="shop-seo-section" id="care-guide">
          <div className="shop-seo-inner">
            <h3 className="shop-seo-title">The Preservation Ethos &amp; Protocol</h3>
            <div className="shop-seo-grid">
              <div className="seo-card">
                <span className="seo-card-num">01</span>
                <h4 className="seo-card-title">Highest Quality Preserved Botanicals</h4>
                <p className="seo-card-desc">
                  Setiap kuntum bunga diekstraksi kelembapannya secara terukur di laboratorium silica hingga kadar air &lt; 0.02%, mempertahankan integritas seluler dan pigmen alami selama bertahun-tahun.
                </p>
              </div>

              <div className="seo-card">
                <span className="seo-card-num">02</span>
                <h4 className="seo-card-title">Curated Seasonal Floral Drops</h4>
                <p className="seo-card-desc">
                  Kami mengalihfungsikan surplus bunga dari floris lokal berkualitas premium menjadi karya seni abadi. Setiap rilis merupakan edisi terbatas dengan nomor arsip unik.
                </p>
              </div>

              <div className="seo-card">
                <span className="seo-card-num">03</span>
                <h4 className="seo-card-title">Handcrafted UV-Shielded Crystal Bio-Epoxy</h4>
                <p className="seo-card-desc">
                  Dituangkan secara individual dengan formula bio-epoxy bening anti-kuning tingkat optik, bebas gelembung udara, serta tahan terhadap iklim tropis Indonesia.
                </p>
              </div>

              <div className="seo-card">
                <span className="seo-card-num">04</span>
                <h4 className="seo-card-title">Care Guide: How to Keep Your Pieces Fabulous?</h4>
                <p className="seo-card-desc">
                  Jauhkan dari sinar matahari langsung terus-menerus dan kelembapan ekstrem. Jangan pernah disiram air. Bersihkan debu menggunakan kuas halus atau hembusan udara sejuk.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Modal View */}
      {selectedProduct && (
        <div
          className="modal-overlay specimen-modal-overlay open"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}
        >
          <div
            className="modal specimen-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            aria-describedby="specimen-narrative"
            ref={dialogRef}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelectedProduct(null)}
              aria-label="Tutup lembar spesimen"
            >
              ✕
            </button>
            <ProductSpecimen
              product={selectedProduct}
              whatsappUrl={whatsappModalUrl}
              onOrder={() => {
                window.location.href = `/?product=${encodeURIComponent(selectedProduct.id)}#pesan`;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
