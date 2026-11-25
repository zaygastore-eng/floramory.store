import { useEffect, useState } from "react";
import { Link } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import ProductSpecimen from "@/components/ProductSpecimen";
import VaultExperience from "@/pages/VaultExperience";
import {
  fetchVaultPreview,
  fetchWhatsAppNumber,
  tierLabel,
  type Product,
} from "@/lib/api";
import { resolveVaultMedia } from "@/lib/media";
import { applyProductMeta } from "@/lib/seo";
import { pageUrl, normalizeWhatsApp } from "@/lib/site";

const WA_FALLBACK = "6285235242425";

export default function Produk() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);
  const [hasVault, setHasVault] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || params.get("ID");
    if (!id) {
      window.location.replace(pageUrl("/shop"));
      return;
    }

    fetchWhatsAppNumber().then((value) => {
      if (value) setWaNumber(normalizeWhatsApp(value) || WA_FALLBACK);
    });

    fetchVaultPreview(id)
      .then((preview) => {
        if (!preview) {
          setError(true);
        } else {
          const p = preview.product;
          setProduct(p);
          setHasVault(preview.hasVault);
          applyProductMeta({
            id: p.id,
            nama_produk: p.nama_produk,
            deskripsi: p.deskripsi,
            imageUrl: p.foto_qr || p.foto_produk,
            harga: p.harga,
          });
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen public-v2">
        <div className="loading-logo" aria-label="A Chapter">
          <BrandLogo className="brand-logo-img loading-logo-img" />
        </div>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="error-screen public-v2">
        <div className="error-card">
          <div className="error-icon" aria-hidden="true">🌿</div>
          <h1 className="error-title">Produk Tidak Ditemukan</h1>
          <p className="error-msg">
            QR code ini mungkin tidak valid atau produk sudah tidak tersedia. Hubungi kami untuk bantuan.
          </p>
          <a
            href={`https://wa.me/${normalizeWhatsApp(waNumber) || WA_FALLBACK}?text=${encodeURIComponent("Halo A Chapter, saya memerlukan bantuan terkait pemindaian produk QR.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hero-cta hero-cta-primary"
          >
            Hubungi A Chapter via WhatsApp →
          </a>
        </div>
      </div>
    );
  }

  const tier = product.tier.toLowerCase();
  const hasFotoVault = Boolean(product.foto_vault && product.foto_vault.trim());
  const { audioMedia, videoMedia } = resolveVaultMedia(product.audio_url, product.video_url);
  const hasVideo = videoMedia.isVideo && Boolean(videoMedia.url);
  const hasAudio = audioMedia.isAudio && Boolean(audioMedia.url);
  const hasPersonalMessage = Boolean(product.pesan_personal && product.pesan_personal.trim());
  const hasMemoir = hasFotoVault || hasVideo || hasAudio || hasPersonalMessage;

  // Semua QR produk personal langsung didelegasikan ke VaultExperience (Konsep B terpadu).
  if (hasVault || hasMemoir || !product.is_catalog) {
    return <VaultExperience productIdOverride={product.id} />;
  }

  const waDigits = normalizeWhatsApp(waNumber) || WA_FALLBACK;
  const waMsg = encodeURIComponent(
    `Hello A Chapter, I'd like to consult on customizing ${product.nama_produk} (ID: ${product.id})`
  );

  return (
    <div className="produk-page public-v2">
      <header className="site-header">
        <a className="header-logo logo-link" href={pageUrl("/")} aria-label="A Chapter">
          <BrandLogo />
        </a>
        <span className="header-badge">{tierLabel(tier)}</span>
      </header>

      <main className="produk-specimen-page">
        <ProductSpecimen
          product={product}
          whatsappUrl={`https://wa.me/${waDigits}?text=${waMsg}`}
          onOrder={() => {
            window.location.href = pageUrl(`/products/${encodeURIComponent(product.id)}`);
          }}
        />

        <section className="specimen-personal-vault" aria-labelledby="personal-vault-title">
          <div className="specimen-personal-heading">
            <span className="specimen-eyebrow">A private chapter</span>
            <h2 id="personal-vault-title">Dilengkapi Smart QR Memory Vault</h2>
            <p>
              Setiap pesanan karya ini mencakup brankas digital pribadi untuk menyimpan kaset rekaman suara,
              surat papan renda, photobooth 4-cut, dan video memoir seumur hidup.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/smart-qr-vault" className="hero-cta hero-cta-primary">
                Lihat Simulasi Memory Vault →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
