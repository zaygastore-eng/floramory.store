import { useState, useEffect, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import ProductImage from "@/components/ProductImage";
import ProductSpecimen from "@/components/ProductSpecimen";
import { createPreOrder, fetchAllProducts, fetchWhatsAppNumber, tierLabel, tierEmoji, tierBadgeClass, type Product } from "@/lib/sheets";
import { pageUrl, normalizeWhatsApp, formatHarga } from "@/lib/site";
import useToast from "@/hooks/useToast";

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const tier = product.tier.toLowerCase();
  const emoji = tierEmoji(tier);
  const badgeClass = tierBadgeClass(tier);
  const badge = tierLabel(tier);
  const productImage = product.foto_produk;
  const desc = product.deskripsi ? product.deskripsi.slice(0, 80) + (product.deskripsi.length > 80 ? "…" : "") : "";

  return (
    <button type="button" className="product-card" onClick={onClick}>
      <div className="product-img">
        <ProductImage
          src={productImage}
          size="thumb"
          alt={product.nama_produk}
          width={600}
          height={600}
          loading="lazy"
          fallback={
            <>
              <div className="flower-bg">{emoji}</div>
              <div className="flower-main">{emoji}</div>
            </>
          }
        />
        <span className={`product-badge ${badgeClass}`}>{badge}</span>
        <div className="product-qr-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
          </svg>
        </div>
      </div>
      <div className="product-info">
        <div className="product-name">{product.nama_produk}</div>
        {desc && <div className="product-desc">{desc}</div>}
        <div className="product-footer">
          <span className="product-price">{formatHarga(product.harga)}</span>
          <span className="product-btn">Detail</span>
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
  onOrder: (product: Product) => void;
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
    `Hello Floramory, I'd like to consult on customizing ${product.nama_produk} (ID: ${product.id})`
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
        <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup detail produk">✕</button>
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

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { toastMsg, toastVisible, showToast } = useToast(3500);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [lastOrderWaUrl, setLastOrderWaUrl] = useState<string | null>(null);
  const [orderStep, setOrderStep] = useState<1 | 2>(1);
  const [prefilledProductName, setPrefilledProductName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const [vaultSimTab, setVaultSimTab] = useState<"foto" | "audio" | "surat" | "botani">("foto");
  const [orderForm, setOrderForm] = useState({
    nama: "",
    wa: "",
    pesan: "",
    produk: "",
    namaPenerima: "",
    dari: "",
    pesanPersonal: "",
    website: "",
  });
  const formStartRef = useRef(Date.now());

  useEffect(() => {
    fetchAllProducts()
      .then(loadedProducts => {
        setProducts(loadedProducts);
        const preselectedId = new URLSearchParams(window.location.search).get("product");
        const preselectedProduct = loadedProducts.find(product => product.id === preselectedId);
        if (preselectedProduct) {
          setOrderForm(form => ({ ...form, produk: preselectedProduct.id }));
          setPrefilledProductName(preselectedProduct.nama_produk);
          setOrderStep(1);
          window.setTimeout(() => {
            document.getElementById("pesan")?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
    fetchWhatsAppNumber().then(number => {
      setWhatsappNumber(normalizeWhatsApp(number) || "6285235242425");
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const filtered = filter === "all" ? products : products.filter(p => p.tier.toLowerCase() === filter);

  const closeMenu = () => setMenuOpen(false);

  const handleVaultTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = ["foto", "audio", "surat", "botani"] as const;
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
    window.requestAnimationFrame(() => document.getElementById(`vault-tab-${nextTab}`)?.focus());
  };

  const orderProduct = (product: Product) => {
    setOrderForm(f => ({ ...f, produk: product.id }));
    setPrefilledProductName(product.nama_produk);
    setOrderStep(1);
    window.setTimeout(() => {
      document.getElementById("pesan")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderStep === 1) {
      if (!orderForm.nama.trim() || !orderForm.wa.trim()) {
        showToast("Lengkapi nama dan nomor WhatsApp terlebih dahulu.");
        return;
      }
      const phoneDigits = orderForm.wa.replace(/\D/g, "");
      if (!/^(?:08\d{8,11}|628\d{8,11})$/.test(phoneDigits)) {
        showToast("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
        return;
      }
      if (!orderForm.produk) {
        showToast("Pilih produk yang ingin Anda pesan terlebih dahulu.");
        return;
      }
      setOrderStep(2);
      return;
    }

    if (!orderForm.nama.trim() || !orderForm.wa.trim() || !orderForm.produk) {
      showToast("Periksa kembali nama, WhatsApp, dan produk pilihan Anda.");
      setOrderStep(1);
      return;
    }

    const phoneDigits = orderForm.wa.replace(/\D/g, "");
    if (!/^(?:08\d{8,11}|628\d{8,11})$/.test(phoneDigits)) {
      showToast("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
      setOrderStep(1);
      return;
    }
    const wa = normalizeWhatsApp(orderForm.wa);

    const selected = products.find(p => p.id === orderForm.produk);
    setLastOrderWaUrl(null);
    setOrderSubmitting(true);
    try {
      await createPreOrder(
        {
          customer_name: orderForm.nama,
          whatsapp: wa,
          product_id: orderForm.produk,
          product_name: selected?.nama_produk || orderForm.produk,
          custom_request: orderForm.pesan,
          recipient_name: orderForm.namaPenerima,
          sender_name: orderForm.dari,
          personal_message: orderForm.pesanPersonal,
        },
        {
          honeypot: orderForm.website,
          fillMs: Date.now() - formStartRef.current,
        }
      );
      formStartRef.current = Date.now();
      setOrderForm({ nama: "", wa: "", pesan: "", produk: "", namaPenerima: "", dari: "", pesanPersonal: "", website: "" });
      setPrefilledProductName("");
      setOrderStep(1);
      const waNumber = normalizeWhatsApp(await fetchWhatsAppNumber());
      const waMessage = encodeURIComponent(
        `Halo Floramory, saya ingin konfirmasi pre-order atas nama ${orderForm.nama}${selected ? ` untuk produk ${selected.nama_produk}` : ""}.`
      );
      const waUrl = `https://wa.me/${waNumber}?text=${waMessage}`;
      const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
      setLastOrderWaUrl(waUrl);
      if (!opened || opened.closed || typeof opened.closed === "undefined") {
        showToast("Pre-order tersimpan! Klik tombol di bawah untuk konfirmasi WhatsApp.");
      } else {
        showToast("Pre-order terkirim! Mengarahkan ke WhatsApp...");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengirim pre-order. Silakan coba lagi.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <>
      <nav className="fm-nav">
        <a className="nav-logo logo-link" href={pageUrl("/")} aria-label="Floramory">
          <BrandLogo />
        </a>
        <button
          type="button"
          className="nav-menu-btn"
          aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
          aria-expanded={menuOpen}
          aria-controls="nav-links"
          onClick={() => setMenuOpen(open => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <ul className={`nav-links${menuOpen ? " open" : ""}`} id="nav-links">
          <li><a href="#produk" onClick={closeMenu}>Produk</a></li>
          <li><a href="#memory-vault" onClick={closeMenu}>Memory Vault</a></li>
          <li><a href="#tentang" onClick={closeMenu}>Tentang</a></li>
          <li><a href="#pesan" onClick={closeMenu}>Pesan</a></li>
        </ul>
        <span className="nav-badge">Smart QR ✦ Eco</span>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <div className="hero-eyebrow">Smart Eco-Preserved Artware</div>
          <h1>Botanical beauty,<br /><em>made timeless.</em></h1>
          <p className="hero-sub">
            Bunga pilihan yang diawetkan dengan presisi laboratorium, dituangkan dalam resin kristal,
            dan dipertemukan dengan kenangan yang ingin Anda simpan selamanya.
          </p>
          <a className="hero-cta" href="#produk">
            Explore Collection
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </section>

      <main className="home-sections">
      <section className="fm-section products-section" id="produk">
        <div className="catalog-section">
          <div className="catalog-header">
            <span className="section-eyebrow">Koleksi Produk</span>
            <h2 className="section-title">Tiga Lini <em>Eksklusif</em></h2>
            <p className="section-desc">Dari aksesori harian hingga dekorasi rumah premium — setiap produk membawa keindahan botani dan kenangan digital.</p>
          </div>
          <div className="tier-tabs">
            {[
              { val: "all", label: "Semua Produk" },
              { val: "classic", label: "Floramory Classic" },
              { val: "signature", label: "Floramory Signature" },
              { val: "masterpiece", label: "Floramory Masterpiece" },
            ].map(tab => (
              <button key={tab.val} type="button" className={`tier-tab${filter === tab.val ? " active" : ""}`}
                onClick={() => setFilter(tab.val)}>{tab.label}</button>
            ))}
          </div>

          {loadingProducts ? (
            <div className="catalog-loading">
              Memuat produk dari katalog
              <span className="loading-dots"><span /><span /><span /></span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="catalog-loading">
              {products.length === 0
                ? "Belum ada produk di katalog. Tambahkan data di admin."
                : "Tidak ada produk di kategori ini."}
            </div>
          ) : (
            <div className="products-grid">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} onClick={() => setSelectedProduct(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="fm-section vault-section" id="memory-vault">
        <div className="vault-inner">
          <div>
            <div className="vault-eyebrow">
              <span className="vault-eyebrow-line" />
              Inovasi Smart-Scan
              <span className="vault-eyebrow-line" />
            </div>
            <h2 className="vault-title">Smart-Scan<br /><em>Memory Vault</em></h2>
            <p className="vault-desc">Karya seni botani fisik yang hidup — kenangan digital yang tak pernah pudar. Setiap kali Anda atau penerima memindai QR mikronya, momen berharga kembali hadir di layar gawai.</p>
            <ul className="vault-steps">
              {[
                { n: 1, title: "Pilih & Kustomisasi", desc: "Pilih lini produk, bunga favorit, dan masukkan foto, pesan suara, atau surat personal Anda." },
                { n: 2, title: "Laboratorium Preservasi & Casting", desc: "Bunga diawetkan secara dehidrasi laboratorium, dituang dalam epoxy kristal anti-UV dengan chip micro-QR permanen." },
                { n: 3, title: "Scan Langsung & Update Selamanya", desc: "Cukup dekatkan kamera ponsel tanpa aplikasi. Isi vault digital dapat diperbarui kapan saja seumur hidup." },
              ].map(({ n, title, desc }) => (
                <li className="vault-step" key={n}>
                  <div className="vault-step-num">{n}</div>
                  <div className="vault-step-text">
                    <h4>{title}</h4>
                    <p>{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="vault-simulator-wrap">
              <div className="vault-simulator-header">
                <span className="vault-sim-dot red" />
                <span className="vault-sim-dot yellow" />
                <span className="vault-sim-dot green" />
                <span className="vault-sim-title">A glimpse inside your Memory Vault</span>
              </div>

              <div className="vault-sim-nav" role="tablist" aria-label="Memory Vault preview">
                <button
                  type="button"
                  role="tab"
                  id="vault-tab-foto"
                  aria-controls="vault-panel"
                  aria-selected={vaultSimTab === "foto"}
                  tabIndex={vaultSimTab === "foto" ? 0 : -1}
                  className={`vault-sim-btn${vaultSimTab === "foto" ? " active" : ""}`}
                  onClick={() => setVaultSimTab("foto")}
                  onKeyDown={handleVaultTabKeyDown}
                >
                  <span aria-hidden="true">📸</span> <span>Photo Gallery</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="vault-tab-audio"
                  aria-controls="vault-panel"
                  aria-selected={vaultSimTab === "audio"}
                  tabIndex={vaultSimTab === "audio" ? 0 : -1}
                  className={`vault-sim-btn${vaultSimTab === "audio" ? " active" : ""}`}
                  onClick={() => setVaultSimTab("audio")}
                  onKeyDown={handleVaultTabKeyDown}
                >
                  <span aria-hidden="true">🎵</span> <span>Voice Note</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="vault-tab-surat"
                  aria-controls="vault-panel"
                  aria-selected={vaultSimTab === "surat"}
                  tabIndex={vaultSimTab === "surat" ? 0 : -1}
                  className={`vault-sim-btn${vaultSimTab === "surat" ? " active" : ""}`}
                  onClick={() => setVaultSimTab("surat")}
                  onKeyDown={handleVaultTabKeyDown}
                >
                  <span aria-hidden="true">💌</span> <span>Personal Letter</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="vault-tab-botani"
                  aria-controls="vault-panel"
                  aria-selected={vaultSimTab === "botani"}
                  tabIndex={vaultSimTab === "botani" ? 0 : -1}
                  className={`vault-sim-btn${vaultSimTab === "botani" ? " active" : ""}`}
                  onClick={() => setVaultSimTab("botani")}
                  onKeyDown={handleVaultTabKeyDown}
                >
                  <span aria-hidden="true">🌿</span> <span>Botanical Profile</span>
                </button>
              </div>

              <div
                className="vault-sim-body"
                id="vault-panel"
                role="tabpanel"
                aria-labelledby={`vault-tab-${vaultSimTab}`}
                aria-live="polite"
              >
                {vaultSimTab === "foto" && (
                  <div className="sim-panel" key="foto">
                    <div className="sim-polaroid">
                      <div className="sim-polaroid-img">
                        <span className="sim-tag">Graduation 2026 · Surabaya</span>
                        <div className="sim-photo-art" aria-hidden="true">
                          <span className="sim-photo-sun" />
                          <span className="sim-photo-flower">✿</span>
                          <span className="sim-photo-flower sim-photo-flower-small">✿</span>
                          <span className="sim-photo-caption">a day to remember</span>
                        </div>
                      </div>
                      <div className="sim-polaroid-caption">
                        <strong>“To endless memories and new beginnings.”</strong>
                        <span className="sim-photo-count">12 High-Res Photos Preserved</span>
                      </div>
                    </div>
                  </div>
                )}

                {vaultSimTab === "audio" && (
                  <div className="sim-panel" key="audio">
                    <div className="sim-audio-card">
                      <div className="sim-audio-heading">
                        <div>
                          <span className="sim-audio-badge">✦ Crystal Audio</span>
                          <div className="sim-audio-title">A voice to keep close</div>
                        </div>
                        <span className="sim-audio-art" aria-hidden="true">♫</span>
                      </div>
                      <div className="sim-waveform" aria-hidden="true">
                        {[24, 38, 58, 34, 72, 48, 88, 55, 96, 42, 68, 34, 82, 50, 100, 58, 75, 38, 64, 46, 86, 54, 72, 32, 60, 42, 92, 48, 68, 36, 78, 52].map((height, index) => (
                          <span key={index} style={{ height: `${height}%`, animationDelay: `${index * 35}ms` }} />
                        ))}
                      </div>
                      <div className="sim-audio-time">
                        <span><span aria-hidden="true">▶</span> 01:28 <span className="sim-audio-duration">/ 02:15</span></span>
                        <span>Voice note · 2:15</span>
                      </div>
                      <p className="sim-audio-transcript-label">A moment in their own words</p>
                      <p className="sim-audio-snippet">“Thank you for standing by me through every season...”</p>
                    </div>
                  </div>
                )}

                {vaultSimTab === "surat" && (
                  <div className="sim-panel" key="surat">
                    <div className="sim-letter-card">
                      <div className="sim-letter-seal" aria-hidden="true">✦</div>
                      <div className="sim-letter-kicker">A letter, kept close</div>
                      <div className="sim-letter-head">To My Dearest...</div>
                      <p className="sim-letter-text">
                        If time could be gathered like these petals, I would keep every little moment we shared. Until we make new memories, let this one remind you how deeply you are loved.
                      </p>
                      <div className="sim-letter-foot">With all my love,<br /><strong>Always yours</strong></div>
                      <span className="sim-letter-stamp">F · SBY</span>
                    </div>
                  </div>
                )}

                {vaultSimTab === "botani" && (
                  <div className="sim-panel" key="botani">
                    <div className="sim-botani-card">
                      <div className="sim-botani-tag">Botanical field notes <span>SPECIMEN 01—02</span></div>
                      <h4>Hydrangea macrophylla<br /><span>&amp; Gypsophila</span></h4>
                      <div className="sim-botani-meta">
                        <div className="sim-botani-item">
                          <strong>Symbolism</strong>
                          <span>Gratitude &amp; Grace</span>
                        </div>
                        <div className="sim-botani-item">
                          <strong>Preservation</strong>
                          <span>Laboratory silica dehydration · 3–5 days</span>
                        </div>
                        <div className="sim-botani-item">
                          <strong>Encapsulation</strong>
                          <span>Bubble-free, UV-resistant crystal epoxy</span>
                        </div>
                        <div className="sim-botani-cert">
                          <span aria-hidden="true">✧</span>
                          <div><strong>Floramory Preservation Certificate</strong><small>Hand-finished · Surabaya, Indonesia</small></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="vault-sim-footer">
                <span className="vault-sim-qr-tag">✦ Embedded permanent micro-QR — Scannable instantly using any native smartphone camera. No app download required.</span>
              </div>
            </div>
          </div>
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
          <span className="section-eyebrow order-center">Pre-Order Sekarang</span>
          <h2 className="section-title order-center">Abadikan <em>Momenmu</em></h2>
          <p className="section-desc order-center order-desc">Pesan sekarang dengan sistem Pre-Order. DP 50% untuk mulai produksi kustom Anda.</p>

          <div className="order-trust-badges">
            <div className="order-trust-item">
              <span>🌿</span>
              <span>100% Bunga Asli Terpreservasi</span>
            </div>
            <div className="order-trust-item">
              <span>🛡️</span>
              <span>DP 50% Aman via WhatsApp</span>
            </div>
            <div className="order-trust-item">
              <span>🔄</span>
              <span>QR Vault Dinamis Seumur Hidup</span>
            </div>
          </div>

          <form className="order-form-card" onSubmit={submitOrder}>
            <div className="order-stepper" aria-label={`Langkah ${orderStep} dari 2`}>
              {[1, 2].map(step => (
                <div className={`order-stepper-item${orderStep === step ? " active" : ""}${orderStep > step ? " complete" : ""}`} key={step}>
                  <span className="order-stepper-number">{orderStep > step ? "✓" : step}</span>
                  <span>{step === 1 ? "Produk & Kontak" : "Personalisasi Vault"}</span>
                </div>
              ))}
            </div>

            {orderStep === 1 ? (
              <div className="order-step-content">
                <div className="form-step-title">
                  <span className="step-num">1</span>
                  <span>Produk & Kontak Pemesan</span>
                </div>
                <p className="order-step-intro">Mulai dengan memilih karya dan memberi tahu kami cara menghubungi Anda.</p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="order-nama">Nama Lengkap</label>
                    <input id="order-nama" className="form-input" type="text" placeholder="Nama Anda" maxLength={120} autoComplete="name"
                      value={orderForm.nama} onChange={e => setOrderForm(f => ({ ...f, nama: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="order-wa">No. WhatsApp</label>
                    <input id="order-wa" className="form-input" type="tel" inputMode="tel" placeholder="08xx-xxxx-xxxx" maxLength={20} autoComplete="tel"
                      aria-describedby="order-wa-hint" value={orderForm.wa} onChange={e => setOrderForm(f => ({ ...f, wa: e.target.value }))} />
                    <span className="form-field-hint" id="order-wa-hint">Gunakan format nomor Indonesia 08xx atau 62xx.</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="order-produk">Pilih Produk</label>
                  <select id="order-produk" className="form-select" value={orderForm.produk} onChange={e => {
                    setOrderForm(f => ({ ...f, produk: e.target.value }));
                    setPrefilledProductName("");
                  }}>
                    <option value="">— Pilih lini produk —</option>
                    {products.length > 0 ? (
                      ["classic", "signature", "masterpiece"].map(tier => {
                        const tierProds = products.filter(p => p.tier.toLowerCase() === tier);
                        if (!tierProds.length) return null;
                        return (
                          <optgroup key={tier} label={tierLabel(tier)}>
                            {tierProds.map(p => <option key={p.id} value={p.id}>{p.nama_produk} — {formatHarga(p.harga)}</option>)}
                          </optgroup>
                        );
                      })
                    ) : (
                      <option value="" disabled>Katalog belum tersedia</option>
                    )}
                  </select>
                  {prefilledProductName && (
                    <span className="form-prefill-indicator" role="status">
                      Terpilih dari produk: {prefilledProductName}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="order-pesan">Kustomisasi Bunga & Permintaan Desain</label>
                  <textarea id="order-pesan" className="form-textarea" maxLength={2000}
                    placeholder="Ceritakan momen yang ingin diabadikan, pilihan bunga, palet warna, atau bentuk yang Anda inginkan..."
                    value={orderForm.pesan} onChange={e => setOrderForm(f => ({ ...f, pesan: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="order-step-content">
                <div className="form-step-title">
                  <span className="step-num">2</span>
                  <span>Personalisasi Smart QR Memory Vault</span>
                </div>
                <p className="order-step-intro">Siapkan detail penerima dan pesan yang akan hadir di dalam Memory Vault.</p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="order-penerima">Nama Penerima Memory Vault</label>
                    <input id="order-penerima" className="form-input" type="text" placeholder="Contoh: Nabila Putri" maxLength={120} autoComplete="off"
                      value={orderForm.namaPenerima} onChange={e => setOrderForm(f => ({ ...f, namaPenerima: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="order-dari">Dari / Pengirim</label>
                    <input id="order-dari" className="form-input" type="text" placeholder="Contoh: Keluarga & Sahabat" maxLength={120} autoComplete="off"
                      value={orderForm.dari} onChange={e => setOrderForm(f => ({ ...f, dari: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="order-personal">Pesan Personal / Surat Digital Untuk QR</label>
                  <textarea id="order-personal" className="form-textarea" maxLength={2000}
                    placeholder="Tuliskan ucapan atau pesan berharga yang akan muncul saat penerima memindai QR code..."
                    value={orderForm.pesanPersonal} onChange={e => setOrderForm(f => ({ ...f, pesanPersonal: e.target.value }))} />
                </div>
                <div className="order-review-note">
                  <span aria-hidden="true">✦</span>
                  <span>Tim Floramory akan mengonfirmasi detail pesanan dan DP 50% melalui WhatsApp.</span>
                </div>
              </div>
            )}
            <div className="form-honeypot" aria-hidden="true">
              <input id="order-website" className="form-input" type="text" tabIndex={-1} autoComplete="off"
                value={orderForm.website} onChange={e => setOrderForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className={`order-form-actions${orderStep === 2 ? " has-back" : ""}`}>
              {orderStep === 2 && (
                <button type="button" className="order-back-button" disabled={orderSubmitting} onClick={() => setOrderStep(1)}>
                  ← Kembali
                </button>
              )}
              <button type="submit" className="form-submit" disabled={orderSubmitting}>
                {orderSubmitting ? "Mengirim..." : orderStep === 1 ? "Lanjut ke Personalisasi →" : "Kirim Pre-Order →"}
              </button>
            </div>
            {lastOrderWaUrl && (
              <a href={lastOrderWaUrl} target="_blank" rel="noopener noreferrer" className="btn-wa-confirm">
                💬 Buka WhatsApp untuk Konfirmasi Pesanan →
              </a>
            )}
            <p className="form-note">Data Anda aman. Tim kami akan menghubungi Anda via WhatsApp dalam 1×24 jam.</p>
          </form>
        </div>
      </section>
      </main>

      <footer className="fm-footer">
        <div className="footer-logo" aria-label="Floramory">
          <BrandLogo className="brand-logo-img footer-logo-img" />
        </div>
        <ul className="footer-links">
          <li><a href="#produk">Produk</a></li>
          <li><a href="#memory-vault">Memory Vault</a></li>
          <li><a href="#tentang">Tentang</a></li>
          <li><a href="#pesan">Pesan</a></li>
        </ul>
        <div className="footer-divider" />
        <div className="footer-copy">© 2026 Floramory · Semua hak dilindungi</div>
        <div className="footer-signature">Atelier Floramory · Surabaya, Indonesia · Handcrafted Botanical Artware</div>
      </footer>

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
