import { useState, useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/ProductImage";
import {
  fetchCatalogProducts,
  fetchProductDetailById,
  fetchWhatsAppNumber,
  tierLabel,
  type CatalogProduct,
  type Product,
} from "@/lib/api";
import { normalizeWhatsApp, formatHarga } from "@/lib/site";
import { applyProductMeta } from "@/lib/seo";

type FrameFinish = "teak" | "black-oak" | "crystal";

interface FrameOption {
  key: FrameFinish;
  label: string;
  sub: string;
}

const FRAME_OPTIONS: FrameOption[] = [
  { key: "teak", label: "Solid Teak Wood", sub: "Kayu Jati Alami" },
  { key: "black-oak", label: "Matte Black Oak", sub: "Kayu Oak Hitam" },
  { key: "crystal", label: "Full Crystal Block", sub: "Blok Kristal Penuh" },
];

export default function ProductDetail() {
  const [, matchProducts] = useRoute("/products/:id");
  const [, matchProduk] = useRoute("/produk/:id");
  const productId = matchProducts?.id || matchProduk?.id || "";

  const [product, setProduct] = useState<Product | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [frameFinish, setFrameFinish] = useState<FrameFinish>("teak");
  const [activeAccordion, setActiveAccordion] = useState<number | null>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");

  const mainCtaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImageIndex(0);
  }, [productId]);

  useEffect(() => {
    fetchWhatsAppNumber().then(num => {
      setWhatsappNumber(normalizeWhatsApp(num) || "6285235242425");
    });

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
  const selectedFinishLabel = FRAME_OPTIONS.find(f => f.key === frameFinish)?.label || "Solid Teak Wood";

  const commissionUrl = `/?product=${encodeURIComponent(product.id)}&finish=${encodeURIComponent(frameFinish)}#pesan`;

  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Halo A Chapter Concierge,\n\nSaya tertarik mengonfirmasi pemesanan karya botani:\n` +
    `• Karya: ${product.nama_produk} (ID: ${product.id})\n` +
    `• Pilihan Frame: ${selectedFinishLabel}\n` +
    `• Harga: ${formatHarga(product.harga)}\n\nMohon info ketersediaan slot batch penuangan minggu ini.`
  )}`;

  const accordions = [
    {
      title: "Botanical Ingredients & Symbolism",
      content: (
        <div>
          <p>
            <strong>Spesimen Alami:</strong> {product.bunga || "Preserved Hydrangea macrophylla, Gypsophila paniculata, dan dedaunan botani asli."}
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Bahasa &amp; Makna Bunga:</strong> Menggambarkan rasa syukur yang mendalam, ketulusan hubungan abadi, serta memori berharga yang tak lekang oleh perputaran musim.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Dimensi &amp; Material:</strong> {[product.ukuran, product.bahan].filter(Boolean).join(" · ") || "Frame kayu padat presisi & kristal bio-epoxy bebas gelembung."}
          </p>
        </div>
      ),
    },
    {
      title: "Preservation Science & Optical Bio-Epoxy",
      content: (
        <div>
          <p>
            <strong>Laboratorium Dehidrasi Silica:</strong> Setiap kuntum diekstraksi kelembapannya dalam inkubator vakum bertingkat hingga kadar air mencapai &lt; 0.02%, mempertahankan pigmen antosianin alami tanpa pewarna buatan.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Formula Bio-Epoxy Anti-UV:</strong> Menggunakan resin tingkat optik dengan filter UV ganda yang teruji tidak menguning di iklim tropis dan tahan kelembapan tinggi Indonesia.
          </p>
        </div>
      ),
    },
    {
      title: "How The Permanent Memory Vault Works",
      content: (
        <div>
          <p>
            <strong>1. Micro-Chip Terintegrasi:</strong> Sebuah micro-QR fisik tertanam permanen di dasar resin. Tahan air, tanpa baterai, dan tidak terpengaruh usia.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>2. Tanpa Unduh Aplikasi:</strong> Siapa pun dapat memindai micro-QR langsung menggunakan kamera ponsel cerdas (iOS &amp; Android) untuk membuka foto resolusi tinggi, rekaman suara, atau surat personal.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>3. Akses Update Seumur Hidup:</strong> Anda menerima Link Akses Privat untuk memperbarui atau menambah arsip memoar kapan saja di masa depan.
          </p>
        </div>
      ),
    },
    {
      title: "Delivery & Archival Care Protocol",
      content: (
        <div>
          <p>
            <strong>Pengemasan Mewah Terlindungi:</strong> Setiap karya dikemas dalam hardbox presentation box eksklusif berpita sutra dengan pelindung benturan tingkat tinggi, menjamin keamanan pengiriman ke seluruh Nusantara.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Protokol Perawatan:</strong> Bunga tidak membutuhkan air maupun penggantian vas. Cukup hindarkan dari paparan terik sinar matahari langsung dan bersihkan debu halus sesekali dengan kuas berbulu lembut.
          </p>
        </div>
      ),
    },
  ];

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
                {/* Main Viewport */}
                <div className="pdp-main-viewport">
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

                  {/* High-Res Inspect Button */}
                  <button
                    type="button"
                    className="pdp-inspect-btn"
                    onClick={() => setIsLightboxOpen(true)}
                    aria-label="Perbesar detail foto spesimen"
                  >
                    <span>⚲</span> Inspect Petal Details
                  </button>

                  <span className="pdp-view-badge">{selectedImage.label}</span>
                </div>

                {/* Thumbnails (hanya jika ada lebih dari satu foto) */}
                {galleryImages.length > 1 && (
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

            {/* Right Column: Console & Purchasing */}
            <div className="pdp-console-column">
              <div className="pdp-header">
                <span className="pdp-folio-tag">
                  FOLIO ARCHIVE SPECIMEN NO. {String(product.id).slice(0, 8).toUpperCase()}
                </span>
                <h1 className="pdp-title">{product.nama_produk}</h1>
                <p className="pdp-taxonomy">
                  <em>{product.bunga || "Hydrangea macrophylla × Gypsophila paniculata"}</em>
                </p>
                <div className="pdp-price-row">
                  <span className="pdp-price">{formatHarga(product.harga)}</span>
                  <span className="pdp-price-badge">PRE-ORDER 50% DEPOSIT</span>
                </div>
              </div>

              {/* Batch Availability Indicator */}
              <div className="pdp-batch-schedule">
                <span className="batch-pulse-dot" aria-hidden="true" />
                <span>
                  <strong>Open for Surabaya Weekly Batch No. 12</strong> · Hand-poured in 3–5 days in East Java Studio
                </span>
              </div>

              {/* Narrative Story */}
              <p className="pdp-narrative">
                {product.deskripsi || "Karya seni botani asli yang dipreservasi abadi melalui standar presisi laboratorium, dituangkan dalam kristal epoxy anti-UV bersama brankas kenangan digital untuk menyimpan suara, surat, dan foto orang tersayang selamanya."}
              </p>

              {/* Interactive Frame Finish Selector */}
              <div className="pdp-config-group">
                <label className="pdp-config-label">
                  Pilih Material Frame Finishing: <strong>{selectedFinishLabel}</strong>
                </label>
                <div className="frame-finish-selector" role="radiogroup" aria-label="Pilihan Frame Finishing">
                  {FRAME_OPTIONS.map(opt => {
                    const isSelected = frameFinish === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`frame-finish-btn${isSelected ? " active" : ""}`}
                        onClick={() => setFrameFinish(opt.key)}
                      >
                        <span className="finish-name">{opt.label}</span>
                        <span className="finish-sub">{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart QR Memory Vault Included Assurance Card */}
              <div className="specimen-vault-card pdp-vault-assurance">
                <div className="vault-card-badge">✦ PERMANENT SMART-QR MEMORY VAULT INCLUDED</div>
                <p className="vault-card-text">
                  Setiap pesanan sudah termasuk 1x Micro-QR Chip fisik permanen yang tertanam di dasar karya. Cukup dekatkan kamera HP tanpa aplikasi untuk membuka foto kenangan, pesan suara, dan surat rahasia seumur hidup.
                </p>
              </div>

              {/* Dual Action CTAs */}
              <div className="pdp-actions">
                <a
                  ref={mainCtaRef}
                  href={commissionUrl}
                  className="hero-cta hero-cta-primary pdp-order-btn"
                >
                  COMMISSION THIS CHAPTER (PRE-ORDER DP 50%) →
                </a>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pdp-whatsapp-btn"
                >
                  Konsultasi Kustomisasi Bunga via WhatsApp
                </a>
              </div>

              {/* 4 Technical Spec Accordions */}
              <div className="pdp-accordions" role="region" aria-label="Spesifikasi Teknis Karya">
                {accordions.map((acc, idx) => {
                  const isOpen = activeAccordion === idx;
                  return (
                    <div className={`faq-item pdp-accordion-item${isOpen ? " open" : ""}`} key={idx}>
                      <button
                        type="button"
                        className="faq-question-btn pdp-accordion-btn"
                        aria-expanded={isOpen}
                        onClick={() => setActiveAccordion(curr => curr === idx ? null : idx)}
                      >
                        <span className="faq-question-text pdp-accordion-title">{acc.title}</span>
                        <span className="faq-toggle-icon" aria-hidden="true">+</span>
                      </button>
                      <div
                        className="faq-answer-panel"
                        style={{ maxHeight: isOpen ? "340px" : "0" }}
                      >
                        <div className="faq-answer-text pdp-accordion-body">
                          {acc.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            ORDER NOW →
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
