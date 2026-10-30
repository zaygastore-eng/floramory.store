import ProductImage from "@/components/ProductImage";
import { formatHarga } from "@/lib/site";
import { tierEmoji, tierLabel, type Product } from "@/lib/sheets";

interface ProductSpecimenProps {
  product: Product;
  whatsappUrl: string;
  onOrder: () => void;
}

export default function ProductSpecimen({
  product,
  whatsappUrl,
  onOrder,
}: ProductSpecimenProps) {
  const tier = product.tier.toLowerCase();
  const tierNotes: Record<string, string> = {
    classic: "A quiet keepsake, made to hold a lasting memory.",
    signature: "A considered composition, preserved by hand.",
    masterpiece: "A singular botanical work, made for a once-in-a-lifetime story.",
  };

  return (
    <article className="specimen-sheet">
      <section className="specimen-media-column" aria-label="Visual specimen">
        <div className="specimen-viewport">
          <ProductImage
            src={product.foto_produk}
            size="large"
            alt={`${product.nama_produk} — preserved botanical specimen`}
            className="specimen-product-image"
            width={1000}
            height={1200}
            loading="eager"
            fallback={<span className="specimen-fallback">{tierEmoji(tier)}</span>}
          />
          <span className="specimen-tier-pill">
            <span>{tierLabel(tier)}</span>
            <span>{tierNotes[tier] || "A botanical keepsake, preserved by hand."}</span>
          </span>
        </div>
      </section>

      <section className="specimen-copy-column" aria-label="Keepsake story">
        <span className="specimen-eyebrow">Preserved botanical art · Handcrafted</span>
        <h1 className="specimen-title" id="product-modal-title">{product.nama_produk}</h1>
        <p className="specimen-price">{formatHarga(product.harga)}</p>
        <p className="specimen-narrative" id="specimen-narrative">
          {product.deskripsi || "A fleeting bloom, held in crystal clarity. Each specimen is carefully composed to keep the feeling of a meaningful moment close, long after the petals have fallen."}
        </p>

        <p className="specimen-metadata">
          {product.bunga || "Preserved bloom"} · 3–5 Days Lab Dehydration · {[product.ukuran, product.bahan].filter(Boolean).join(" · ") || "Hand-finished form"}
        </p>
        <p className="specimen-qr-whisper">
          <span aria-hidden="true">✦</span> Secret embedded micro-QR permanently links this physical keepsake to your private digital Memory Vault.
        </p>

        <div className="specimen-actions">
          <button type="button" className="specimen-order-button" onClick={onOrder}>
            Pre-Order This Keepsake <span aria-hidden="true">→</span>
          </button>
          <div className="specimen-secondary-actions">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              Ask / Consult via WhatsApp
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}
