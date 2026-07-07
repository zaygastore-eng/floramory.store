import { useEffect, useState } from "react";
import { fetchProductById, tierLabel, tierEmoji, tierBg, type Product } from "@/lib/sheets";

const WA_NUMBER = "6281234567890";

export default function Produk() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || params.get("ID");
    if (!id) { setError(true); setLoading(false); return; }

    fetchProductById(id)
      .then((p) => {
        if (!p) { setError(true); } else { setProduct(p); document.title = `${p.nama_produk} — Floramory`; }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">Flora<span>mory</span></div>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="error-screen">
        <div className="error-icon">🌾</div>
        <div className="error-title">Produk tidak ditemukan</div>
        <p className="error-msg">QR code ini mungkin tidak valid atau produk sudah tidak tersedia. Hubungi kami untuk bantuan.</p>
        <br />
        <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: "0.85rem", color: "var(--sage)", textDecoration: "none" }}>
          Hubungi Floramory via WhatsApp →
        </a>
      </div>
    );
  }

  const tier = product.tier.toLowerCase();
  const emoji = tierEmoji(tier);
  const heroBg = tierBg(tier);

  const waMsg = encodeURIComponent(
    `Halo Floramory! 🌸\n\nSaya tertarik dengan produk:\n*${product.nama_produk}* (${product.id})\nHarga: ${product.harga}\n\nApakah masih tersedia? Saya ingin tanya lebih lanjut.`
  );

  const chips: [string, string][] = [];
  if (product.bahan) chips.push(["Bahan", product.bahan]);
  if (product.ukuran) chips.push(["Ukuran", product.ukuran]);
  if (product.tier) chips.push(["Lini produk", tierLabel(tier)]);
  if (product.id) chips.push(["Serial produk", product.id]);

  const shareProduct = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${product.nama_produk} — Floramory`, url });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(url).then(() => showToast("✦ Link berhasil disalin!"));
  };

  return (
    <div className="produk-page">
      <header className="site-header">
        <a className="header-logo" href="/">Flora<span>mory</span></a>
        <span className="header-badge">{tierLabel(tier)}</span>
      </header>

      <div className="product-hero" style={{ background: heroBg }}>
        {product.foto_url && product.foto_url.startsWith("http") && (
          <img src={product.foto_url} alt={product.nama_produk} />
        )}
        <div className="hero-emoji">{emoji}</div>
        <div className="tier-ribbon">{tierLabel(tier)}</div>
        <span className="serial-tag">#{product.id || "—"}</span>
        <div className="hero-overlay" />
      </div>

      <div className="produk-body">
        <div className="produk-name">{product.nama_produk || "—"}</div>
        <div className="produk-price">{product.harga || "—"}</div>
        <div className="divider" />

        <div className="botanical-tag">✦ {product.bunga || "Preserved Flower"}</div>
        <span className="section-label">Tentang produk ini</span>
        <p className="description-text">{product.deskripsi || "—"}</p>

        {chips.length > 0 && (
          <div className="detail-grid">
            {chips.map(([label, val]) => (
              <div className="detail-chip" key={label}>
                <div className="chip-label">{label}</div>
                <div className="chip-value">{val}</div>
              </div>
            ))}
          </div>
        )}

        <div className="memory-vault">
          <div className="vault-header">
            <div className="vault-icon">💌</div>
            <div>
              <div className="vault-title-text">Memory Vault</div>
              <div className="vault-subtitle">Pesan personal untuk pemilik produk ini</div>
            </div>
          </div>
          {product.pesan_personal && product.pesan_personal.trim() ? (
            <div className="vault-message">
              "{product.pesan_personal}"
              <div className="vault-from">— {product.dari || "Floramory"}, untuk {product.nama_pembeli || "Anda"}</div>
            </div>
          ) : (
            <p className="no-message">Tidak ada pesan personal untuk produk ini.</p>
          )}
        </div>

        <div className="care-card">
          <div className="care-title">🌿 Panduan perawatan</div>
          <ul className="care-tips">
            {[
              "Jauhkan dari paparan sinar matahari langsung untuk menjaga kejernihan resin",
              "Bersihkan dengan kain lembut kering, jangan rendam dalam air",
              "Simpan di tempat sejuk dan kering saat tidak digunakan",
              "Hindari benturan keras agar resin tidak retak",
              "QR Code di stiker dapat di-scan kapan saja — isinya bisa diperbarui",
            ].map((tip, i) => (
              <li key={i}><span className="care-dot">✦</span>{tip}</li>
            ))}
          </ul>
        </div>

        <footer className="page-footer">
          <div className="footer-logo-sm">Flora<span>mory</span></div>
          <p className="footer-note">Smart Eco-Preserved Artware · FST Universitas Airlangga</p>
        </footer>
      </div>

      <div className="cta-section">
        <a className="btn-wa" href={`https://wa.me/${WA_NUMBER}?text=${waMsg}`} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style={{ flexShrink: 0 }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          Tanya / Pesan via WhatsApp
        </a>
        <button className="btn-share" onClick={shareProduct} title="Bagikan produk">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>

      <div className={`produk-toast${toastVisible ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}
