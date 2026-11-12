import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { applyPageMeta } from "@/lib/seo";

const ABOUT_FAQS = [
  {
    q: "Mengapa memilih bunga yang diawetkan dibanding bunga segar?",
    a: "Bunga segar layu dan dibuang dalam 3–5 hari, menyisakan air vas berbau dan sampah organik. Karya A Chapter mempertahankan warna dan bentuk alami selama bertahun-tahun, menjadi simbol kenangan abadi yang bernilai seni tinggi."
  },
  {
    q: "Bagaimana sains preservasi cryo-dehidrasi menjaga warna alami bunga?",
    a: "Alih-alih dikeringkan di udara panas yang menyebabkan kelopak menciut dan kusam, kami menempatkan bunga dalam ruang dehidrasi terkontrol dengan media kristal silica bertingkat. Proses ini mengekstraksi kelembapan selular secara perlahan tanpa merusak pigmen antosianin alami bunga."
  },
  {
    q: "Apakah resin kristal A Chapter akan menguning seiring waktu?",
    a: "Tidak. Kami secara eksklusif menggunakan formulasi bio-epoxy berstandar optik museum yang diperkaya dengan filter UV inhibitor tingkat lanjut. Formula ini teruji tahan terhadap paparan suhu dan kelembapan tropis Indonesia tanpa menguning atau retak mikro."
  },
  {
    q: "Apakah saya bisa memesan karya dengan bunga dari momen berharga saya sendiri?",
    a: "Tentu. Layanan Bespoke Commission kami menerima pengiriman buket pernikahan, bunga wisuda, atau kuntum memorial pribadi untuk dikeringkan di laboratorium kami dan dituang ke dalam karya resin abadi bersama brankas kenangan digital."
  }
];

export default function AboutUs() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    applyPageMeta({
      title: "The Atelier Story — A Chapter",
      description:
        "Dilahirkan di Surabaya, A Chapter menggabungkan seni lukis botani abad ke-17 dengan sains preservasi modern untuk mengabadikan babak terindah hidup manusia.",
      path: "/about",
    });
  }, []);

  return (
    <div className="subpage-wrapper public-v2">
      <SiteHeader />

      <main className="subpage-main">
        {/* Curatorial Hero Banner */}
        <section className="about-hero-section" aria-label="Atelier Philosophy Header">
          <div className="about-hero-inner">
            <span className="section-eyebrow">THE ARCHIVAL BOTANICAL ATELIER</span>
            <h1 className="about-hero-title">
              Suspending Nature’s Apex in <em>Eternal Silence</em>
            </h1>
            <p className="about-hero-lead">
              Dilahirkan di Surabaya, Jawa Timur — A Chapter menggabungkan seni lukis botani abad ke-17 dengan sains laboratorium modern untuk mengabadikan babak terindah dalam hidup manusia.
            </p>
          </div>
        </section>

        {/* 1. Curatorial Philosophy */}
        <section className="about-philosophy-section" id="filosofi" aria-label="Filosofi Kuratorial">
          <div className="about-philosophy-container">
            <div className="philosophy-grid">
              <div className="philosophy-copy">
                <span className="section-eyebrow">OUR CURATORIAL INSPIRATION</span>
                <h2 className="section-title">
                  The Rachel Ruysch <em>Tradition</em>
                </h2>
                <p className="philosophy-text">
                  Pada abad ke-17 di Belanda, pelukis perempuan legendaris Rachel Ruysch mendedikasikan hidupnya untuk melukis kuntum bunga langka dengan detail sains botani yang tak tertandingi. Setiap karyanya merupakan upaya manusia melawan kefanaan — menghentikan waktu sebelum kelopak berguguran.
                </p>
                <p className="philosophy-text">
                  A Chapter melanjutkan warisan tersebut dalam media fisik kontemporer. Kami menyelamatkan bunga surplus dari floris lokal, memilih setiap kuntum pada puncak mekarnya, dan mengubah kerapuhan alam menjadi karya seni abadi.
                </p>
                <div className="philosophy-quote">
                  <blockquote>
                    “Every flower holds a moment. Every life deserves an eternal chapter.”
                  </blockquote>
                  <cite>— Curatorial Manifesto, Surabaya Atelier</cite>
                </div>
              </div>

              <div className="philosophy-visual">
                <div className="philosophy-visual-card">
                  <div className="philosophy-visual-box">
                    <span className="philosophy-herbarium-seal">A · C</span>
                    <div className="philosophy-art-frame">
                      <span className="art-frame-text">ARCHIVAL BOTANICAL SPECIMEN · 2026</span>
                    </div>
                  </div>
                  <p className="philosophy-caption">
                    Spesimen botani dirangkai dengan tangan satu per satu di studio Surabaya oleh kurator bunga berpengalaman.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Laboratory Science & Cryo-Dehydration */}
        <section className="about-science-section" id="sains-preservasi" aria-label="Sains Preservasi Laboratorium">
          <div className="about-science-container">
            <div className="about-science-header">
              <span className="section-eyebrow">PRECISION BOTANICAL ENGINEERING</span>
              <h2 className="section-title">
                The Science of <em>Immortality</em>
              </h2>
              <p className="section-desc">
                Tiga pilar teknologi laboratorium yang menjamin karya kami bertahan puluhan tahun di iklim tropis.
              </p>
            </div>

            <div className="science-cards-grid">
              <div className="science-card">
                <span className="science-num">01</span>
                <h3 className="science-title">Lab Cryo-Silica Dehydration</h3>
                <p className="science-desc">
                  Setiap tangkai bunga diekstraksi kelembapannya dalam inkubator silica gel berstandar farmasi selama 3–5 hari hingga kadar air mencapai &lt; 0.02%. Metode ini mencegah oksidasi pigmen warna tanpa zat pewarna kimia berbahaya.
                </p>
              </div>

              <div className="science-card">
                <span className="science-num">02</span>
                <h3 className="science-title">Optical-Grade UV Shielding</h3>
                <p className="science-desc">
                  Kristal resin yang kami gunakan diformulasikan khusus dengan polimer bio-epoxy tingkat optik bebas gelembung (vacuum-degassed). Lapisan ini menghalau 99.4% radiasi ultraviolet yang biasanya memudarkan warna bunga.
                </p>
              </div>

              <div className="science-card">
                <span className="science-num">03</span>
                <h3 className="science-title">Micro-Vault Embedment</h3>
                <p className="science-desc">
                  Di dasar setiap blok resin, kurator menanamkan micro-chip permanen yang terhubung ke cloud server aman seumur hidup. Tanpa baterai, tahan air, dan dapat dipindai langsung oleh kamera smartphone apa pun.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Studio Documentation & Behind The Scenes */}
        <section className="about-studio-section" aria-label="Dokumentasi Studio Surabaya">
          <div className="about-studio-container">
            <div className="about-studio-header">
              <span className="section-eyebrow">HANDCRAFTED IN EAST JAVA</span>
              <h2 className="section-title">
                The Atelier <em>Chronicles</em>
              </h2>
              <p className="section-desc">
                Sebuah intipan ke dalam meja kerja kurator botani kami di Surabaya.
              </p>
            </div>

            <div className="studio-gallery-grid">
              <div className="studio-gallery-item">
                <div className="studio-img-box">
                  <span className="studio-step-tag">Phase I</span>
                  <p className="studio-step-label">Curating Surplus Flora</p>
                </div>
                <p className="studio-item-desc">
                  Penyortiran kelopak bunga surplus pilihan dari perkebunan dataran tinggi Jawa Timur.
                </p>
              </div>

              <div className="studio-gallery-item">
                <div className="studio-img-box">
                  <span className="studio-step-tag">Phase II</span>
                  <p className="studio-step-label">Petal Dehydration Chamber</p>
                </div>
                <p className="studio-item-desc">
                  Proses ekstraksi kelembapan di laboratorium tertutup untuk mengunci kesegaran warna.
                </p>
              </div>

              <div className="studio-gallery-item">
                <div className="studio-img-box">
                  <span className="studio-step-tag">Phase III</span>
                  <p className="studio-step-label">Precision Crystal Casting</p>
                </div>
                <p className="studio-item-desc">
                  Penuangan resin bening bertahap bebas gelembung bersama penanaman micro-chip fisik.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Atelier FAQ Accordion */}
        <section className="about-faq-section" id="faq" aria-label="FAQ Atelier">
          <div className="faq-inner">
            <div className="faq-header">
              <span className="section-eyebrow order-center">FREQUENTLY ASKED QUESTIONS</span>
              <h2 className="section-title order-center">
                Atelier <em>Inquiries &amp; Protocols</em>
              </h2>
            </div>

            <div className="faq-accordion" role="region" aria-label="About FAQ Accordion">
              {ABOUT_FAQS.map((item, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div className={`faq-item${isOpen ? " open" : ""}`} key={index}>
                    <button
                      type="button"
                      className="faq-question-btn"
                      aria-expanded={isOpen}
                      aria-controls={`about-faq-answer-${index}`}
                      id={`about-faq-btn-${index}`}
                      onClick={() => setActiveFaq(current => current === index ? null : index)}
                    >
                      <span className="faq-question-text">{item.q}</span>
                      <span className="faq-toggle-icon" aria-hidden="true">+</span>
                    </button>
                    <div
                      id={`about-faq-answer-${index}`}
                      role="region"
                      aria-labelledby={`about-faq-btn-${index}`}
                      className="faq-answer-panel"
                      style={{ maxHeight: isOpen ? "220px" : "0" }}
                    >
                      <p className="faq-answer-text">{item.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
