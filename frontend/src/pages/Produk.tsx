import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ProductImage from "@/components/ProductImage";
import { fetchProductById, fetchWhatsAppNumber, tierLabel, tierEmoji, tierBg, type Product } from "@/lib/sheets";
import { applyProductMeta } from "@/lib/seo";
import { pageUrl, normalizeWhatsApp, formatHarga } from "@/lib/site";
import useToast from "@/hooks/useToast";

const WA_FALLBACK = "6281234567890";

export default function Produk() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { toastMsg, toastVisible, showToast } = useToast(2500);
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || params.get("ID");
    if (!id) { setError(true); setLoading(false); return; }

    fetchWhatsAppNumber().then((value) => {
      if (value) setWaNumber(normalizeWhatsApp(value) || WA_FALLBACK);
    });

    fetchProductById(id)
      .then((p) => {
        if (!p) {
          setError(true);
        } else {
          setProduct(p);
          applyProductMeta({
            id: p.id,
            nama_produk: p.nama_produk,
            deskripsi: p.deskripsi,
            imageUrl: p.foto_qr || p.foto_produk,
          });
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo" aria-label="Floramory">
          <BrandLogo className="brand-logo-img loading-logo-img" />
        </div>
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
        <a href={`https://wa.me/${normalizeWhatsApp(waNumber) || WA_FALLBACK}`} target="_blank" rel="noopener noreferrer"
          className="error-link">
          Hubungi Floramory via WhatsApp →
        </a>
      </div>
    );
  }

  const tier = product.tier.toLowerCase();
  const emoji = tierEmoji(tier);
  const heroBg = tierBg(tier);
  // An empty foto_qr is falsy, so QR pages use the product image instead.
  const qrImage = product.foto_qr || product.foto_produk;
  const hasPersonalMessage = Boolean(product.pesan_personal && product.pesan_personal.trim());
  const waDigits = normalizeWhatsApp(waNumber) || WA_FALLBACK;

  const chips: [string, string][] = [];
  if (product.bahan) chips.push(["Bahan", product.bahan]);
  if (product.ukuran) chips.push(["Ukuran", product.ukuran]);
  if (product.bunga) chips.push(["Bunga", product.bunga]);
  if (product.id) chips.push(["Serial", product.id]);

  const waMsg = encodeURIComponent(
    `Halo Floramory! 🌸\n\nSaya tertarik dengan produk:\n*${product.nama_produk}* (${product.id})\nHarga: ${formatHarga(product.harga)}\n\nApakah masih tersedia? Saya ingin tanya lebih lanjut.`
  );

  const shareProduct = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${product.nama_produk} — Floramory`, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("✦ Link berhasil disalin!");
    } catch {
      showToast("Gagal menyalin tautan.");
    }
  };

  return (
    <div className="produk-page">
      <header className="site-header">
        <a className="header-logo logo-link" href={pageUrl("/")} aria-label="Floramory">
          <BrandLogo />
        </a>
        <span className="header-badge">{tierLabel(tier)}</span>
      </header>

      <main className="qr-card-stage" style={{ background: heroBg }}>
        <article className="greeting-card">
          <div className="greeting-image-wrap">
            <ProductImage
              src={qrImage}
              size="large"
              alt={product.nama_produk}
              className="greeting-image"
              fallback={<div className="greeting-image-placeholder">{emoji}</div>}
            />
          </div>

          <div className="memory-vault">
            <button
              className="vault-toggle"
              type="button"
              aria-expanded={isVaultOpen}
              aria-controls="vault-panel"
              onClick={() => setIsVaultOpen((open) => !open)}
            >
              <div className="vault-icon">💌</div>
              <div className="vault-toggle-copy">
                <div className="vault-title-text">Memory Vault</div>
                <div className="vault-subtitle">Pesan personal untuk pemilik produk ini</div>
              </div>
            </button>

            {isVaultOpen && (
              <div id="vault-panel">
                {hasPersonalMessage ? (
                  <div className="vault-message">
                    {product.pesan_personal}
                    <div className="vault-from">Dari {product.dari || "Floramory"}</div>
                  </div>
                ) : (
                  <p className="no-message">Tidak ada pesan personal untuk produk ini.</p>
                )}
              </div>
            )}
          </div>

          <div className="greeting-details">
            <div className="greeting-name">{product.nama_produk}</div>
            {product.harga && <div className="greeting-price">{formatHarga(product.harga)}</div>}
            {product.deskripsi && <p className="greeting-desc">{product.deskripsi}</p>}
            {chips.length > 0 && (
              <div className="greeting-chips">
                {chips.map(([label, val]) => (
                  <div className="greeting-chip" key={label}>
                    <span>{label}</span>
                    <strong>{val}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="greeting-card-footer">
            <span>{product.bunga || "Preserved Flower"}</span>
            <span>{product.nama_produk || "Floramory Gift"}</span>
          </div>
        </article>
      </main>


      <div className="cta-section">
        <a className="btn-wa" href={`https://wa.me/${waDigits}?text=${waMsg}`} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style={{ flexShrink: 0 }} aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          Tanya / Pesan via WhatsApp
        </a>
        <button type="button" className="btn-share" onClick={shareProduct} title="Bagikan produk" aria-label="Bagikan produk">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>

      <div className={`produk-toast${toastVisible ? " show" : ""}`} role="status">{toastMsg}</div>
    </div>
  );
}
