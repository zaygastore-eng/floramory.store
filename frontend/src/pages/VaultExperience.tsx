import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { useRoute } from "wouter";
import {
  fetchVaultPreview,
  fetchWhatsAppNumber,
  openVault,
  getVaultAudioUrl,
  type Product,
} from "@/lib/api";
import { resolveVaultMedia } from "@/lib/media";
import { normalizeWhatsApp } from "@/lib/site";
import { applyProductMeta, applyNoIndexMeta } from "@/lib/seo";

const AudioPlayer = lazy(() => import("@/components/AudioPlayer"));

const WA_FALLBACK = "6285235242425";

type VaultTab = "photos" | "audio" | "letter" | "video";

export default function VaultExperience({
  params,
  productIdOverride,
  previewData,
}: {
  params?: { id?: string };
  productIdOverride?: string;
  previewData?: Partial<Product>;
}) {
  const [, matchVault] = useRoute("/vault/:id");
  const [, matchV] = useRoute("/v/:id");
  const queryParamId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("id") || ""
    : "";

  const vaultId = productIdOverride || params?.id || matchVault?.id || matchV?.id || queryParamId;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState(false);
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);
  const [activeTab, setActiveTab] = useState<VaultTab>("photos");
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // PIN Unlock state
  const [vaultUnlocked, setVaultUnlocked] = useState(Boolean(previewData));
  const [openingCeremony, setOpeningCeremony] = useState<"idle" | "opening" | "done">(
    previewData ? "done" : "idle"
  );
  const [pinDigits, setPinDigits] = useState<string[]>(() => Array(6).fill(""));
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Touch swipe support for polaroid
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  useEffect(() => {
    if (previewData) {
      setProduct({
        id: "preview",
        nama_produk: previewData.nama_produk || "The Botanical Keepsake",
        tier: previewData.tier || "classic",
        harga: previewData.harga || "350000",
        deskripsi: previewData.deskripsi || "",
        foto_produk: previewData.foto_produk || "",
        bunga: previewData.bunga || "Hydrangea macrophylla × Gypsophila paniculata",
        bahan: previewData.bahan || "UV Bio-Epoxy",
        ukuran: previewData.ukuran || "15x20 cm",
        nama_pembeli: previewData.nama_pembeli || "You",
        dari: previewData.dari || "Someone Special",
        pesan_personal: previewData.pesan_personal || "",
        foto_qr: previewData.foto_qr || "",
        audio_url: previewData.audio_url || "",
        audio_durasi: previewData.audio_durasi || 0,
        video_url: previewData.video_url || "",
        foto_vault: previewData.foto_vault || "",
        is_catalog: false,
      });
      setVaultUnlocked(true);
      setLoading(false);
      return;
    }

    if (!vaultId) {
      setError(true);
      setLoading(false);
      return;
    }

    let active = true;

    fetchWhatsAppNumber().then((num) => {
      if (active) setWaNumber(normalizeWhatsApp(num) || WA_FALLBACK);
    });

    const tokenKey = (id: string) => `fm_vault_token_${id}`;

    const loadVault = async () => {
      // Preview hanya berisi metadata aman. Isi surat/media baru
      // dikirim server setelah PIN atau token sesi valid.
      const preview = await fetchVaultPreview(vaultId);
      if (!active) return;
      if (!preview) {
        setError(true);
        return;
      }

      let current = preview.product;
      setProduct(current);

      applyProductMeta({
        id: current.id,
        nama_produk: `${current.nama_pembeli ? `Memoir untuk ${current.nama_pembeli}` : current.nama_produk} — A Chapter Memory Vault`,
        deskripsi: "A secret digital chapter preserved in eternal botanical form.",
        imageUrl: current.foto_vault || current.foto_produk,
      });
      // Brankas penerima bersifat privat: jangan pernah diindeks mesin pencari.
      applyNoIndexMeta(document.title);

      // Produk tanpa PIN (katalog) memang tidak pernah terkunci.
      if (preview.unlocked) {
        setVaultUnlocked(true);
        setOpeningCeremony("done");
        return;
      }

      // Coba buka ulang sesi 30 menit dari sessionStorage.
      let savedToken = "";
      try {
        savedToken = sessionStorage.getItem(tokenKey(current.id)) || "";
      } catch {
        savedToken = "";
      }
      if (!savedToken) return;

      const opened = await openVault(current.id, { token: savedToken });
      if (!active) return;
      if (opened.ok && opened.product) {
        current = opened.product;
        setProduct(current);
        setVaultUnlocked(true);
        setOpeningCeremony("done");
        if (opened.token) {
          try {
            sessionStorage.setItem(tokenKey(current.id), opened.token);
          } catch {
            // storage tidak tersedia: tetap tampilkan konten sesi ini
          }
        }
        return;
      }
      try {
        sessionStorage.removeItem(tokenKey(current.id));
      } catch {
        // ignore
      }
    };

    loadVault()
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [vaultId, previewData]);

  // Animasi pembuka brankas: tampil sebentar setelah PIN benar, lalu menyingkap konten.
  useEffect(() => {
    if (openingCeremony !== "opening") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => setOpeningCeremony("done"), 3600);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [openingCeremony]);

  const finishOpeningCeremony = () => setOpeningCeremony("done");

  const handlePinDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    const updated = [...pinDigits];
    updated[index] = digit;
    setPinDigits(updated);
    setPinMessage("");

    if (digit && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const updated = [...pinDigits];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setPinDigits(updated);
    pinInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const pin = pinDigits.join("");
    if (!/^\d{4,6}$/.test(pin)) return;

    setPinBusy(true);
    setPinMessage("");
    setPinLocked(false);

    try {
      const res = await openVault(product.id, { pin });
      if (!res.ok || !res.verified) {
        setPinMessage(res.message || "PIN rahasia tidak sesuai. Periksa kartu ucapan.");
        setPinLocked(Boolean(res.locked));
        return;
      }
      if (res.product) setProduct(res.product);
      if (res.token) {
        try {
          sessionStorage.setItem(`fm_vault_token_${product.id}`, res.token);
        } catch {
          // storage tidak tersedia: konten tetap tampil untuk sesi ini
        }
      }
      setVaultUnlocked(true);
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      setOpeningCeremony(prefersReducedMotion ? "done" : "opening");
    } catch (err) {
      setPinMessage(err instanceof Error ? err.message : "Terjadi kesalahan saat memeriksa PIN.");
    } finally {
      setPinBusy(false);
    }
  };

  // Build Polaroid photo list
  const photos: string[] = [];
  if (product?.foto_vault && product.foto_vault.trim()) photos.push(product.foto_vault.trim());
  if (product?.foto_produk && product.foto_produk.trim() && !photos.includes(product.foto_produk.trim())) {
    photos.push(product.foto_produk.trim());
  }
  if (photos.length === 0) {
    photos.push("/opengraph.jpg");
  }

  const currentPhoto = photos[activePhotoIdx] || photos[0];

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return;
    const diff = touchStartXRef.current - touchEndXRef.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && activePhotoIdx < photos.length - 1) {
        setActivePhotoIdx(prev => prev + 1);
      } else if (diff < 0 && activePhotoIdx > 0) {
        setActivePhotoIdx(prev => prev - 1);
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  if (loading) {
    return (
      <div className="vault-memoir-loading">
        <div className="vault-wax-seal-hero pulse" aria-hidden="true">
          <span className="wax-seal-circle">A · C</span>
        </div>
        <p className="vault-loading-text">Membuka Brankas Memoar Rahasia...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="vault-memoir-container" style={{ textAlign: "center", padding: "5rem 1.5rem" }}>
        <div className="vault-wax-seal-hero" aria-hidden="true">
          <span className="wax-seal-circle">✦</span>
        </div>
        <h1 className="vault-hero-recipient" style={{ marginTop: "1rem" }}>Brankas Tidak Ditemukan</h1>
        <p className="vault-hero-dedication" style={{ margin: "1rem auto 2rem" }}>
          Kode QR ini mungkin sudah kedaluwarsa atau belum dikonfigurasi oleh pengirim.
        </p>
        <a
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Halo A Chapter Concierge, saya membutuhkan bantuan terkait QR Memory Vault.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hero-cta hero-cta-primary"
        >
          Hubungi Concierge WhatsApp →
        </a>
      </div>
    );
  }

  const { audioMedia, videoMedia } = resolveVaultMedia(product.audio_url, product.video_url);
  const letterBody = product.pesan_personal ||
    "Setiap bunga A Chapter dirangkai untuk menyimpan kenangan abadi. Karya seni botani ini diawetkan dengan cermat di laboratorium agar keindahan dan ketulusan momen istimewa Anda tetap mekar selamanya.";
  const firstLetter = letterBody.trim().charAt(0) || "S";
  const restOfLetter = letterBody.trim().slice(1);

  return (
    <div className={`vault-memoir-wrapper${openingCeremony === "opening" ? " is-ceremony" : ""}`}>
      {openingCeremony === "opening" && (
        <div className="vault-opening-overlay" role="status" aria-live="polite">
          <div className="vault-opening-stage">
            <span className="vault-opening-ring" aria-hidden="true" />
            <span className="vault-opening-ring ring-two" aria-hidden="true" />
            <div className="vault-opening-seal" aria-hidden="true">
              <span className="wax-seal-circle">A · C</span>
            </div>
            <span className="vault-opening-kicker">A CHAPTER · MEMORY VAULT</span>
            <h2 className="vault-opening-title">Membuka babak rahasia...</h2>
            <p className="vault-opening-sub">
              Kenangan yang disimpan untuk {product.nama_pembeli || "Anda"}
            </p>
            <button type="button" className="vault-opening-skip" onClick={finishOpeningCeremony}>
              Lewati animasi →
            </button>
          </div>
        </div>
      )}
      <div className="vault-memoir-container">
        {/* ── 1. WAX SEAL REVEAL HERO ── */}
        <header className="vault-memoir-hero">
          <div className="vault-wax-seal-hero" aria-hidden="true">
            <span className="wax-seal-circle">A · C</span>
          </div>

          <div className="vault-hero-text">
            <span className="vault-hero-kicker">A SECRET CHAPTER PRESERVED FOR</span>
            <h1 className="vault-hero-recipient">{product.nama_pembeli || "You"}</h1>
            <p className="vault-hero-dedication">
              Disimpan selamanya oleh <strong>{product.dari || "Someone Special"}</strong> bersama karya botani abadi ini.
            </p>
          </div>
        </header>

        {/* ── PIN LOCK CARD (IF NOT UNLOCKED) ── */}
        {!vaultUnlocked ? (
          <div className="vault-pin-card" role="dialog" aria-label="Verifikasi PIN Brankas">
            <div className="vault-pin-icon" aria-hidden="true">🔒</div>
            <h2 className="vault-pin-heading">Brankas Memori Terkunci</h2>
            <p className="vault-pin-desc">
              Karya botani ini membawa pesan pribadi rahasia. Masukkan 6 digit PIN dari kartu ucapan fisik untuk membuka memori Anda.
            </p>

            <form onSubmit={handleVerifyPin} className="vault-pin-form">
              <div className="vault-pin-inputs">
                {Array.from({ length: 6 }, (_, i) => (
                  <input
                    key={i}
                    ref={el => { pinInputRefs.current[i] = el; }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    className="vault-pin-digit"
                    value={pinDigits[i]}
                    onChange={e => handlePinDigitChange(i, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                        pinInputRefs.current[i - 1]?.focus();
                      }
                    }}
                    onPaste={handlePinPaste}
                    aria-label={`Digit PIN ke-${i + 1}`}
                  />
                ))}
              </div>

              {pinMessage && (
                <p role="alert" className={`vault-pin-message${pinLocked ? " locked" : ""}`}>
                  {pinMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={pinBusy || pinDigits.filter(Boolean).length < 4}
                className="hero-cta hero-cta-primary vault-pin-submit"
              >
                {pinBusy ? "Memverifikasi..." : "BUKA BRANKAS MEMORI →"}
              </button>

              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo A Chapter, kartu kado saya untuk produk ID ${product.id} tidak terbaca. Mohon bantuan PIN.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="vault-pin-help-link"
              >
                PIN tidak terbaca atau hilang? Bantuan WhatsApp
              </a>
            </form>
          </div>
        ) : (
          /* ── 2. UNLOCKED LIVING MEMOIR EXPERIENCE ── */
          <div className="vault-unlocked-content">
            {/* Roman Tab Navigation */}
            <nav className="vault-roman-nav" role="tablist" aria-label="Memoir Vault Tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "photos"}
                className={`vault-roman-btn${activeTab === "photos" ? " active" : ""}`}
                onClick={() => setActiveTab("photos")}
              >
                I. PHOTOGRAPHS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "audio"}
                className={`vault-roman-btn${activeTab === "audio" ? " active" : ""}`}
                onClick={() => setActiveTab("audio")}
              >
                II. VOICE NOTE
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "letter"}
                className={`vault-roman-btn${activeTab === "letter" ? " active" : ""}`}
                onClick={() => setActiveTab("letter")}
              >
                III. THE LETTER
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "video"}
                className={`vault-roman-btn${activeTab === "video" ? " active" : ""}`}
                onClick={() => setActiveTab("video")}
              >
                IV. VIDEO MEMOIR
              </button>
            </nav>

            {/* TAB PANELS */}
            <div className="vault-panel-body">
              {/* PANEL I: TOUCH-SWIPE POLAROID */}
              {activeTab === "photos" && (
                <div className="vault-polaroid-touch" role="tabpanel">
                  <div
                    className="vault-polaroid-frame"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    <div className="vault-polaroid-pin" aria-hidden="true">✦</div>
                    <div className="vault-polaroid-image-box">
                      <img
                        src={currentPhoto}
                        alt="Foto kenangan abadi"
                        className="vault-polaroid-img"
                      />
                    </div>
                    <p className="vault-polaroid-cursive">
                      “To endless beginnings · Surabaya, 2026”
                    </p>
                  </div>

                  {photos.length > 1 && (
                    <div className="vault-carousel-dots" aria-label="Indikator Foto">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`carousel-dot${activePhotoIdx === i ? " active" : ""}`}
                          onClick={() => setActivePhotoIdx(i)}
                          aria-label={`Lihat foto ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  <div className="vault-photo-actions">
                    <a
                      href={currentPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vault-download-link"
                    >
                      [ Save High-Res Memory ↓ ]
                    </a>
                  </div>
                </div>
              )}

              {/* PANEL II: CRYSTAL AUDIO & VIDEO */}
              {activeTab === "audio" && (
                <div className="vault-audio-panel" role="tabpanel">
                  {audioMedia.type === "spotify" && audioMedia.embedUrl ? (
                    <div className="vault-crystal-audio-card">
                      <span className="vault-audio-badge-top">✦ SPOTIFY SOUNDTRACK</span>
                      <iframe
                        title="Spotify Memory Soundtrack"
                        src={audioMedia.embedUrl}
                        width="100%"
                        height="152"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{ border: "none", borderRadius: "12px", marginTop: "1rem" }}
                      />
                      <blockquote className="vault-audio-quote">
                        <p>“Lagu yang dipilih khusus untuk mewakili setiap rasa yang tak sempat terucap.”</p>
                        <footer>— {product.dari || "Atelier Keepsake"}</footer>
                      </blockquote>
                    </div>
                  ) : audioMedia.isAudio && audioMedia.url ? (
                    <div className="vault-crystal-audio-card">
                      <span className="vault-audio-badge-top">✦ AUDIO MEMOIR RECORDING</span>
                      <Suspense fallback={<div className="vault-audio-loading">Memuat pemutar suara...</div>}>
                        <AudioPlayer
                          src={getVaultAudioUrl(audioMedia.url)}
                          initialDuration={product.audio_durasi}
                          title={`Pesan Suara dari ${product.dari || "Pengirim"}`}
                          className="vault-player-custom"
                        />
                      </Suspense>
                      <blockquote className="vault-audio-quote">
                        <p>“Dengarkan dengan saksama suara yang dirangkai untuk menemani babak terindah hidupmu.”</p>
                        <footer>— {product.dari || "Atelier Keepsake"}</footer>
                      </blockquote>
                    </div>
                  ) : (
                    <div className="vault-empty-note">
                      <p>Tidak ada pesan suara yang disematkan dalam brankas ini.</p>
                    </div>
                  )}
                </div>
              )}

              {/* PANEL III: THE PARCHMENT LETTER */}
              {activeTab === "letter" && (
                <div className="vault-letter-panel" role="tabpanel">
                  <div className="vault-parchment-sheet">
                    <div className="vault-parchment-seal" aria-hidden="true">A · C</div>
                    <div className="vault-letter-salutation">
                      To My Dearest {product.nama_pembeli || ""},
                    </div>
                    <p className="vault-letter-body-text">
                      <span className="vault-drop-cap">{firstLetter}</span>
                      {restOfLetter}
                    </p>
                    <div className="vault-letter-signoff">
                      <span className="signoff-phrase">With all my love, always yours,</span>
                      <strong className="signoff-author">{product.dari || "Someone Special"}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* PANEL IV: VIDEO MEMOIR */}
              {activeTab === "video" && (
                <div className="vault-video-memoir-panel" role="tabpanel">
                  {videoMedia.isVideo && videoMedia.url ? (
                    <div className="vault-video-frame">
                      {(videoMedia.type === "youtube" || videoMedia.type === "google_drive") && videoMedia.embedUrl ? (
                        <iframe
                          src={videoMedia.embedUrl}
                          title="Video Kenangan"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="vault-video-iframe"
                        />
                      ) : (
                        <video
                          controls
                          playsInline
                          src={videoMedia.url}
                          className="vault-video-player"
                        >
                          Browser tidak mendukung video.
                        </video>
                      )}
                      <p className="vault-video-caption">
                        “Sebuah memoir bergerak yang dirangkai untuk mengenang babak terindah.”
                      </p>
                    </div>
                  ) : (
                    <div className="vault-empty-note">
                      <p>Tidak ada video kenangan yang disematkan dalam brankas ini.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 8. MEMOIR COLOPHON FOOTER ── */}
        <footer className="vault-memoir-footer">
          <div className="vault-footer-leaf">🌿</div>
          <p className="vault-footer-text">
            A Chapter Botanical Atelier · Preserved in Timeless Silence · Surabaya, Indonesia
          </p>
        </footer>
      </div>
    </div>
  );
}
