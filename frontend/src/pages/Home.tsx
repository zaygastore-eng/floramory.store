import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import ProductImage from "@/components/ProductImage";
import ProductSpecimen from "@/components/ProductSpecimen";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  createPreOrder,
  fetchCatalogProducts,
  fetchHeroConfig,
  fetchProductDetailById,
  fetchWhatsAppNumber,
  getHomeContentCatalogProducts,
  tierLabel,
  type CatalogProduct,
  type HeroConfig,
  type Product,
} from "@/lib/api";
import { homeContent } from "@/content/homeContent";
import {
  pageUrl,
  normalizeWhatsApp,
  formatHarga,
  formatBespokeCommissionWhatsApp,
} from "@/lib/site";
import useToast from "@/hooks/useToast";

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
                <span className="product-monogram-inner">A · C</span>
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
              fallback={<div className="product-img-monogram" />}
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
          <span className="product-btn">Detail / Reservasi →</span>
        </div>
      </div>
    </button>
  );
}

function ProductModal({
  product,
  onClose,
  onOrder,
  whatsappNumber,
}: {
  product: Product;
  onClose: () => void;
  onOrder: (product: CatalogProduct | Product) => void;
  whatsappNumber: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(".modal-close")?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [onClose]);

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Halo A Chapter, saya ingin berkonsultasi mengenai kustomisasi untuk karya ${product.nama_produk} (ID: ${product.id}).`
  )}`;

  return (
    <div
      className="modal-overlay specimen-modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal specimen-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        aria-describedby="specimen-narrative"
        ref={dialogRef}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup lembar spesimen">✕</button>
        <ProductSpecimen
          product={product}
          whatsappUrl={whatsappUrl}
          onOrder={() => {
            onClose();
            onOrder(product);
          }}
        />
      </div>
    </div>
  );
}

const faqItems = [
  {
    q: "Apakah bunga ini benar-benar bunga asli?",
    a: "Ya, 100% bunga botani asli pilihan. Setiap tangkai diekstraksi kelembapannya menggunakan teknik dehidrasi silica berstandar laboratorium hingga kadar air mencapai < 0.02%, mengunci warna dan bentuk alaminya tanpa layu atau membusuk."
  },
  {
    q: "Berapa lama bunga A Chapter bertahan?",
    a: "Karya botani A Chapter dirancang untuk bertahan 8–10 tahun (atau seumur hidup jika terhindar dari paparan terik matahari langsung dan kelembapan ekstrem). Bunga tidak membutuhkan air, pemotongan tangkai, maupun perawatan rumit."
  },
  {
    q: "Apakah penerima butuh mengunduh aplikasi untuk scan QR?",
    a: "Sama sekali tidak. Micro-chip QR dapat dipindai langsung menggunakan kamera bawaan ponsel pintar (iOS maupun Android) tanpa aplikasi pihak ketiga. Brankas memori digital terbuka seketika di peramban web."
  },
  {
    q: "Bagaimana proses pembayaran DP 50% dan pelunasan?",
    a: "Pembayaran uang muka (DP 50%) dilakukan setelah konfirmasi melalui WhatsApp concierge atelier untuk mengamankan slot batch mingguan dan memulai kurasi. Pelunasan sisa 50% dilakukan saat karya botani selesai dirangkai dan siap dikirim."
  }
];

const defaultHeroConfig: HeroConfig = {
  eyebrow: homeContent.hero.eyebrow,
  headline: homeContent.hero.headline,
  description: homeContent.hero.description,
  ctaText: homeContent.hero.ctaButton,
  ctaLink: "#chapters",
  bgImageUrl: homeContent.hero.bgImage,
};

function splitHeroHeadline(headline: string): [string, string] {
  const lines = headline.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1) return [lines[0], lines.slice(1).join(" ")];

  const text = lines[0] || "";
  const commaIndex = text.indexOf(",");
  if (commaIndex > 0) {
    return [text.slice(0, commaIndex + 1).trim(), text.slice(commaIndex + 1).trim()];
  }

  const words = text.split(/\s+/);
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function getCommissionProductGroups(
  products: CatalogProduct[],
  stemProducts: CatalogProduct[]
) {
  const activeProducts = products.filter(product => !product.isFallback);
  const stemIds = new Set(
    stemProducts.filter(product => !product.isFallback).map(product => product.id)
  );
  const giftPattern = /gift|voucher|packag|wooden box|wax seal|kartu/i;
  const gifts = activeProducts.filter(product => giftPattern.test(product.nama_produk));
  const giftIds = new Set(gifts.map(product => product.id));
  const stems = activeProducts.filter(product => stemIds.has(product.id));
  const stemIdsWithProducts = new Set(stems.map(product => product.id));
  const chapters = activeProducts.filter(
    product => !stemIdsWithProducts.has(product.id) && !giftIds.has(product.id)
  );

  return [
    {
      label: "The Chapters (Framed Keepsakes)",
      products: chapters,
      examples: ["The Rose Garden", "Hydrangea Study", "Meadow Notes", "Custom Frame"],
    },
    {
      label: "Single Stems (Minimalist Specimens)",
      products: stems,
      examples: ["Preserved Rose", "Single Hydrangea", "Lavender Stem", "Golden Fern"],
    },
    {
      label: "Gift Cards & Archival Packaging",
      products: gifts,
      examples: ["Archival Wooden Box", "Wax Seal Gift Card", "Digital Voucher"],
    },
  ];
}

export default function Home() {
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(defaultHeroConfig);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [chapterProducts, setChapterProducts] = useState<CatalogProduct[]>(
    () => getHomeContentCatalogProducts("framed")
  );
  const [singleStemProducts, setSingleStemProducts] = useState<CatalogProduct[]>(
    () => getHomeContentCatalogProducts("stem")
  );
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const toggleFaq = (index: number) => {
    setActiveFaq(current => current === index ? null : index);
  };
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { toastMsg, toastVisible, showToast } = useToast(3500);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [lastOrderWaUrl, setLastOrderWaUrl] = useState<string | null>(null);
  const [orderComplete, setOrderComplete] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState("");
  const [prefilledProductName, setPrefilledProductName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const [vaultSimTab, setVaultSimTab] = useState<
    "photograph" | "voice-record" | "letter" | "herbarium-notes"
  >("photograph");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [orderForm, setOrderForm] = useState({
    nama: "",
    wa: "",
    pesan: "",
    produk: "",
    namaPenerima: "",
    website: "",
  });
  const formStartRef = useRef(Date.now());
  const commissionPopupRef = useRef<Window | null>(null);

  useEffect(() => {
    let active = true;
    void fetchHeroConfig().then(config => {
      if (active && config) {
        setHeroConfig({
          ...config,
          bgImageUrl: config.bgImageUrl || defaultHeroConfig.bgImageUrl,
        });
      }
    });

    Promise.all([
      fetchCatalogProducts(),
      fetchCatalogProducts("framed"),
      fetchCatalogProducts("stem"),
    ])
      .then(([loadedProducts, framedProducts, stems]) => {
        setProducts(loadedProducts);
        setChapterProducts(framedProducts);
        setSingleStemProducts(stems);
        const preselectedId = new URLSearchParams(window.location.search).get("product");
        const preselectedProduct = loadedProducts.find(product => (
          !product.isFallback && product.id === preselectedId
        ));
        if (preselectedProduct) {
          setOrderForm(form => ({ ...form, produk: preselectedProduct.id }));
          setPrefilledProductName(preselectedProduct.nama_produk);
          setOrderComplete(false);
          window.setTimeout(() => {
            document.getElementById("pesan")?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      })
      .catch(() => {
        setProducts([]);
        setChapterProducts(getHomeContentCatalogProducts("framed"));
        setSingleStemProducts(getHomeContentCatalogProducts("stem"));
      });
    fetchWhatsAppNumber().then(number => {
      setWhatsappNumber(normalizeWhatsApp(number) || "6285235242425");
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSelectProduct = (cardProduct: CatalogProduct) => {
    // Immediate preview representation with available card fields
    setSelectedProduct({
      ...cardProduct,
      bunga: cardProduct.bunga || "",
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

    if (cardProduct.isFallback) return;

    // Fetch full product details including specimen fields
    fetchProductDetailById(cardProduct.id).then(fullProduct => {
      if (fullProduct) {
        setSelectedProduct(fullProduct);
      }
    });
  };

  const [heroFirstLine, heroSecondLine] = splitHeroHeadline(heroConfig.headline);
  const commissionProductGroups = getCommissionProductGroups(products, singleStemProducts);

  const handleVaultTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = ["photograph", "voice-record", "letter", "herbarium-notes"] as const;
    const tabIds = {
      photograph: "vault-tab-foto",
      "voice-record": "vault-tab-audio",
      letter: "vault-tab-surat",
      "herbarium-notes": "vault-tab-botani",
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

  const orderProduct = (product: CatalogProduct | Product) => {
    if (product.isFallback) {
      const phone = normalizeWhatsApp(whatsappNumber) || "6285235242425";
      const message = `Halo A Chapter, saya tertarik untuk memesan karya botani ${product.nama_produk}. Mohon informasi ketersediaan dan proses reservasinya.`;
      const popup = window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank"
      );
      if (popup) popup.opener = null;
      if (!popup) showToast("Izinkan pop-up untuk melanjutkan konsultasi WhatsApp.");
      return;
    }

    setOrderForm(f => ({ ...f, produk: product.id }));
    setPrefilledProductName(product.nama_produk);
    setOrderComplete(false);
    window.setTimeout(() => {
      document.getElementById("pesan")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const renderProductGrid = (items: CatalogProduct[]) => (
    <div className="products-grid showcase-products-grid">
      {items.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => handleSelectProduct(product)}
        />
      ))}
    </div>
  );

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.nama.trim() || !orderForm.wa.trim() || !orderForm.produk) {
      showToast("Periksa kembali nama, WhatsApp, dan produk pilihan Anda.");
      return;
    }

    const phoneDigits = orderForm.wa.replace(/\D/g, "");
    if (!/^(?:08\d{8,11}|628\d{8,11})$/.test(phoneDigits)) {
      showToast("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
      return;
    }
    const wa = normalizeWhatsApp(orderForm.wa);

    const selected = products.find(p => p.id === orderForm.produk);
    if (!selected || selected.isFallback) {
      showToast("Karya ini belum tersedia untuk reservasi online. Silakan hubungi concierge.");
      return;
    }

    setLastOrderWaUrl(null);
    commissionPopupRef.current = window.open("about:blank", "_blank");
    if (commissionPopupRef.current) {
      commissionPopupRef.current.opener = null;
    }
    setOrderSubmitting(true);
    try {
      const result = await createPreOrder(
        {
          customer_name: orderForm.nama,
          whatsapp: wa,
          recipient_whatsapp: "",
          product_id: orderForm.produk,
          product_name: selected.nama_produk,
          custom_request: orderForm.pesan,
          recipient_name: orderForm.namaPenerima,
          sender_name: orderForm.nama,
          personal_message: "",
        },
        {
          honeypot: orderForm.website,
          fillMs: Date.now() - formStartRef.current,
        }
      );
      formStartRef.current = Date.now();
      const orderNum = result.orderNumber || result.order_number || result.orderId || result.id || "";
      if (!result.success || !result.orderId) {
        throw new Error("Permintaan belum tercatat. Silakan coba kembali atau hubungi concierge.");
      }
      setSubmittedOrderId(result.orderId || result.id || "");
      setSubmittedOrderNumber(orderNum);

      const commissionMessage = formatBespokeCommissionWhatsApp({
        customerName: orderForm.nama,
        productName: selected.nama_produk,
        moment: orderForm.namaPenerima,
        notes: orderForm.pesan,
      });
      const waDigits = normalizeWhatsApp(whatsappNumber) || "6285235242425";
      const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(commissionMessage)}`;
      setLastOrderWaUrl(waUrl);
      if (commissionPopupRef.current && !commissionPopupRef.current.closed) {
        commissionPopupRef.current.location.href = waUrl;
      }
      commissionPopupRef.current = null;
      setOrderComplete(true);
      showToast("Permintaan komisi berhasil disimpan. Lanjutkan melalui WhatsApp Concierge.");
    } catch (error) {
      commissionPopupRef.current?.close();
      commissionPopupRef.current = null;
      showToast(error instanceof Error ? error.message : "Gagal mengirim pre-order. Silakan coba lagi.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader />

      <section className="hero hero-teaser" id="hero">
        <div className="hero-teaser-content">
          <h1 className="hero-teaser-headline">
            <span className="hero-line-where">Where Every</span>
            <span className="hero-line-flower">Flower</span>
            <span className="hero-line-chapter">Tells Your Chapter</span>
          </h1>
          <div className="hero-teaser-cta-wrap">
            <a href="#pesan" className="hero-teaser-cta">
              Join the Pre-Order
            </a>
          </div>
        </div>
      </section>

      <section className="craft-manifesto" aria-label="The Craft Manifesto">
        <div className="craft-manifesto-inner">
          <blockquote className="craft-manifesto-quote">
            “We capture blooms at the apex of their life, extract every trace of moisture under controlled laboratory conditions, and cast each stem within crystal-clear UV-shielded resin alongside an indelible memory micro-vault. No wilting. No decay. Only your story, suspended in timeless silence.”
          </blockquote>
          <cite className="craft-manifesto-author">
            — East Java Botanical Atelier · Est. 2024
          </cite>
        </div>
      </section>

      <main className="home-sections">
      <section className="fm-section chapters-section" id="chapters">
        <div className="cluster-inner" id="produk">
          <div className="cluster-heading">
            <div>
              <span className="section-eyebrow">THE CURATED EDITIONS · PRESERVED BOTANICAL ARTWARE</span>
              <h2 className="cluster-title">The Chapters — Framed Keepsakes</h2>
              <p className="cluster-description">
                Karya botani asli yang dipreservasi dalam kristal anti-UV, dilengkapi brankas memori digital di setiap bingkai.
              </p>
            </div>
            <Link href="/shop" className="catalog-explore-all-link">
              Lihat Detail Katalog →
            </Link>
          </div>
          {renderProductGrid(chapterProducts)}
        </div>
      </section>

      <section className="fm-section single-stems-section" id="single-stems">
        <div className="cluster-inner">
          <div className="cluster-heading cluster-heading--single">
            <div>
              <span className="section-eyebrow">BOTANICAL SPECIMENS · SINGLE STEM</span>
              <h2 className="cluster-title">{homeContent.singleStems.sectionTitle}</h2>
              <p className="cluster-description">{homeContent.singleStems.sectionDescription}</p>
            </div>
          </div>
          {renderProductGrid(singleStemProducts)}
        </div>
      </section>

      <section className="fm-section gift-packaging-section" id="gift-cards">
        <div className="cluster-inner">
          <div className="cluster-heading cluster-heading--single">
            <div>
              <span className="section-eyebrow">THOUGHTFUL ARCHIVES · ATELIER PACKAGING</span>
              <h2 className="cluster-title">{homeContent.giftPackaging.sectionTitle}</h2>
              <p className="cluster-description">
                Kemasan standar museum dan kartu kado digital/fisik untuk momen yang tak terlupakan.
              </p>
            </div>
          </div>
          <div className="packaging-showcase-grid">
            {homeContent.giftPackaging.items
              .filter(item => item.id === "archival-wood-box" || item.id === "atelier-gift-card")
              .map(item => (
                <article className="packaging-showcase-card" key={item.id}>
                  <div className="packaging-showcase-image">
                    <ProductImage
                      src={item.imageUrl}
                      size="large"
                      alt={item.name}
                      width={1000}
                      height={700}
                      loading="lazy"
                      fallback={<div className="packaging-image-placeholder">A Chapter · Atelier</div>}
                    />
                    {item.tag && <span className="packaging-showcase-tag">{item.tag}</span>}
                  </div>
                  <div className="packaging-showcase-copy">
                    <span className="section-eyebrow">ATELIER ARCHIVE</span>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    {item.ctaHref && item.ctaLabel ? (
                      <Link className="packaging-showcase-cta" href={item.ctaHref}>
                        {item.ctaLabel}
                      </Link>
                    ) : (
                      <span className="packaging-showcase-included">{item.price}</span>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      </section>

      <section className="fm-section vault-section" id="vault">
        <div className="vault-inner" id="memory-vault">
          <header className="vault-section-header">
            <span className="vault-eyebrow">THE ARCHIVAL MEMORY VAULT</span>
            <h2 className="vault-title">{homeContent.smartVault.sectionTitle}</h2>
            <p className="vault-desc">
              {homeContent.smartVault.sectionSubtitle} Di balik setiap bingkai, kenangan
              personal tersimpan aman dan dapat dibuka kembali melalui kamera ponsel.
            </p>
          </header>

          <article className="vault-simulator-wrap" aria-label="Interactive memory vault preview">
            <div className="vault-simulator-header">
              <span className="folio-label-left">FOLIO ARCHIVE NO. 2026-A · SURABAYA ATELIER</span>
              <span className="folio-label-right">
                PERMANENT CLOUD RECORD · SECURED
                <span className="folio-status-dot" aria-hidden="true" />
              </span>
            </div>

            <div className="vault-sim-nav" role="tablist" aria-label="Memory Vault preview">
              {homeContent.smartVault.mediaTabs.map((tab, index) => {
                const tabId = `vault-tab-${["foto", "audio", "surat", "botani"][index]}`;
                const isSelected = vaultSimTab === tab.kind;
                return (
                  <button
                    key={tab.kind}
                    type="button"
                    role="tab"
                    id={tabId}
                    aria-controls="vault-panel"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className={`vault-sim-btn${isSelected ? " active" : ""}`}
                    onClick={() => {
                      setVaultSimTab(tab.kind);
                      setIsAudioPlaying(false);
                    }}
                    onKeyDown={handleVaultTabKeyDown}
                  >
                    {["I.", "II.", "III.", "IV."][index]} {tab.title.toUpperCase()}
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
                  "herbarium-notes": "botani",
                }[vaultSimTab]}`}
                tabIndex={0}
              >
                {homeContent.smartVault.mediaTabs.map((tab) => {
                  if (tab.kind !== vaultSimTab) return null;

                  if (tab.kind === "photograph") {
                    return (
                      <div className="sim-panel" key={tab.kind}>
                        <div className="folio-polaroid">
                          <div className="folio-polaroid-frame">
                            <ProductImage
                              className="folio-polaroid-img"
                              src={tab.imageUrl}
                              size="large"
                              alt={tab.excerpt}
                              width={900}
                              height={675}
                              fallback={<div className="folio-polaroid-placeholder">A · C</div>}
                            />
                          </div>
                          <p className="folio-polaroid-script">{tab.handwrittenCaption}</p>
                          <span className="folio-polaroid-stamp">{tab.archivalStamp}</span>
                        </div>
                      </div>
                    );
                  }

                  if (tab.kind === "voice-record") {
                    return (
                      <div className="sim-panel" key={tab.kind}>
                        <div className="folio-audio-card">
                          <div className="folio-audio-kicker">
                            RECORDED VOICE MEMORY · CHAPTER NO. 02
                          </div>
                          <div
                            className={`folio-waveform${isAudioPlaying ? " is-playing" : ""}`}
                            aria-hidden="true"
                          >
                            {[24, 38, 58, 34, 72, 48, 88, 55, 96, 42, 68, 34, 82, 50, 100, 58, 75, 38, 64, 46, 86, 54, 72, 32, 60, 42, 92, 48, 68, 36, 78, 52].map((height, index) => (
                              <span
                                key={index}
                                style={{ height: `${height}%`, animationDelay: `${index * -27}ms` }}
                              />
                            ))}
                          </div>
                          <div className="folio-audio-controls">
                            <button
                              type="button"
                              className="folio-play-btn"
                              aria-label={isAudioPlaying ? "Pause voice recording preview" : "Play voice recording preview"}
                              aria-pressed={isAudioPlaying}
                              onClick={() => setIsAudioPlaying((playing) => !playing)}
                            >
                              <span aria-hidden="true">{isAudioPlaying ? "Ⅱ" : "▶"}</span>
                              {isAudioPlaying ? "PAUSE PREVIEW" : "PLAY PREVIEW"}
                            </button>
                            <span className="folio-audio-time">
                              {tab.durationLabel} / {tab.totalDurationLabel}
                            </span>
                          </div>
                          <blockquote className="folio-audio-quote">
                            <p>“{tab.quoteExcerpt}”</p>
                            <footer>— {tab.quoteAttribution}</footer>
                          </blockquote>
                        </div>
                      </div>
                    );
                  }

                  if (tab.kind === "letter") {
                    return (
                      <div className="sim-panel" key={tab.kind}>
                        <div className="folio-letter-card">
                          <div className="folio-wax-seal" aria-hidden="true">A · C</div>
                          <div className="folio-letter-head">{tab.greeting}</div>
                          <p className="folio-letter-body">
                            <span className="folio-drop-cap">{tab.letterText.charAt(0)}</span>
                            {tab.letterText.slice(1)}
                          </p>
                          <div className="folio-letter-sign">
                            {tab.signoff}<br />
                            <span>{tab.signature}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="sim-panel" key={tab.kind}>
                      <div className="folio-herbarium-card">
                        <div className="folio-herb-eyebrow">HERBARIUM SPECIMEN · SURABAYA ATELIER</div>
                        <h3 className="folio-herb-name">{tab.taxonomy}</h3>
                        <p className="folio-herb-certificate">{tab.certificateDetails}</p>
                        <dl className="folio-herb-meta">
                          <div className="folio-herb-row">
                            <dt>Taxonomy</dt>
                            <dd><em>{tab.taxonomy}</em></dd>
                          </div>
                          <div className="folio-herb-row">
                            <dt>Preservation</dt>
                            <dd>{tab.preservationMethod}</dd>
                          </div>
                          <div className="folio-herb-row">
                            <dt>Encapsulation</dt>
                            <dd>{tab.encapsulation}</dd>
                          </div>
                          <div className="folio-herb-row">
                            <dt>Residual moisture</dt>
                            <dd>{tab.humiditySpec}</dd>
                          </div>
                          <div className="folio-herb-row">
                            <dt>Lab warranty</dt>
                            <dd>{tab.labWarrantyDuration} archival preservation guarantee</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="vault-copy">
                <span className="vault-copy-eyebrow">DIGITAL MEMOIR PREVIEW</span>
                <h3 className="vault-copy-title">A Glimpse Inside Your Secret Vault</h3>
                <p className="vault-copy-description">
                  Ketika penerima memindai micro-chip di dasar bingkai kristal ini, layar gawai
                  mereka langsung membuka lembar arsip eksklusif berisi foto beresolusi tinggi,
                  rekaman suara asli, dan surat cinta personal tanpa perlu menginstal aplikasi.
                </p>
                <a className="hero-cta-primary vault-commission-cta" href="#pesan">
                  COMMISSION YOUR VAULT →
                </a>
              </div>
            </div>
          </article>

          <section className="vault-privacy" aria-labelledby="vault-privacy-title">
            <div className="vault-block-heading">
              <span className="vault-eyebrow">THE ARCHIVAL PRIVACY</span>
              <h3 id="vault-privacy-title">Kenangan personal, terlindungi.</h3>
            </div>
            <div className="vault-privacy-grid">
              {homeContent.smartVault.privacyPillars.map((pillar, index) => (
                <article className="vault-privacy-card" key={pillar.id}>
                  <span className="vault-card-index">0{index + 1}</span>
                  <h4>{pillar.title}</h4>
                  <p>{pillar.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="vault-workflow" aria-labelledby="vault-workflow-title">
            <div className="vault-block-heading">
              <span className="vault-eyebrow">ATELIER TO RECIPIENT</span>
              <h3 id="vault-workflow-title">From a personal story to a lasting archive</h3>
            </div>
            <ol className="vault-workflow-grid">
              {homeContent.smartVault.workflowSteps.map((step) => (
                <li className="vault-workflow-card" key={step.step}>
                  <span className="vault-workflow-number">{String(step.step).padStart(2, "0")}.</span>
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>

      <section className="fm-section about-section" id="tentang">
        <div className="about-inner">
          <div className="about-copy">
            <span className="section-eyebrow">Philosophy &amp; Preservation</span>
            <h2 className="section-title">Science, Art &amp;<br /><em>Botanical Immortality</em></h2>
            <p className="section-desc">
              Kami memberi kehidupan baru pada bunga surplus dari florist lokal melalui dehidrasi silica gel di laboratorium.
              Setiap kuntum lalu dicasting dengan teliti dalam resin bening anti-UV—bebas gelembung, kaya warna alami,
              dan dibuat untuk menjadi karya kenangan yang bertahan lama.
            </p>
          </div>
          <div className="about-metrics">
            <div className="about-stats">
              {[
                { num: "0 Waste", label: "Surplus bunga dimanfaatkan kembali dan diawetkan sebagai karya botani." },
                { num: "3–5 Days", label: "Ekstraksi kelembapan terukur untuk menjaga pigmen alami tetap hidup." },
                { num: "Handmade", label: "Penuangan individual yang disesuaikan untuk momen personal Anda." },
                { num: "Lifetime", label: "Memory Vault dinamis untuk foto, suara, dan surat—selalu dapat diakses." },
              ].map(({ num, label }, index) => (
                <div className="stat-card" key={index}>
                  <div className="stat-num">{num}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="fm-section order-section" id="pesan">
        <div className="order-inner">
          <div className="commission-sheet-card">
            {orderComplete ? (
              <div className="commission-confirmation" role="status" aria-live="polite">
                <div className="certificate-seal" aria-hidden="true">A · C</div>
                <span className="commission-eyebrow">A CHAPTER ATELIER · OFFICIAL ARCHIVE</span>
                <h2 className="commission-title">Your Chapter Begins Here.</h2>
                <p className="commission-confirmation-copy">
                  Lembar permintaan Anda telah tercatat. Concierge kami akan membantu
                  memeriksa ketersediaan dan tahap pengunggahan Memory Vault.
                </p>
                <p className="commission-reference">
                  REFERENCE NO. <strong>#{submittedOrderNumber || submittedOrderId}</strong>
                </p>
                {lastOrderWaUrl && (
                  <a
                    href={lastOrderWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hero-cta-primary btn-commission-submit"
                  >
                    Buka WhatsApp Concierge
                  </a>
                )}
                <button
                  type="button"
                  className="order-reset-link commission-reset"
                  onClick={() => {
                    setOrderForm({ nama: "", wa: "", pesan: "", produk: "", namaPenerima: "", website: "" });
                    setPrefilledProductName("");
                    setSubmittedOrderId("");
                    setSubmittedOrderNumber("");
                    setLastOrderWaUrl(null);
                    setOrderComplete(false);
                    formStartRef.current = Date.now();
                  }}
                >
                  Buat permintaan baru
                </button>
              </div>
            ) : (
              <>
                <header className="commission-sheet-header">
                  <span className="commission-eyebrow">BESPOKE BOTANICAL COMMISSION · ATELIER RESERVATION</span>
                  <h2 className="commission-title">The Bespoke Commission — Begin Your Chapter</h2>
                  <p className="commission-subtitle">
                    Konsultasikan karya botani abadi dan konfigurasi brankas memori Anda
                    bersama kurator atelier kami via WhatsApp resmi.
                  </p>
                </header>

                <form className="commission-form" onSubmit={submitOrder}>
                  <div className="commission-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="order-nama">Nama Pemesan</label>
                      <input
                        id="order-nama"
                        className="form-input"
                        type="text"
                        placeholder="Nama Lengkap Anda"
                        maxLength={120}
                        autoComplete="name"
                        required
                        value={orderForm.nama}
                        onChange={event => setOrderForm(form => ({ ...form, nama: event.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="order-wa">Nomor WhatsApp Pemesan</label>
                      <input
                        id="order-wa"
                        className="form-input"
                        type="tel"
                        inputMode="tel"
                        placeholder="08xx-xxxx-xxxx"
                        maxLength={20}
                        autoComplete="tel"
                        aria-describedby="order-wa-hint"
                        required
                        value={orderForm.wa}
                        onChange={event => setOrderForm(form => ({ ...form, wa: event.target.value }))}
                      />
                      <span className="form-field-hint" id="order-wa-hint">
                        Gunakan nomor aktif Indonesia, contoh 08xx atau +62.
                      </span>
                    </div>
                    <div className="form-group commission-col-span-2">
                      <label className="form-label" htmlFor="order-produk">Pilihan Koleksi / Karya</label>
                      <select
                        id="order-produk"
                        className="form-select"
                        required
                        value={orderForm.produk}
                        onChange={event => {
                          setOrderForm(form => ({ ...form, produk: event.target.value }));
                          setPrefilledProductName("");
                        }}
                      >
                        <option value="">— Pilih koleksi karya —</option>
                        {commissionProductGroups.map(group => (
                          <optgroup label={group.label} key={group.label}>
                            {group.products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.nama_produk} — {formatHarga(product.harga)}
                              </option>
                            ))}
                            {group.examples
                              .filter(example => !group.products.some(product => (
                                product.nama_produk.toLocaleLowerCase() === example.toLocaleLowerCase()
                              )))
                              .map(example => (
                                <option key={example} disabled value={`unavailable-${example}`}>
                                  {example} — belum tersedia
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      {prefilledProductName && (
                        <span className="form-prefill-indicator" role="status">
                          Terpilih dari produk: {prefilledProductName}
                        </span>
                      )}
                    </div>
                    <div className="form-group commission-col-span-2">
                      <label className="form-label" htmlFor="order-moment">
                        Nama Penerima Kado &amp; Momen (Opsional)
                      </label>
                      <input
                        id="order-moment"
                        className="form-input"
                        type="text"
                        placeholder="Contoh: Untuk Sarah · Momen Pernikahan"
                        maxLength={180}
                        value={orderForm.namaPenerima}
                        onChange={event => setOrderForm(form => ({ ...form, namaPenerima: event.target.value }))}
                      />
                    </div>
                    <div className="form-group commission-col-span-2">
                      <label className="form-label" htmlFor="order-pesan">Pesan Khusus / Catatan Singkat</label>
                      <textarea
                        id="order-pesan"
                        className="form-textarea"
                        rows={3}
                        maxLength={2000}
                        placeholder="Preferensi warna bunga, tanggal pengiriman yang diharapkan, atau catatan khusus lainnya..."
                        value={orderForm.pesan}
                        onChange={event => setOrderForm(form => ({ ...form, pesan: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-honeypot" aria-hidden="true">
                    <input
                      id="order-website"
                      className="form-input"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={orderForm.website}
                      onChange={event => setOrderForm(form => ({ ...form, website: event.target.value }))}
                    />
                  </div>
                  <button type="submit" className="hero-cta-primary btn-commission-submit" disabled={orderSubmitting}>
                    {orderSubmitting ? (
                      <>
                        <span className="commission-spinner" aria-hidden="true" />
                        Mempersiapkan Lembar Arsip...
                      </>
                    ) : (
                      "COMMISSION THIS CHAPTER →"
                    )}
                  </button>
                  <p className="commission-form-note">
                    Permintaan Anda tersimpan dengan status menunggu konsultasi DP.
                    WhatsApp akan terbuka setelah lembar arsip berhasil dicatat.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="fm-section faq-section" id="faq" aria-label="Pertanyaan Umum Atelier">
        <div className="faq-inner">
          <div className="faq-header">
            <span className="section-eyebrow order-center">FREQUENTLY ASKED QUESTIONS</span>
            <h2 className="section-title order-center">
              The Inquiries —<br />
              <em>Guidance &amp; Care Protocol</em>
            </h2>
          </div>

          <div className="faq-accordion" role="region" aria-label="FAQ Accordion">
            {faqItems.map((item, index) => {
              const isOpen = activeFaq === index;
              return (
                <div className={`faq-item${isOpen ? " open" : ""}`} key={index}>
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
                    style={{ maxHeight: isOpen ? "220px" : "0" }}
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

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onOrder={orderProduct}
          whatsappNumber={whatsappNumber}
        />
      )}

      <div className={`fm-toast${toastVisible ? " show" : ""}`} role="status">
        {toastMsg}
      </div>
    </>
  );
}
