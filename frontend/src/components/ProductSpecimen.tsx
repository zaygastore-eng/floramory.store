import ProductImage from "@/components/ProductImage";
import { formatHarga } from "@/lib/site";
import type { Product } from "@/lib/api";

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
  return (
    <article className="specimen-sheet">
      <section className="specimen-media-column" aria-label="Visual botanical specimen">
        <div className="specimen-viewport">
          <div className="specimen-passe-partout">
            <ProductImage
              src={product.foto_produk}
              size="large"
              alt={`${product.nama_produk} — preserved botanical specimen`}
              className="specimen-product-image"
              width={1000}
              height={1250}
              loading="eager"
              fallback={
                <div className="product-img-monogram">
                  <span className="product-monogram-inner">A · C</span>
                </div>
              }
            />
          </div>
          <div className="specimen-microchip-stamp">
            <span className="stamp-dot" aria-hidden="true">✦</span>
            PERMANENT CLOUD MICRO-CHIP EMBEDDED IN BASE
          </div>
        </div>
      </section>

      <section className="specimen-copy-column" aria-label="Archival keepsake folio">
        {/* Edition Header */}
        <div className="specimen-folio-header">
          <span className="specimen-folio-tag">
            FOLIO SPECIMEN NO. {product.id ? String(product.id).slice(0, 8).toUpperCase() : "2026-A"} · SURABAYA ATELIER
          </span>
          <h1 className="specimen-title" id="product-modal-title">{product.nama_produk}</h1>
          <p className="specimen-price">{formatHarga(product.harga)}</p>
        </div>

        {/* Story / Philosophical Narrative */}
        <p className="specimen-narrative" id="specimen-narrative">
          {product.deskripsi || "A fleeting bloom, held in crystal clarity. Each specimen is carefully composed to keep the feeling of a meaningful moment close, long after the petals have fallen."}
        </p>

        {/* Curated Botanical Specifications (Hairline Definition List) */}
        <dl className="specimen-herbarium-notes">
          <div className="herb-note-row">
            <dt>Botanical Elements</dt>
            <dd>{product.bunga || "Natural Preserved Flora (Hydrangea & Gypsophila)"}</dd>
          </div>
          <div className="herb-note-row">
            <dt>Preservation Standard</dt>
            <dd>Lab Cryo-Dehydration (&lt; 0.02% Residual Moisture Content)</dd>
          </div>
          <div className="herb-note-row">
            <dt>Encapsulation</dt>
            <dd>Optical-Grade UV-Shielded Crystal Bio-Epoxy (Bubble-Free)</dd>
          </div>
          <div className="herb-note-row">
            <dt>Frame &amp; Form</dt>
            <dd>{[product.ukuran, product.bahan].filter(Boolean).join(" · ") || "Archival Solid Wood Herbarium Frame"}</dd>
          </div>
        </dl>

        {/* The Memory Vault Included Card */}
        <div className="specimen-vault-card">
          <div className="vault-card-badge">DIGITAL MEMORY VAULT INCLUDED</div>
          <p className="vault-card-text">
            Sudah termasuk akses eksklusif Smart QR Memory Vault: simpan rekaman suara, foto kenangan, dan surat personal yang dapat diperbarui kapan saja seumur hidup tanpa aplikasi.
          </p>
        </div>

        {/* Dual Action System */}
        <div className="specimen-actions">
          <button type="button" className="specimen-order-button" onClick={onOrder}>
            COMMISSION THIS CHAPTER →
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="specimen-whatsapp-link"
          >
            Consult Custom Request via WhatsApp
          </a>
        </div>
      </section>
    </article>
  );
}
