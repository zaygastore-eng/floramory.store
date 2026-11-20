import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Camera, Film, Mail, Music } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  fetchCatalogProducts,
  tierLabel,
  type CatalogProduct,
} from "@/lib/api";
import { homeContent } from "@/content/homeContent";
import { applyPageMeta } from "@/lib/seo";
import { formatHarga, pageUrl } from "@/lib/site";
import {
  DEFAULT_VAULT_SKIN,
  PHOTOBOOTH_THEMES,
  VAULT_SKINS,
  type PhotoboothThemeId,
  type VaultHookId,
  type VaultSkinId,
} from "@/lib/vaultDesign";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

const CelebrationHook = lazy(() => import("@/components/CelebrationHook"));

type PhotoboothBorderId = PhotoboothThemeId;


const WAVEFORM_SEEK_BARS = [
  24, 32, 46, 65, 50, 76, 60, 88, 70, 82, 52, 64, 90, 68, 96, 56,
  72, 84, 62, 40, 55, 78, 92, 66, 84, 50, 74, 86, 58, 42, 66, 78,
  85, 94, 60, 48, 70, 84, 52, 66, 90, 74, 44, 60, 78, 88, 58, 46,
  68, 82, 94, 70, 54, 76, 86, 62, 46, 66, 80, 58, 44, 56, 36, 26,
];

type VaultSimTab = "photograph" | "voice-record" | "letter" | "video";

const VAULT_TAB_ICONS: Record<VaultSimTab, typeof Camera> = {
  photograph: Camera,
  "voice-record": Music,
  letter: Mail,
  video: Film,
};

const VAULT_TAB_HINTS: Record<VaultSimTab, string> = {
  photograph: "Empat potong kenangan dalam satu kolase",
  "voice-record": "Dengarkan suara yang direkam untukmu",
  letter: "Baca kata-kata yang ditulis untukmu",
  video: "Tonton video kenangan",
};

/** Lottie pratinjau hanya dipasang saat kartu berada di viewport. */
function LandingHookPreview({ hookId }: { hookId: VaultHookId }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="lp-hook-preview-frame">
      {visible ? (
        <Suspense fallback={<span className="lp-hook-fallback" aria-hidden="true">✦</span>}>
          <CelebrationHook hookId={hookId} loop className="lp-hero-hook" />
        </Suspense>
      ) : (
        <span className="lp-hook-fallback" aria-hidden="true">✦</span>
      )}
    </div>
  );
}


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


  const [vaultSimTab, setVaultSimTab] = useState<VaultSimTab>("photograph");
  const [previewSkin, setPreviewSkin] = useState<VaultSkinId>(DEFAULT_VAULT_SKIN);
  const [photoboothBorder, setPhotoboothBorder] = useState<PhotoboothBorderId>("cream");
  const [letterText, setLetterText] = useState(
    "Untuk Sahabat & Belahan Jiwa yang Terkasih,\n\nWaktu mungkin membawa kita ke persimpangan jalan yang berbeda, namun kenangan yang telah kita ukir bersama takkan pernah lekang oleh jarak dan masa. Sebagaimana kelopak bunga ini yang diawetkan abadi di laboratorium A Chapter, rasa sayang, syukur, dan doa tulusku akan selalu menyertai setiap langkahmu.\n\nIni bukan akhir, melainkan sebuah babak baru. Until we meet again, simpanlah memori ini selamanya.\n\nDengan cinta terdalam,\nSelalu Sahabat Terbaikmu"
  );
  const [letterFont, setLetterFont] = useState<"parisienne" | "cinzel" | "cormorant" | "sans">("cormorant");
  const [letterSize, setLetterSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [letterBold, setLetterBold] = useState(false);
  const [letterItalic, setLetterItalic] = useState(false);
  const [letterUnderline, setLetterUnderline] = useState(false);
  const [letterAlign, setLetterAlign] = useState<"left" | "center" | "right">("center");
  const [letterColor, setLetterColor] = useState<string>("#531B21");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const {
    isPlaying: isAudioPlaying,
    currentTime: audioCurrentTime,
    duration: audioDuration,
    rate: audioRate,
    toggle: toggleAudio,
    pause: pauseAudio,
    seekTo: seekAudio,
    skip: skipAudio,
    cycleRate: cycleAudioRate,
    seekStart: handleAudioSeekStart,
    seekEnd: handleAudioSeekEnd,
  } = useAudioPlayback(131);


  const handleVaultTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = ["photograph", "voice-record", "letter", "video"] as const;
    const tabIds = {
      photograph: "vault-tab-foto",
      "voice-record": "vault-tab-audio",
      letter: "vault-tab-surat",
      video: "vault-tab-video",
    } as const;
    const currentIndex = tabs.indexOf(vaultSimTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setVaultSimTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(tabIds[nextTab])?.focus());
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

  const renderSkinSwitcher = (variant: "hero" | "vault") => (
    <div
      className={`lp-skin-switcher lp-skin-switcher--${variant}`}
      role="group"
      aria-label="Pratinjau tema Celebration"
    >
      <span className="lp-skin-switcher-label">Pratinjau tema</span>
      <div className="lp-skin-switcher-options">
        {VAULT_SKINS.map((skin) => (
          <button
            key={skin.id}
            type="button"
            className={`lp-skin-chip${previewSkin === skin.id ? " is-active" : ""}`}
            aria-pressed={previewSkin === skin.id}
            title={skin.tagline}
            onClick={() => setPreviewSkin(skin.id)}
          >
            <span className={`lp-skin-swatch skin-${skin.id}`} aria-hidden="true" />
            <span className="lp-skin-name">{skin.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

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
    <div className="lp-celebration-root" data-preview-skin={previewSkin}>
      <SiteHeader variant="overlay" />

      <div className="landing-v2" data-preview-skin={previewSkin}>
        {/* ── HERO (Celebration preview) ── */}
        <section className="lp-hero lp-hero--celebration" id="hero">
          <div
            className="lp-hero-bg"
            style={{ backgroundImage: "url('/landing/hero-flowers.webp')" }}
            aria-hidden="true"
          />
          <div className="lp-hero-veil" aria-hidden="true" />
          <div className="lp-hero-inner">
            <div className="lp-hero-celebration-grid">
              <div className="lp-hero-celebration-copy">
                <span className="lp-hero-kicker">A CHAPTER · CELEBRATION MEMORY VAULT</span>
                <h1 className="lp-celebration-script">
                  Setiap bunga menyimpan sebuah babak.
                </h1>
                <p className="lp-hero-sub">
                  Karya bunga abadi dengan Smart QR yang membuka surat, foto, suara, dan video
                  hanya untuk orang yang kamu pilih. Lihat dulu seperti apa tampilannya saat
                  penerima membukanya.
                </p>
                <div className="lp-hero-celebration-cta">
                  <a href="/shop" className="lp-btn lp-btn--wine">Pilih Karya</a>
                  <a href="#vault" className="lp-btn lp-btn--ghost">Lihat pratinjau vault →</a>
                </div>
                {renderSkinSwitcher("hero")}
              </div>

              <div className="lp-hero-celebration-preview">
                <div className="lp-hero-preview-card">
                  <span className="lp-hero-preview-eyebrow">SEBUAH HARI ISTIMEWA</span>
                  <span className="lp-hero-preview-script">Selamat ulang tahun, Sayang</span>
                  <LandingHookPreview hookId="gift-box" />
                  <span className="lp-hero-preview-foot">Contoh pembuka saat QR dipindai</span>
                </div>
              </div>
            </div>
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
          <section className="lp-vault lp-vault--celebration" id="vault">
            <div className="lp-vault-bg" aria-hidden="true" />
            <div className="lp-vault-inner">
              <header className="lp-vault-head">
                <span className="lp-eyebrow">CELEBRATION MEMORY VAULT</span>
                <h2 className="lp-celebration-script lp-vault-title">
                  Sebuah babak yang bisa dibuka lagi.
                </h2>
                <p>
                  {homeContent.smartVault.sectionSubtitle} Di balik setiap bingkai, kenangan
                  tersimpan aman dan dibuka lewat kamera ponsel — lengkap dengan surat, suara,
                  foto, dan video. Coba pilih tema dan isi vault di bawah.
                </p>
                {renderSkinSwitcher("vault")}
              </header>

              <article className="vault-simulator-wrap lp-vault-sim" aria-label="Pratinjau interaktif Memory Vault">
                <div className="vault-simulator-header">
                  <span className="folio-label-left">PRATINJAU MEMORY VAULT</span>
                  <span className="folio-label-right">
                    DEMO INTERAKTIF
                    <span className="folio-status-dot" aria-hidden="true" />
                  </span>
                </div>

                <div className="vault-sim-nav lp-hub-grid" role="tablist" aria-label="Pilih jenis kenangan">
                  {homeContent.smartVault.mediaTabs.map((tab, index) => {
                    const tabId = `vault-tab-${["foto", "audio", "surat", "video"][index]}`;
                    const kind = tab.kind as VaultSimTab;
                    const isSelected = vaultSimTab === kind;
                    const Icon = VAULT_TAB_ICONS[kind];
                    const tabLabel = kind === "photograph"
                      ? "Foto"
                      : kind === "voice-record"
                        ? "Rekaman suara"
                        : kind === "letter"
                          ? "Surat"
                          : "Video";
                    return (
                      <button
                        key={tab.kind}
                        type="button"
                        role="tab"
                        id={tabId}
                        aria-controls="vault-panel"
                        aria-selected={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        className={`lp-hub-card${isSelected ? " is-active" : ""}`}
                        onClick={() => {
                          setVaultSimTab(kind);
                          if (kind !== "voice-record") pauseAudio();
                          if (kind !== "video") setIsVideoPlaying(false);
                        }}
                        onKeyDown={handleVaultTabKeyDown}
                      >
                        <span className="lp-hub-icon" aria-hidden="true"><Icon /></span>
                        <span className="lp-hub-copy">
                          <strong>{tabLabel}</strong>
                          <em>{VAULT_TAB_HINTS[kind]}</em>
                        </span>
                        <ArrowRight className="lp-hub-arrow" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>

                <div className="vault-folio-body">
                  <div
                    className="vault-sim-body"
                    id="vault-panel"
                    role="tabpanel"
                    aria-labelledby={`vault-tab-${{
                      photograph: "foto",
                      "voice-record": "audio",
                      letter: "surat",
                      video: "video",
                    }[vaultSimTab]}`}
                    tabIndex={0}
                  >
                    {homeContent.smartVault.mediaTabs.map((tab) => {
                      if (tab.kind !== vaultSimTab) return null;

                      if (tab.kind === "photograph") {
                        const activeTheme = PHOTOBOOTH_THEMES.find((t) => t.id === photoboothBorder) || PHOTOBOOTH_THEMES[0];
                        return (
                          <div className="sim-panel sim-panel--photobooth" key={tab.kind}>
                            <div className="photobooth-experience">
                              {/* Border / Style Picker */}
                              <div className="photobooth-controls">
                                <div className="photobooth-control-header">
                                  <span className="photobooth-control-badge">SIMULASI BINGKAI</span>
                                  <h4 className="photobooth-control-title">Pilih Warna Bingkai</h4>
                                  <p className="photobooth-control-desc">
                                    Coba warna bingkai untuk melihat suasana yang berbeda. Pratinjau ini menunjukkan kenangan yang dapat dibuka melalui Smart QR.
                                  </p>
                                </div>
                                <div className="photobooth-theme-chips" role="radiogroup" aria-label="Pilih warna bingkai foto kenangan">
                                  {PHOTOBOOTH_THEMES.map((theme) => {
                                    const isSelected = photoboothBorder === theme.id;
                                    return (
                                      <button
                                        key={theme.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        aria-label={`Gaya ${theme.name}`}
                                        className={`photobooth-theme-chip${isSelected ? " is-active" : ""}`}
                                        onClick={() => setPhotoboothBorder(theme.id)}
                                      >
                                        <span
                                          className="photobooth-swatch-circle"
                                          style={{
                                            backgroundColor: theme.bg,
                                            borderColor: isSelected ? "var(--lp-wine, #531B21)" : theme.border,
                                            color: theme.text,
                                          }}
                                        >
                                          {isSelected && <span className="theme-check" aria-hidden="true">✓</span>}
                                        </span>
                                        <span className="theme-name">{theme.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="photobooth-perks">
                                  <span className="photobooth-perk-item">✦ Bingkai kenangan personal</span>
                                  <span className="photobooth-perk-item">✦ Foto dan cerita tersimpan</span>
                                  <span className="photobooth-perk-item">✦ Buka dengan memindai QR</span>
                                </div>
                              </div>

                              {/* Single Keepsake Photo Frame */}
                              <div className="photobooth-strip-wrap">
                                <div
                                  className="photobooth-strip photobooth-strip--single"
                                  style={{
                                    backgroundColor: activeTheme.bg,
                                    color: activeTheme.text,
                                    borderColor: activeTheme.border,
                                  }}
                                >
                                  <div className="photobooth-strip-head">
                                    <span className="strip-atelier-tag">A CHAPTER ATELIER</span>
                                    <span className="strip-edition">BINGKAI KENANGAN</span>
                                  </div>

                                  <div className="photobooth-single-frame">
                                    <img
                                      src="/landing/polaroid-1.webp"
                                      alt="Buket mawar kenangan abadi"
                                      className="photobooth-strip-img"
                                      loading="lazy"
                                    />
                                    <span className="photobooth-frame-num" aria-hidden="true">01</span>
                                  </div>

                                  <div className="photobooth-strip-foot">
                                    <div className="strip-foot-meta">
                                      <span className="strip-date">CONTOH FOTO · A CHAPTER</span>
                                      <span className="strip-stamp">KENANGAN ANDA</span>
                                    </div>
                                    <div className="strip-brand-mark" aria-hidden="true">
                                      <img
                                        src={["wine", "crimson", "noir"].includes(activeTheme.id) ? "/a-chapter-logo-light.png" : "/a-chapter-logo.png"}
                                        alt="A Chapter"
                                        className="strip-logo-img"
                                        width={68}
                                        height={20}
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (tab.kind === "voice-record") {
                        const formatTime = (sec: number) => {
                          if (!Number.isFinite(sec) || sec < 0) return "00:00";
                          const m = Math.floor(sec / 60);
                          const s = Math.floor(sec % 60);
                          return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
                        };
                        const curTimeStr = formatTime(audioCurrentTime);
                        const totalTimeStr = formatTime(audioDuration || 131);
                        const currentRatio = audioDuration > 0 ? Math.min(1, Math.max(0, audioCurrentTime / audioDuration)) : 0;

                        const handleSeekFromEvent = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
                          const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                          seekAudio(ratio * (audioDuration || 131));
                        };

                        return (
                          <div className="sim-panel" key={tab.kind}>
                            <div className="folio-audio-card">
                              <div className="folio-audio-kicker">
                                {tab.songTitle || "SEE YOU AGAIN — ACOUSTIC KEEPSAKE MEMOIR"}
                              </div>

                              {/* 1-Baris Kompak Waveform Seekbar (540-600px, bar 2px, gap 3px) */}
                              <div className="folio-waveform-unified">
                                <button
                                  type="button"
                                  className={`folio-audio-circle-btn${isAudioPlaying ? " is-playing" : ""}`}
                                  aria-label={isAudioPlaying ? "Jeda lagu See You Again" : "Putar lagu See You Again"}
                                  onClick={() => toggleAudio(tab.audioSrc || "/see-you-again.mp3")}
                                >
                                  <span aria-hidden="true">{isAudioPlaying ? "❚❚" : "▶"}</span>
                                </button>

                                <div
                                  className={`folio-waveform-seeker${isAudioPlaying ? " is-playing" : ""}`}
                                  role="slider"
                                  tabIndex={0}
                                  aria-label="Seekbar rekaman audio"
                                  aria-valuemin={0}
                                  aria-valuemax={audioDuration || 131}
                                  aria-valuenow={audioCurrentTime}
                                  onClick={handleSeekFromEvent}
                                  onMouseDown={handleAudioSeekStart}
                                  onMouseUp={handleAudioSeekEnd}
                                  onTouchStart={(e) => {
                                    handleAudioSeekStart();
                                    handleSeekFromEvent(e);
                                  }}
                                  onTouchMove={handleSeekFromEvent}
                                  onTouchEnd={handleAudioSeekEnd}
                                  title="Klik atau geser waveform untuk melompat ke menit tertentu"
                                >
                                  {WAVEFORM_SEEK_BARS.map((heightPct, idx) => {
                                    const barRatio = idx / (WAVEFORM_SEEK_BARS.length - 1);
                                    const isPlayed = barRatio <= currentRatio;
                                    return (
                                      <span
                                        key={idx}
                                        className={`waveform-bar${isPlayed ? " is-played" : ""}`}
                                        style={{ height: `${heightPct}%` }}
                                      />
                                    );
                                  })}
                                </div>

                                <div className="folio-audio-time-badge">
                                  <span>{isAudioPlaying || audioCurrentTime > 0 ? curTimeStr : "00:00"}</span>
                                  <span className="time-sep">/</span>
                                  <span className="time-total">{totalTimeStr}</span>
                                </div>
                              </div>

                              <div className="folio-audio-extra">
                                <button
                                  type="button"
                                  className="folio-skip-btn"
                                  onClick={() => skipAudio(-10)}
                                  aria-label="Mundur 10 detik"
                                >
                                  −10s
                                </button>
                                <button
                                  type="button"
                                  className="folio-skip-btn"
                                  onClick={() => skipAudio(10)}
                                  aria-label="Maju 10 detik"
                                >
                                  +10s
                                </button>
                                <button
                                  type="button"
                                  className="folio-speed-btn"
                                  onClick={cycleAudioRate}
                                  aria-label={`Kecepatan putar ${audioRate} kali`}
                                >
                                  {audioRate}x
                                </button>
                              </div>

                              <blockquote className="folio-audio-quote">
                                <p>{tab.quoteExcerpt}</p>
                                <footer>— {tab.quoteAttribution}</footer>
                              </blockquote>
                            </div>
                          </div>
                        );
                      }

                      if (tab.kind === "letter") {
                        return (
                          <div className="sim-panel sim-panel--letter" key={tab.kind}>
                            <div className="lace-letter-experience">
                              {/* Word / GDocs style rich text toolbar */}
                              <div className="lace-letter-toolbar" aria-label="Pengaturan gaya tulisan surat">
                                <div className="toolbar-group">
                                  <span className="toolbar-label">FONT</span>
                                  <div className="toolbar-btn-group">
                                    <button
                                      type="button"
                                      className={`toolbar-btn${letterFont === "parisienne" ? " is-active" : ""}`}
                                      onClick={() => setLetterFont("parisienne")}
                                      title="Font Parisienne (Romance Script)"
                                      style={{ fontFamily: "'Parisienne', cursive", fontSize: "1.05rem" }}
                                    >
                                      Parisienne
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn${letterFont === "cinzel" ? " is-active" : ""}`}
                                      onClick={() => setLetterFont("cinzel")}
                                      title="Font Cinzel (Classical Roman)"
                                      style={{ fontFamily: "'Cinzel', serif", fontSize: "0.82rem", letterSpacing: "0.06em" }}
                                    >
                                      Cinzel
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn${letterFont === "cormorant" ? " is-active" : ""}`}
                                      onClick={() => setLetterFont("cormorant")}
                                      title="Font Cormorant Garamond (Editorial Serif)"
                                      style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "0.95rem" }}
                                    >
                                      Cormorant
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn${letterFont === "sans" ? " is-active" : ""}`}
                                      onClick={() => setLetterFont("sans")}
                                      title="Font DM Sans (Modern Clean)"
                                      style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem" }}
                                    >
                                      Modern
                                    </button>
                                  </div>
                                </div>

                                <div className="toolbar-group">
                                  <span className="toolbar-label">UKURAN</span>
                                  <div className="toolbar-btn-group">
                                    {(["sm", "md", "lg", "xl"] as const).map((sz) => (
                                      <button
                                        key={sz}
                                        type="button"
                                        className={`toolbar-btn toolbar-btn--size${letterSize === sz ? " is-active" : ""}`}
                                        onClick={() => setLetterSize(sz)}
                                      >
                                        {sz.toUpperCase()}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="toolbar-group">
                                  <span className="toolbar-label">GAYA</span>
                                  <div className="toolbar-btn-group">
                                    <button
                                      type="button"
                                      className={`toolbar-btn toolbar-btn--icon${letterBold ? " is-active" : ""}`}
                                      onClick={() => setLetterBold((b) => !b)}
                                      title="Bold (Tebal)"
                                    >
                                      <strong>B</strong>
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn toolbar-btn--icon${letterItalic ? " is-active" : ""}`}
                                      onClick={() => setLetterItalic((i) => !i)}
                                      title="Italic (Miring)"
                                    >
                                      <em>I</em>
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn toolbar-btn--icon${letterUnderline ? " is-active" : ""}`}
                                      onClick={() => setLetterUnderline((u) => !u)}
                                      title="Underline (Garis Bawah)"
                                    >
                                      <u>U</u>
                                    </button>
                                  </div>
                                </div>

                                <div className="toolbar-group">
                                  <span className="toolbar-label">POSISI</span>
                                  <div className="toolbar-btn-group">
                                    <button
                                      type="button"
                                      className={`toolbar-btn toolbar-btn--icon${letterAlign === "left" ? " is-active" : ""}`}
                                      onClick={() => setLetterAlign("left")}
                                      title="Rata Kiri"
                                    >
                                      ≡
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn toolbar-btn--icon${letterAlign === "center" ? " is-active" : ""}`}
                                      onClick={() => setLetterAlign("center")}
                                      title="Rata Tengah"
                                    >
                                      ⁞
                                    </button>
                                    <button
                                      type="button"
                                      className={`toolbar-btn toolbar-btn--icon${letterAlign === "right" ? " is-active" : ""}`}
                                      onClick={() => setLetterAlign("right")}
                                      title="Rata Kanan"
                                    >
                                      ≡
                                    </button>
                                  </div>
                                </div>

                                <div className="toolbar-group">
                                  <span className="toolbar-label">TINTA</span>
                                  <div className="toolbar-color-group">
                                    {[
                                      { color: "#531B21", name: "Atelier Wine" },
                                      { color: "#2A2523", name: "Charcoal" },
                                      { color: "#783642", name: "Rosewood" },
                                    ].map((c) => (
                                      <button
                                        key={c.color}
                                        type="button"
                                        className={`toolbar-color-dot${letterColor === c.color ? " is-active" : ""}`}
                                        style={{ backgroundColor: c.color }}
                                        onClick={() => setLetterColor(c.color)}
                                        title={`Warna Tinta: ${c.name}`}
                                        aria-label={c.name}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* The Lace Board Canvas */}
                              <div className="lace-board-frame">
                                <img
                                  src="/landing/lace-letter-frame.webp"
                                  alt="Lace Board Card"
                                  className="lace-board-mat"
                                  loading="lazy"
                                />
                                <div className="lace-board-parchment">
                                  <textarea
                                    className="lace-letter-textarea"
                                    value={letterText}
                                    onChange={(e) => setLetterText(e.target.value)}
                                    placeholder="Tuliskan pesan cinta atau surat rahasiamu di sini..."
                                    style={{
                                      fontFamily: {
                                        parisienne: "'Parisienne', cursive",
                                        cinzel: "'Cinzel', serif",
                                        cormorant: "'Cormorant Garamond', serif",
                                        sans: "'DM Sans', sans-serif",
                                      }[letterFont],
                                      fontSize: {
                                        sm: "clamp(0.85rem, 1.1vw, 0.98rem)",
                                        md: "clamp(1.02rem, 1.35vw, 1.15rem)", // 16px - 18.4px
                                        lg: "clamp(1.15rem, 1.8vw, 1.4rem)",
                                        xl: "clamp(1.3rem, 2.2vw, 1.7rem)",
                                      }[letterSize],
                                      fontWeight: letterBold ? 700 : 400,
                                      fontStyle: letterItalic ? "italic" : "normal",
                                      textDecoration: letterUnderline ? "underline" : "none",
                                      textAlign: letterAlign,
                                      color: letterColor,
                                      lineHeight: letterFont === "parisienne" ? 1.5 : 1.8,
                                    }}
                                  />
                                </div>
                              </div>
                              <p className="lace-board-hint">
                                ✏️ Ketik langsung di atas perkamen renda dan gunakan toolbar di atas untuk mengubah gaya suratmu.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="sim-panel sim-panel--video" key={tab.kind}>
                          <div className={`folio-video-card folio-video-card--portrait${isVideoPlaying ? " is-playing" : ""}`}>
                            <button
                              type="button"
                              className="folio-video-frame folio-video-frame--vertical"
                              onClick={() => setIsVideoPlaying((playing) => !playing)}
                              aria-label={isVideoPlaying ? "Jeda simulasi video memoir" : "Putar simulasi video memoir"}
                            >
                              <img
                                className="folio-video-poster"
                                src={tab.posterUrl}
                                alt={tab.caption}
                                loading="lazy"
                              />
                              <span className="folio-video-vignette" aria-hidden="true" />
                              {!isVideoPlaying && (
                                <span className="folio-video-play" aria-hidden="true">▶</span>
                              )}
                              <span className="folio-video-badge">KEEPSAKE MEMOIR FRAME · {tab.durationLabel}</span>
                              <span className="folio-video-progress" aria-hidden="true">
                                <span className="folio-video-progress-fill" />
                              </span>
                            </button>
                            <p className="folio-video-caption">{tab.caption}</p>
                            <span className="folio-video-stamp">{tab.archivalStamp}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>

              <div className="lp-vault-copy">
                <span className="lp-eyebrow">KENALI FITURNYA</span>
                <h3 className="lp-vault-copy-title">Kenangan Pribadi dalam Satu Bingkai</h3>
                <p>
                  Ketika penerima memindai micro-chip di dasar bingkai kristal ini, layar gawai mereka
                  langsung membuka lembar arsip eksklusif berisi foto beresolusi tinggi, rekaman suara
                  asli, dan surat cinta personal tanpa perlu menginstal aplikasi.
                </p>
                <div className="lp-vault-actions">
                  <Link className="lp-btn lp-btn--wine" href="/pre-order">
                    Pre-Order Karya →
                  </Link>
                  <Link className="lp-btn lp-btn--outline" href="/smart-qr-vault">
                    Cara Kerja Lengkap →
                  </Link>
                </div>
              </div>
            </div>
          </section>

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
      </div>
    </div>
  );
}
