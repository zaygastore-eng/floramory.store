import { useEffect, useRef, useState, lazy, Suspense, type FormEvent } from "react";
import BrandLogo from "@/components/BrandLogo";
import ProductSpecimen from "@/components/ProductSpecimen";
const AudioPlayer = lazy(() => import("@/components/AudioPlayer"));
import {
  fetchProductById,
  fetchWhatsAppNumber,
  requestVaultOtp,
  verifyVaultOtp,
  tierLabel,
  getVaultAudioUrl,
  type Product,
} from "@/lib/api";
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
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [otpTargetType, setOtpTargetType] = useState<"recipient" | "buyer">("recipient");
  const [otpMaskedPhone, setOtpMaskedPhone] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
  const isVaultLocked = !product.is_catalog && !isVaultEmpty && !vaultUnlocked;
  const ytVideoId = hasVideo ? parseYouTubeId(product.video_url) : null;
  const waDigits = normalizeWhatsApp(waNumber) || WA_FALLBACK;

  const waMsg = encodeURIComponent(
    `Hello Floramory, I'd like to consult on customizing ${product.nama_produk} (ID: ${product.id})`
  );

  const handleRequestOtp = async () => {
    setOtpBusy(true);
    setOtpMessage("");
    try {
      const result = await requestVaultOtp(product.id);
      if (!result.ok) throw new Error(result.message || "Gagal meminta kode OTP.");
      setOtpRequested(true);
      if (result.targetType) setOtpTargetType(result.targetType);
      if (result.maskedPhone) setOtpMaskedPhone(result.maskedPhone);
      if (result.debugOtp) {
        setOtpCode(result.debugOtp);
        setOtpMessage(`Kode simulasi: ${result.debugOtp}`);
      } else {
        setOtpCode("");
        setOtpMessage("");
      }
    } catch (requestError) {
      setOtpMessage(requestError instanceof Error ? requestError.message : "Gagal meminta kode OTP.");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otpCode)) return;
    setOtpBusy(true);
    setOtpMessage("");
    try {
      const result = await verifyVaultOtp(product.id, otpCode);
      if (!result.ok || !result.verified) {
        throw new Error(result.message || "Kode OTP tidak valid atau sudah kadaluarsa.");
      }
      try {
        sessionStorage.setItem(`fm_unlocked_${product.id}`, "true");
      } catch {
        // Keep the current view unlocked even when browser storage is unavailable.
      }
      setVaultUnlocked(true);
      setOtpMessage("");
    } catch (verifyError) {
      setOtpMessage(verifyError instanceof Error ? verifyError.message : "Gagal memverifikasi kode OTP.");
    } finally {
      setOtpBusy(false);
    }
  };

  const updateOtpDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 1);
    const next = otpCode.padEnd(6, " ").slice(0, 6).split("");
    next[index] = digits || " ";
    setOtpCode(next.join(""));
    if (digits && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  return (
    <div className="produk-page">
      <header className="site-header">
        <a className="header-logo logo-link" href={pageUrl("/")} aria-label="Floramory">
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
                <button
                  type="button"
                  className="specimen-order-button"
                  onClick={() => void handleRequestOtp()}
                  disabled={otpBusy}
                >
                  {otpBusy ? "Menyiapkan kode..." : "🎁 Buka Kado & Dapatkan Kode"}
                </button>
                {!otpRequested && otpMessage && (
                  <p role="status" aria-live="polite" style={{ margin: "0.8rem 0 0", color: "#8a4d3b", fontSize: "0.88rem" }}>
                    {otpMessage}
                  </p>
                )}
                {otpRequested && (
                  <form onSubmit={handleVerifyOtp} style={{ margin: "1.5rem auto 0", maxWidth: "22rem" }}>
                    <p style={{ margin: "0 0 0.9rem", color: "#69705d" }}>
                      {otpTargetType === "buyer"
                        ? "Kode dikirim ke nomor WhatsApp pemesan."
                        : `Kode 6 digit telah dikirim ke WhatsApp ${otpMaskedPhone || "penerima kado"}.`}
                    </p>
                    {otpTargetType === "buyer" && otpMaskedPhone && (
                      <p style={{ margin: "0 0 0.9rem", color: "#69705d" }}>
                        Kode 6 digit dikirim ke WhatsApp {otpMaskedPhone}.
                      </p>
                    )}
                    <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                      {Array.from({ length: 6 }, (_, index) => (
                        <input
                          key={index}
                          ref={element => { otpInputRefs.current[index] = element; }}
                          type="tel"
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          aria-label={`Digit ${index + 1} kode OTP`}
                          value={otpCode[index] && otpCode[index] !== " " ? otpCode[index] : ""}
                          maxLength={1}
                          onChange={event => updateOtpDigit(index, event.target.value)}
                          onKeyDown={event => {
                            if (event.key === "Backspace" && !otpCode[index] && index > 0) {
                              otpInputRefs.current[index - 1]?.focus();
                            }
                          }}
                          onPaste={event => {
                            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                            if (pasted) {
                              event.preventDefault();
                              setOtpCode(pasted.padEnd(6, " "));
                              otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
                            }
                          }}
                          className="form-input"
                          style={{ width: "2.8rem", height: "3.2rem", padding: 0, textAlign: "center", fontSize: "1.25rem", fontWeight: 700 }}
                        />
                      ))}
                    </div>
                    <button type="submit" className="specimen-order-button" disabled={otpBusy || !/^\d{6}$/.test(otpCode)}>
                      {otpBusy ? "Memverifikasi..." : "Verifikasi Kode"}
                    </button>
                    {otpMessage && (
                      <p role="status" aria-live="polite" style={{ margin: "0.8rem 0 0", color: "#69705d", fontSize: "0.88rem" }}>
                        {otpMessage}
                      </p>
                    )}
                    <a
                      className="specimen-order-button"
                      href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                        `Halo Bantuan Floramory, saya tidak menerima kode OTP untuk membuka Vault produk ${product.id}. Mohon bantu periksa nomor WhatsApp tujuan.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: "1rem", textDecoration: "none" }}
                    >
                      Tidak menerima kode? Hubungi Bantuan Floramory
                    </a>
                  </form>
                )}
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
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
