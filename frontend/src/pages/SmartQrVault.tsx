import { useState, useEffect } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import VaultShowcase from "@/components/VaultShowcase";
import { homeContent } from "@/content/homeContent";
import { applyPageMeta } from "@/lib/seo";

const VAULT_FAQS = [
  {
    q: "Apakah penerima kado harus mengunduh aplikasi tertentu untuk membuka Memory Vault?",
    a: "Sama sekali tidak. Kode Smart-QR A Chapter dirancang untuk langsung dipindai menggunakan aplikasi kamera bawaan di iPhone maupun Android. Tautan akan otomatis terbuka di browser ponsel dengan alur cerita interaktif."
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
    a: "Setelah Anda melakukan pre-order dan konfirmasi pembayaran DP 50% manual melalui WhatsApp, Concierge A Chapter akan mengirimkan tautan privat 'Vault Setup' melalui WhatsApp. Anda dapat langsung mengunggah foto, merekam suara, menambahkan video memoir, dan mengetik surat dari ponsel Anda dengan santai."
  }
];

export default function SmartQrVault() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    applyPageMeta({
      title: "Smart QR Memory Vault — A Chapter",
      description:
        "Satu karya botani abadi, satu Smart-QR rahasia. Pindai dengan kamera ponsel untuk membuka kaset musik, surat amplop, photobooth 4-cut, dan video memoir.",
      path: window.location.pathname.startsWith("/vault") ? "/vault" : "/smart-qr-vault",
    });
  }, []);

  return (
    <div className="subpage-wrapper smart-vault-page public-v2">
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
                Satu karya botani abadi, satu Smart-QR rahasia. Pilih momen perayaannya
                — ulang tahun, anniversary, wisuda, atau momen milikmu — lalu pindai dengan
                kamera ponsel untuk membuka kaset musik berputar, amplop surat, photobooth 4-cut, dan video.
              </p>
              <ul className="smart-vault-hero-points">
                <li><span>01</span> Tanpa aplikasi tambahan</li>
                <li><span>02</span> PIN 6 digit wajib</li>
                <li><span>03</span> Tersimpan permanen</li>
              </ul>
              <div className="smart-vault-hero-actions">
                <a href="#vault" className="hero-cta-primary">
                  Lihat Simulasi Vault ↓
                </a>
                <Link href="/pre-order" className="smart-vault-hero-secondary">
                  Pre-Order Karya →
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
                    <span className="hero-vault-seal">
                      <img src="/a-chapter-logo-light.png" alt="" className="vault-seal-logo-img" />
                    </span>
                    <span className="hero-vault-kicker">MEMORY VAULT</span>
                    <p className="hero-vault-dedication">
                      Untuk seseorang yang paling berarti
                    </p>
                    <div className="hero-vault-wave">
                      {[38, 62, 44, 82, 56, 92, 48, 70, 36, 78, 52, 88, 42, 66].map((height, index) => (
                        <span key={index} style={{ height: `${height}%`, animationDelay: `${index * -120}ms` }} />
                      ))}
                    </div>
                    <span className="hero-vault-caption">Kaset memoir · 02:11</span>
                  </div>
                </div>
              </div>
              <span className="hero-visual-tag tag-one">SCAN · TAP · RELIVE</span>
              <span className="hero-visual-tag tag-two">CASSETTE · LETTER · PHOTO</span>
            </div>
          </div>
        </section>

        {/* 1. Interactive Concept B Simulation (Shared with Landing Page) */}
        <VaultShowcase />

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
        <section className="vault-closing-cta" style={{
          padding: "5rem 1.5rem",
          background: "linear-gradient(180deg, #f7f3ea 0%, #ece5d8 100%)",
          borderTop: "1px solid #e3dccf",
          textAlign: "center"
        }}>
          <div style={{ maxWidth: "38rem", margin: "0 auto" }}>
            <span className="section-eyebrow">START YOUR ARCHIVE</span>
            <h2 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "2.4rem", margin: "0.75rem 0 1rem", color: "#1a1a1a" }}>
              Abadikan Babak <em>Cerita Anda</em> Bersama Kami
            </h2>
            <p style={{ color: "#666", lineHeight: 1.7, fontSize: "1rem", marginBottom: "2rem" }}>
              Konsultasikan bunga spesial Anda, foto polaroid kenangan, dan rekaman suara untuk diramu oleh artisan laboratorium A Chapter di Surabaya.
            </p>
            <Link href="/pre-order" className="hero-cta-primary" style={{ padding: "1rem 2.5rem", fontSize: "1rem" }}>
              Buka Halaman Pre-Order →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
