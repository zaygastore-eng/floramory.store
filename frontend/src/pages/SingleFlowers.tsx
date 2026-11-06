import { useState, useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { fetchWhatsAppNumber } from "@/lib/api";
import { normalizeWhatsApp } from "@/lib/site";

interface StemSpecimen {
  id: string;
  name: string;
  botanical: string;
  price: string;
  height: string;
  tag: string;
  description: string;
}

const SINGLE_STEMS: StemSpecimen[] = [
  {
    id: "stem-king-protea",
    name: "Single King Protea",
    botanical: "Protea cynaroides",
    price: "Rp 195.000,-",
    height: "38 cm",
    tag: "Exotic Bloom",
    description: "Kuntum King Protea agung dengan kelopak bertekstur beludru, diawetkan secara utuh.",
  },
  {
    id: "stem-icelandic-poppy",
    name: "Golden Icelandic Poppy",
    botanical: "Papaver nudicaule",
    price: "Rp 175.000,-",
    height: "32 cm",
    tag: "Atelier Favorite",
    description: "Kuntum poppy jingga keemasan dengan tangkai meliuk alami yang diabadikan dalam kristal.",
  },
  {
    id: "stem-coral-peony",
    name: "Coral Peony in Mini Crystal",
    botanical: "Paeonia lactiflora",
    price: "Rp 220.000,-",
    height: "35 cm",
    tag: "Rare Preservation",
    description: "Lapisan mahkota peony koral yang mekar sempurna pada puncak keindahannya.",
  },
  {
    id: "stem-burgundy-hydrangea",
    name: "Deep Burgundy Hydrangea Stem",
    botanical: "Hydrangea macrophylla",
    price: "Rp 185.000,-",
    height: "30 cm",
    tag: "Best Seller",
    description: "Kluster hydrangea bernuansa anggur burgundy pekat dengan daya tahan puluhan tahun.",
  },
  {
    id: "stem-white-orchid",
    name: "White Orchid Keepsake",
    botanical: "Phalaenopsis amabilis",
    price: "Rp 210.000,-",
    height: "40 cm",
    tag: "Pure Elegance",
    description: "Kuntum anggrek bulan putih bersih dengan detail putik yang tetap segar tanpa air.",
  },
  {
    id: "stem-velvet-rose",
    name: "Velvet Garden Rose",
    botanical: "Rosa damascena",
    price: "Rp 195.000,-",
    height: "34 cm",
    tag: "Romantic Classic",
    description: "Mawar taman kelopak ganda dengan warna crimson abadi berstandar laboratorium.",
  },
  {
    id: "stem-craspedia-globes",
    name: "Preserved Craspedia Globes",
    botanical: "Craspedia globosa",
    price: "Rp 150.000,-",
    height: "42 cm",
    tag: "Architectural Stem",
    description: "Trio bola drumstick kuning mustard yang memberikan aksen modern minimalis.",
  },
  {
    id: "stem-blue-eryngium",
    name: "Thistle Eryngium Bloom",
    botanical: "Eryngium planum",
    price: "Rp 165.000,-",
    height: "36 cm",
    tag: "Wild Botanical",
    description: "Bunga thistle baja bernuansa biru keperakan dengan tekstur arsitektural dramatis.",
  },
  {
    id: "stem-silver-eucalyptus",
    name: "Silver Dollar Eucalyptus Branch",
    botanical: "Eucalyptus cinerea",
    price: "Rp 160.000,-",
    height: "45 cm",
    tag: "Aromatic Foliage",
    description: "Dedaunan eukaliptus perak kebiruan yang tetap lentur dan tidak rapuh.",
  },
  {
    id: "stem-anemone-dark",
    name: "Dark Center Anemone",
    botanical: "Anemone coronaria",
    price: "Rp 180.000,-",
    height: "33 cm",
    tag: "Rare Bloom",
    description: "Kelopak putih gading dengan pusat mata ungu gelap pekat yang sangat memikat.",
  },
];

export default function SingleFlowers() {
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");

  useEffect(() => {
    fetchWhatsAppNumber().then(num => {
      setWhatsappNumber(normalizeWhatsApp(num) || "6285235242425");
    });
  }, []);

  const handleOrderStem = (stem: StemSpecimen) => {
    const message = encodeURIComponent(
      `Halo A Chapter Atelier, saya tertarik memesan Single Botanical Stem: ${stem.name} (${stem.price}) untuk koleksi saya.`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="subpage-wrapper">
      <SiteHeader />

      <main className="subpage-main">
        {/* Editorial Subpage Header */}
        <section className="stem-header-section" aria-label="Single Stems Gallery Header">
          <div className="stem-header-inner">
            <span className="section-eyebrow">THE ARCHIVAL PEDESTAL COLLECTION</span>
            <h1 className="stem-header-title">Single Botanical Stems</h1>
            <p className="stem-header-desc">
              Dari mawar terpreservasi abadi hingga kuntum dahlia langka. Setiap tangkai dibuat untuk bertahan bertahun-tahun tanpa air, berdiri anggun di atas dudukan keramik minimalis.
            </p>
          </div>
        </section>

        {/* 5-Column Pedestal Gallery */}
        <section className="stem-gallery-section" aria-label="Daftar Tangkai Botani Tunggal">
          <div className="stem-gallery-container">
            <div className="shop-5col-grid">
              {SINGLE_STEMS.map(stem => (
                <div className="stem-card" key={stem.id}>
                  {/* Conical Pedestal Visualizer */}
                  <div className="stem-visual">
                    <div className="stem-tag">{stem.tag}</div>
                    <div className="conical-stand-wrapper">
                      <div className="stem-specimen-symbol">🌿</div>
                      <div className="conical-stand" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="stem-info">
                    <span className="stem-botanical-name"><em>{stem.botanical}</em></span>
                    <h3 className="stem-name">{stem.name}</h3>
                    <p className="stem-meta-line">{stem.height} · Lab silica preserved</p>
                    <p className="stem-desc">{stem.description}</p>

                    <div className="stem-footer">
                      <span className="stem-price">{stem.price}</span>
                      <button
                        type="button"
                        className="stem-order-btn"
                        onClick={() => handleOrderStem(stem)}
                      >
                        Commission Stem →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Custom Stem Request Banner */}
        <section className="stem-custom-banner">
          <div className="stem-custom-inner">
            <h3 className="stem-custom-title">Looking for a specific heirloom stem?</h3>
            <p className="stem-custom-text">
              Punya bunga sentimental dari buket pernikahan, kelulusan, atau memorial Anda sendiri? Kirimkan kuntum segar Anda ke atelier kami untuk dipreservasi abadi.
            </p>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Halo A Chapter, saya ingin mengabadikan bunga sentimental pribadi saya.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta hero-cta-primary"
            >
              Consult Bespoke Stem Preservation →
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
