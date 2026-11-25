import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  Camera,
  Check,
  Disc3,
  Film,
  Mail,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import VaultStoryExperience, {
  type VaultStoryHandle,
  type VaultStorySectionId,
  type VaultStorySkin,
} from "@/components/VaultStoryExperience";
import { homeContent } from "@/content/homeContent";
import {
  DEFAULT_LETTER_STYLE,
  PHOTOBOOTH_THEMES,
  type PhotoboothThemeId,
} from "@/lib/vaultDesign";

const DEMO_PHOTOS = [
  "/landing/polaroid-1.webp",
  "/landing/polaroid-2.webp",
  "/landing/polaroid-3.webp",
  "/landing/polaroid-4.webp",
];

const DEMO_LETTER_TEXT =
  "Waktu mungkin terus berjalan, namun kenangan yang kita ukir bersama takkan pernah layu.\n\nSeperti kelopak bunga yang diawetkan abadi di studio A Chapter, doa dan rasa terima kasihku akan selalu menyertai setiap langkahmu.\n\nSimpanlah pesan ini baik-baik—momen kita akan selalu mekar di sini.";

const DEMO_SKINS: ReadonlyArray<{
  id: VaultStorySkin;
  label: string;
  dot: string;
}> = [
  { id: "atelier", label: "Klasik Ivory", dot: "#F5EDE1" },
  { id: "romance", label: "Romance Blush", dot: "#F6DDE1" },
  { id: "crayon", label: "Crayon Party", dot: "#FFC670" },
  { id: "noir", label: "Noir Atelier", dot: "#1E1514" },
];

const JUMP_ITEMS: ReadonlyArray<{
  id: "opening" | VaultStorySectionId;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "opening", label: "Pembuka", icon: RotateCcw },
  { id: "letter", label: "Surat", icon: Mail },
  { id: "photos", label: "Foto", icon: Camera },
  { id: "video", label: "Video", icon: Film },
];

const THEME_OVERRIDES: Partial<Record<PhotoboothThemeId, { bg: string; border: string }>> = {
  crimson: { bg: "#9E1B32", border: "#B82942" },
};

export default function VaultShowcase() {
  const [selectedThemeId, setSelectedThemeId] = useState<PhotoboothThemeId>("periwinkle");
  const [selectedSkin, setSelectedSkin] = useState<VaultStorySkin>("atelier");
  const [demoStage, setDemoStage] = useState<"opening" | "story">("opening");
  const [activeJump, setActiveJump] = useState<"opening" | VaultStorySectionId>("opening");

  const phoneScrollRef = useRef<HTMLDivElement | null>(null);
  const storyRef = useRef<VaultStoryHandle | null>(null);

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

  const handleJump = (target: "opening" | VaultStorySectionId) => {
    setActiveJump(target);
    storyRef.current?.jumpTo(target);
  };

  return (
    <section className="vs-section" id="vault" aria-label="Pratinjau Interaktif Smart QR Memory Vault">
      <div className="vs-container">
        <header className="vs-header">
          <span className="vs-eyebrow">SMART QR MEMORY VAULT</span>
          <h2 className="vs-title">Kenangan, Siap Dibuka Kembali</h2>
          <p className="vs-subtitle">
            Coba langsung momen penerima saat memindai kode QR: ketuk pembuka untuk memutar suara latar,
            lihat amplop surat terbuka dengan tulisan bergerak, lalu saksikan foto kenangan hadir otomatis.
          </p>
        </header>

        <div className="vs-stage vs-concept-stage">
          <div className="vs-concept-grid">
            {/* ── KIRI: KONTROL TEMA & PENJELASAN ALUR ── */}
            <div className="vs-concept-info">
              <span className="vs-panel-kicker">SIMULASI INTERAKTIF · ALUR ROMANTIS</span>
              <h3 className="vs-panel-heading">Surat Terbuka, Foto Menyusul</h3>
              <p className="vs-panel-desc">
                Saat tombol pembuka diketuk, musik mengalun pelan di latar belakang dan amplop langsung terbuka
                dengan ketikan surat bergerak. Begitu tulisan selesai, photobooth strip 4-cut otomatis hadir di layar,
                diikuti video memoir yang diputar manual saat diklik.
              </p>

              {/* Pilihan Suasana Tema */}
              <div className="vs-control-block">
                <span className="vs-control-label">Suasana Tampilan Vault</span>
                <div className="vs-skin-pills" role="radiogroup" aria-label="Suasana tampilan vault">
                  {DEMO_SKINS.map((skin) => {
                    const active = selectedSkin === skin.id;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`vs-skin-pill${active ? " is-active" : ""}`}
                        onClick={() => setSelectedSkin(skin.id)}
                      >
                        <span
                          className="vs-skin-pill-dot"
                          style={{ backgroundColor: skin.dot }}
                          aria-hidden="true"
                        />
                        <span>{skin.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pilihan 7 Warna Bingkai Photobooth */}
              <div className="vs-control-block">
                <span className="vs-control-label">
                  Warna Bingkai Photobooth: <strong>{activeTheme.name}</strong>
                </span>
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
                        style={{
                          backgroundColor: swatchBg,
                          borderColor: theme.border,
                          color: theme.text,
                        }}
                        onClick={() => {
                          setSelectedThemeId(theme.id);
                          if (demoStage === "opening") {
                            handleJump("photos");
                          }
                        }}
                      >
                        {isSelected && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pintas Cepat Layar Ponsel */}
              <div className="vs-control-block">
                <span className="vs-control-label">Lompat Langsung ke Bagian Demo</span>
                <div className="vs-jump-row">
                  {JUMP_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeJump === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`vs-jump-btn${isActive ? " is-active" : ""}`}
                        onClick={() => handleJump(item.id)}
                      >
                        <Icon size={14} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="vs-perks">
                <div className="vs-perk-row">
                  <Disc3 size={16} aria-hidden="true" />
                  <span>Musik hanya berupa suara latar dengan kapsul kaset mini di sudut atas</span>
                </div>
                <div className="vs-perk-row">
                  <Mail size={16} aria-hidden="true" />
                  <span>Amplop terbuka, surat mengetik, lalu foto otomatis muncul &amp; bergulir lembut</span>
                </div>
                <div className="vs-perk-row">
                  <Film size={16} aria-hidden="true" />
                  <span>Video kenangan tidak auto-play, diputar manual saat diklik</span>
                </div>
              </div>
            </div>

            {/* ── KANAN: MOCKUP LAYAR PONSEL INTERAKTIF KONSEP B ── */}
            <div className="vs-phone-stage">
              <div className="vs-phone-frame" aria-label="Simulasi layar ponsel penerima QR Vault">
                <div className="vs-phone-top-bezel">
                  <span className="vs-phone-notch" aria-hidden="true" />
                </div>
                <div ref={phoneScrollRef} className="vs-phone-screen">
                  <VaultStoryExperience
                    ref={storyRef}
                    mode="demo"
                    recipient="Nadia"
                    sender="Raka"
                    eyebrow="SEBUAH HARI ISTIMEWA"
                    title="Selamat ulang tahun, Nadia"
                    subtitle="Disiapkan khusus bersama karya botani A Chapter."
                    skin={selectedSkin}
                    hookId={selectedSkin === "atelier" ? null : "cake"}
                    audioMedia={{
                      type: "direct_audio",
                      embedUrl: null,
                      isAudio: true,
                      isVideo: false,
                      url: audioTab?.audioSrc || "/see-you-again.mp3",
                    }}
                    audioSrcResolved={audioTab?.audioSrc || "/see-you-again.mp3"}
                    audioDuration={131}
                    audioQuote="Suara yang terekam hari ini akan menjadi pelukan hangat di tahun-tahun mendatang."
                    letterBody={DEMO_LETTER_TEXT}
                    letterStyle={{
                      ...DEFAULT_LETTER_STYLE,
                      font: "cormorant",
                      size: "sm",
                      align: "center",
                    }}
                    hasCustomLetter={false}
                    photos={DEMO_PHOTOS}
                    photoboothTheme={activeTheme}
                    videoMedia={{
                      type: "direct_video",
                      embedUrl: null,
                      isAudio: false,
                      isVideo: true,
                      url: "demo",
                    }}
                    demoVideoPoster={videoTab?.posterUrl || "/landing/polaroid-3.webp"}
                    initialStage="opening"
                    scrollContainerRef={phoneScrollRef}
                    onStageChange={(next) => {
                      setDemoStage(next);
                      setActiveJump(next === "opening" ? "opening" : "letter");
                    }}
                  />
                </div>
              </div>
              <p className="vs-phone-caption">
                Ketuk &ldquo;Buka Surat Kenangan&rdquo; lalu biarkan tulisan selesai untuk melihat foto muncul otomatis
              </p>
            </div>
          </div>

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
