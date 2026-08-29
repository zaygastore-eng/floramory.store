import { useState, useEffect, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import ProductImage from "@/components/ProductImage";
import { createPreOrder, fetchAllProducts, tierLabel, tierEmoji, tierBadgeClass, type Product } from "@/lib/sheets";
import { pageUrl, normalizeWhatsApp } from "@/lib/site";

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
          <span className="product-price">{product.harga}</span>
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
}: {
  product: Product;
  onClose: () => void;
  onOrder: (product: Product) => void;
}) {
  const tier = product.tier.toLowerCase();
  const emoji = tierEmoji(tier);
  const productImage = product.foto_produk;

  const chips: [string, string][] = [];
  if (product.bahan) chips.push(["Bahan", product.bahan]);
  if (product.ukuran) chips.push(["Ukuran", product.ukuran]);
  if (product.tier) chips.push(["Lini produk", tierLabel(tier)]);
  if (product.id) chips.push(["Serial produk", product.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="modal-hero">
          <ProductImage
            src={productImage}
            size="large"
            alt={product.nama_produk}
            width={800}
            height={800}
            fallback={<span className="emoji-fallback">{emoji}</span>}
          />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div className="modal-body">
          <span className="modal-tier">{tierLabel(tier)}</span>
          <div className="modal-name" id="product-modal-title">{product.nama_produk}</div>
          <div className="modal-price">{product.harga}</div>
          <p className="modal-desc">{product.deskripsi}</p>

          {chips.length > 0 && (
            <div className="modal-detail-grid">
              {chips.map(([label, val]) => (
                <div className="modal-detail-chip" key={label}>
                  <div className="chip-label">{label}</div>
                  <div className="chip-value">{val}</div>
                </div>
              ))}
            </div>
          )}

          <div className="modal-qr">
            <div className="modal-qr-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
              </svg>
            </div>
            <div className="modal-qr-text">
              <h4>Smart-Scan Memory Vault Tersedia</h4>
              <p>Setiap produk dilengkapi QR code unik untuk mengakses memori digital personal Anda.</p>
            </div>
          </div>
          <div className="modal-actions">
            <a
              href="#pesan"
              className="btn-primary"
              onClick={() => {
                onOrder(product);
                onClose();
              }}
            >
              Pesan Sekarang
            </a>
            <button type="button" className="btn-secondary" onClick={onClose}>Tutup</button>
          </div>
        </div>
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
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("✦ Pre-order Anda telah terkirim! Kami akan menghubungi via WhatsApp segera.");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
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
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = window.setTimeout(() => setToastVisible(false), 3500);
    return () => window.clearTimeout(timer);
  }, [toastVisible, toastMsg]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const filtered = filter === "all" ? products : products.filter(p => p.tier.toLowerCase() === filter);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  };

  const closeMenu = () => setMenuOpen(false);

  const orderProduct = (product: Product) => {
    setOrderForm(f => ({ ...f, produk: product.id }));
    window.setTimeout(() => {
      document.getElementById("pesan")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.nama.trim() || !orderForm.wa.trim()) {
      showToast("Lengkapi nama dan nomor WhatsApp terlebih dahulu.");
      return;
    }

    const wa = normalizeWhatsApp(orderForm.wa);
    if (wa.length < 10) {
      showToast("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
      return;
    }

    const selected = products.find(p => p.id === orderForm.produk);
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
      setOrderForm({ nama: "", wa: "", pesan: "", produk: "", namaPenerima: "", dari: "", pesanPersonal: "", website: "" });
      showToast("✦ Pre-order Anda tersimpan! Tim kami akan menghubungi via WhatsApp segera.");
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
          <h1>Kenangan Abadi<br />dalam <em>Bunga Nyata</em></h1>
          <p className="hero-sub">
            Aksesori & dekorasi premium dari preserved flower asli yang terintegrasi teknologi Smart-QR Code —
            simpan foto, video, dan pesan di dalam keindahan botani.
          </p>
          <a className="hero-cta" href="#produk">
            Jelajahi Koleksi
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
              Fitur Utama
              <span className="vault-eyebrow-line" />
            </div>
            <h2 className="vault-title">Smart-Scan<br /><em>Memory Vault</em></h2>
            <p className="vault-desc">Produk fisik yang hidup — kenangan digital yang tak pernah pudar. Setiap kali Anda atau penerima hadiah memindai QR-nya, momen berharga itu hadir kembali.</p>
            <ul className="vault-steps">
              {[
                { n: 1, title: "Pilih & Kustomisasi", desc: "Pilih bunga, desain, dan unggah foto/video kenangan Anda melalui landing page pre-order." },
                { n: 2, title: "Kami Produksi", desc: "Bunga diawetkan dengan silica gel lab, dituang dalam epoxy anti-UV, QR code ditanam dalam resin." },
                { n: 3, title: "Scan & Nikmati", desc: "Produk tiba. Scan QR, akses vault digital berisi kenangan — bisa diperbarui kapan saja." },
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
            <div className="vault-visual">
              <div className="vault-card"><div>📸</div><p>Galeri foto & video kenangan pribadi</p></div>
              <div className="vault-card"><div>🎵</div><p>Rekaman suara & pesan audio</p></div>
              <div className="vault-card"><div>🌿</div><p>Ensiklopedia botani spesies bunga</p></div>
              <div className="vault-card"><div>💌</div><p>Pesan teks emosional & ucapan</p></div>
              <div className="vault-card featured">
                <div className="vault-featured-icon">🔄</div>
                <p><strong className="vault-featured-strong">QR Dinamis</strong>Perbarui isi memori digital Anda kapan saja tanpa ganti produk fisik</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="fm-section about-section" id="tentang">
        <div className="about-inner">
          <div>
            <span className="section-eyebrow">Tentang Floramory</span>
            <h2 className="section-title">Sains, Seni &<br /><em>Keberlanjutan</em></h2>
            <p className="section-desc">Floramory lahir dari kepedulian terhadap limbah bunga pasca-perayaan kampus. Kami menyerap sisa pasokan florist lokal Surabaya untuk menciptakan produk premium bernilai emosional tinggi.</p>
            <div className="about-sdg">
              {[
                { icon: "♻️", num: "SDG 12", label: "Konsumsi & Produksi Bertanggung Jawab" },
                { icon: "💡", num: "SDG 9", label: "Industri, Inovasi & Infrastruktur" },
                { icon: "🌱", num: "SDG 8", label: "Pekerjaan Layak & Pertumbuhan Ekonomi" },
              ].map(({ icon, num, label }) => (
                <div className="sdg-card" key={num}>
                  <div className="sdg-icon">{icon}</div>
                  <div className="sdg-num">{num}</div>
                  <div className="sdg-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="about-stats">
              {[
                { num: "0", label: "Limbah botani — sumber bunga dari florist lokal Surabaya" },
                { num: "3–5", label: "Hari dehidrasi kilat dengan silica gel laboratorium" },
                { num: "Handmade", label: "Setiap produk dibuat kustom sesuai momen Anda" },
                { num: "∞", label: "Kenangan digital yang dapat diperbarui seumur hidup" },
              ].map(({ num, label }) => (
                <div className="stat-card" key={num}>
                  <div className="stat-num">{num}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
            <div className="about-quote">
              <p>"Menggunakan epoxy resin premium anti-UV dan teknik dehidrasi botani laboratorium untuk memastikan setiap bunga tetap crystal clear — tanpa yellowing, tanpa bubble — selamanya."</p>
              <div className="quote-author">Tim Floramory · FST Universitas Airlangga</div>
            </div>
          </div>
        </div>
      </section>

      <section className="fm-section order-section" id="pesan">
        <div className="order-inner">
          <span className="section-eyebrow order-center">Pre-Order Sekarang</span>
          <h2 className="section-title order-center">Abadikan <em>Momenmu</em></h2>
          <p className="section-desc order-center order-desc">Pesan sekarang dengan sistem Pre-Order. DP 50% untuk mulai produksi kustom Anda.</p>
          <form className="order-form-card" onSubmit={submitOrder}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="order-nama">Nama Lengkap</label>
                <input id="order-nama" className="form-input" type="text" placeholder="Nama Anda" required maxLength={120}
                  value={orderForm.nama} onChange={e => setOrderForm(f => ({ ...f, nama: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="order-wa">No. WhatsApp</label>
                <input id="order-wa" className="form-input" type="tel" placeholder="08xx-xxxx-xxxx" required maxLength={20}
                  value={orderForm.wa} onChange={e => setOrderForm(f => ({ ...f, wa: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="order-produk">Pilih Produk</label>
              <select id="order-produk" className="form-select" value={orderForm.produk} onChange={e => setOrderForm(f => ({ ...f, produk: e.target.value }))}>
                <option value="">— Pilih lini produk —</option>
                {products.length > 0 ? (
                  ["classic", "signature", "masterpiece"].map(tier => {
                    const tierProds = products.filter(p => p.tier.toLowerCase() === tier);
                    if (!tierProds.length) return null;
                    return (
                      <optgroup key={tier} label={tierLabel(tier)}>
                        {tierProds.map(p => <option key={p.id} value={p.id}>{p.nama_produk} — {p.harga}</option>)}
                      </optgroup>
                    );
                  })
                ) : (
                  <option value="" disabled>Katalog belum tersedia</option>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="order-pesan">Kustomisasi & Pesan Memori</label>
              <textarea id="order-pesan" className="form-textarea" maxLength={2000}
                placeholder="Ceritakan momen yang ingin diabadikan, pilihan bunga, warna, dan isi Memory Vault (foto/pesan) yang ingin Anda sertakan..."
                value={orderForm.pesan} onChange={e => setOrderForm(f => ({ ...f, pesan: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="order-penerima">Nama Penerima Memory Vault</label>
                <input id="order-penerima" className="form-input" type="text" placeholder="Contoh: Nabila Putri" maxLength={120}
                  value={orderForm.namaPenerima} onChange={e => setOrderForm(f => ({ ...f, namaPenerima: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="order-dari">Dari / Pengirim</label>
                <input id="order-dari" className="form-input" type="text" placeholder="Contoh: Keluarga Putri" maxLength={120}
                  value={orderForm.dari} onChange={e => setOrderForm(f => ({ ...f, dari: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="order-personal">Pesan Personal Untuk QR</label>
              <textarea id="order-personal" className="form-textarea" maxLength={2000}
                placeholder="Pesan ini bisa ditampilkan saat penerima scan QR produk..."
                value={orderForm.pesanPersonal} onChange={e => setOrderForm(f => ({ ...f, pesanPersonal: e.target.value }))} />
            </div>
            <div className="form-honeypot" aria-hidden="true">
              <label className="form-label" htmlFor="order-website">Website (jangan diisi)</label>
              <input id="order-website" className="form-input" type="text" tabIndex={-1} autoComplete="off"
                value={orderForm.website} onChange={e => setOrderForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <button type="submit" className="form-submit" disabled={orderSubmitting}>
              {orderSubmitting ? "Mengirim..." : "Kirim Pre-Order →"}
            </button>
            <p className="form-note">Tim kami akan menghubungi Anda via WhatsApp dalam 1×24 jam untuk konfirmasi detail & pembayaran DP 50%.</p>
          </form>
        </div>
      </section>
      </main>

      <footer className="fm-footer">
        <div className="footer-logo" aria-label="Floramory">
          <BrandLogo className="brand-logo-img footer-logo-img" />
        </div>
        <div className="footer-tagline">Smart Eco-Preserved Artware · Est. 2026</div>
        <ul className="footer-links">
          <li><a href="#produk">Produk</a></li>
          <li><a href="#memory-vault">Memory Vault</a></li>
          <li><a href="#tentang">Tentang</a></li>
          <li><a href="#pesan">Pesan</a></li>
        </ul>
        <div className="footer-divider" />
        <div className="footer-copy">© 2026 Floramory · Semua hak dilindungi</div>
        <div className="footer-unair">FST Young Entrepreneur · Universitas Airlangga, Surabaya</div>
      </footer>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onOrder={orderProduct}
        />
      )}

      <div className={`fm-toast${toastVisible ? " show" : ""}`} role="status">
        {toastMsg}
      </div>
    </>
  );
}
