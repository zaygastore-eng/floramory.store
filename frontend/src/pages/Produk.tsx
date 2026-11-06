import { useEffect, useRef, useState, lazy, Suspense, type ClipboardEvent, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import ProductSpecimen from "@/components/ProductSpecimen";
import VaultExperience from "@/pages/VaultExperience";
const AudioPlayer = lazy(() => import("@/components/AudioPlayer"));
import {
  fetchProductById,
  fetchWhatsAppNumber,
  verifyVaultPin,
  tierLabel,
  getVaultAudioUrl,
  type Product,
} from "@/lib/api";
import { resolveVaultMedia } from "@/lib/media";
import { applyProductMeta } from "@/lib/seo";
import { pageUrl, normalizeWhatsApp } from "@/lib/site";

const WA_FALLBACK = "6281234567890";

export default function Produk() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(() => Array(6).fill(""));
  const [pinMessage, setPinMessage] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
          try {
            setVaultUnlocked(sessionStorage.getItem(`fm_unlocked_${p.id}`) === "true");
          } catch {
            setVaultUnlocked(false);
          }
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
        <div className="loading-logo" aria-label="A Chapter">
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
          Hubungi A Chapter via WhatsApp →
        </a>
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

  // When a physical QR is scanned pointing to /produk?id=UUID:
  // If the product has a linked memoir vault or is a custom order, immediately render VaultExperience
  if (hasMemoir || !product.is_catalog) {
    return <VaultExperience productIdOverride={product.id} />;
  }

  const isVaultEmpty = !hasFotoVault && !hasVideo && !hasAudio && !hasPersonalMessage;
  const isVaultLocked = !product.is_catalog && !isVaultEmpty && !vaultUnlocked;
  const waDigits = normalizeWhatsApp(waNumber) || WA_FALLBACK;

  const waMsg = encodeURIComponent(
    `Hello A Chapter, I'd like to consult on customizing ${product.nama_produk} (ID: ${product.id})`
  );

  const handleVerifyPin = async (event: FormEvent) => {
    event.preventDefault();
    const pin = pinDigits.join("");
    if (!/^\d{6}$/.test(pin)) return;
    setPinBusy(true);
    setPinMessage("");
    setPinLocked(false);
    try {
      const result = await verifyVaultPin(product.id, pin);
      if (!result.ok || !result.verified) {
        setPinMessage(result.message || "PIN tidak cocok. Silakan coba kembali.");
        setPinLocked(Boolean(result.locked));
        return;
      }
      try {
        sessionStorage.setItem(`fm_unlocked_${product.id}`, "true");
      } catch {
        // Keep the current view unlocked even when browser storage is unavailable.
      }
      setVaultUnlocked(true);
      setPinMessage("");
    } catch (verifyError) {
      setPinMessage(verifyError instanceof Error ? verifyError.message : "Gagal memverifikasi PIN.");
    } finally {
      setPinBusy(false);
    }
  };

  const updatePinDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 1);
    setPinDigits(current => current.map((digit, digitIndex) => digitIndex === index ? digits : digit));
    if (digits && index < 5) pinInputRefs.current[index + 1]?.focus();
    setPinMessage("");
    setPinLocked(false);
  };

  const handlePinPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setPinDigits([...pasted, ...Array(Math.max(0, 6 - pasted.length)).fill("")].slice(0, 6));
    pinInputRefs.current[Math.min(pasted.length, 5)]?.focus();
    setPinMessage("");
    setPinLocked(false);
  };

  return (
    <div className="produk-page">
      <header className="site-header">
        <a className="header-logo logo-link" href={pageUrl("/")} aria-label="A Chapter">
          <BrandLogo />
        </a>
        <span className="header-badge">{tierLabel(tier)}</span>
      </header>

      <main className="produk-specimen-page">
        {product.is_catalog && (
          <ProductSpecimen
            product={product}
            whatsappUrl={`https://wa.me/${waDigits}?text=${waMsg}`}
            onOrder={() => {
              window.location.href = `${pageUrl("/")}?product=${encodeURIComponent(product.id)}#pesan`;
            }}
          />
        )}

        <section className="specimen-personal-vault" aria-labelledby="personal-vault-title">
          <div className="specimen-personal-heading">
            <span className="specimen-eyebrow">A private chapter</span>
            <h2 id="personal-vault-title">The Memory Vault</h2>
            <p>Kenangan istimewa yang terhubung secara abadi dengan karya botani ini.</p>
          </div>

          <div className="vault-content-stack">
            {isVaultLocked ? (
              <div
                className="order-step-content"
                style={{
                  padding: "clamp(1.5rem, 5vw, 2.5rem)",
                  border: "1px solid rgba(160, 139, 94, 0.35)",
                  borderRadius: "24px",
                  background: "linear-gradient(145deg, #fffdf7, #f7f3e8)",
                  boxShadow: "0 18px 48px rgba(67, 59, 39, 0.1)",
                  textAlign: "center",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: "2.5rem" }}>✦</span>
                <h3 style={{ margin: "0.75rem 0", color: "#4b503b", fontFamily: "var(--font-heading, Georgia, serif)" }}>
                  Kapsul Kenangan Terkunci
                </h3>
                <p style={{ margin: "0 auto 1.25rem", maxWidth: "28rem", color: "#69705d", lineHeight: 1.7 }}>
                  Kado ini dilengkapi pesan pribadi &amp; kenangan khusus untuk penerima.
                </p>
                <form onSubmit={handleVerifyPin} style={{ margin: "1.5rem auto 0", maxWidth: "24rem" }}>
                    <p style={{ margin: "0 0 0.9rem", color: "#69705d", lineHeight: 1.65 }}>
                      Gosok stiker perak pada kartu ucapan A Chapter kamu, lalu masukkan 6 digit PIN rahasia di bawah ini.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                      {Array.from({ length: 6 }, (_, index) => (
                        <input
                          key={index}
                          ref={element => { pinInputRefs.current[index] = element; }}
                          type="tel"
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          aria-label={`Digit ${index + 1} PIN`}
                          value={pinDigits[index]}
                          maxLength={1}
                          onChange={event => updatePinDigit(index, event.target.value)}
                          onKeyDown={event => {
                            if (event.key === "Backspace" && !pinDigits[index] && index > 0) {
                              pinInputRefs.current[index - 1]?.focus();
                            }
                          }}
                          onPaste={handlePinPaste}
                          className="form-input"
                          style={{ width: "2.8rem", height: "3.2rem", padding: 0, textAlign: "center", fontSize: "1.25rem", fontWeight: 700 }}
                        />
                      ))}
                    </div>
                    <button type="submit" className="specimen-order-button" disabled={pinBusy || pinDigits.join("").length !== 6}>
                      {pinBusy ? <><LoaderCircle size={18} className="vault-pin-spinner" aria-hidden="true" /> Memeriksa PIN...</> : "🎁 Buka Memory Vault"}
                    </button>
                    {pinMessage && (
                      <p role="alert" aria-live="polite" style={{ margin: "0.8rem 0 0", padding: "0.8rem", borderRadius: "10px", background: pinLocked ? "#fff0ed" : "#fff8e7", color: pinLocked ? "#9d3e32" : "#805d21", fontSize: "0.88rem", lineHeight: 1.5 }}>
                        {pinMessage}
                      </p>
                    )}
                    <a
                      href={`https://wa.me/${waDigits}?text=${encodeURIComponent("Halo A Chapter, kartu kado saya rusak atau PIN tidak terbaca. Mohon bantu saya.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: "1rem", color: "#69705d", fontSize: "0.86rem", textDecoration: "underline" }}
                    >
                      Kartu rusak atau tergores tidak terbaca? Hubungi WhatsApp A Chapter
                    </a>
                </form>
              </div>
            ) : (
              <div className={vaultUnlocked ? "order-step-content" : undefined}>
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
                    <span className="vault-polaroid-sub">Captured with love · A Chapter Keepsake</span>
                  </figcaption>
                </figure>
              </div>
            )}

            {/* Component B: Responsive Video Embed */}
            {hasVideo && videoMedia.type === "youtube" && videoMedia.embedUrl && (
              <div className="vault-video-block">
                <div className="vault-video-frame">
                  <iframe
                    src={videoMedia.embedUrl}
                    title="Video Kenangan A Chapter"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="vault-video-iframe"
                  />
                </div>
              </div>
            )}
            {hasVideo && videoMedia.type === "direct_video" && (
              <div className="vault-video-block">
                <div className="vault-video-frame">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={videoMedia.url}
                    className="vault-video-player"
                  >
                    Browser Anda tidak mendukung pemutar video.
                  </video>
                </div>
              </div>
            )}

            {/* Component C: Voice Note Player */}
            {hasAudio && audioMedia.type === "spotify" && audioMedia.embedUrl && (
              <div className="vault-audio-block">
                <div className="vault-audio-badge">
                  <span>✦</span> Lagu Kenangan
                </div>
                <iframe
                  style={{ borderRadius: "14px", border: "none" }}
                  src={audioMedia.embedUrl}
                  width="100%"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  title="Lagu Kenangan Spotify"
                />
              </div>
            )}
            {hasAudio && audioMedia.type === "direct_audio" && (
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
                    src={getVaultAudioUrl(audioMedia.url)}
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
                    <strong>{product.dari || "A Chapter"}</strong>
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
                      {product.nama_pembeli ? `Untuk ${product.nama_pembeli}` : "Karya Kenangan A Chapter"}
                    </h3>
                  </div>
                </div>
                <div className="vault-letter-body">
                  <p className="vault-letter-text">
                    “Setiap bunga A Chapter dirangkai untuk menyimpan kenangan abadi. Karya seni botani ini diawetkan dengan cermat di laboratorium agar keindahan dan ketulusan momen istimewa Anda tetap mekar selamanya.”
                  </p>
                  <div className="vault-letter-sign">
                    <span>Dengan penuh kehangatan,</span>
                    <strong>Atelier A Chapter</strong>
                  </div>
                </div>
              </div>
            )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
