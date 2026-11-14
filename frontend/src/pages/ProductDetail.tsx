import { useState, useEffect, useRef, type TouchEvent } from "react";
import { Link, useRoute } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/ProductImage";
import {
  fetchCatalogProducts,
  fetchProductDetailById,
  tierLabel,
  type CatalogProduct,
  type Product,
} from "@/lib/api";
import { formatHarga } from "@/lib/site";
import { applyProductMeta } from "@/lib/seo";

export default function ProductDetail() {
  const [, matchProducts] = useRoute("/products/:id");
  const [, matchProduk] = useRoute("/produk/:id");
  const productId = matchProducts?.id || matchProduk?.id || "";

  const [product, setProduct] = useState<Product | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [showFloatingBar, setShowFloatingBar] = useState(false);

  const mainCtaRef = useRef<HTMLAnchorElement>(null);
  const touchStartX = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImageIndex(0);
  }, [productId]);

  useEffect(() => {
    fetchCatalogProducts()
      .then(items => setCatalog(items))
      .catch(() => setCatalog([]));

    if (productId) {
      setLoading(true);
      fetchProductDetailById(productId)
        .then(res => {
          if (res) {
            setProduct(res);
            applyProductMeta({
              id: res.id,
              nama_produk: res.nama_produk,
              deskripsi: res.deskripsi,
              imageUrl: res.foto_produk,
              harga: res.harga,
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [productId]);

  // Observer for mobile floating action bar
  useEffect(() => {
    const target = mainCtaRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating bar when main CTA is scrolled past
        setShowFloatingBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [product]);

  if (loading) {
    return (
      <div className="subpage-wrapper public-v2">
        <SiteHeader />
        <main className="subpage-main">
          <div className="catalog-loading" style={{ minHeight: "60vh", display: "grid", placeContent: "center" }}>
            Memuat arsip karya botani...
            <span className="loading-dots"><span /><span /><span /></span>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="subpage-wrapper public-v2">
        <SiteHeader />
        <main className="subpage-main">
          <div className="catalog-loading" style={{ minHeight: "60vh", textAlign: "center", padding: "4rem 2rem" }}>
            <h2 className="pdp-notfound-title">Karya Tidak Ditemukan</h2>
            <p style={{ margin: "1rem 0 2rem", color: "var(--chapter-taupe)" }}>
              Karya dengan kode ini mungkin sudah diarsipkan atau dipindahkan.
            </p>
            <Link href="/shop" className="hero-cta hero-cta-primary">
              Jelajahi Koleksi Lengkap →
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Galeri folio: gunakan foto tambahan dari Admin bila tersedia.
  // Jika belum ada, tampilkan foto produk utama saja (tanpa duplikasi).
  const gallerySources = (() => {
    const extras = (product.gallery_photos || []).filter(url => Boolean(url && url.trim()));
    const all = [product.foto_produk, ...extras].filter(url => Boolean(url && url.trim()));
    return Array.from(new Set(all));
  })();
  const galleryImages = (gallerySources.length > 0 ? gallerySources : [""]).map((src, index) => ({
    label: index === 0 ? "Studio Portrait" : `Gallery View ${index + 1}`,
    src,
  }));

  const selectedImage = galleryImages[activeImageIndex] || galleryImages[0];
  const hasMultipleImages = galleryImages.length > 1;

  // Tombol pesan mengarah ke form reservasi di beranda (produk otomatis terpilih).
  const commissionUrl = `/?product=${encodeURIComponent(product.id)}#pesan`;

  const storyText = product.deskripsi ||
    "Karya seni botani asli yang dipreservasi abadi melalui standar presisi laboratorium, dituangkan dalam kristal epoxy anti-UV bersama brankas kenangan digital untuk menyimpan suara, surat, dan foto orang tersayang selamanya.";

  const handleGalleryTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!hasMultipleImages) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
    didSwipeRef.current = false;
  };

  const handleGalleryTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || !hasMultipleImages) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 45) return;

    didSwipeRef.current = true;
    setActiveImageIndex(current => {
      const next = delta < 0 ? current + 1 : current - 1;
      if (next < 0) return galleryImages.length - 1;
      if (next >= galleryImages.length) return 0;
      return next;
    });
  };

  const handleViewportClick = () => {
    // Abaikan klik yang sebenarnya adalah akhir dari swipe di mobile.
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    setIsLightboxOpen(true);
  };

  // Cross-sell items (excluding current product)
  const relatedProducts = catalog.filter(p => p.id !== product.id).slice(0, 4);

  return (
    <div className="subpage-wrapper public-v2">
      <SiteHeader />

      <main className="subpage-main">
        <div className="pdp-container">
          {/* Breadcrumb Trail */}
          <nav className="pdp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href="/shop">The Chapters</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-tier">{tierLabel(product.tier)}</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current" aria-current="page">{product.nama_produk}</span>
          </nav>

          {/* 2-Column Split Section */}
          <div className="pdp-split">
            {/* Left Column: Sticky Gallery */}
            <div className="pdp-gallery-column">
              <div className="pdp-gallery-sticky">
                <div
                  className="pdp-gallery-stage"
                  onTouchStart={handleGalleryTouchStart}
                  onTouchEnd={handleGalleryTouchEnd}
                >
                  {/* Main Viewport — klik untuk lightbox, geser untuk carousel di mobile */}
                  <button
                    type="button"
                    className="pdp-main-viewport"
                    onClick={handleViewportClick}
                    aria-label={`Perbesar foto ${product.nama_produk}`}
                  >
                    <ProductImage
                      src={selectedImage.src}
                      size="large"
                      alt={`${product.nama_produk} — ${selectedImage.label}`}
                      className="pdp-viewport-img"
                      width={1000}
                      height={1250}
                      loading="eager"
                      fallback={
                        <div className="product-img-monogram" aria-label="A Chapter Atelier">
                          <img
                            src="/a-chapter-logo.png"
                            alt="A Chapter"
                            className="product-fallback-logo"
                            width={150}
                            height={45}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      }
                    />
                  </button>

                  {/* Dots indikator (mobile) */}
                  {hasMultipleImages && (
                    <div className="pdp-gallery-dots" role="tablist" aria-label="Navigasi foto galeri">
                      {galleryImages.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          role="tab"
                          aria-selected={activeImageIndex === idx}
                          aria-label={`Tampilkan ${img.label}`}
                          className={`pdp-gallery-dot${activeImageIndex === idx ? " active" : ""}`}
                          onClick={() => setActiveImageIndex(idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Thumbnails (desktop, hanya jika ada lebih dari satu foto) */}
                {hasMultipleImages && (
                  <div className="pdp-thumb-row" role="tablist" aria-label="Sudut Pandang Galeri">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        role="tab"
                        aria-selected={activeImageIndex === idx}
                        className={`pdp-thumb-btn${activeImageIndex === idx ? " active" : ""}`}
                        onClick={() => setActiveImageIndex(idx)}
                        aria-label={img.label}
                      >
                        <ProductImage
                          src={img.src}
                          size="thumb"
                          alt={img.label}
                          width={120}
                          height={150}
                          loading="lazy"
                          fallback={<div className="product-img-monogram" />}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Minimal Console — judul, harga, cerita, link pesan */}
            <div className="pdp-console-minimal">
              <span className="pdp-folio-tag">
                FOLIO ARCHIVE · {tierLabel(product.tier)}
              </span>

              <h1 className="pdp-title">{product.nama_produk}</h1>

              {product.bunga && (
                <p className="pdp-taxonomy">
                  <em>{product.bunga}</em>
                </p>
              )}

              <p className="pdp-price pdp-price-minimal">{formatHarga(product.harga)}</p>

              <p className="pdp-narrative pdp-story">{storyText}</p>

              <a
                ref={mainCtaRef}
                href={commissionUrl}
                className="pdp-order-link"
              >
                <span>Pesan Karya Ini</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          {/* Curated Pairings & Cross-Sell (4-card Grid) */}
          {relatedProducts.length > 0 && (
            <section className="pdp-pairings-section" aria-label="Rekomendasi Karya Terkait">
              <div className="pdp-pairings-header">
                <span className="section-eyebrow">CURATED PAIRINGS</span>
                <h2 className="section-title">
                  You May Also <em>Love</em>
                </h2>
              </div>

              <div className="products-grid pdp-pairings-grid">
                {relatedProducts.map(p => (
                  <Link key={p.id} href={`/products/${p.id}`} className="product-card">
                    <div className="product-img">
                      <ProductImage
                        src={p.foto_produk}
                        size="thumb"
                        alt={p.nama_produk}
                        width={600}
                        height={750}
                        loading="lazy"
                        fallback={
                          <div className="product-img-monogram" aria-label="A Chapter">
                            <img
                              src="/a-chapter-logo.png"
                              alt="A Chapter"
                              className="product-fallback-logo"
                              width={130}
                              height={39}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        }
                      />
                      <span className="product-badge">{tierLabel(p.tier.toLowerCase())}</span>
                    </div>
                    <div className="product-info">
                      <div className="product-name">{p.nama_produk}</div>
                      <div className="product-footer">
                        <span className="product-price">{formatHarga(p.harga)}</span>
                        <span className="product-btn">[ View Folio ]</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />

      {/* Mobile Floating Action Bar */}
      {showFloatingBar && (
        <div className="pdp-floating-bar" role="toolbar" aria-label="Aksi Cepat Pesan">
          <div className="floating-bar-left">
            <span className="floating-title">{product.nama_produk}</span>
            <span className="floating-price">{formatHarga(product.harga)}</span>
          </div>
          <a href={commissionUrl} className="floating-order-btn">
            Pesan Karya Ini →
          </a>
        </div>
      )}

      {/* Full-Screen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="lightbox-modal open"
          role="dialog"
          aria-modal="true"
          aria-label="Inspeksi Detail Bunga Resolusi Tinggi"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Tutup foto perbesaran"
          >
            ✕
          </button>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img
              src={selectedImage.src}
              alt={`${product.nama_produk} — ${selectedImage.label}`}
              className="lightbox-img"
            />
            <p className="lightbox-caption">
              {product.nama_produk} · {selectedImage.label} (Surabaya Atelier Archival Record)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
