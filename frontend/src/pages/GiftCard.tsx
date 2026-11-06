import { useState, useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { fetchWhatsAppNumber } from "@/lib/api";
import { normalizeWhatsApp } from "@/lib/site";

const DENOMINATIONS = [
  { value: "250000", label: "Rp 250.000,-" },
  { value: "500000", label: "Rp 500.000,-" },
  { value: "750000", label: "Rp 750.000,-" },
  { value: "1000000", label: "Rp 1.000.000,-" },
  { value: "1500000", label: "Rp 1.500.000,-" },
];

export default function GiftCard() {
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const [selectedDenom, setSelectedDenom] = useState("500000");
  const [deliveryMode, setDeliveryMode] = useState<"digital" | "physical">("physical");
  const [recipientName, setRecipientName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    fetchWhatsAppNumber().then(num => {
      setWhatsappNumber(normalizeWhatsApp(num) || "6285235242425");
    });
  }, []);

  const selectedObj = DENOMINATIONS.find(d => d.value === selectedDenom) || DENOMINATIONS[1];
  const totalAmount = Number(selectedDenom) + (deliveryMode === "physical" ? 75000 : 0);

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const modeLabel = deliveryMode === "physical"
      ? "Physical Luxury Giftbox (+Rp 75.000 — Box pita, bunga asli, surat segel lilin)"
      : "Digital Voucher Instan (WhatsApp / Email)";

    const message = encodeURIComponent(
      `Halo A Chapter Atelier,\n\nSaya ingin memesan The A Chapter Gift Card:\n` +
      `• Nilai Voucher: ${selectedObj.label}\n` +
      `• Format Pengiriman: ${modeLabel}\n` +
      `• Total: Rp ${totalAmount.toLocaleString("id-ID")},-\n` +
      `• Untuk: ${recipientName || "-"}\n` +
      `• Dari: ${senderName || "-"}\n` +
      `• Pesan Khusus: ${giftNote || "-"}\n\nMohon petunjuk transfer dan pengiriman kartu kado.`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const giftFaqs = [
    {
      q: "Berapa lama masa berlaku voucher A Chapter?",
      a: "Setiap kartu kado A Chapter berlaku selama 1 tahun penuh (365 hari) terhitung sejak tanggal diterbitkan. Penerima dapat menggunakannya kapan saja untuk semua seri karya botani kami."
    },
    {
      q: "Bagaimana cara penerima menukarkan (redeem) voucher?",
      a: "Di dalam gift card terdapat kode unik personal dan QR code concierge. Penerima cukup memindai QR atau menghubungi WhatsApp resmi kami dengan menyebutkan kode voucher saat memilih karya yang disukai."
    },
    {
      q: "Berapa lama estimasi pengiriman paket Physical Luxury Gift Box?",
      a: "Untuk area Surabaya & Sidoarjo pengiriman dapat dilakukan pada hari yang sama menggunakan kurir instan khusus florist. Untuk pengiriman seluruh Indonesia, paket kotak mewah dilapisi bubble wrap tebal dan tiba dalam 1–3 hari kerja."
    }
  ];

  return (
    <div className="subpage-wrapper">
      <SiteHeader />

      <main className="subpage-main">
        {/* Split Screen Purchase Console */}
        <section className="giftcard-hero-section" aria-label="Gift Card Console">
          <div className="giftcard-container">
            <div className="giftcard-split">
              {/* Left Column: Visual Gift Box Presentation */}
              <div className="giftcard-visual-col">
                <div className="giftcard-box-card">
                  <div className="giftcard-box-presentation">
                    <div className="giftbox-monogram-emboss">A · C</div>
                    <div className="giftbox-ribbon-horizontal" aria-hidden="true" />
                    <div className="giftbox-ribbon-vertical" aria-hidden="true" />
                    <div className="giftbox-real-bloom">
                      <span>🌸</span>
                      <small>REAL PRESERVED BOTANICAL STEM ATOP</small>
                    </div>
                  </div>
                  <div className="giftbox-caption">
                    <span className="caption-tag">ATELIER ARCHIVE PRESENTATION BOX</span>
                    <p>Kotak kado kokoh berpita grosgrain sutra hitam, dilengkapi surat lilin segel dan bunga asli.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Purchase Console */}
              <div className="giftcard-form-col">
                <span className="section-eyebrow">THE ATELIER GIFTING CONCIERGE</span>
                <h1 className="giftcard-title">The A Chapter Gift Card</h1>

                <div className="giftcard-rating-strip">
                  <span className="rating-stars" aria-hidden="true">★★★★★</span>
                  <p className="rating-quote">
                    “The most thoughtful and lasting wedding gift I’ve ever sent. The recipient was in awe of the memory vault.”
                  </p>
                </div>

                <form className="giftcard-console-form" onSubmit={handleOrder}>
                  {/* Step 1: Denomination Selector */}
                  <div className="console-group">
                    <label className="console-label">Pilih Nilai Voucher</label>
                    <div className="denom-grid">
                      {DENOMINATIONS.map(d => (
                        <button
                          key={d.value}
                          type="button"
                          className={`denom-btn${selectedDenom === d.value ? " active" : ""}`}
                          onClick={() => setSelectedDenom(d.value)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Delivery Mode Selection */}
                  <div className="console-group">
                    <label className="console-label">Format Pengiriman</label>
                    <div className="delivery-pills">
                      <button
                        type="button"
                        className={`delivery-pill${deliveryMode === "physical" ? " active" : ""}`}
                        onClick={() => setDeliveryMode("physical")}
                      >
                        <div className="pill-header">
                          <span className="pill-radio">{deliveryMode === "physical" ? "◉" : "○"}</span>
                          <strong>Physical Luxury Gift Box</strong>
                          <span className="pill-price">+Rp 75.000</span>
                        </div>
                        <p className="pill-desc">
                          Kotak keras mewah berikat pita sutra, setangkai bunga asli terpreservasi, surat segel lilin, dan wangi khas atelier.
                        </p>
                      </button>

                      <button
                        type="button"
                        className={`delivery-pill${deliveryMode === "digital" ? " active" : ""}`}
                        onClick={() => setDeliveryMode("digital")}
                      >
                        <div className="pill-header">
                          <span className="pill-radio">{deliveryMode === "digital" ? "◉" : "○"}</span>
                          <strong>Digital E-Voucher</strong>
                          <span className="pill-price">Gratis</span>
                        </div>
                        <p className="pill-desc">
                          Kupon voucher digital elegan dikirim langsung via WhatsApp atau Email beresolusi tinggi, siap cetak atau teruskan.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Recipient & Sender Detail */}
                  <div className="console-group">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="gift-to">Nama Penerima</label>
                        <input
                          id="gift-to"
                          type="text"
                          className="form-input"
                          placeholder="Nama sahabat/pasangan"
                          value={recipientName}
                          onChange={e => setRecipientName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="gift-from">Dari Siapa</label>
                        <input
                          id="gift-from"
                          type="text"
                          className="form-input"
                          placeholder="Nama Anda / Pengirim"
                          value={senderName}
                          onChange={e => setSenderName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="gift-msg">Pesan Pribadi di Kartu Ucapan</label>
                      <textarea
                        id="gift-msg"
                        className="form-textarea"
                        placeholder="Tuliskan ucapan selamat atau doa berharga untuk penerima kado..."
                        rows={3}
                        value={giftNote}
                        onChange={e => setGiftNote(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Order Total & Action */}
                  <div className="giftcard-summary-bar">
                    <div className="summary-left">
                      <span className="summary-label">Total Pembayaran</span>
                      <strong className="summary-value">Rp {totalAmount.toLocaleString("id-ID")},-</strong>
                    </div>
                    <button type="submit" className="hero-cta hero-cta-primary giftcard-submit-btn">
                      ORDER GIFT CARD NOW →
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Gift Card FAQ Accordion */}
        <section className="giftcard-faq-section" aria-label="FAQ Kartu Kado">
          <div className="faq-inner">
            <div className="faq-header">
              <span className="section-eyebrow order-center">GIFT CARD ASSURANCE</span>
              <h2 className="section-title order-center">
                Frequently Asked <em>Questions</em>
              </h2>
            </div>

            <div className="faq-accordion" role="region" aria-label="Gift Card FAQ">
              {giftFaqs.map((item, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div className={`faq-item${isOpen ? " open" : ""}`} key={index}>
                    <button
                      type="button"
                      className="faq-question-btn"
                      aria-expanded={isOpen}
                      aria-controls={`gift-faq-answer-${index}`}
                      id={`gift-faq-btn-${index}`}
                      onClick={() => setActiveFaq(current => current === index ? null : index)}
                    >
                      <span className="faq-question-text">{item.q}</span>
                      <span className="faq-toggle-icon" aria-hidden="true">+</span>
                    </button>
                    <div
                      id={`gift-faq-answer-${index}`}
                      role="region"
                      aria-labelledby={`gift-faq-btn-${index}`}
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
