import React, {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  Check,
  Disc3,
  Download,
  Film,
  Heart,
  Mail,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ResolvedVaultMedia } from "@/lib/media";
import {
  letterStyleToCss,
  type PhotoboothTheme,
  type VaultHookId,
  type VaultLetterStyle,
} from "@/lib/vaultDesign";

const CelebrationHook = lazy(() => import("@/components/CelebrationHook"));

export type VaultStorySkin = "noir" | "crayon" | "romance" | "atelier";
export type VaultStorySectionId = "letter" | "photos" | "video" | "spotify";

export interface VaultStoryHandle {
  openStory: (autoplayAudio?: boolean) => void;
  jumpTo: (target: "opening" | VaultStorySectionId) => void;
  pauseAudio: () => void;
}

export interface VaultStoryExperienceProps {
  mode?: "vault" | "demo";
  recipient: string;
  sender: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  skin: VaultStorySkin;
  hookId?: VaultHookId | null;
  audioMedia: ResolvedVaultMedia;
  audioSrcResolved?: string;
  audioDuration?: number;
  audioQuote?: string;
  letterBody: string;
  letterStyle: VaultLetterStyle;
  hasCustomLetter: boolean;
  photos: string[];
  photoboothTheme: PhotoboothTheme;
  videoMedia: ResolvedVaultMedia;
  demoVideoPoster?: string;
  initialStage?: "opening" | "story";
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onStageChange?: (stage: "opening" | "story") => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/* ── Main Unified Story Component ── */
const VaultStoryExperience = forwardRef<VaultStoryHandle, VaultStoryExperienceProps>(
  function VaultStoryExperience(
    {
      mode = "vault",
      recipient,
      sender,
      eyebrow,
      title,
      subtitle,
      skin,
      hookId,
      audioMedia,
      audioSrcResolved = "",
      audioDuration = 0,
      audioQuote = "",
      letterBody,
      letterStyle,
      hasCustomLetter,
      photos,
      photoboothTheme,
      videoMedia,
      demoVideoPoster = "/landing/polaroid-3.webp",
      initialStage = "opening",
      scrollContainerRef,
      onStageChange,
    },
    ref
  ) {
    const [stage, setStage] = useState<"opening" | "story">(initialStage);
    const [activeSection, setActiveSection] = useState<VaultStorySectionId>("letter");

    // Audio element (tetap terpasang saat "opening" agar play() sinkron di event klik)
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState<number>(() =>
      Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0
    );
    const [audioError, setAudioError] = useState(false);

    // Amplop & efek ketik
    const [envelopeOpened, setEnvelopeOpened] = useState(false);
    const [typedCount, setTypedCount] = useState(0);
    const [typewriterSkipped, setTypewriterSkipped] = useState(false);

    // Photobooth otomatis muncul setelah surat selesai diketik
    const [photosRevealed, setPhotosRevealed] = useState(false);
    const didAutoRevealRef = useRef(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    // Video hanya jalan saat diklik manual
    const [videoActivated, setVideoActivated] = useState(false);
    const [demoVideoPlaying, setDemoVideoPlaying] = useState(false);
    const [demoVideoMuted, setDemoVideoMuted] = useState(true);
    const videoElRef = useRef<HTMLVideoElement | null>(null);

    // Section refs
    const letterSectionRef = useRef<HTMLElement | null>(null);
    const photosSectionRef = useRef<HTMLElement | null>(null);
    const videoSectionRef = useRef<HTMLElement | null>(null);
    const spotifySectionRef = useRef<HTMLElement | null>(null);

    const hasDirectAudio = audioMedia.type !== "spotify" && Boolean(audioSrcResolved);
    const hasSpotifyAudio = audioMedia.type === "spotify" && Boolean(audioMedia.embedUrl);
    const hasRealVideo = videoMedia.isVideo && Boolean(videoMedia.url);
    const showVideoSection = mode === "demo" || hasRealVideo;

    useEffect(() => {
      if (Number.isFinite(audioDuration) && audioDuration > 0) {
        setDuration((prev) => (prev > 0 ? prev : audioDuration));
      }
    }, [audioDuration]);

    useEffect(() => {
      setCurrentTime(0);
      setIsPlaying(false);
      setAudioError(false);
    }, [audioSrcResolved]);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const onLoadedMetadata = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };
      const onTimeUpdate = () => setCurrentTime(audio.currentTime);
      const onPlaying = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
      const onEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      const onError = () => {
        setIsPlaying(false);
        setAudioError(true);
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("playing", onPlaying);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      return () => {
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("playing", onPlaying);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      };
    }, [audioSrcResolved]);

    const playAudioNow = useCallback(() => {
      const audio = audioRef.current;
      if (!audio || !audioSrcResolved || audioError) return;
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch((err) => {
          console.warn("[A Chapter Story Audio] Autoplay ditolak browser:", err);
          setIsPlaying(false);
        });
      }
    }, [audioSrcResolved, audioError]);

    const pauseAudioNow = useCallback(() => {
      audioRef.current?.pause();
      setIsPlaying(false);
    }, []);

    const toggleAudio = useCallback(() => {
      if (isPlaying) {
        pauseAudioNow();
      } else {
        playAudioNow();
      }
    }, [isPlaying, pauseAudioNow, playAudioNow]);

    const scrollToSection = useCallback(
      (section: VaultStorySectionId) => {
        const targetMap: Record<VaultStorySectionId, HTMLElement | null> = {
          letter: letterSectionRef.current,
          photos: photosSectionRef.current,
          video: videoSectionRef.current,
          spotify: spotifySectionRef.current,
        };
        const target = targetMap[section];
        if (!target) return;

        if (section === "letter") setEnvelopeOpened(true);
        if (section === "photos") setPhotosRevealed(true);

        const container = scrollContainerRef?.current;
        if (container) {
          const offsetTop = target.offsetTop - 54;
          container.scrollTo({ top: Math.max(0, offsetTop), behavior: "smooth" });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setActiveSection(section);
      },
      [scrollContainerRef]
    );

    const startLetterSequence = useCallback(() => {
      didAutoRevealRef.current = false;
      setEnvelopeOpened(false);
      setTypewriterSkipped(false);
      setTypedCount(0);
      setPhotosRevealed(false);

      if (prefersReducedMotion()) {
        setEnvelopeOpened(true);
        setTypedCount(letterBody.length);
        setPhotosRevealed(true);
        didAutoRevealRef.current = true;
        return;
      }

      window.setTimeout(() => setEnvelopeOpened(true), 260);
    }, [letterBody.length]);

    const handleOpenStory = useCallback(
      (autoplayAudio = true) => {
        if (autoplayAudio && hasDirectAudio) {
          playAudioNow();
        }
        setStage("story");
        onStageChange?.("story");
        startLetterSequence();
      },
      [hasDirectAudio, playAudioNow, onStageChange, startLetterSequence]
    );

    useImperativeHandle(
      ref,
      () => ({
        openStory: handleOpenStory,
        jumpTo: (target) => {
          if (target === "opening") {
            pauseAudioNow();
            setStage("opening");
            onStageChange?.("opening");
            scrollContainerRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          if (stage !== "story") {
            setStage("story");
            onStageChange?.("story");
            setEnvelopeOpened(true);
            if (target === "photos" || target === "video") {
              setTypewriterSkipped(true);
              setTypedCount(letterBody.length);
              setPhotosRevealed(true);
              didAutoRevealRef.current = true;
            } else {
              startLetterSequence();
            }
            window.setTimeout(() => scrollToSection(target), 90);
          } else {
            if (target === "photos" || target === "video") {
              setPhotosRevealed(true);
              didAutoRevealRef.current = true;
            }
            scrollToSection(target);
          }
        },
        pauseAudio: pauseAudioNow,
      }),
      [
        handleOpenStory,
        letterBody.length,
        onStageChange,
        pauseAudioNow,
        scrollContainerRef,
        scrollToSection,
        stage,
        startLetterSequence,
      ]
    );

    // Scroll-spy untuk bottom dock + tampilkan foto bila user scroll manual lebih cepat
    useEffect(() => {
      if (stage !== "story") return;
      const rootEl = scrollContainerRef?.current ?? null;

      const spyObs = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!visible) return;
          const id = visible.target.getAttribute("data-story-section") as VaultStorySectionId | null;
          if (id) {
            setActiveSection(id);
            if (id === "photos") setPhotosRevealed(true);
          }
        },
        { root: rootEl, threshold: [0.25, 0.5, 0.75] }
      );
      [
        letterSectionRef.current,
        photosSectionRef.current,
        videoSectionRef.current,
        spotifySectionRef.current,
      ].forEach((el) => {
        if (el) spyObs.observe(el);
      });

      return () => spyObs.disconnect();
    }, [stage, scrollContainerRef, showVideoSection, photosRevealed]);

    // Efek ketik huruf demi huruf setelah amplop terbuka
    useEffect(() => {
      if (stage !== "story" || !envelopeOpened || !letterBody) return;
      if (typewriterSkipped || prefersReducedMotion()) {
        setTypedCount(letterBody.length);
        return;
      }

      setTypedCount(0);
      let intervalId: number | null = null;
      const startDelay = window.setTimeout(() => {
        intervalId = window.setInterval(() => {
          setTypedCount((prev) => {
            if (prev >= letterBody.length) {
              if (intervalId !== null) window.clearInterval(intervalId);
              return prev;
            }
            return prev + 1;
          });
        }, 24);
      }, 520);

      return () => {
        window.clearTimeout(startDelay);
        if (intervalId !== null) window.clearInterval(intervalId);
      };
    }, [stage, envelopeOpened, letterBody, typewriterSkipped]);

    const isTypewriterDone = typedCount >= letterBody.length;
    const displayedLetter = isTypewriterDone ? letterBody : letterBody.slice(0, typedCount);

    // Begitu ketikan surat selesai → munculkan Photobooth 4-Cut & auto-scroll lembut ke foto
    useEffect(() => {
      if (stage !== "story" || !envelopeOpened || !isTypewriterDone) return;
      if (didAutoRevealRef.current) return;

      didAutoRevealRef.current = true;
      const revealDelay = typewriterSkipped || prefersReducedMotion() ? 180 : 680;
      const revealTimer = window.setTimeout(() => {
        setPhotosRevealed(true);
        window.setTimeout(() => {
          scrollToSection("photos");
        }, 220);
      }, revealDelay);

      return () => window.clearTimeout(revealTimer);
    }, [stage, envelopeOpened, isTypewriterDone, typewriterSkipped, scrollToSection]);

    // Manual video click handler: jeda musik latar otomatis
    const handleActivateVideo = () => {
      pauseAudioNow();
      setVideoActivated(true);
      if (mode === "demo") {
        setDemoVideoPlaying(true);
      } else {
        window.requestAnimationFrame(() => {
          videoElRef.current?.play().catch(() => {
            // kontrol native tetap tersedia
          });
        });
      }
    };

    const effectiveStripBg =
      photoboothTheme.id === "crimson" ? "#9E1B32" : photoboothTheme.bg;
    const effectiveStripBorder =
      photoboothTheme.id === "crimson" ? "#B82942" : photoboothTheme.border;
    const collagePhotos = useMemo(() => photos.slice(0, 4), [photos]);

    return (
      <div className={`vsx-root vsx-mode-${mode}`} data-vsx-skin={skin}>
        {/* Audio latar tetap terpasang sejak stage opening untuk gesture iOS/Android */}
        {hasDirectAudio && (
          <audio
            ref={audioRef}
            src={audioSrcResolved}
            preload="metadata"
            loop
          />
        )}

        {/* Partikel atmosfer halus sesuai tema */}
        <div className="vsx-ambient" aria-hidden="true">
          <span className="vsx-particle p1" />
          <span className="vsx-particle p2" />
          <span className="vsx-particle p3" />
          <span className="vsx-particle p4" />
          <span className="vsx-particle p5" />
          <span className="vsx-particle p6" />
        </div>

        {stage === "opening" ? (
          /* ═════════ TAMPILAN 1: PEMBUKA ═════════ */
          <section className="vsx-opening" aria-label="Pembuka Kenangan">
            <span className="vsx-eyebrow">{eyebrow}</span>

            <div className="vsx-opening-visual">
              {hookId ? (
                <Suspense
                  fallback={
                    <div className="vsx-wax-hero" aria-hidden="true">
                      <img src="/a-chapter-logo-light.png" alt="" />
                    </div>
                  }
                >
                  <CelebrationHook hookId={hookId} loop className="vsx-opening-hook" />
                </Suspense>
              ) : (
                <div className="vsx-wax-hero" aria-hidden="true">
                  <span className="vsx-wax-ring" />
                  <span className="vsx-wax-ring r2" />
                  <div className="vsx-wax-badge">
                    <img src="/a-chapter-logo-light.png" alt="A Chapter" />
                  </div>
                </div>
              )}
            </div>

            <h1 className="vsx-opening-title">{title}</h1>
            <p className="vsx-opening-for">UNTUK {recipient || "KAMU"}</p>
            <p className="vsx-opening-from">
              {subtitle || `Disiapkan oleh ${sender || "Someone Special"}`}
            </p>

            <button
              type="button"
              className="vsx-open-btn"
              onClick={() => handleOpenStory(true)}
            >
              <span>Buka Surat Kenangan</span>
              <span aria-hidden="true">→</span>
            </button>

            {hasDirectAudio && (
              <p className="vsx-opening-hint">
                <Disc3 size={13} aria-hidden="true" />
                <span>Musik latar akan mengalun pelan saat surat terbuka</span>
              </p>
            )}
          </section>
        ) : (
          /* ═════════ TAMPILAN 2: SURAT TERBUKA → FOTO OTOMATIS → VIDEO MANUAL ═════════ */
          <div className="vsx-story">
            {/* Kapsul Kaset Mini Diskrit di Pojok Atas (bukan tampilan utama) */}
            {hasDirectAudio && !audioError && (
              <div className="vsx-audio-corner-wrap">
                <button
                  type="button"
                  className={`vsx-audio-pill${isPlaying ? " is-playing" : ""}`}
                  onClick={toggleAudio}
                  aria-label={isPlaying ? "Jeda musik latar" : "Putar musik latar"}
                  title={isPlaying ? "Jeda suara latar" : "Putar suara latar"}
                >
                  <span className={`vsx-mini-reel${isPlaying ? " is-spinning" : ""}`}>
                    <Disc3 size={14} />
                  </span>
                  <span className="vsx-audio-pill-copy">
                    <strong>{isPlaying ? "Suara Latar" : "Suara Dijeda"}</strong>
                    <em>{formatTime(currentTime)} / {formatTime(duration || 131)}</em>
                  </span>
                  <span className="vsx-audio-pill-icon" aria-hidden="true">
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </span>
                </button>
              </div>
            )}

            {/* ── SPOTIFY COMPACT CARD (khusus bila pengirim pakai Spotify, karena butuh klik manual) ── */}
            {hasSpotifyAudio && audioMedia.embedUrl && (
              <section
                ref={spotifySectionRef}
                data-story-section="spotify"
                className="vsx-spotify-compact"
                aria-label="Soundtrack Spotify"
              >
                <div className="vsx-spotify-compact-head">
                  <Music size={14} aria-hidden="true" />
                  <span>Tekan putar untuk mengiringi suratmu</span>
                </div>
                <iframe
                  title="Spotify Memory Soundtrack"
                  src={audioMedia.embedUrl}
                  width="100%"
                  height="80"
                  className="vsx-spotify-iframe"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </section>
            )}

            {/* ── BAGIAN 1 (UTAMA): AMPLOP TERBUKA & SURAT TULISAN BERGERAK ── */}
            <section
              ref={letterSectionRef}
              data-story-section="letter"
              className="vsx-section vsx-section-letter"
              aria-label="Surat Kenangan"
            >
              <header className="vsx-story-top-head">
                <span className="vsx-eyebrow">{eyebrow}</span>
                <h2 className="vsx-story-title">{title}</h2>
                <p className="vsx-story-sub">
                  Untuk <strong>{recipient || "Kamu"}</strong> · dari{" "}
                  <strong>{sender || "Someone Special"}</strong>
                </p>
              </header>

              <div className={`vsx-envelope-stage${envelopeOpened ? " is-open" : ""}`}>
                {!envelopeOpened && (
                  <button
                    type="button"
                    className="vsx-envelope-closed-btn"
                    onClick={() => setEnvelopeOpened(true)}
                    aria-label="Ketuk untuk membuka amplop surat"
                  >
                    <div className="vsx-envelope-body">
                      <span className="vsx-envelope-flap" />
                      <span className="vsx-envelope-seal">
                        <Heart size={16} />
                      </span>
                      <span className="vsx-envelope-caption">
                        Membuka surat untukmu...
                      </span>
                    </div>
                  </button>
                )}

                <div className={`vsx-letter-reveal${envelopeOpened ? " is-open" : ""}`}>
                  <div className="vsx-envelope-pocket-top" aria-hidden="true">
                    <span className="vsx-pocket-flap" />
                  </div>

                  <div className="vsx-lace-sheet">
                    <img
                      src="/landing/lace-letter-frame.webp"
                      alt="Papan renda surat rahasia"
                      className="vsx-lace-mat"
                      loading="lazy"
                    />
                    <div
                      className="vsx-lace-parchment"
                      onClick={() => {
                        if (!isTypewriterDone) {
                          setTypewriterSkipped(true);
                          setTypedCount(letterBody.length);
                        }
                      }}
                    >
                      {!hasCustomLetter && (
                        <p className="vsx-lace-salutation">
                          To My Dearest {recipient || ""},
                        </p>
                      )}
                      <p
                        className="vsx-lace-body"
                        style={letterStyleToCss(letterStyle, "compact")}
                      >
                        {displayedLetter}
                        {!isTypewriterDone && envelopeOpened && (
                          <span className="vault-typewriter-cursor" aria-hidden="true">
                            |
                          </span>
                        )}
                      </p>
                      {!hasCustomLetter && isTypewriterDone && (
                        <div className="vsx-lace-signoff">
                          <span>With all my love, always yours,</span>
                          <strong>{sender || "Someone Special"}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="vsx-letter-actions">
                {envelopeOpened && !isTypewriterDone && (
                  <button
                    type="button"
                    className="vsx-text-btn"
                    onClick={() => {
                      setTypewriterSkipped(true);
                      setTypedCount(letterBody.length);
                    }}
                  >
                    Tampilkan semua tulisan →
                  </button>
                )}
                {envelopeOpened && isTypewriterDone && (
                  <button
                    type="button"
                    className="vsx-text-btn"
                    onClick={() => startLetterSequence()}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    <span>Putar ulang amplop</span>
                  </button>
                )}
              </div>

              {audioQuote.trim() && isTypewriterDone && (
                <blockquote className="vsx-soft-quote">
                  <p>“{audioQuote.trim()}”</p>
                </blockquote>
              )}
            </section>

            {/* ── BAGIAN 2: PHOTOBOOTH STRIP 4-CUT (OTOMATIS MUNCUL SETELAH SURAT SELESAI) ── */}
            <section
              ref={photosSectionRef}
              data-story-section="photos"
              className={`vsx-section vsx-section-photos${photosRevealed ? " is-revealed" : " is-waiting"}`}
              aria-label="Photobooth Strip Kenangan"
            >
              <div className="vsx-section-head">
                <span className="vsx-step-tag">KENANGAN TERABADIKAN</span>
                <h3 className="vsx-section-title">Potongan Momen Kita</h3>
              </div>

              <div className="vsx-photobooth-stage">
                <span className="vsx-strip-deco d1" aria-hidden="true">
                  <Sparkles size={16} />
                </span>
                <span className="vsx-strip-deco d2" aria-hidden="true">
                  ✦
                </span>

                <div
                  className="vsx-strip-card"
                  style={{
                    backgroundColor: effectiveStripBg,
                    borderColor: effectiveStripBorder,
                    color: photoboothTheme.text,
                  }}
                >
                  <div className="vsx-strip-head">
                    <span>A CHAPTER ATELIER</span>
                    <span>
                      {collagePhotos.length} CUT{collagePhotos.length > 1 ? "S" : ""}
                    </span>
                  </div>

                  <div className="vsx-strip-grid" data-count={collagePhotos.length}>
                    {collagePhotos.map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        className="vsx-strip-cell"
                        style={{ animationDelay: `${index * 140}ms` }}
                        onClick={() => setLightboxIdx(index)}
                        aria-label={`Lihat foto kenangan ${index + 1}`}
                      >
                        <img
                          src={photo}
                          alt={`Kenangan ${index + 1}`}
                          loading={index === 0 ? "eager" : "lazy"}
                        />
                        <span className="vsx-strip-num" aria-hidden="true">
                          0{index + 1}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="vsx-strip-foot">
                    <span>ARCHIVAL PHOTOBOOTH</span>
                    <span>KENANGAN ANDA</span>
                  </div>
                </div>
              </div>

              <p className="vsx-photo-hint">
                Ketuk setiap foto untuk memperbesar atau menyimpan resolusi penuh.
              </p>
            </section>

            {/* ── BAGIAN 3: VIDEO MEMOIR (KLIK MANUAL SAJA) ── */}
            {showVideoSection && (
              <section
                ref={videoSectionRef}
                data-story-section="video"
                className="vsx-section vsx-section-video"
                aria-label="Video Kenangan"
              >
                <div className="vsx-section-head">
                  <span className="vsx-step-tag">VIDEO MEMOIR</span>
                  <h3 className="vsx-section-title">Sebuah Rekaman Bergerak</h3>
                </div>

                <div className="vsx-video-card">
                  {mode === "demo" ? (
                    <div
                      className={`vsx-video-poster-box${demoVideoPlaying ? " is-playing" : ""}`}
                    >
                      <img
                        src={demoVideoPoster}
                        alt="Pratinjau video kenangan"
                        className="vsx-video-poster-img"
                        loading="lazy"
                      />
                      <span className="vsx-video-scrim" aria-hidden="true" />
                      <span className="vsx-video-pill">MEMOIR · KLIK MANUAL</span>

                      <button
                        type="button"
                        className="vsx-video-play-btn"
                        onClick={() => {
                          if (!demoVideoPlaying) {
                            pauseAudioNow();
                            setDemoVideoPlaying(true);
                          } else {
                            setDemoVideoPlaying(false);
                          }
                        }}
                        aria-label={demoVideoPlaying ? "Jeda simulasi video" : "Putar video kenangan"}
                      >
                        {demoVideoPlaying ? <Pause size={22} /> : <Play size={22} />}
                      </button>

                      {demoVideoPlaying && (
                        <button
                          type="button"
                          className="vsx-video-mute-btn"
                          onClick={() => setDemoVideoMuted((m) => !m)}
                          aria-label={demoVideoMuted ? "Nyalakan suara" : "Bisukan suara"}
                        >
                          {demoVideoMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>
                      )}

                      <div className="vsx-video-demo-progress" aria-hidden="true">
                        <span />
                      </div>
                    </div>
                  ) : !videoActivated ? (
                    <button
                      type="button"
                      className="vsx-video-cover-btn"
                      onClick={handleActivateVideo}
                      aria-label="Ketuk untuk memutar video kenangan"
                    >
                      <img
                        src={collagePhotos[0] || "/landing/polaroid-3.webp"}
                        alt="Sampul video kenangan"
                        className="vsx-video-poster-img"
                      />
                      <span className="vsx-video-scrim" aria-hidden="true" />
                      <span className="vsx-video-pill">VIDEO MEMOIR</span>
                      <span className="vsx-video-play-circle">
                        <Play size={24} />
                      </span>
                      <span className="vsx-video-cover-label">
                        Ketuk untuk memutar video (suara latar akan dijeda otomatis)
                      </span>
                    </button>
                  ) : (videoMedia.type === "youtube" || videoMedia.type === "google_drive") &&
                    videoMedia.embedUrl ? (
                    <iframe
                      src={
                        videoMedia.type === "youtube"
                          ? `${videoMedia.embedUrl}&autoplay=1`
                          : videoMedia.embedUrl
                      }
                      title="Video Kenangan"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="vsx-video-iframe"
                    />
                  ) : (
                    <video
                      ref={videoElRef}
                      controls
                      playsInline
                      src={videoMedia.url}
                      className="vsx-video-player"
                      onPlay={pauseAudioNow}
                    >
                      Browser tidak mendukung pemutaran video.
                    </video>
                  )}

                  <p className="vsx-video-caption">
                    “Video hanya diputar saat kamu mengetuk tombol putar di atas.”
                  </p>
                </div>
              </section>
            )}

            {/* ── BAGIAN 4: PENUTUP & MENU PILIHAN ULANG ── */}
            <section className="vsx-section vsx-section-ending" aria-label="Pilih Ulang Bagian">
              <div className="vsx-ending-card">
                <span className="vsx-step-tag">AKHIR CERITA</span>
                <h3 className="vsx-ending-title">Ingin mengulang bagian mana?</h3>
                <p className="vsx-ending-sub">
                  Semua kenangan ini selalu terbuka untukmu kapan saja.
                </p>

                <div className="vsx-ending-grid">
                  <button
                    type="button"
                    className="vsx-ending-choice"
                    onClick={() => scrollToSection("letter")}
                  >
                    <Mail size={18} />
                    <span>Surat</span>
                  </button>
                  <button
                    type="button"
                    className="vsx-ending-choice"
                    onClick={() => scrollToSection("photos")}
                  >
                    <Camera size={18} />
                    <span>Foto</span>
                  </button>
                  {showVideoSection && (
                    <button
                      type="button"
                      className="vsx-ending-choice"
                      onClick={() => scrollToSection("video")}
                    >
                      <Film size={18} />
                      <span>Video</span>
                    </button>
                  )}
                  {hasDirectAudio && (
                    <button
                      type="button"
                      className="vsx-ending-choice"
                      onClick={toggleAudio}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                      <span>{isPlaying ? "Jeda" : "Musik"}</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="vsx-replay-opening-btn"
                  onClick={() => {
                    pauseAudioNow();
                    setStage("opening");
                    onStageChange?.("opening");
                    scrollContainerRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
                    if (!scrollContainerRef?.current) {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Putar ulang dari tampilan pembuka</span>
                </button>
              </div>
            </section>

            {/* ── FLOATING BOTTOM DOCK ── */}
            <nav className="vsx-bottom-dock" aria-label="Navigasi cepat bagian kenangan">
              <button
                type="button"
                className={`vsx-dock-btn${activeSection === "letter" ? " is-active" : ""}`}
                onClick={() => scrollToSection("letter")}
              >
                <Mail size={15} />
                <span>Surat</span>
              </button>
              <button
                type="button"
                className={`vsx-dock-btn${activeSection === "photos" ? " is-active" : ""}`}
                onClick={() => scrollToSection("photos")}
              >
                <Camera size={15} />
                <span>Foto</span>
              </button>
              {showVideoSection && (
                <button
                  type="button"
                  className={`vsx-dock-btn${activeSection === "video" ? " is-active" : ""}`}
                  onClick={() => scrollToSection("video")}
                >
                  <Film size={15} />
                  <span>Video</span>
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Photo Lightbox */}
        {lightboxIdx !== null && collagePhotos[lightboxIdx] && (
          <div
            className="vsx-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Pratinjau foto"
            onClick={() => setLightboxIdx(null)}
          >
            <div className="vsx-lightbox-card" onClick={(e) => e.stopPropagation()}>
              <img
                src={collagePhotos[lightboxIdx]}
                alt={`Foto kenangan ${lightboxIdx + 1}`}
              />
              <div className="vsx-lightbox-bar">
                <span>
                  Foto 0{lightboxIdx + 1} / 0{collagePhotos.length}
                </span>
                <div className="vsx-lightbox-btns">
                  {mode === "vault" && (
                    <a
                      href={collagePhotos[lightboxIdx]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vsx-lightbox-dl"
                    >
                      <Download size={14} />
                      <span>Simpan HD</span>
                    </a>
                  )}
                  <button
                    type="button"
                    className="vsx-lightbox-close"
                    onClick={() => setLightboxIdx(null)}
                  >
                    <Check size={14} />
                    <span>Tutup</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default VaultStoryExperience;
