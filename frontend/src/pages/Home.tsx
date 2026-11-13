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
import { applyPageMeta } from "@/lib/seo";
import {
  pageUrl,
  normalizeWhatsApp,
  formatHarga,
  formatBespokeCommissionWhatsApp,
} from "@/lib/site";
import { PHOTOBOOTH_THEMES, type PhotoboothThemeId } from "@/lib/vaultDesign";
import useToast from "@/hooks/useToast";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

// Editorial fallbacks keep the landing showcase full even when the live
// catalog only has a couple of active pieces.
const editorialChapters = getHomeContentCatalogProducts("framed");

type PhotoboothBorderId = PhotoboothThemeId;

export const ATELIER_COLLECTION_GROUPS = [
  {
    group: "Keychain",
    items: [
      { id: "keychain-scarlet", name: "Keychain — Scarlet Chapter" },
      { id: "keychain-sapphire", name: "Keychain — Sapphire Memory" },
    ],
  },
  {
    group: "Bag Charm",
    items: [
      { id: "bagcharm-hastings", name: "Bag Charm — The Hastings Red" },
      { id: "bagcharm-mayfair", name: "Bag Charm — Mayfair Blue" },
    ],
  },
] as const;

export const NUANSA_WARNA_OPTIONS = [
  {
    id: "crimson-romance",
    label: "Crimson Romance",
    detail: "Nuansa Merah Crimson & Emas",
    swatch: "#7A222D",
  },
  {
    id: "bridgerton-blue",
    label: "Bridgerton Blue",
    detail: "Nuansa Biru Lembut & Mutiara",
    swatch: "#B4C6E7",
  },
  {
    id: "classic-ivory",
    label: "Classic Ivory",
    detail: "Nuansa Krem & Bunga Natural",
    swatch: "#FAF5EE",
  },
] as const;

const PHOTOBOOTH_SAMPLE_PHOTOS = [
  { id: "cut-1", src: "/landing/polaroid-1.webp", alt: "Flower market morning bouquet" },
  { id: "cut-2", src: "/landing/polaroid-2.webp", alt: "Fragrance of fresh roses" },
  { id: "cut-3", src: "/landing/polaroid-3.webp", alt: "Candid laughter and joy" },
  { id: "cut-4", src: "/landing/polaroid-4.webp", alt: "Keepsake flowers framed" },
];

const WAVEFORM_SEEK_BARS = [
  24, 32, 46, 65, 50, 76, 60, 88, 70, 82, 52, 64, 90, 68, 96, 56,
  72, 84, 62, 40, 55, 78, 92, 66, 84, 50, 74, 86, 58, 42, 66, 78,
  85, 94, 60, 48, 70, 84, 52, 66, 90, 74, 44, 60, 78, 88, 58, 46,
  68, 82, 94, 70, 54, 76, 86, 62, 46, 66, 80, 58, 44, 56, 36, 26,
];

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
  products: CatalogProduct[]
) {
  const activeProducts = products.filter(product => !product.isFallback);

  return [
    {
      label: "The Chapters (Framed Keepsakes)",
      products: activeProducts,
      examples: ["The Rose Garden", "Hydrangea Study", "Meadow Notes", "Custom Frame"],
    },
  ];
}

export default function Home() {
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(defaultHeroConfig);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [chapterProducts, setChapterProducts] = useState<CatalogProduct[]>(
    () => getHomeContentCatalogProducts("framed")
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
    "photograph" | "voice-record" | "letter" | "video"
  >("photograph");
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
  const [orderForm, setOrderForm] = useState({
    nama: "",
    wa: "",
    koleksi: "",
    inisial: "",
    nuansa: "crimson-romance",
    pesan: "",
    isVip: false,
    website: "",
  });
  const formStartRef = useRef(Date.now());
  const commissionPopupRef = useRef<Window | null>(null);

  useEffect(() => {
    applyPageMeta({
      title: "A Chapter — Atelier Preserved Flowers & Smart Memory Vault",
      description:
        "Karya seni botani abadi dari kelopak bunga asli, dipadukan dengan Smart-QR Memory Vault seumur hidup untuk menyimpan foto, rekaman suara, video, dan surat personal Anda.",
      path: "/",
    });
  }, []);

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
    ])
      .then(([loadedProducts, framedProducts]) => {
        setProducts(loadedProducts);
        setChapterProducts(framedProducts);
        const preselectedId = new URLSearchParams(window.location.search).get("product");
        const preselectedProduct = loadedProducts.find(product => (
          !product.isFallback && product.id === preselectedId
        ));
        if (preselectedProduct) {
          const matchItem = ATELIER_COLLECTION_GROUPS.flatMap(g => g.items).find(
            it => it.name.toLowerCase().includes(preselectedProduct.nama_produk.toLowerCase()) ||
                  preselectedProduct.nama_produk.toLowerCase().includes(it.name.toLowerCase())
          ) || ATELIER_COLLECTION_GROUPS[0].items[0];
          setOrderForm(form => ({ ...form, koleksi: matchItem.id }));
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
  const commissionProductGroups = getCommissionProductGroups(products);

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

    const matchItem = ATELIER_COLLECTION_GROUPS.flatMap(g => g.items).find(
      it => it.name.toLowerCase().includes(product.nama_produk.toLowerCase()) ||
            product.nama_produk.toLowerCase().includes(it.name.toLowerCase())
    ) || ATELIER_COLLECTION_GROUPS[0].items[0];

    setOrderForm(f => ({ ...f, koleksi: matchItem.id }));
    setPrefilledProductName(product.nama_produk);
    setOrderComplete(false);
    window.setTimeout(() => {
      document.getElementById("pesan")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
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
                if (!hasMoved) handleSelectProduct(product);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const showcaseProducts = (() => {
    const items = [...chapterProducts];
    for (const editorial of editorialChapters) {
      if (items.length >= 4) break;
      const exists = items.some(
        product => product.nama_produk.toLowerCase() === editorial.nama_produk.toLowerCase()
      );
      if (!exists) items.push(editorial);
    }
    return items;
  })();

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.nama.trim() || !orderForm.wa.trim() || !orderForm.koleksi || !orderForm.inisial.trim() || !orderForm.nuansa) {
      showToast("Periksa kembali nama, nomor WhatsApp, pilihan koleksi, inisial, dan nuansa warna.");
      return;
    }

    const phoneDigits = orderForm.wa.replace(/\D/g, "");
    if (!/^(?:08\d{8,11}|628\d{8,11})$/.test(phoneDigits)) {
      showToast("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
      return;
    }
    const wa = normalizeWhatsApp(orderForm.wa);

    const selectedCollection = ATELIER_COLLECTION_GROUPS.flatMap(g => g.items).find(i => i.id === orderForm.koleksi);
    const collectionLabel = selectedCollection?.name || orderForm.koleksi;

    const selectedNuansa = NUANSA_WARNA_OPTIONS.find(n => n.id === orderForm.nuansa);
    const nuansaLabel = selectedNuansa ? `${selectedNuansa.label} (${selectedNuansa.detail})` : orderForm.nuansa;

    // Matching product ID dari database jika ada, atau fallback ke koleksi ID
    const matchedDbProduct = products.find(p => p.nama_produk.toLowerCase() === collectionLabel.toLowerCase()) || products[0];
    const productIdForDb = matchedDbProduct?.id || orderForm.koleksi;

    setLastOrderWaUrl(null);
    commissionPopupRef.current = window.open("about:blank", "_blank");
    if (commissionPopupRef.current) {
      commissionPopupRef.current.opener = null;
    }
    setOrderSubmitting(true);
    try {
      const customRequestSummary = `Inisial: ${orderForm.inisial.trim()} | Nuansa: ${nuansaLabel} | VIP Waiting List: ${orderForm.isVip ? "Ya (Klaim Early-Bird Privilege)" : "Belum Terdaftar"}`;

      const result = await createPreOrder(
        {
          customer_name: orderForm.nama.trim(),
          whatsapp: wa,
          recipient_whatsapp: "",
          product_id: productIdForDb,
          product_name: collectionLabel,
          custom_request: customRequestSummary,
          recipient_name: `Inisial: ${orderForm.inisial.trim()}`,
          sender_name: orderForm.nama.trim(),
          personal_message: orderForm.pesan.trim(),
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
        collection: collectionLabel,
        initial: orderForm.inisial,
        colorPalette: nuansaLabel,
        notes: orderForm.pesan,
        isVip: orderForm.isVip,
      });
      const waDigits = normalizeWhatsApp(whatsappNumber) || "6285235242425";
      const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(commissionMessage)}`;
      setLastOrderWaUrl(waUrl);
      if (commissionPopupRef.current && !commissionPopupRef.current.closed) {
        commissionPopupRef.current.location.href = waUrl;
      }
      commissionPopupRef.current = null;
      setOrderComplete(true);
      showToast("Pre-order berhasil disegel. Lanjutkan ke WhatsApp Concierge untuk verifikasi.");
    } catch (error) {
      commissionPopupRef.current?.close();
      commissionPopupRef.current = null;
      showToast(error instanceof Error ? error.message : "Gagal menyegel pre-order. Silakan coba lagi.");
    } finally {
      setOrderSubmitting(false);
    }
  };

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
              The Pre-Order phase is officially open.
              <br />
              Secure your timeless memory piece before <strong>November 20, 2026</strong>.
            </p>
            <a href="#kolom-pengisian" className="lp-btn lp-btn--wine">
              Pre Order Now
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
                Explore the Chapters
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
              <h2 className="lp-band-title">Produk</h2>
              <span className="lp-band-line" aria-hidden="true" />
            </div>
            <div className="lp-products-body">
              {renderProductGrid(showcaseProducts)}
              <div className="lp-products-actions">
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
                <Link href="/shop" className="lp-btn lp-btn--outline">
                  Lihat Detail Katalog →
                </Link>
              </div>
            </div>
          </section>

          {/* ── CAPTURED MOMENTS / MEMORY VAULT ── */}
          <section className="lp-vault" id="vault">
            <div className="lp-vault-bg" aria-hidden="true" />
            <div className="lp-vault-inner">
              <header className="lp-vault-head">
                <span className="lp-eyebrow">THE ARCHIVAL MEMORY VAULT</span>
                <h2 className="lp-script lp-vault-title">Captured Moments</h2>
                <p>
                  {homeContent.smartVault.sectionSubtitle} Di balik setiap bingkai, kenangan personal
                  tersimpan aman dan dapat dibuka kembali melalui kamera ponsel.
                </p>
              </header>

              <article className="vault-simulator-wrap lp-vault-sim" aria-label="Interactive memory vault preview">
                <div className="vault-simulator-header">
                  <span className="folio-label-left">FOLIO ARCHIVE NO. 2026-A · SURABAYA ATELIER</span>
                  <span className="folio-label-right">
                    PERMANENT CLOUD RECORD · SECURED
                    <span className="folio-status-dot" aria-hidden="true" />
                  </span>
                </div>

                <div className="vault-sim-nav" role="tablist" aria-label="Memory Vault preview">
                  {homeContent.smartVault.mediaTabs.map((tab, index) => {
                    const tabId = `vault-tab-${["foto", "audio", "surat", "video"][index]}`;
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
                          if (tab.kind !== "voice-record") pauseAudio();
                          if (tab.kind !== "video") setIsVideoPlaying(false);
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
                                  <span className="photobooth-control-badge">ARCHIVAL KEEPSAKE</span>
                                  <h4 className="photobooth-control-title">Pilih Gaya Border Kenangan</h4>
                                  <p className="photobooth-control-desc">
                                    Abadikan 1 momen terbaikmu dalam bingkai atelier eksklusif. Pilih warna bordermu sendiri dan simpan abadi di dalam chip QR.
                                  </p>
                                </div>
                                <div className="photobooth-theme-chips" role="radiogroup" aria-label="Pilih border foto kenangan">
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
                                  <span className="photobooth-perk-item">✦ Single Keepsake Frame</span>
                                  <span className="photobooth-perk-item">✦ High-Res Cloud Record</span>
                                  <span className="photobooth-perk-item">✦ Scan to Relive</span>
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
                                    <span className="strip-edition">ARCHIVAL MEMORY · KEEPSAKE FRAME</span>
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
                                      <span className="strip-date">JUNE 2026 · SURABAYA ATELIER</span>
                                      <span className="strip-stamp">№ 2026-CH-0482</span>
                                    </div>
                                    <div className="strip-monogram" aria-hidden="true">
                                      <span>A</span>
                                      <span>·</span>
                                      <span>C</span>
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
                                  src="/landing/lace-letter-card.webp"
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
                <span className="lp-eyebrow">DIGITAL MEMOIR PREVIEW</span>
                <h3 className="lp-vault-copy-title">A Glimpse Inside Your Secret Vault</h3>
                <p>
                  Ketika penerima memindai micro-chip di dasar bingkai kristal ini, layar gawai mereka
                  langsung membuka lembar arsip eksklusif berisi foto beresolusi tinggi, rekaman suara
                  asli, dan surat cinta personal tanpa perlu menginstal aplikasi.
                </p>
                <div className="lp-vault-actions">
                  <a className="lp-btn lp-btn--wine" href="#pesan">
                    Commission Your Vault →
                  </a>
                  <Link className="lp-btn lp-btn--outline" href="/smart-qr-vault">
                    Cara Kerja Lengkap →
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── KOLOM PENGISIAN ── */}
          <section className="lp-kolom" id="pesan">
            <span id="kolom-pengisian" className="lp-anchor" aria-hidden="true" />
            <div className="lp-kolom-inner">
              <h2 className="lp-script lp-kolom-title">Kolom Pengisian</h2>
              <p className="lp-kolom-lead">
                Setiap karya dirangkai khusus berdasarkan ceritamu. Lengkapi detail di bawah ini
                untuk mengamankan slot Pre-Order eksklusifmu sebelum pintu galeri ditutup.
              </p>

              <div className="lp-kolom-card">
                {orderComplete ? (
                  <div className="commission-confirmation lp-confirmation" role="status" aria-live="polite">
                    <div className="certificate-seal" aria-hidden="true">
                      <img src="/a-chapter-logo-light.png" alt="" className="certificate-seal-logo" />
                    </div>
                    <span className="commission-eyebrow">A CHAPTER ATELIER · OFFICIAL ARCHIVE</span>
                    <h2 className="commission-title">Your Chapter Begins Here.</h2>
                    <p className="commission-confirmation-copy">
                      Lembar permintaan Anda telah tercatat. Concierge kami akan membantu memeriksa
                      ketersediaan dan tahap pengunggahan Memory Vault.
                    </p>
                    <p className="commission-reference">
                      REFERENCE NO. <strong>#{submittedOrderNumber || submittedOrderId}</strong>
                    </p>
                    {lastOrderWaUrl && (
                      <a
                        href={lastOrderWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lp-btn lp-btn--wine"
                      >
                        Buka WhatsApp Concierge
                      </a>
                    )}
                    <button
                      type="button"
                      className="order-reset-link commission-reset"
                      onClick={() => {
                        setOrderForm({
                          nama: "",
                          wa: "",
                          koleksi: "",
                          inisial: "",
                          nuansa: "crimson-romance",
                          pesan: "",
                          isVip: false,
                          website: "",
                        });
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
                    <header className="lp-form-head">
                      <span className="commission-eyebrow">BESPOKE BOTANICAL COMMISSION · ATELIER RESERVATION</span>
                      <h3 className="lp-form-title">Reserve your chapter</h3>
                      <p className="lp-form-sub">
                        Konsultasikan karya botani abadi dan konfigurasi brankas memori Anda bersama
                        kurator atelier kami via WhatsApp resmi.
                      </p>
                    </header>

                    <form className="commission-form lp-form" onSubmit={submitOrder}>
                      <div className="commission-form-grid lp-form-grid">
                        <div className="form-group">
                          <label className="form-label" htmlFor="order-nama">Nama Lengkap</label>
                          <input
                            id="order-nama"
                            className="form-input"
                            type="text"
                            placeholder="Nama Lengkap Pemesan"
                            maxLength={120}
                            autoComplete="name"
                            required
                            value={orderForm.nama}
                            onChange={event => setOrderForm(form => ({ ...form, nama: event.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="order-wa">Nomor WhatsApp</label>
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
                            Nomor WhatsApp aktif pemesan (contoh: 08xx atau 62xx).
                          </span>
                        </div>
                        <div className="form-group commission-col-span-2">
                          <label className="form-label" htmlFor="order-koleksi">Pilihan Koleksi</label>
                          <select
                            id="order-koleksi"
                            className="form-select"
                            required
                            value={orderForm.koleksi}
                            onChange={event => {
                              setOrderForm(form => ({ ...form, koleksi: event.target.value }));
                              setPrefilledProductName("");
                            }}
                          >
                            <option value="">— Pilih koleksi karya —</option>
                            {ATELIER_COLLECTION_GROUPS.map(group => (
                              <optgroup label={group.group} key={group.group}>
                                {group.items.map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {prefilledProductName && (
                            <span className="form-prefill-indicator" role="status">
                              Terpilih: {prefilledProductName}
                            </span>
                          )}
                        </div>

                        <div className="form-group commission-col-span-2">
                          <label className="form-label" htmlFor="order-inisial">Inisial Huruf / Angka</label>
                          <input
                            id="order-inisial"
                            className="form-input"
                            type="text"
                            placeholder="Tuliskan 1 huruf atau angka pilihanmu (contoh: A, R, atau 5)"
                            maxLength={10}
                            required
                            value={orderForm.inisial}
                            onChange={event => setOrderForm(form => ({ ...form, inisial: event.target.value }))}
                          />
                          <span className="form-field-hint">
                            Tuliskan 1 huruf atau angka pilihanmu (contoh: A, R, atau 5).
                          </span>
                        </div>

                        <div className="form-group commission-col-span-2">
                          <label className="form-label">Nuansa Warna</label>
                          <div className="form-nuansa-grid" role="radiogroup" aria-label="Pilihan Nuansa Warna">
                            {NUANSA_WARNA_OPTIONS.map(nuansa => {
                              const isChecked = orderForm.nuansa === nuansa.id;
                              return (
                                <label
                                  key={nuansa.id}
                                  className={`form-nuansa-card ${isChecked ? "active" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name="nuansa_warna"
                                    value={nuansa.id}
                                    checked={isChecked}
                                    onChange={() => setOrderForm(form => ({ ...form, nuansa: nuansa.id }))}
                                    className="form-nuansa-input"
                                  />
                                  <span
                                    className="form-nuansa-color-pip"
                                    style={{ backgroundColor: nuansa.swatch }}
                                    aria-hidden="true"
                                  />
                                  <div className="form-nuansa-text">
                                    <strong className="form-nuansa-name">{nuansa.label}</strong>
                                    <span className="form-nuansa-desc">{nuansa.detail}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="form-group commission-col-span-2">
                          <label className="form-label" htmlFor="order-pesan">
                            Catatan Khusus / Ucapan (Special Notes &amp; Gift Message)
                          </label>
                          <textarea
                            id="order-pesan"
                            className="form-textarea"
                            rows={3}
                            maxLength={1000}
                            placeholder="Tuliskan pesan singkat untuk kartu ucapan jika karya ini ditujukan sebagai hadiah."
                            value={orderForm.pesan}
                            onChange={event => setOrderForm(form => ({ ...form, pesan: event.target.value }))}
                          />
                        </div>

                        <div className="form-group commission-col-span-2 form-vip-wrap">
                          <label className="form-checkbox-label" htmlFor="order-vip">
                            <input
                              id="order-vip"
                              type="checkbox"
                              className="form-checkbox-input"
                              checked={orderForm.isVip}
                              onChange={event => setOrderForm(form => ({ ...form, isVip: event.target.checked }))}
                            />
                            <span className="form-checkbox-box" aria-hidden="true" />
                            <span className="form-checkbox-caption">
                              Saya sudah terdaftar di VIP Waiting List (Klaim Early-Bird Privilege)
                            </span>
                          </label>
                        </div>

                        <div className="commission-smart-qr-callout commission-col-span-2" role="note">
                          <div className="smart-qr-callout-icon" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7" rx="1.5" />
                              <rect x="14" y="3" width="7" height="7" rx="1.5" />
                              <rect x="3" y="14" width="7" height="7" rx="1.5" />
                              <rect x="14" y="14" width="7" height="7" rx="1.5" />
                            </svg>
                          </div>
                          <div className="smart-qr-callout-body">
                            <span className="smart-qr-callout-badge">Smart-QR Digital Memory Gate</span>
                            <p className="smart-qr-callout-text">
                              Tautan pengisian memori digital (foto kenangan, surat cinta, rekaman suara, &amp; video) akan dikirimkan otomatis melalui WhatsApp resmi setelah pembayaran DP 50% terverifikasi.
                            </p>
                          </div>
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
                      <button type="submit" className="lp-btn lp-btn--wine lp-submit" disabled={orderSubmitting}>
                        {orderSubmitting ? (
                          <>
                            <span className="commission-spinner" aria-hidden="true" />
                            Menyegel Lembar Pre-Order...
                          </>
                        ) : (
                          <>
                            <svg
                              className="lp-submit-wa-icon"
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.79.98-.15.17-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.25-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.44-.06-.13-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.32-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29" />
                            </svg>
                            Seal My Pre-Order (send)
                          </>
                        )}
                      </button>
                      <p className="commission-form-note">
                        Pre-order Anda akan langsung diproses dan diteruskan ke WhatsApp Concierge untuk konfirmasi ketersediaan slot &amp; verifikasi DP 50%.
                      </p>
                    </form>
                  </>
                )}
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
