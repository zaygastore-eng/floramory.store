import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/ProductImage";
import { homeContent } from "@/content/homeContent";
import { applyPageMeta } from "@/lib/seo";

const VAULT_FAQS = [
  {
    q: "Apakah penerima kado harus mengunduh aplikasi tertentu untuk membuka Memory Vault?",
    a: "Sama sekali tidak. Micro-chip dan kode QR A Chapter dirancang untuk langsung dipindai menggunakan aplikasi kamera bawaan di iPhone maupun Android. Tautan akan otomatis terbuka di browser ponsel dengan tampilan interaktif yang elegan."
  },
  {
    q: "Bagaimana jika kado berisi foto atau pesan rahasia yang sangat intim?",
    a: "Setiap karya A Chapter dilengkapi dengan sistem PIN Gosok Rahasia (Scratch-Off Physical PIN) pada kartu sertifikat. Penerima harus menggosok stiker perak fisik dan memasukkan 6-digit PIN untuk membuka konten pribadi seperti surat dan rekaman suara."
  },
  {
    q: "Berapa lama memori digital (foto & audio) akan tersimpan?",
    a: "Tersimpan permanen seumur hidup tanpa biaya langganan bulanan. Kami menggunakan infrastruktur cloud enterprise dengan redundansi data tinggi untuk memastikan arsip digital Anda tetap utuh bertahun-tahun kemudian."
  },
  {
    q: "Kapan dan bagaimana saya mengirimkan foto, rekaman suara, dan surat?",
    a: "Setelah Anda melakukan reservasi dan konfirmasi DP 50%, Concierge A Chapter akan mengirimkan tautan privat 'Vault Setup' melalui WhatsApp. Anda dapat langsung mengunggah foto, merekam suara, menambahkan video memoir, dan mengetik surat dari ponsel Anda dengan santai."
  }
];

export default function SmartQrVault() {
  const [vaultSimTab, setVaultSimTab] = useState<
    "photograph" | "voice-record" | "letter" | "video"
  >("photograph");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(131);
  const vaultAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    applyPageMeta({
      title: "Smart QR Memory Vault — A Chapter",
      description:
        "Satu karya botani abadi, satu micro-chip rahasia. Pindai dengan kamera ponsel untuk membuka foto, rekaman suara, video memoir, dan surat personal.",
      path: window.location.pathname.startsWith("/vault") ? "/vault" : "/smart-qr-vault",
    });
  }, []);

  const toggleAudio = (src?: string) => {
    if (!vaultAudioRef.current && src) {
      const audio = new Audio(src);
      vaultAudioRef.current = audio;

      audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setAudioDuration(audio.duration);
        }
      });
      audio.addEventListener("timeupdate", () => {
        setAudioCurrentTime(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        setIsAudioPlaying(false);
        setAudioCurrentTime(0);
      });
    }

    const audio = vaultAudioRef.current;
    if (!audio) return;

    if (isAudioPlaying) {
      audio.pause();
      setIsAudioPlaying(false);
    } else {
      audio.play().then(() => {
        setIsAudioPlaying(true);
      }).catch((err) => {
        console.warn("Audio playback error:", err);
      });
    }
  };

  const handleVaultTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = ["photograph", "voice-record", "letter", "video"] as const;
    const currentIndex = tabs.indexOf(vaultSimTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      setVaultSimTab(tabs[nextIndex]);
      if (vaultAudioRef.current && tabs[nextIndex] !== "voice-record") {
        vaultAudioRef.current.pause();
        setIsAudioPlaying(false);
      }
      if (tabs[nextIndex] !== "video") setIsVideoPlaying(false);
    }
  };

  return (
    <div className="subpage-wrapper smart-vault-page">
      <SiteHeader />

      <main className="subpage-main">
        {/* Curatorial Hero Banner */}
        <section className="smart-vault-hero" aria-label="Smart QR Vault Hero">
          <div className="smart-vault-hero-inner">
            <div className="smart-vault-hero-copy">
              <span className="section-eyebrow">THE LIVING ARCHIVAL VAULT</span>
              <h1 className="smart-vault-hero-title">
                Bunga yang menyimpan <em>suara dan cerita</em> Anda.
              </h1>
              <p className="smart-vault-hero-lead">
                Satu karya botani abadi, satu micro-chip rahasia. Cukup pindai dengan kamera
                ponsel — foto, rekaman suara, video, dan surat personal terbuka selamanya.
              </p>
              <ul className="smart-vault-hero-points">
                <li><span>01</span> Tanpa aplikasi tambahan</li>
                <li><span>02</span> PIN rahasia opsional</li>
                <li><span>03</span> Tersimpan permanen</li>
              </ul>
              <div className="smart-vault-hero-actions">
                <a href="#simulator" className="hero-cta-primary">
                  Lihat Simulasi Vault ↓
                </a>
                <Link href="/#pesan" className="smart-vault-hero-secondary">
                  Commission Your Keepsake →
                </Link>
              </div>
            </div>

            <div className="smart-vault-hero-visual" aria-hidden="true">
              <span className="hero-visual-glow" />
              <div className="hero-phone-mock">
                <span className="hero-phone-notch" />
                <div className="hero-phone-screen">
                  <span className="hero-phone-scan" />
                  <div className="hero-vault-card">
                    <span className="hero-vault-seal">A · C</span>
                    <span className="hero-vault-kicker">MEMORY VAULT</span>
                    <p className="hero-vault-dedication">
                      Untuk seseorang yang paling berarti
                    </p>
                    <div className="hero-vault-wave">
                      {[38, 62, 44, 82, 56, 92, 48, 70, 36, 78, 52, 88, 42, 66].map((height, index) => (
                        <span key={index} style={{ height: `${height}%`, animationDelay: `${index * -120}ms` }} />
                      ))}
                    </div>
                    <span className="hero-vault-caption">Audio memoir · 02:11</span>
                  </div>
                </div>
              </div>
              <span className="hero-visual-tag tag-one">SCAN · TAP · RELIVE</span>
              <span className="hero-visual-tag tag-two">PHOTO · VOICE · VIDEO</span>
            </div>
          </div>
        </section>

        {/* 1. Interactive Folio Simulation */}
        <section className="fm-section vault-section" id="simulator" style={{ paddingTop: "2rem" }}>
          <div className="vault-inner">
            <header className="vault-section-header">
              <span className="vault-eyebrow">DIGITAL MEMOIR SIMULATOR</span>
              <h2 className="vault-title">A Glimpse Inside Your Secret Vault</h2>
              <p className="vault-desc">
                Coba pengalaman membuka brankas rahasia berikut. Navigasikan 4 tab di bawah untuk melihat bagaimana foto,
                suara, surat cinta, dan video memoir disajikan secara elegan kepada penerima kado.
              </p>
            </header>

            <article className="vault-simulator-wrap" aria-label="Interactive memory vault preview">
              <div className="vault-simulator-header">
                <span className="folio-label-left">FOLIO ARCHIVE NO. 2026-A · SURABAYA ATELIER</span>
                <span className="folio-label-right">
                  PERMANENT CLOUD RECORD · SECURED
                  <span className="folio-status-dot" aria-hidden="true" />
                </span>
              </div>

              <div className="vault-sim-nav" role="tablist" aria-label="Memory Vault preview">
                {homeContent.smartVault.mediaTabs.map((tab, index) => {
                  const tabId = `vault-page-tab-${["foto", "audio", "surat", "video"][index]}`;
                  const isSelected = vaultSimTab === tab.kind;
                  return (
                    <button
                      key={tab.kind}
                      type="button"
                      role="tab"
                      id={tabId}
                      aria-controls="vault-page-panel"
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      className={`vault-sim-btn${isSelected ? " active" : ""}`}
                      onClick={() => {
                        setVaultSimTab(tab.kind);
                        if (vaultAudioRef.current && tab.kind !== "voice-record") {
                          vaultAudioRef.current.pause();
                          setIsAudioPlaying(false);
                        }
                        if (tab.kind !== "video") setIsVideoPlaying(false);
                      }}
                      onKeyDown={handleVaultTabKeyDown}
                    >
                      {["I.", "II.", "III.", "IV."][index]} {tab.title.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              <div className="vault-folio-body">
                <div
                  className="vault-sim-body"
                  id="vault-page-panel"
                  role="tabpanel"
                  aria-labelledby={`vault-page-tab-${{
                    photograph: "foto",
                    "voice-record": "audio",
                    letter: "surat",
                    video: "video",
                  }[vaultSimTab]}`}
                  tabIndex={0}
                >
                  {homeContent.smartVault.mediaTabs.map((tab) => {
                    if (tab.kind !== vaultSimTab) return null;

                    if (tab.kind === "photograph") {
                      return (
                        <div className="sim-panel" key={tab.kind}>
                          <div className="folio-polaroid">
                            <div className="folio-polaroid-frame">
                              <ProductImage
                                className="folio-polaroid-img"
                                src={tab.imageUrl}
                                size="large"
                                alt={tab.excerpt}
                                width={900}
                                height={675}
                                fallback={<div className="folio-polaroid-placeholder">A · C</div>}
                              />
                            </div>
                            <p className="folio-polaroid-script">{tab.handwrittenCaption}</p>
                            <span className="folio-polaroid-stamp">{tab.archivalStamp}</span>
                          </div>
                        </div>
                      );
                    }

                    if (tab.kind === "voice-record") {
                      const formatTime = (sec: number) => {
                        if (!Number.isFinite(sec) || sec < 0) return "00:00";
                        const m = Math.floor(sec / 60);
                        const s = Math.floor(sec % 60);
                        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
                      };
                      const curTimeStr = formatTime(audioCurrentTime);
                      const totalTimeStr = formatTime(audioDuration);

                      return (
                        <div className="sim-panel" key={tab.kind}>
                          <div className="folio-audio-card">
                            <div className="folio-audio-meta">
                              <span className="folio-audio-tag">SEE YOU AGAIN · ACOUSTIC KEEPSAKE</span>
                              <span className="folio-audio-dur">{totalTimeStr}</span>
                            </div>
                            <blockquote className="folio-audio-quote">
                              {tab.quoteExcerpt}
                            </blockquote>
                            <p className="folio-audio-cite">— {tab.quoteAttribution}</p>
                            <div className="folio-audio-player">
                              <button
                                type="button"
                                className="folio-play-btn"
                                aria-label={isAudioPlaying ? "Jeda lagu See You Again" : "Putar lagu See You Again"}
                                onClick={() => toggleAudio(tab.audioSrc || "/see-you-again.mp3")}
                              >
                                {isAudioPlaying ? "❚❚" : "▶"}
                              </button>
                              <div
                                className="folio-waveform"
                                aria-hidden="true"
                                onClick={() => toggleAudio(tab.audioSrc || "/see-you-again.mp3")}
                                style={{ cursor: "pointer" }}
                                title="Klik untuk memutar lagu"
                              >
                                {[40, 75, 25, 90, 60, 45, 80, 55, 30, 95, 70, 50, 85, 40, 65, 30, 80, 45].map((h, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      height: `${h}%`,
                                      opacity: isAudioPlaying && i < 12 ? 1 : 0.45,
                                    }}
                                  />
                                ))}
                              </div>
                              <span className="folio-play-time">
                                {isAudioPlaying || audioCurrentTime > 0 ? curTimeStr : "00:00"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (tab.kind === "letter") {
                      return (
                        <div className="sim-panel" key={tab.kind}>
                          <div className="folio-letter">
                            <div className="folio-letter-seal" aria-hidden="true">A · C</div>
                            <p className="folio-letter-greeting">{tab.greeting}</p>
                            <p className="folio-letter-body">{tab.letterText}</p>
                            <div className="folio-letter-signoff">
                              <span>{tab.signoff}</span>
                              <span className="folio-letter-signature">{tab.signature}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="sim-panel" key={tab.kind}>
                        <div className={`folio-video-card${isVideoPlaying ? " is-playing" : ""}`}>
                          <button
                            type="button"
                            className="folio-video-frame"
                            onClick={() => setIsVideoPlaying(playing => !playing)}
                            aria-label={isVideoPlaying ? "Jeda simulasi video memoir" : "Putar simulasi video memoir"}
                          >
                            <img
                              className="folio-video-poster"
                              src={tab.posterUrl}
                              alt={tab.caption}
                              loading="lazy"
                            />
                            <span className="folio-video-vignette" aria-hidden="true" />
                            {!isVideoPlaying && (
                              <span className="folio-video-play" aria-hidden="true">▶</span>
                            )}
                            <span className="folio-video-badge">SIMULASI VIDEO MEMOIR · {tab.durationLabel}</span>
                            <span className="folio-video-progress" aria-hidden="true">
                              <span className="folio-video-progress-fill" />
                            </span>
                          </button>
                          <p className="folio-video-caption">{tab.caption}</p>
                          <span className="folio-video-stamp">{tab.archivalStamp}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="vault-copy">
                  <span className="vault-copy-eyebrow">TAP &amp; RELIVE</span>
                  <h3 className="vault-copy-title">Keajaiban di Dasar Bingkai Kristal</h3>
                  <p className="vault-copy-description">
                    Ketika penerima memindai micro-chip di dasar bingkai kristal ini, layar gawai
                    mereka langsung membuka lembar arsip eksklusif berisi foto beresolusi tinggi,
                    rekaman suara asli, dan surat cinta personal tanpa perlu menginstal aplikasi apapun.
                  </p>
                  <Link className="hero-cta-primary vault-commission-cta" href="/#pesan">
                    COMMISSION YOUR VAULT →
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* 2. The Archival Privacy */}
        <section className="vault-privacy" id="privasi" style={{ padding: "5rem 1.5rem" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
            <div className="vault-block-heading" style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="vault-eyebrow">THE ARCHIVAL PRIVACY</span>
              <h3 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "2.2rem", color: "#1a1a1a", marginTop: "0.5rem" }}>
                Kenangan Personal Anda Aman &amp; Terlindungi
              </h3>
              <p style={{ maxWidth: "36rem", margin: "0.5rem auto 0", color: "#666", fontSize: "0.95rem" }}>
                Privasi adalah prioritas tertinggi kami. Setiap kenangan disimpan dengan protokol keamanan berlapis.
              </p>
            </div>
            <div className="vault-privacy-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
              {homeContent.smartVault.privacyPillars.map((pillar, index) => (
                <article key={pillar.id} style={{
                  background: "#ffffff",
                  border: "1px solid #e9e5d9",
                  borderRadius: "14px",
                  padding: "1.75rem 1.5rem",
                  boxShadow: "0 4px 16px rgba(47, 51, 79, 0.03)",
                }}>
                  <span style={{ display: "block", fontSize: "1.1rem", fontFamily: "var(--font-heading, Georgia, serif)", color: "var(--wine, #8B3A4A)", fontStyle: "italic", marginBottom: "0.75rem" }}>0{index + 1}</span>
                  <h4 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "1.2rem", color: "#1a1a1a", margin: "0 0 0.5rem" }}>{pillar.title}</h4>
                  <p style={{ color: "#555", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>{pillar.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Atelier to Recipient Workflow */}
        <section className="vault-workflow" id="cara-kerja" style={{ padding: "5rem 1.5rem", background: "rgba(246, 243, 237, 0.5)", borderTop: "1px solid #e9e5d9" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
            <div className="vault-block-heading" style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="vault-eyebrow">ATELIER TO RECIPIENT WORKFLOW</span>
              <h3 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "2.2rem", color: "#1a1a1a", marginTop: "0.5rem" }}>
                Alur dari Kisah Personal Menjadi Arsip Abadi
              </h3>
              <p style={{ maxWidth: "36rem", margin: "0.5rem auto 0", color: "#666", fontSize: "0.95rem" }}>
                Proses mudah dan nyaman dari ponsel Anda hingga kado diterima dengan penuh kehangatan.
              </p>
            </div>
            <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem", listStyle: "none", padding: 0, margin: 0 }}>
              {homeContent.smartVault.workflowSteps.map((step) => (
                <li key={step.step} style={{
                  background: "#ffffff",
                  border: "1px solid #e9e5d9",
                  borderRadius: "14px",
                  padding: "2rem 1.75rem",
                  boxShadow: "0 4px 16px rgba(47, 51, 79, 0.03)",
                  position: "relative"
                }}>
                  <span style={{ display: "inline-block", fontSize: "1.35rem", fontFamily: "var(--font-heading, Georgia, serif)", color: "var(--wine, #8B3A4A)", fontWeight: 600, marginBottom: "0.75rem" }}>
                    {String(step.step).padStart(2, "0")}.
                  </span>
                  <h4 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "1.25rem", color: "#1a1a1a", margin: "0 0 0.6rem" }}>{step.title}</h4>
                  <p style={{ color: "#555", fontSize: "0.92rem", lineHeight: 1.65, margin: 0 }}>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. FAQs */}
        <section className="about-faq-section" style={{ padding: "5rem 1.5rem" }}>
          <div className="about-faq-container" style={{ maxWidth: "48rem", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="section-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
              <h2 className="cluster-title" style={{ marginTop: "0.5rem" }}>
                Pertanyaan Seputar Smart QR Memory Vault
              </h2>
            </div>
            <div className="about-faq-accordion">
              {VAULT_FAQS.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div key={index} className={`faq-item${isOpen ? " is-open" : ""}`} style={{
                    background: "#ffffff",
                    border: "1px solid #e9e5d9",
                    borderRadius: "12px",
                    marginBottom: "1rem",
                    overflow: "hidden"
                  }}>
                    <button
                      type="button"
                      className="faq-question-btn"
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      style={{
                        width: "100%",
                        padding: "1.25rem 1.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "var(--font-heading, Georgia, serif)",
                        fontSize: "1.15rem",
                        color: "#1a1a1a",
                      }}
                    >
                      <span>{faq.q}</span>
                      <span style={{ fontSize: "1.25rem", transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s ease" }}>+</span>
                    </button>
                    {isOpen && (
                      <div className="faq-answer-body" style={{ padding: "0 1.5rem 1.5rem", color: "#555", lineHeight: 1.7, fontSize: "0.95rem" }}>
                        <p style={{ margin: 0 }}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6. Bottom Call to Action */}
        <section style={{
          padding: "5rem 1.5rem",
          background: "linear-gradient(180deg, #f7f3ea 0%, #ece5d8 100%)",
          borderTop: "1px solid #e3dccf",
          textAlign: "center"
        }}>
          <div style={{ maxWidth: "38rem", margin: "0 auto" }}>
            <span className="section-eyebrow">START YOUR ARCHIVE</span>
            <h2 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "2.4rem", margin: "0.75rem 0 1rem", color: "#1a1a1a" }}>
              Abadikan Babak Cerita Anda Bersama Kami
            </h2>
            <p style={{ color: "#666", lineHeight: 1.7, fontSize: "1rem", marginBottom: "2rem" }}>
              Konsultasikan bunga spesial Anda, foto polaroid kenangan, dan rekaman suara untuk diramu oleh artisan laboratorium A Chapter di Surabaya.
            </p>
            <Link href="/#pesan" className="hero-cta-primary" style={{ padding: "1rem 2.5rem", fontSize: "1rem" }}>
              Buka Lembar Pre-Order / Reservasi →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
