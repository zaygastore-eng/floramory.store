import { useState, useEffect } from "react";
import { fetchAllProducts, tierLabel, tierEmoji, tierBadgeClass, type Product } from "@/lib/sheets";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const tier = product.tier.toLowerCase();
  const emoji = tierEmoji(tier);
  const badgeClass = tierBadgeClass(tier);
  const badge = tierLabel(tier);
  const productImage = product.foto_produk || product.foto_url;
  const hasProductImage = productImage.startsWith("http");
  const desc = product.deskripsi ? product.deskripsi.slice(0, 80) + (product.deskripsi.length > 80 ? "…" : "") : "";

  return (
    <div className="product-card" onClick={onClick}>
      <div className="product-img">
        {hasProductImage && (
          <img src={productImage} alt={product.nama_produk} />
        )}
        {!hasProductImage && (
          <>
            <div className="flower-bg">{emoji}</div>
            <div className="flower-main">{emoji}</div>
          </>
        )}
        <span className={`product-badge ${badgeClass}`}>{badge}</span>
        <div className="product-qr-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
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
    </div>
  );
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const tier = product.tier.toLowerCase();
  const emoji = tierEmoji(tier);
  const productImage = product.foto_produk || product.foto_url;
  const hasProductImage = productImage.startsWith("http");

  const chips: [string, string][] = [];
  if (product.bahan) chips.push(["Bahan", product.bahan]);
  if (product.ukuran) chips.push(["Ukuran", product.ukuran]);
  if (product.tier) chips.push(["Lini produk", tierLabel(tier)]);
  if (product.id) chips.push(["Serial produk", product.id]);

  const produkUrl = `${BASE_PATH}/produk?id=${product.id}`;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-hero">
          {hasProductImage && (
            <img src={productImage} alt={product.nama_produk} />
          )}
          {!hasProductImage && <span className="emoji-fallback">{emoji}</span>}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <span className="modal-tier">{tierLabel(tier)}</span>
          <div className="modal-name">{product.nama_produk}</div>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
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
            <a href="#pesan" className="btn-primary" onClick={onClose}>Pesan Sekarang</a>
            <button className="btn-secondary" onClick={onClose}>Tutup</button>
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
  const [toastVisible, setToastVisible] = useState(false);
  const [orderForm, setOrderForm] = useState({ nama: "", wa: "", pesan: "", produk: "" });

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, []);

  const filtered = filter === "all" ? products : products.filter(p => p.tier.toLowerCase() === filter);

  const showToast = () => { setToastVisible(true); setTimeout(() => setToastVisible(false), 3500); };

  const submitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    showToast();
  };

  return (
    <>
      {/* NAV */}
      <nav className="fm-nav">
        <a className="nav-logo" href="#">Flora<span>mory</span></a>
        <ul className="nav-links">
          <li><a href="#produk">Produk</a></li>
          <li><a href="#memory-vault">Memory Vault</a></li>
          <li><a href="#tentang">Tentang</a></li>
          <li><a href="#pesan">Pesan</a></li>
        </ul>
        <span className="nav-badge">Smart QR ✦ Eco</span>
      </nav>

      <main className="home-sections">
      {/* PRODUCTS */}
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
              { val: "lite", label: "Floramory Lite" },
              { val: "signature", label: "Floramory Signature" },
              { val: "home", label: "Floramory Home" },
            ].map(tab => (
              <button key={tab.val} className={`tier-tab${filter === tab.val ? " active" : ""}`}
                onClick={() => setFilter(tab.val)}>{tab.label}</button>
            ))}
          </div>

          {loadingProducts ? (
            <div className="catalog-loading">
              Memuat produk dari Google Sheets
              <span className="loading-dots"><span /><span /><span /></span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="catalog-loading">
              {products.length === 0
                ? "Belum ada produk di spreadsheet. Tambahkan data di Google Sheets Anda."
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

      {/* MEMORY VAULT SECTION */}
      <section className="fm-section vault-section" id="memory-vault">
        <div className="vault-inner">
          <div>
            <div className="vault-eyebrow">
              <span style={{ display: "block", width: 24, height: 1, background: "rgba(200,219,197,0.5)" }} />
              Fitur Utama
              <span style={{ display: "block", width: 24, height: 1, background: "rgba(200,219,197,0.5)" }} />
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
                <div style={{ fontSize: "2rem" }}>🔄</div>
                <p><strong style={{ color: "#fff", display: "block", marginBottom: 4 }}>QR Dinamis</strong>Perbarui isi memori digital Anda kapan saja tanpa ganti produk fisik</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
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
                { num: "60%", label: "Margin keuntungan kotor lini Signature" },
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

      {/* ORDER */}
      <section className="fm-section order-section" id="pesan">
        <div className="order-inner">
          <span className="section-eyebrow" style={{ textAlign: "center", display: "block" }}>Pre-Order Sekarang</span>
          <h2 className="section-title" style={{ textAlign: "center" }}>Abadikan <em>Momenmu</em></h2>
          <p className="section-desc" style={{ textAlign: "center", margin: "0 auto" }}>Pesan sekarang dengan sistem Pre-Order. DP 50% untuk mulai produksi kustom Anda.</p>
          <form className="order-form-card" onSubmit={submitOrder}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input className="form-input" type="text" placeholder="Nama Anda"
                  value={orderForm.nama} onChange={e => setOrderForm(f => ({ ...f, nama: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">No. WhatsApp</label>
                <input className="form-input" type="tel" placeholder="08xx-xxxx-xxxx"
                  value={orderForm.wa} onChange={e => setOrderForm(f => ({ ...f, wa: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Pilih Produk</label>
              <select className="form-select" value={orderForm.produk} onChange={e => setOrderForm(f => ({ ...f, produk: e.target.value }))}>
                <option value="">— Pilih lini produk —</option>
                {products.length > 0 ? (
                  <>
                    {["lite", "signature", "home"].map(tier => {
                      const tierProds = products.filter(p => p.tier.toLowerCase() === tier);
                      if (!tierProds.length) return null;
                      return (
                        <optgroup key={tier} label={tierLabel(tier)}>
                          {tierProds.map(p => <option key={p.id} value={p.id}>{p.nama_produk} — {p.harga}</option>)}
                        </optgroup>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <optgroup label="Floramory Lite (Rp 30.000 – 85.000)">
                      <option>Cincin Preserved Flower</option>
                      <option>Anting Botani</option>
                      <option>Gantungan Kunci Resin</option>
                    </optgroup>
                    <optgroup label="Floramory Signature (Rp 135.000 – 450.000+)">
                      <option>Plakat Wisuda Kustom</option>
                      <option>Full Set Aksesori Premium</option>
                    </optgroup>
                    <optgroup label="Floramory Home Decor (Rp 135.000 – 450.000+)">
                      <option>Lampu Tidur Botani</option>
                      <option>Figura Dinding Preserved Flower</option>
                    </optgroup>
                  </>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kustomisasi & Pesan Memori</label>
              <textarea className="form-textarea"
                placeholder="Ceritakan momen yang ingin diabadikan, pilihan bunga, warna, dan isi Memory Vault (foto/pesan) yang ingin Anda sertakan..."
                value={orderForm.pesan} onChange={e => setOrderForm(f => ({ ...f, pesan: e.target.value }))} />
            </div>
            <button type="submit" className="form-submit">Kirim Pre-Order →</button>
            <p className="form-note">Tim kami akan menghubungi Anda via WhatsApp dalam 1×24 jam untuk konfirmasi detail & pembayaran DP 50%.</p>
          </form>
        </div>
      </section>
      </main>

      {/* FOOTER */}
      <footer className="fm-footer">
        <div className="footer-logo">Flora<span>mory</span></div>
        <div className="footer-tagline">Smart Eco-Preserved Artware · Est. 2026</div>
        <ul className="footer-links">
          <li><a href="#produk">Produk</a></li>
          <li><a href="#memory-vault">Memory Vault</a></li>
          <li><a href="#tentang">Tentang</a></li>
          <li><a href="#pesan">Pesan</a></li>
          <li><a href={`${BASE_PATH}/admin`} style={{ color: "rgba(200,219,197,0.4)" }}>Admin</a></li>
        </ul>
        <div className="footer-divider" />
        <div className="footer-copy">© 2026 Floramory · Semua hak dilindungi</div>
        <div className="footer-unair">FST Young Entrepreneur · Universitas Airlangga, Surabaya</div>
      </footer>

      {/* MODAL */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {/* TOAST */}
      <div className={`fm-toast${toastVisible ? " show" : ""}`}>
        ✦ Pre-order Anda telah terkirim! Kami akan menghubungi via WhatsApp segera.
      </div>
    </>
  );
}
