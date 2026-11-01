import { useEffect, useState, lazy, Suspense } from "react";
import BrandLogo from "@/components/BrandLogo";
import ProductSpecimen from "@/components/ProductSpecimen";
const AudioPlayer = lazy(() => import("@/components/AudioPlayer"));
import { fetchProductById, fetchWhatsAppNumber, tierLabel, getVaultAudioUrl, type Product } from "@/lib/api";
import { applyProductMeta } from "@/lib/seo";
import { pageUrl, normalizeWhatsApp } from "@/lib/site";

const WA_FALLBACK = "6281234567890";

/**
 * Robust YouTube video ID parser supporting standard watch, short youtu.be,
 * shorts, embed, and unlisted URLs with arbitrary query parameters.
 */
function parseYouTubeId(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

export default function Produk() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);

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
  const hasFotoVault = Boolean(product.foto_vault && product.foto_vault.trim());
  const hasVideo = Boolean(product.video_url && product.video_url.trim());
  const hasAudio = Boolean(product.audio_url && product.audio_url.trim());
  const hasPersonalMessage = Boolean(product.pesan_personal && product.pesan_personal.trim());
  const isVaultEmpty = !hasFotoVault && !hasVideo && !hasAudio && !hasPersonalMessage;
  const ytVideoId = hasVideo ? parseYouTubeId(product.video_url) : null;
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
            <p>Kenangan istimewa yang terhubung secara abadi dengan karya botani ini.</p>
          </div>

          <div className="vault-content-stack">
            {/* Component A: Personal Memory Photo (Polaroid Capsule) */}
            {hasFotoVault && (
              <div className="vault-polaroid-wrap">
                <figure className="vault-polaroid-card">
                  <div className="vault-polaroid-pin" aria-hidden="true">✦</div>
                  <div className="vault-polaroid-img-box">
                    <img
                      src={product.foto_vault}
                      alt={`Momen kenangan ${product.nama_pembeli || product.nama_produk}`}
                      className="vault-polaroid-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <figcaption className="vault-polaroid-caption">
                    <span className="vault-polaroid-title">
                      {product.nama_pembeli ? `Untuk ${product.nama_pembeli}` : "Kapsul Kenangan"}
                    </span>
                    <span className="vault-polaroid-sub">Captured with love · Floramory Keepsake</span>
                  </figcaption>
                </figure>
              </div>
            )}

            {/* Component B: Responsive Video Embed */}
            {hasVideo && (
              <div className="vault-video-block">
                <div className="vault-video-frame">
                  {ytVideoId ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?rel=0&modestbranding=1&playsinline=1`}
                      title="Video Kenangan Floramory"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="vault-video-iframe"
                    />
                  ) : (
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      src={product.video_url}
                      className="vault-video-player"
                    >
                      Browser Anda tidak mendukung pemutar video.
                    </video>
                  )}
                </div>
              </div>
            )}

            {/* Component C: Voice Note Player */}
            {hasAudio && (
              <div className="vault-audio-block">
                <div className="vault-audio-badge">
                  <span>✦</span> Dengarkan Pesan Suara Khusus
                </div>
                <Suspense
                  fallback={
                    <div
                      className="floramory-audio-card"
                      style={{ height: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <span className="audio-spinner" style={{ borderColor: "rgba(105, 112, 153, 0.2)", borderTopColor: "var(--sage)" }} />
                    </div>
                  }
                >
                  <AudioPlayer
                    src={getVaultAudioUrl(product.audio_url)}
                    initialDuration={product.audio_durasi}
                    title={`Pesan Suara untuk ${product.nama_pembeli || "Anda"}`}
                  />
                </Suspense>
              </div>
            )}

            {/* Component D: Personal Letter */}
            {hasPersonalMessage && (
              <div className="vault-letter-card">
                <div className="vault-letter-header">
                  <div className="vault-letter-seal" aria-hidden="true">✦</div>
                  <div className="vault-letter-meta">
                    <span className="vault-letter-label">Surat Personal</span>
                    {product.nama_pembeli && (
                      <h3 className="vault-letter-salutation">
                        Untuk {product.nama_pembeli}
                      </h3>
                    )}
                  </div>
                </div>
                <div className="vault-letter-body">
                  <p className="vault-letter-text">{product.pesan_personal}</p>
                  <div className="vault-letter-sign">
                    <span>Dengan penuh cinta,</span>
                    <strong>{product.dari || "Floramory"}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback State: Empty / Standard Bouquet */}
            {isVaultEmpty && (
              <div className="vault-letter-card vault-letter-story">
                <div className="vault-letter-header">
                  <div className="vault-letter-seal" aria-hidden="true">🌿</div>
                  <div className="vault-letter-meta">
                    <span className="vault-letter-label">Botanical Keepsake Blessing</span>
                    <h3 className="vault-letter-salutation">
                      {product.nama_pembeli ? `Untuk ${product.nama_pembeli}` : "Karya Kenangan Floramory"}
                    </h3>
                  </div>
                </div>
                <div className="vault-letter-body">
                  <p className="vault-letter-text">
                    “Setiap bunga Floramory dirangkai untuk menyimpan kenangan abadi. Karya seni botani ini diawetkan dengan cermat di laboratorium agar keindahan dan ketulusan momen istimewa Anda tetap mekar selamanya.”
                  </p>
                  <div className="vault-letter-sign">
                    <span>Dengan penuh kehangatan,</span>
                    <strong>Atelier Floramory</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
