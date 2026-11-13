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
import {
  getPhotoboothTheme,
  letterStyleToCss,
  normalizeLetterStyle,
} from "@/lib/vaultDesign";
import type { AudioPlayerHandle } from "@/components/AudioPlayer";

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

  // Wax-seal gateway: konten sudah termuat di balik segel, lalu satu
  // ketukan membuka tirai sekaligus memutar voice note di dalam gesture.
  const [sealOpened, setSealOpened] = useState(Boolean(previewData));
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioPlayerRef = useRef<AudioPlayerHandle | null>(null);

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
        vault_photos: previewData.vault_photos || [],
        vault_photobooth_theme: previewData.vault_photobooth_theme || "",
        vault_letter_style: previewData.vault_letter_style || {},
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

  // Animasi pembuka brankas: tampil sebentar setelah PIN benar, lalu menyingkap segel.
  useEffect(() => {
    if (openingCeremony !== "opening") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => setOpeningCeremony("done"), 2600);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [openingCeremony]);

  // Saat segel belum dibuka, kunci gulir agar fokus penerima pada ritual.
  useEffect(() => {
    if (!vaultUnlocked || sealOpened || openingCeremony === "opening") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [vaultUnlocked, sealOpened, openingCeremony]);

  const finishOpeningCeremony = () => setOpeningCeremony("done");

  const handleOpenSeal = () => {
    // play() dipanggil sinkron di dalam event gesture — inilah kunci
    // agar iOS/Android mengizinkan suara tanpa tombol play tambahan.
    audioPlayerRef.current?.play();
    setAutoPlayAudio(true);
    setSealOpened(true);
  };

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

  // Foto dari photobooth strip (maks. 4). Fallback ke polaroid lama
  // untuk vault yang dibuat sebelum fitur strip tersedia.
  const savedVaultPhotos = (product?.vault_photos || []).filter(
    (url) => Boolean(url && url.trim())
  );
  const photos: string[] = [];
  if (savedVaultPhotos.length > 0) {
    photos.push(...savedVaultPhotos);
  } else if (product?.foto_vault && product.foto_vault.trim()) {
    photos.push(product.foto_vault.trim());
  }
  if (photos.length === 0 && product?.foto_produk && product.foto_produk.trim()) {
    photos.push(product.foto_produk.trim());
  }
  if (photos.length === 0) {
    photos.push("/opengraph.jpg");
  }

  const hasStrip = savedVaultPhotos.length > 0;
  const stripTheme = getPhotoboothTheme(product?.vault_photobooth_theme);
  const letterStyle = normalizeLetterStyle(product?.vault_letter_style);
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
      <div className="vault-memoir-loading public-v2">
        <div className="vault-wax-seal-hero pulse" aria-hidden="true">
          <span className="wax-seal-circle">
            <img src="/a-chapter-logo-light.png" alt="" className="wax-seal-logo-img" />
          </span>
        </div>
        <p className="vault-loading-text">Membuka Brankas Memoar Rahasia...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="vault-memoir-wrapper public-v2">
        <div className="vault-memoir-container" style={{ textAlign: "center" }}>
          <div className="vault-wax-seal-hero" aria-hidden="true">
            <span className="wax-seal-circle">✦</span>
          </div>
          <h1 className="vault-hero-error-title" style={{ marginTop: "1.25rem" }}>Brankas Tidak Ditemukan</h1>
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
      </div>
    );
  }

  const { audioMedia, videoMedia } = resolveVaultMedia(product.audio_url, product.video_url);
  const hasAudioMemoir = audioMedia.isAudio && Boolean(audioMedia.url);
  const hasCustomLetter = Boolean(product.pesan_personal && product.pesan_personal.trim());
  const letterBody = hasCustomLetter
    ? product.pesan_personal
    : "Setiap bunga A Chapter dirangkai untuk menyimpan kenangan abadi. Karya seni botani ini diawetkan dengan cermat di laboratorium agar keindahan dan ketulusan momen istimewa Anda tetap mekar selamanya.";
  const showSealGate = vaultUnlocked && !sealOpened && openingCeremony !== "opening";

  return (
    <div className={`vault-memoir-wrapper public-v2${openingCeremony === "opening" ? " is-ceremony" : ""}`}>
      {openingCeremony === "opening" && (
        <div className="vault-opening-overlay" role="status" aria-live="polite">
          <div className="vault-opening-stage">
            <span className="vault-opening-ring" aria-hidden="true" />
            <span className="vault-opening-ring ring-two" aria-hidden="true" />
            <div className="vault-opening-seal" aria-hidden="true">
              <span className="wax-seal-circle">
                <img src="/a-chapter-logo-light.png" alt="" className="wax-seal-logo-img" />
              </span>
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

      {/* ── WAX-SEAL GATEWAY: satu ketukan membuka tirai + memutar suara ── */}
      {showSealGate && (
        <div className="vault-seal-gate" role="dialog" aria-modal="true" aria-label="Buka Memory Vault">
          <div className="vault-seal-gate-card">
            <span className="vault-seal-gate-kicker">A CHAPTER · MEMORY VAULT</span>
            <h2 className="vault-seal-gate-title">Sebuah babak rahasia menanti</h2>
            <p className="vault-seal-gate-sub">
              Disimpan untuk <strong>{product.nama_pembeli || "Anda"}</strong> oleh{" "}
              <strong>{product.dari || "seseorang yang menyayangi Anda"}</strong>.
            </p>

            <button
              type="button"
              className="vault-seal-tap"
              onClick={handleOpenSeal}
              aria-label="Ketuk segel lilin untuk membuka brankas memori"
            >
              <span className="vault-seal-tap-ring" aria-hidden="true" />
              <span className="vault-seal-tap-wax" aria-hidden="true">
                <img src="/a-chapter-logo-light.png" alt="" className="wax-seal-logo-img" />
              </span>
              <span className="vault-seal-tap-label">Tap to Open Vault</span>
            </button>

            <p className="vault-seal-gate-hint">
              {hasAudioMemoir
                ? "Ketuk segel — kenangan, surat, dan pesan suara terbuka bersamaan."
                : "Ketuk segel lilin untuk membuka kenangan yang disimpan untuk Anda."}
            </p>
          </div>
        </div>
      )}

      <div
        className="vault-memoir-container"
        aria-hidden={showSealGate ? true : undefined}
      >
        {/* ── 1. WAX SEAL REVEAL HERO ── */}
        <header className="vault-memoir-hero">
          <div className="vault-wax-seal-hero" aria-hidden="true">
            <span className="wax-seal-circle">
              <img src="/a-chapter-logo-light.png" alt="" className="wax-seal-logo-img" />
            </span>
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
            {sealOpened && isAudioPlaying && activeTab !== "audio" && hasAudioMemoir && (
              <button
                type="button"
                className="vault-now-playing"
                onClick={() => setActiveTab("audio")}
              >
                <span className="vault-now-playing-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Voice note sedang diputar · buka pemutar
              </button>
            )}

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
              {/* PANEL I: PHOTOBOOTH STRIP / TOUCH-SWIPE POLAROID */}
              {activeTab === "photos" && (
                <div className="vault-polaroid-touch" role="tabpanel">
                  {hasStrip ? (
                    <div className="vault-strip-stage">
                      <div
                        className="vault-recipient-strip"
                        style={{
                          backgroundColor: stripTheme.bg,
                          color: stripTheme.text,
                          borderColor: stripTheme.border,
                        }}
                      >
                        <div className="vault-recipient-strip-head">
                          <span className="strip-atelier-tag">A CHAPTER ATELIER</span>
                          <span className="strip-edition">
                            ARCHIVAL PHOTOBOOTH · {photos.length} CUT{photos.length > 1 ? "S" : ""}
                          </span>
                        </div>
                        <div className="vault-recipient-strip-grid">
                          {photos.map((photo, index) => (
                            <a
                              key={`${photo}-${index}`}
                              href={photo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vault-recipient-strip-frame"
                            >
                              <img
                                src={photo}
                                alt={`Kenangan photobooth ${index + 1}`}
                                className="vault-recipient-strip-img"
                                loading={index > 1 ? "lazy" : "eager"}
                              />
                              <span className="vault-recipient-frame-num" aria-hidden="true">
                                0{index + 1}
                              </span>
                            </a>
                          ))}
                        </div>
                        <div className="vault-recipient-strip-foot">
                          <span className="strip-date">SURABAYA ATELIER · 2026</span>
                          <span className="strip-monogram" aria-hidden="true">
                            <img src="/a-chapter-logo.png" alt="" className="strip-logo-img" />
                          </span>
                        </div>
                      </div>
                      <p className="vault-strip-caption">
                        Ketuk setiap bingkai untuk menyimpan foto resolusi tinggi.
                      </p>
                    </div>
                  ) : (
                    <>
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
                    </>
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

              {/* PANEL II: CRYSTAL AUDIO — selalu termuat agar voice note
                  bisa mulai tepat saat segel diketuk, walau tab lain aktif. */}
              <div
                className="vault-audio-panel"
                role="tabpanel"
                aria-hidden={activeTab !== "audio"}
                style={{ display: activeTab === "audio" ? undefined : "none" }}
              >
                {audioMedia.type === "spotify" && audioMedia.embedUrl ? (
                  <div className="vault-crystal-audio-card">
                    <span className="vault-audio-badge-top">✦ SPOTIFY SOUNDTRACK</span>
                    <iframe
                      title="Spotify Memory Soundtrack"
                      src={audioMedia.embedUrl}
                      width="100%"
                      height="352"
                      className="vault-spotify-embed"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      style={{ border: "none", borderRadius: "12px", marginTop: "1rem" }}
                    />
                    <a
                      className="spotify-open-link"
                      href={product.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka langsung di Spotify ↗
                    </a>
                    <blockquote className="vault-audio-quote">
                      <p>
                        {product.pesan_personal?.trim()
                          ? `“${product.pesan_personal.trim()}”`
                          : "“Lagu yang dipilih khusus untuk mewakili setiap rasa yang tak sempat terucap.”"}
                      </p>
                      <footer>— {product.dari || "Atelier Keepsake"}</footer>
                    </blockquote>
                  </div>
                ) : audioMedia.isAudio && audioMedia.url ? (
                  <div className="vault-crystal-audio-card">
                    <span className="vault-audio-badge-top">✦ AUDIO MEMOIR RECORDING</span>
                    <Suspense fallback={<div className="vault-audio-loading">Memuat pemutar suara...</div>}>
                      <AudioPlayer
                        ref={audioPlayerRef}
                        src={getVaultAudioUrl(audioMedia.url)}
                        initialDuration={product.audio_durasi}
                        title={`Pesan Suara dari ${product.dari || "Pengirim"}`}
                        className="vault-player-custom"
                        autoPlay={autoPlayAudio}
                        onPlayingChange={setIsAudioPlaying}
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

              {/* PANEL III: THE LACE LETTER */}
              {activeTab === "letter" && (
                <div className="vault-letter-panel" role="tabpanel">
                  <div className="vault-lace-sheet">
                    <img
                      src="/landing/lace-letter-card.webp"
                      alt="Papan renda surat rahasia"
                      className="vault-lace-mat"
                      loading="lazy"
                    />
                    <div className="vault-lace-parchment">
                      <div className="vault-lace-letter">
                        {!hasCustomLetter && (
                          <p className="vault-lace-salutation">
                            To My Dearest {product.nama_pembeli || ""},
                          </p>
                        )}
                        <p
                          className="vault-lace-body"
                          style={letterStyleToCss(letterStyle, "compact")}
                        >
                          {letterBody}
                        </p>
                        {!hasCustomLetter && (
                          <div className="vault-lace-signoff">
                            <span className="signoff-phrase">With all my love, always yours,</span>
                            <strong className="signoff-author">{product.dari || "Someone Special"}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="vault-lace-caption">
                    Surat ini disimpan di atas papan renda yang sama dengan yang Anda pilih saat meracik kenangan.
                  </p>
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
