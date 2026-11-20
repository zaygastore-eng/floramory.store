import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import ProductImage from "@/components/ProductImage";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import VaultShowcase from "@/components/VaultShowcase";
import OrderStickyBar from "@/components/OrderStickyBar";
import {
  fetchCatalogProducts,
  tierLabel,
  type CatalogProduct,
} from "@/lib/api";
import { applyPageMeta } from "@/lib/seo";
import { formatHarga, pageUrl } from "@/lib/site";


function ProductCard({
  product,
  onClick,
}: {
  product: CatalogProduct;
  onClick: () => void;
}) {
  const tier = product.tier.toLowerCase();
  const badge = product.editionTag || tierLabel(tier);
  const hasSecondaryImage = Boolean(product.hoverImageUrl);

  return (
    <button
      type="button"
      className="product-card editorial-product-card"
      onClick={onClick}
      aria-label={`Lihat detail ${product.nama_produk}`}
    >
      <div className={`product-img${hasSecondaryImage ? " has-secondary-image" : " single-image"}`}>
        <div className="product-img-layer product-img-primary">
          <ProductImage
            src={product.foto_produk}
            size="thumb"
            alt={product.nama_produk}
            width={480}
            height={600}
            loading="lazy"
            fallback={
              <div className="product-img-monogram" aria-label="A Chapter Botanical Atelier">
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
        </div>
        {hasSecondaryImage && (
          <div className="product-img-layer product-img-secondary" aria-hidden="true">
            <ProductImage
              src={product.hoverImageUrl || ""}
              size="thumb"
              alt=""
              width={480}
              height={600}
              loading="lazy"
              fallback={
                <div className="product-img-monogram" aria-hidden="true">
                  <img
                    src="/a-chapter-logo.png"
                    alt=""
                    className="product-fallback-logo"
                    width={130}
                    height={39}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              }
            />
          </div>
        )}
        <span className="product-badge">{badge}</span>
        <span className="product-qr-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="16" height="16" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
          </svg>
          <span>QR Vault Included</span>
        </span>
      </div>
      <div className="product-info">
        <div className="product-name">{product.nama_produk}</div>
        {product.bunga && <div className="product-latin-name">{product.bunga}</div>}
        {product.deskripsi && <div className="product-desc">{product.deskripsi}</div>}
        <div className="product-footer">
          <span className="product-price">{formatHarga(product.harga)}</span>
          <span className="product-btn">Lihat &amp; Atur →</span>
        </div>
      </div>
    </button>
  );
}


const faqItems = [
  {
    q: "Apa itu A Chapter & Fitur Smart-QR?",
    a: " A Chapter adalah kerajinan botani abadi (preserved artware) yang dilengkapi teknologi Smart-QR Code untuk menyimpan kenangan digital (album foto, video, atau musik) di dalam karya resin."
  },
  {
    q: "Bagaimana cara kustomisasi produknya?",
    a: " Kamu bisa memilih inisial huruf/angka, nuansa palet warna (Crimson Romance atau Bridgerton Blue), serta menyematkan tautan kenangan digital pribadi saat mengisi halaman pre-order."
  },
  {
    q: "Bagaimana sistem pembayaran dan pre-order-nya?",
    a: "Karena setiap karya dibuat secara khusus (bespoke), kami menerapkan sistem DP (Down Payment) 50%. DP dibayarkan secara manual melalui WhatsApp setelah atelier mengonfirmasi ketersediaan dan ongkos kirim. Pelunasan dilakukan saat karya selesai dan siap dikirim."
  },
  {
    q: "Berapa lama proses pembuatan & ke mana pengirimannya?",
    a: "Pengerjaan memakan waktu 5–7 hari kerja. Untuk fase peluncuran perdana ini, pengiriman dikirim langsung dari Surabaya dan difokuskan ke seluruh wilayah Jawa Timur."
  },
  {
    q: "Apakah bunga di dalam resin bisa layu?",
    a: "Tidak. Kami menggunakan bunga asli berkualitas tinggi yang diawetkan (preserved flowers) dan disegel rapat dengan resin bening premium agar keindahannya bertahan selamanya."
  } 
];


export default function Home() {
  const [, navigate] = useLocation();
  const [chapterProducts, setChapterProducts] = useState<CatalogProduct[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const toggleFaq = (index: number) => {
    setActiveFaq(current => current === index ? null : index);
  };
  const productSliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  const scrollSlider = (direction: "left" | "right") => {
    if (!productSliderRef.current) return;
    const scrollAmount = 340;
    productSliderRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!productSliderRef.current) return;
    setIsDragging(true);
    setHasMoved(false);
    setDragStartX(e.pageX - productSliderRef.current.offsetLeft);
    setDragScrollLeft(productSliderRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !productSliderRef.current) return;
    const x = e.pageX - productSliderRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
    }
    productSliderRef.current.scrollLeft = dragScrollLeft - walk;
  };



  useEffect(() => {
    // Tautan lama mengarah ke formulir di beranda (/?product=...#pesan).
    // Teruskan ke halaman pre-order agar bookmark & pesan WhatsApp lama
    // tetap bekerja.
    const url = new URL(window.location.href);
    const legacyProduct = url.searchParams.get("product");
    if (legacyProduct) {
      window.location.replace(
        `${pageUrl("/pre-order")}?product=${encodeURIComponent(legacyProduct)}`
      );
      return;
    }
    if (url.hash === "#pesan" || url.hash === "#kolom-pengisian") {
      window.location.replace(pageUrl("/pre-order"));
    }
  }, []);

  useEffect(() => {
    // Anchor lama "#cara-reservasi" masih dipakai tautan yang sudah tersebar.
    if (window.location.hash !== "#cara-reservasi") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("cara-pre-order")?.scrollIntoView({ behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    applyPageMeta({
      title: "A Chapter — Atelier Preserved Flowers & Smart Memory Vault",
      description:
        "Karya seni botani abadi dari kelopak bunga asli, dipadukan dengan Smart-QR Memory Vault seumur hidup untuk menyimpan foto, rekaman suara, video, dan surat personal Anda.",
      path: "/",
    });
  }, []);

  useEffect(() => {
    fetchCatalogProducts("framed")
      .then(items => setChapterProducts(items.filter(product => !product.isFallback)))
      .catch(() => setChapterProducts([]));
  }, []);

  const showcaseProducts = chapterProducts;

  const renderProductGrid = (items: CatalogProduct[]) => (
    <div className="product-slider-wrapper">
      <div
        ref={productSliderRef}
        className={`product-slider-track ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {items.map(product => (
          <div key={product.id} className="product-slider-item">
            <ProductCard
              product={product}
              onClick={() => {
                if (!hasMoved) navigate(`/products/${product.id}`);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );


  return (

    <>
      <SiteHeader variant="overlay" />

      <div className="landing-v2">
        {/* ── HERO ── */}
        <section className="lp-hero" id="hero">
          <div
            className="lp-hero-bg"
            style={{ backgroundImage: "url('/landing/hero-flowers.webp')" }}
            aria-hidden="true"
          />
          <div className="lp-hero-veil" aria-hidden="true" />
          <div className="lp-hero-inner">
            <h1 className="lp-hero-title" aria-label="Where Every Flowers Tells Your Chapter">
              <img
                src="/landing/hero-title-lockup.webp"
                alt="Where Every Flowers Tells Your Chapter"
                className="lp-hero-title-image"
                width="2829"
                height="535"
                loading="eager"
                decoding="async"
              />
            </h1>
            <p className="lp-hero-sub">
              The pre-order phase is officially open.
              <br />
              Secure your timeless memory piece before <strong>November 20, 2026</strong>.
            </p>
            <a href="/shop" className="lp-btn lp-btn--wine">
              Pilih Karya
            </a>
          </div>
          <a className="lp-hero-scroll" href="#art-of-preserving" aria-label="Gulir ke bawah">
            ⌄
          </a>
        </section>

        <main className="lp-main">
          {/* ── INTRO / THE ART OF PRESERVING MEMORIES ── */}
          <section className="lp-intro" id="art-of-preserving">
            <div className="lp-intro-copy">
              <span className="lp-eyebrow">THE ART OF PRESERVING MEMORIES</span>
              <h2 className="lp-intro-title">Some memories are too precious to let wilt.</h2>
              <p>
                Beberapa memori terlalu berharga untuk dibiarkan layu seiring waktu. Di A Chapter,
                kami memadukan keindahan kelopak bunga asli dengan teknologi Smart-QR Code di dalam
                setiap karya.
              </p>
              <p>
                Setiap kali kamu memindai kodenya, video, foto, atau lagu dari babak terbaik hidupmu
                akan hidup kembali di genggamanmu. Karena setiap bunga berhak menceritakan babak
                hidupmu!
              </p>
              <a href="#chapters" className="lp-btn lp-btn--outline">
                Jelajahi Koleksi
              </a>
            </div>
            <div className="lp-intro-art" aria-hidden="true">
              <img src="/landing/intro-collage.webp" alt="" loading="lazy" />
            </div>
          </section>

          {/* ── PRODUK ── */}
          <section className="lp-products" id="chapters">
            <div className="lp-band">
              <span className="lp-band-line" aria-hidden="true" />
              <h2 className="lp-band-title">Karya Pilihan</h2>
              <span className="lp-band-line" aria-hidden="true" />
            </div>

            <div className="lp-products-body">
              {showcaseProducts.length > 0 ? (
                renderProductGrid(showcaseProducts)
              ) : (
                <p className="lp-products-empty">
                  Belum ada karya di katalog. Koleksi baru sedang disiapkan.
                </p>
              )}
              <div className="lp-products-actions">
                {showcaseProducts.length > 1 && (
                  <div className="slider-nav-btns" aria-label="Navigasi geser produk">
                    <button
                      type="button"
                      className="slider-nav-btn prev"
                      onClick={() => scrollSlider("left")}
                      aria-label="Geser produk ke kiri"
                      title="Geser ke kiri"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="slider-nav-btn next"
                      onClick={() => scrollSlider("right")}
                      aria-label="Geser produk ke kanan"
                      title="Geser ke kanan"
                    >
                      →
                    </button>
                  </div>
                )}
                <Link href="/shop" className="lp-btn lp-btn--outline">
                  Lihat Detail Katalog →
                </Link>
              </div>
            </div>
          </section>

          {/* ── CARA PRE-ORDER ── */}
          <section className="lp-reserve" id="cara-pre-order">
            <div className="lp-reserve-inner">
              <header className="lp-reserve-head">
                <span className="lp-eyebrow">BESPOKE PRE-ORDER</span>
                <h2 className="lp-script">Dari karya pilihan hingga ke rumah Anda.</h2>
                <p>
                  Pilih karya dan atur warnanya, lalu isi data pemesan di halaman
                  pre-order. Atelier akan mengonfirmasi ketersediaan, ongkos kirim, dan
                  pembayaran DP 50% secara manual melalui WhatsApp.
                </p>
              </header>

              <ol className="lp-reserve-steps">
                <li>
                  <span className="lp-reserve-num">01</span>
                  <h3>Pilih &amp; atur karya</h3>
                  <p>Buka halaman karya, pilih nuansa warna, jumlah, dan inisial monogram.</p>
                  <Link href="/shop" className="lp-reserve-link">Jelajahi koleksi →</Link>
                </li>
                <li>
                  <span className="lp-reserve-num">02</span>
                  <h3>Klik pre-order &amp; isi data</h3>
                  <p>Lengkapi nama, WhatsApp, dan data pengiriman opsional di halaman pre-order.</p>
                  <Link href="/pre-order" className="lp-reserve-link">Buka pre-order →</Link>
                </li>
                <li>
                  <span className="lp-reserve-num">03</span>
                  <h3>Konfirmasi &amp; DP manual</h3>
                  <p>Concierge menghubungi Anda via WhatsApp untuk konfirmasi dan instruksi DP 50%.</p>
                </li>
              </ol>
            </div>
          </section>

          {/* ── PRATINJAU MEMORY VAULT ── */}
          <VaultShowcase />

          {/* ── FAQ ── */}
          <section className="lp-faq" id="faq" aria-label="Pertanyaan Umum Atelier">
            <div className="lp-faq-inner">
              <div className="lp-faq-head">
                <span className="lp-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
                <h2 className="lp-script">A letter for every question</h2>
                <p>
                  Setiap detail kecil kami jaga seperti surat berharga. Temukan jawaban atas
                  pertanyaan yang paling sering kami terima.
                </p>
              </div>

              <div className="lp-faq-letters" role="region" aria-label="FAQ Accordion">
                {faqItems.map((item, index) => {
                  const isOpen = activeFaq === index;
                  return (
                    <div className={`faq-item lp-faq-item${isOpen ? " open" : ""}`} key={index}>
                      <button
                        type="button"
                        className="faq-question-btn"
                        aria-expanded={isOpen}
                        aria-controls={`faq-answer-${index}`}
                        id={`faq-btn-${index}`}
                        onClick={() => toggleFaq(index)}
                      >
                        <span className="faq-question-text">{item.q}</span>
                        <span className="faq-toggle-icon" aria-hidden="true">+</span>
                      </button>
                      <div
                        id={`faq-answer-${index}`}
                        role="region"
                        aria-labelledby={`faq-btn-${index}`}
                        className="faq-answer-panel"
                        style={{ maxHeight: isOpen ? "260px" : "0" }}
                      >
                        <p className="faq-answer-text">{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
        <OrderStickyBar products={chapterProducts} />
      </div>
    </>
  );
}
