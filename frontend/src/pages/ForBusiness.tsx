import { useState, useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { fetchWhatsAppNumber } from "@/lib/api";
import { normalizeWhatsApp } from "@/lib/site";

export default function ForBusiness() {
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const [companyName, setCompanyName] = useState("");
  const [picName, setPicName] = useState("");
  const [picWhatsapp, setPicWhatsapp] = useState("");
  const [venueType, setVenueType] = useState("Hotel / Resort Luxury");
  const [roomCount, setRoomCount] = useState("1–3 Ruangan");

  useEffect(() => {
    fetchWhatsAppNumber().then(num => {
      setWhatsappNumber(normalizeWhatsApp(num) || "6285235242425");
    });
  }, []);

  const handleRequestQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const message = encodeURIComponent(
      `Halo A Chapter Corporate Concierge,\n\nSaya ingin berkonsultasi mengenai Business Floral Subscription:\n` +
      `• Perusahaan: ${companyName || "-"}\n` +
      `• PIC: ${picName || "-"}\n` +
      `• WhatsApp PIC: ${picWhatsapp || "-"}\n` +
      `• Tipe Properti: ${venueType}\n` +
      `• Jumlah Ruangan/Titik: ${roomCount}\n\nMohon info proposal kurasi dan penjadwalan sampel fisik.`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="subpage-wrapper">
      <SiteHeader />

      <main className="subpage-main">
        {/* Split Screen Hero */}
        <section className="b2b-hero-split" aria-label="Business Subscriptions Hero">
          <div className="b2b-hero-visual">
            <div className="b2b-visual-overlay">
              <span className="b2b-visual-caption">Suite Preserved Floral Installation · Luxury Hospitality Surabaya</span>
            </div>
          </div>

          <div className="b2b-hero-content">
            <span className="b2b-eyebrow">CORPORATE &amp; HOSPITALITY CURATION</span>
            <h1 className="b2b-title">Discover Our Business Subscriptions</h1>
            <p className="b2b-lead">
              Solusi penataan flora berstandar galeri seni untuk hotel, klinik premium, kantor eksekutif, dan restoran mewah tanpa repot mengganti air dan tanpa bunga layu.
            </p>

            <ul className="b2b-props-list">
              <li>
                <strong>Hemat 50%–75% Biaya Florist Bulanan:</strong> Tidak ada bunga mati terbuang setiap 3 hari; efisiensi operasional tanpa mengurangi prestige.
              </li>
              <li>
                <strong>Higienis, Bebas Alergen &amp; Air Busuk:</strong> Tanpa air vas berbau, tanpa bakteri atau serbuk sari yang memicu bersin tamu penting Anda.
              </li>
              <li>
                <strong>Rotasi Koleksi Terjadwal:</strong> Koleksi ditukar secara berkala (setiap 1, 2, atau 3 bulan) sehingga interior Anda selalu tampil segar dan eksklusif.
              </li>
            </ul>

            <a href="#quote" className="hero-cta hero-cta-primary b2b-cta-btn">
              Explore Subscription Tiers ↓
            </a>
          </div>
        </section>

        {/* 3 Subscription Tiers Grid */}
        <section className="b2b-tiers-section" id="tiers" aria-label="Pilihan Paket Berlangganan">
          <div className="b2b-tiers-inner">
            <div className="b2b-tiers-header">
              <span className="section-eyebrow">CURATED CORPORATE TIERS</span>
              <h2 className="section-title">
                Three Scales of <em>Botanical Presence</em>
              </h2>
              <p className="section-desc">
                Dirancang presisi untuk setiap titik sentuh arsitektural properti bisnis Anda.
              </p>
            </div>

            <div className="b2b-tiers-grid">
              {/* Tier 1: Petit */}
              <div className="b2b-tier-card">
                <span className="tier-card-badge">COMPACT SCALE</span>
                <h3 className="tier-card-name">PETIT</h3>
                <div className="tier-card-price">Mulai Rp 250.000 <span>/ bulan</span></div>
                <p className="tier-card-dims">Tinggi: ~30–45 cm · Meja Konsultasi &amp; Restroom</p>
                <p className="tier-card-text">
                  Karya aksen mungil berkarakter kuat untuk meja resepsionis boutique, meja bedside suite hotel, atau meja konsultasi dokter.
                </p>
                <ul className="tier-card-bullets">
                  <li>1 Kuntum fokal utama (Protea / Peony)</li>
                  <li>Tatakan keramik kerucut / frame kristal</li>
                  <li>Opsi rotasi per 1, 2, atau 3 bulan</li>
                  <li>Gratis pengantaran dan penataan kurator</li>
                </ul>
                <a href="#quote" className="tier-card-btn">Pilih Paket Petit →</a>
              </div>

              {/* Tier 2: Classic (Most Popular) */}
              <div className="b2b-tier-card featured">
                <span className="tier-card-badge featured-badge">MOST POPULAR IN HOSPITALITY</span>
                <h3 className="tier-card-name">CLASSIC</h3>
                <div className="tier-card-price">Mulai Rp 450.000 <span>/ bulan</span></div>
                <p className="tier-card-dims">Tinggi: ~60–75 cm · Lobi Utama &amp; Boardroom</p>
                <p className="tier-card-text">
                  Rangkaian botani multidimensi berskala menengah untuk counter check-in hotel, meja rapat dewan direksi, dan VIP lounge.
                </p>
                <ul className="tier-card-bullets">
                  <li>3–5 Tangkai botani langka terpreservasi</li>
                  <li>Resin bio-epoxy anti-UV tingkat optik</li>
                  <li>Integrasi Smart QR Memory / Info Hotel kustom</li>
                  <li>Prioritas penggantian desain setiap kuartal</li>
                </ul>
                <a href="#quote" className="tier-card-btn featured-btn">Pilih Paket Classic →</a>
              </div>

              {/* Tier 3: Masterpiece */}
              <div className="b2b-tier-card">
                <span className="tier-card-badge">GRAND INSTALLATION</span>
                <h3 className="tier-card-name">MASTERPIECE</h3>
                <div className="tier-card-price">Mulai Rp 850.000 <span>/ bulan</span></div>
                <p className="tier-card-dims">Tinggi: ~90–110 cm · Atrium &amp; Ballroom Foyer</p>
                <p className="tier-card-text">
                  Instalasi arsitektural berskala penuh yang menjadi fokal visual tak terlupakan bagi tamu prestisius Anda.
                </p>
                <ul className="tier-card-bullets">
                  <li>Gubahan bunga surplus impor langka berskala megah</li>
                  <li>Vessel keramik artisanal kustom Surabaya</li>
                  <li>Layanan pemeliharaan dan inspeksi bulanan</li>
                  <li>Bebas kustomisasi palet warna sesuai brand guidelines</li>
                </ul>
                <a href="#quote" className="tier-card-btn">Pilih Paket Masterpiece →</a>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works (3 Steps) */}
        <section className="b2b-steps-section" aria-label="Cara Kerja Berlangganan">
          <div className="b2b-steps-inner">
            <h3 className="b2b-steps-title">The Corporate Subscription Protocol</h3>
            <div className="b2b-steps-grid">
              <div className="b2b-step-item">
                <span className="b2b-step-num">01</span>
                <h4>Choose Your Size &amp; Style</h4>
                <p>Pilih ukuran gubahan (Petit, Classic, atau Masterpiece) dan diskusikan preferensi nuansa interior Anda dengan kurator kami.</p>
              </div>

              <div className="b2b-step-item">
                <span className="b2b-step-num">02</span>
                <h4>Set Swap Frequency</h4>
                <p>Tentukan siklus rotasi (setiap 1, 2, atau 3 bulan). Kami akan datang membawa karya baru dan membawa karya lama untuk disegarkan di studio.</p>
              </div>

              <div className="b2b-step-item">
                <span className="b2b-step-num">03</span>
                <h4>Enjoy Enduring Prestige</h4>
                <p>Ruangan bisnis Anda senantiasa tampil menawan dengan karya bunga abadi tanpa perawatan, tanpa serpihan rontok, dan tanpa kekhawatiran air vas busuk.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tailor-Made Quote Form */}
        <section className="b2b-quote-section" id="quote" aria-label="Formulir Konsultasi B2B">
          <div className="b2b-quote-inner">
            <div className="b2b-quote-header">
              <span className="section-eyebrow">TAILOR-MADE BESPOKE PROPOSAL</span>
              <h2 className="section-title">Request a Corporate Consultation</h2>
              <p className="section-desc">
                Konsultasikan kebutuhan properti Anda. Tim kurator atelier kami akan menyiapkan mock-up visual dan proposal estimasi dalam 1×24 jam.
              </p>
            </div>

            <form className="order-form-card b2b-quote-card" onSubmit={handleRequestQuote}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="b2b-company">Nama Perusahaan / Properti</label>
                  <input
                    id="b2b-company"
                    type="text"
                    className="form-input"
                    placeholder="Contoh: The Majapahit Heritage Hotel"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="b2b-pic">Nama PIC / Penanggung Jawab</label>
                  <input
                    id="b2b-pic"
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Ibu Raline Shah"
                    value={picName}
                    onChange={e => setPicName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="b2b-wa">Nomor WhatsApp PIC</label>
                  <input
                    id="b2b-wa"
                    type="tel"
                    className="form-input"
                    placeholder="08xx-xxxx-xxxx"
                    value={picWhatsapp}
                    onChange={e => setPicWhatsapp(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="b2b-venue">Tipe Venue / Properti</label>
                  <select
                    id="b2b-venue"
                    className="form-select"
                    value={venueType}
                    onChange={e => setVenueType(e.target.value)}
                  >
                    <option value="Hotel / Resort Luxury">Hotel / Resort Luxury</option>
                    <option value="Kantor Korporat & Executive Suite">Kantor Korporat &amp; Executive Suite</option>
                    <option value="Klinik Estetika / Medical Spa">Klinik Estetika / Medical Spa</option>
                    <option value="Fine Dining Restaurant / Bar">Fine Dining Restaurant / Bar</option>
                    <option value="Galeri Seni / Luxury Retail">Galeri Seni / Luxury Retail</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="b2b-rooms">Estimasi Jumlah Titik Penataan</label>
                <select
                  id="b2b-rooms"
                  className="form-select"
                  value={roomCount}
                  onChange={e => setRoomCount(e.target.value)}
                >
                  <option value="1–3 Ruangan / Titik Display">1–3 Ruangan / Titik Display</option>
                  <option value="4–10 Ruangan / Titik Display">4–10 Ruangan / Titik Display</option>
                  <option value="11+ Ruangan (Full Property Subscription)">11+ Ruangan (Full Property Subscription)</option>
                  <option value="One-Time Event / Corporate Gifting Bulk">One-Time Event / Corporate Gifting Bulk</option>
                </select>
              </div>

              <button type="submit" className="form-submit btn-wa-atelier b2b-submit-btn">
                Request Business Consultation via WhatsApp →
              </button>
              <p className="form-note">
                Katalog sampel fisik dan kurasi wangi atelier dapat dibawa saat pertemuan langsung di area Surabaya &amp; sekitarnya.
              </p>
            </form>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
