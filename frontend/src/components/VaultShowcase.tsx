import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Camera,
  Check,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Mail,
  Music,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { homeContent } from "@/content/homeContent";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { PHOTOBOOTH_THEMES, type PhotoboothThemeId } from "@/lib/vaultDesign";

type ShowcaseTab = "photo" | "audio" | "letter" | "video";

const TABS: ReadonlyArray<{
  id: ShowcaseTab;
  title: string;
  sub: string;
  icon: typeof Camera;
}> = [
  { id: "photo", title: "Foto", sub: "Photobooth 4 potongan", icon: Camera },
  { id: "audio", title: "Rekaman Suara", sub: "Suara & musik kenangan", icon: Music },
  { id: "letter", title: "Surat", sub: "Surat papan renda & ketik", icon: Mail },
  { id: "video", title: "Video", sub: "Klip momen personal", icon: Film },
];

const PHOTOBOOTH_CUTS = [
  { src: "/landing/polaroid-1.webp", alt: "Potongan kenangan 1" },
  { src: "/landing/polaroid-2.webp", alt: "Potongan kenangan 2" },
  { src: "/landing/polaroid-3.webp", alt: "Potongan kenangan 3" },
  { src: "/landing/polaroid-4.webp", alt: "Potongan kenangan 4" },
] as const;

const DEMO_LETTER_TEXT =
  "Waktu mungkin terus berjalan, namun kenangan yang kita ukir bersama takkan pernah layu.\n\nSeperti kelopak bunga yang diawetkan abadi di studio A Chapter, doa dan rasa terima kasihku akan selalu menyertai setiap langkahmu.\n\nSimpanlah pesan ini baik-baik—setiap kali kamu memindai bingkai ini, ingatlah bahwa momen kita selalu hidup di sini.";

const WAVEFORM_BARS = [
  24, 34, 48, 64, 50, 78, 60, 88, 72, 84, 52, 66, 90, 70, 96, 56,
  74, 86, 62, 42, 58, 80, 92, 66, 84, 50, 74, 88, 58, 44, 68, 80,
  86, 94, 60, 48, 72, 84, 54, 66, 90, 74, 46, 60, 78, 88, 58, 48,
];

const THEME_OVERRIDES: Partial<Record<PhotoboothThemeId, { bg: string; border: string }>> = {
  crimson: { bg: "#9E1B32", border: "#B82942" },
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function VaultShowcase() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("photo");
  const [selectedThemeId, setSelectedThemeId] = useState<PhotoboothThemeId>("cream");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  const [typedCount, setTypedCount] = useState(0);
  const [typewriterSkipped, setTypewriterSkipped] = useState(false);

  const {
    isPlaying: isAudioPlaying,
    currentTime: audioCurrentTime,
    duration: audioDuration,
    rate: audioRate,
    toggle: toggleAudio,
    pause: pauseAudio,
    seekTo: seekAudio,
    skip: skipAudio,
    cycleRate: cycleAudioRate,
  } = useAudioPlayback(131);

  useEffect(() => {
    if (activeTab !== "letter") return;
    if (
      typewriterSkipped ||
      (typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      setTypedCount(DEMO_LETTER_TEXT.length);
      return;
    }

    setTypedCount(0);
    const interval = window.setInterval(() => {
      setTypedCount((prev) => {
        if (prev >= DEMO_LETTER_TEXT.length) {
          window.clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 28);

    return () => window.clearInterval(interval);
  }, [activeTab, typewriterSkipped]);

  const activeThemeBase =
    PHOTOBOOTH_THEMES.find((t) => t.id === selectedThemeId) || PHOTOBOOTH_THEMES[0];
  const themeOverride = THEME_OVERRIDES[activeThemeBase.id];
  const activeTheme = {
    ...activeThemeBase,
    bg: themeOverride?.bg || activeThemeBase.bg,
    border: themeOverride?.border || activeThemeBase.border,
  };

  const audioTab = homeContent.smartVault.mediaTabs.find((t) => t.kind === "voice-record");
  const videoTab = homeContent.smartVault.mediaTabs.find((t) => t.kind === "video");

  const handleSelectTab = (tabId: ShowcaseTab) => {
    setActiveTab(tabId);
    if (tabId !== "audio") pauseAudio();
    if (tabId !== "video") setIsVideoPlaying(false);
    if (tabId === "letter") {
      setTypewriterSkipped(false);
      setTypedCount(0);
    }
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekAudio(ratio * (audioDuration || 131));
  };

  const totalDur = audioDuration || 131;
  const progressRatio = totalDur > 0 ? Math.min(1, Math.max(0, audioCurrentTime / totalDur)) : 0;
  const isTypewriterDone = typedCount >= DEMO_LETTER_TEXT.length;
  const displayedLetter = isTypewriterDone ? DEMO_LETTER_TEXT : DEMO_LETTER_TEXT.slice(0, typedCount);

  return (
    <section className="vs-section" id="vault" aria-label="Pratinjau Interaktif Smart QR Memory Vault">
      <div className="vs-container">
        <header className="vs-header">
          <span className="vs-eyebrow">SMART QR MEMORY VAULT</span>
          <h2 className="vs-title">Kenangan, Siap Dibuka Kembali</h2>
          <p className="vs-subtitle">
            Lihat langsung tampilan brankas digital yang akan dibuka penerima saat memindai kode QR pada karya Anda.
          </p>
        </header>

        <div className="vs-tabs" role="tablist" aria-label="Pilih fitur Memory Vault">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`vs-tab${isActive ? " is-active" : ""}`}
                onClick={() => handleSelectTab(tab.id)}
              >
                <span className="vs-tab-left">
                  <span className="vs-tab-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span className="vs-tab-text">
                    <span className="vs-tab-title">{tab.title}</span>
                    <span className="vs-tab-sub">{tab.sub}</span>
                  </span>
                </span>
                <ChevronRight size={16} className="vs-tab-arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="vs-stage">
          {activeTab === "photo" && (
            <div className="vs-panel vs-photo-grid" key="photo" role="tabpanel">
              <div>
                <span className="vs-panel-kicker">PHOTOBOOTH KENANGAN</span>
                <h3 className="vs-panel-heading">Kolase 4 Potong Foto</h3>
                <p className="vs-panel-desc">
                  Persis seperti yang dibuka penerima: 4 momen terbaik tersusun rapi dalam strip photobooth dengan pilihan warna bingkai sesuai selera Anda.
                </p>

                <div className="vs-swatches" role="radiogroup" aria-label="Pilihan warna bingkai">
                  {PHOTOBOOTH_THEMES.map((theme) => {
                    const isSelected = selectedThemeId === theme.id;
                    const swatchBg = THEME_OVERRIDES[theme.id]?.bg || theme.bg;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={theme.name}
                        title={theme.name}
                        className={`vs-swatch-btn${isSelected ? " is-active" : ""}`}
                        style={{ backgroundColor: swatchBg, borderColor: theme.border, color: theme.text }}
                        onClick={() => setSelectedThemeId(theme.id)}
                      >
                        {isSelected && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <p className="vs-swatch-name">Tema terpilih: {activeTheme.name}</p>

                <div className="vs-perks">
                  <div className="vs-perk-row">
                    <Sparkles size={16} aria-hidden="true" />
                    <span>Hingga 4 foto dalam satu strip photobooth</span>
                  </div>
                  <div className="vs-perk-row">
                    <ImageIcon size={16} aria-hidden="true" />
                    <span>Resolusi tajam &amp; tersimpan permanen</span>
                  </div>
                  <div className="vs-perk-row">
                    <QrCode size={16} aria-hidden="true" />
                    <span>Terbuka langsung lewat kamera ponsel</span>
                  </div>
                </div>
              </div>

              <div className="vs-photo-preview-wrap">
                <div
                  className="vs-strip-card"
                  style={{
                    backgroundColor: activeTheme.bg,
                    borderColor: activeTheme.border,
                    color: activeTheme.text,
                  }}
                >
                  <div className="vs-frame-head">
                    <span>A CHAPTER ATELIER</span>
                    <span>4 CUTS</span>
                  </div>
                  <div className="vs-strip-grid">
                    {PHOTOBOOTH_CUTS.map((cut, i) => (
                      <div className="vs-strip-cell" key={cut.src}>
                        <img src={cut.src} alt={cut.alt} loading="lazy" />
                        <span className="vs-strip-num">0{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <div className="vs-frame-foot">
                    <span>ARCHIVAL PHOTOBOOTH</span>
                    <span>KENANGAN ANDA</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "audio" && (
            <div className="vs-panel vs-audio-grid" key="audio" role="tabpanel">
              <div className="vs-vinyl-card">
                <div className={`vs-vinyl-disc${isAudioPlaying ? " is-spinning" : ""}`}>
                  <img src="/landing/polaroid-2.webp" alt="Sampul rekaman kenangan" loading="lazy" />
                </div>
                <span className="vs-vinyl-label">
                  {isAudioPlaying ? "Sedang Diputar" : "Siap Diputar"}
                </span>
              </div>

              <div className="vs-audio-main">
                <div>
                  <span className="vs-panel-kicker">REKAMAN SUARA &amp; MUSIK</span>
                  <h3 className="vs-audio-title">Acoustic Keepsake Memoir</h3>
                  <p className="vs-audio-artist">Mendukung Spotify Soundtrack atau Rekaman Suara Pribadi</p>
                </div>

                <div className="vs-waveform-box">
                  <div
                    className="vs-waveform-bars"
                    role="slider"
                    tabIndex={0}
                    aria-label="Seekbar audio kenangan"
                    aria-valuemin={0}
                    aria-valuemax={totalDur}
                    aria-valuenow={audioCurrentTime}
                    onClick={handleSeekClick}
                    title="Klik pada gelombang suara untuk melompat ke bagian tertentu"
                  >
                    {WAVEFORM_BARS.map((pct, idx) => {
                      const ratio = idx / (WAVEFORM_BARS.length - 1);
                      return (
                        <span
                          key={idx}
                          className={`vs-wbar${ratio <= progressRatio ? " is-played" : ""}`}
                          style={{ height: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="vs-audio-time">
                    {formatTime(audioCurrentTime)} / {formatTime(totalDur)}
                  </span>
                </div>

                <div className="vs-audio-controls">
                  <button
                    type="button"
                    className="vs-play-btn"
                    onClick={() => toggleAudio(audioTab?.audioSrc || "/see-you-again.mp3")}
                  >
                    {isAudioPlaying ? <Pause size={15} /> : <Play size={15} />}
                    <span>{isAudioPlaying ? "Jeda" : "Putar Contoh"}</span>
                  </button>
                  <button type="button" className="vs-ctrl-btn" onClick={() => skipAudio(-10)}>
                    −10s
                  </button>
                  <button type="button" className="vs-ctrl-btn" onClick={() => skipAudio(10)}>
                    +10s
                  </button>
                  <button type="button" className="vs-ctrl-btn" onClick={cycleAudioRate}>
                    {audioRate}x
                  </button>
                </div>

                <blockquote className="vs-audio-quote">
                  <p>{audioTab?.quoteExcerpt || "“Suara yang terekam hari ini akan menjadi pelukan hangat di tahun-tahun mendatang.”"}</p>
                  <footer>— Pesan Kenangan &amp; Ucapan Personal</footer>
                </blockquote>
              </div>
            </div>
          )}

          {activeTab === "letter" && (
            <div className="vs-panel vs-letter-customer-grid" key="letter" role="tabpanel">
              <div className="vs-lace-preview-wrap">
                <div className="vs-lace-sheet">
                  <img
                    src="/landing/lace-letter-frame.webp"
                    alt="Papan renda surat rahasia"
                    className="vs-lace-mat"
                    loading="lazy"
                  />
                  <div
                    className="vs-lace-parchment"
                    onClick={() => {
                      if (!isTypewriterDone) {
                        setTypewriterSkipped(true);
                        setTypedCount(DEMO_LETTER_TEXT.length);
                      }
                    }}
                  >
                    <p className="vs-lace-salutation">To My Dearest,</p>
                    <p className="vs-lace-body">
                      {displayedLetter}
                      {!isTypewriterDone && (
                        <span className="vault-typewriter-cursor" aria-hidden="true">|</span>
                      )}
                    </p>
                    {isTypewriterDone && (
                      <div className="vs-lace-signoff">
                        <span className="vs-signoff-script">With all my love, always yours,</span>
                        <strong>Someone Special</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <span className="vs-panel-kicker">SURAT PAPAN RENDA</span>
                <h3 className="vs-panel-heading">Pesan Personal dengan Efek Ketik</h3>
                <p className="vs-panel-desc">
                  Saat penerima membuka surat di Memory Vault, kata-kata Anda muncul perlahan seolah sedang ditulis langsung di atas papan renda vintage.
                </p>
                <div className="vs-letter-demo-actions">
                  {!isTypewriterDone ? (
                    <button
                      type="button"
                      className="vs-ctrl-btn"
                      onClick={() => {
                        setTypewriterSkipped(true);
                        setTypedCount(DEMO_LETTER_TEXT.length);
                      }}
                    >
                      Tampilkan semua tulisan →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="vs-ctrl-btn"
                      onClick={() => {
                        setTypewriterSkipped(false);
                        setTypedCount(0);
                      }}
                    >
                      <RotateCcw size={14} style={{ marginRight: "0.35rem", verticalAlign: "-2px" }} />
                      Putar ulang efek ketik
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "video" && (
            <div className="vs-panel vs-video-grid" key="video" role="tabpanel">
              <div className={`vs-video-frame${isVideoPlaying ? " is-playing" : ""}`}>
                <img
                  className="vs-video-poster"
                  src={videoTab?.posterUrl || "/landing/polaroid-3.webp"}
                  alt="Pratinjau video memoir"
                  loading="lazy"
                />
                <div className="vs-video-warm-overlay" aria-hidden="true" />
                <span className="vs-video-badge">MEMOIR · 00:18</span>

                <button
                  type="button"
                  className="vs-video-play"
                  onClick={() => setIsVideoPlaying((p) => !p)}
                  aria-label={isVideoPlaying ? "Jeda pratinjau video" : "Putar pratinjau video"}
                >
                  {isVideoPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>

                <button
                  type="button"
                  className="vs-video-mute"
                  onClick={() => setIsVideoMuted((m) => !m)}
                  aria-label={isVideoMuted ? "Nyalakan suara" : "Bisukan suara"}
                >
                  {isVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                <div className="vs-video-progress" aria-hidden="true">
                  <span className="vs-video-progress-fill" />
                </div>
              </div>

              <div>
                <span className="vs-panel-kicker">VIDEO MEMOIR</span>
                <h3 className="vs-panel-heading">Hidupkan Kembali Momen Berharga</h3>
                <p className="vs-panel-desc">
                  Sematkan video ucapan ulang tahun, lamaran, atau kilas balik perjalanan bersama. Format vertikal dirancang khusus agar pas di layar ponsel penerima.
                </p>
                <div className="vs-perks">
                  <div className="vs-perk-row">
                    <Film size={16} aria-hidden="true" />
                    <span>Mendukung video langsung maupun tautan YouTube / Drive</span>
                  </div>
                  <div className="vs-perk-row">
                    <Sparkles size={16} aria-hidden="true" />
                    <span>Tampilan potret penuh tanpa perlu memutar layar HP</span>
                  </div>
                  <div className="vs-perk-row">
                    <QrCode size={16} aria-hidden="true" />
                    <span>Dilindungi PIN rahasia 6 digit sebelum dibuka</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="vs-panel-cta">
            <p className="vs-panel-cta-note">
              Semua fitur di atas sudah termasuk di setiap karya A Chapter tanpa biaya langganan.
            </p>
            <div className="vs-panel-cta-btns">
              <Link className="lp-btn lp-btn--wine" href="/pre-order">
                Pesan Memory Vault Ini →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
