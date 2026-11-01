import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ProductSpecimen from "@/components/ProductSpecimen";
import { fetchProductById, fetchWhatsAppNumber, tierLabel, type Product } from "@/lib/api";
import { applyProductMeta } from "@/lib/seo";
import { pageUrl, normalizeWhatsApp } from "@/lib/site";

const WA_FALLBACK = "6281234567890";

export default function Produk() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
  const hasPersonalMessage = Boolean(product.pesan_personal && product.pesan_personal.trim());
  const waDigits = normalizeWhatsApp(waNumber) || WA_FALLBACK;

  const waMsg = encodeURIComponent(
    `Hello Floramory, I'd like to consult on customizing ${product.nama_produk} (ID: ${product.id})`
  );

  return (
    <div className="produk-page">
      <header className="site-header">
        <a className="header-logo logo-link" href={pageUrl("/")} aria-label="Floramory">
          <BrandLogo />
        </a>
        <span className="header-badge">{tierLabel(tier)}</span>
      </header>

      <main className="produk-specimen-page">
        <ProductSpecimen
          product={product}
          whatsappUrl={`https://wa.me/${waDigits}?text=${waMsg}`}
          onOrder={() => {
            window.location.href = `${pageUrl("/")}?product=${encodeURIComponent(product.id)}#pesan`;
          }}
        />
        <section className="specimen-personal-vault" aria-labelledby="personal-vault-title">
          <div className="specimen-personal-heading">
            <span className="specimen-eyebrow">A private chapter</span>
            <h2 id="personal-vault-title">The Memory Vault</h2>
            <p>Your personal message, kept with this botanical keepsake.</p>
          </div>
          <button
            className="specimen-personal-toggle"
            type="button"
            aria-expanded={isVaultOpen}
            aria-controls="vault-panel"
            onClick={() => setIsVaultOpen(open => !open)}
          >
            <span className="specimen-personal-seal" aria-hidden="true">✦</span>
            <span>
              <strong>Open your personal letter</strong>
              <small>Private message for the owner of this specimen</small>
            </span>
            <span aria-hidden="true">{isVaultOpen ? "−" : "+"}</span>
          </button>
          {isVaultOpen && (
            <div className="specimen-personal-message" id="vault-panel">
              {hasPersonalMessage ? (
                <>
                  <p>{product.pesan_personal}</p>
                  <span>From {product.dari || "Floramory"}</span>
                </>
              ) : (
                <p>No personal message has been added to this Memory Vault yet.</p>
              )}
            </div>
          )}
        </section>
      </main>

    </div>
  );
}
