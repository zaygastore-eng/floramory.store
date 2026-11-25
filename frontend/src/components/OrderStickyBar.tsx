import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShoppingBag, X } from "lucide-react";
import type { CatalogProduct } from "@/lib/api";
import {
  clearReservationDraft,
  loadReservationDraft,
  parseHargaAmount,
  type ReservationDraftItem,
} from "@/lib/reservation";
import { formatHarga } from "@/lib/site";

export default function OrderStickyBar({ products = [] }: { products?: CatalogProduct[] }) {
  const [items, setItems] = useState<ReservationDraftItem[]>(() =>
    loadReservationDraft().filter((i) => Boolean(i.productId))
  );

  useEffect(() => {
    const sync = () => {
      setItems(loadReservationDraft().filter((i) => Boolean(i.productId)));
    };
    window.addEventListener("fm-draft-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("fm-draft-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (items.length === 0) return null;

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const priceById = new Map(products.map((p) => [p.id, parseHargaAmount(p.harga)]));
  const totalAmount = items.reduce((sum, item) => {
    const unit = priceById.get(item.productId) || 0;
    return sum + unit * item.qty;
  }, 0);

  return (
    <div className="esb-sticky-bar" role="region" aria-label="Ringkasan pesanan aktif">
      <div className="esb-sticky-inner">
        <div className="esb-sticky-info">
          <span className="esb-sticky-icon" aria-hidden="true">
            <ShoppingBag size={18} />
          </span>
          <div className="esb-sticky-meta">
            <strong>{totalQty} Karya di Pesanan</strong>
            <span>
              {totalAmount > 0
                ? `Estimasi ${formatHarga(String(totalAmount))}`
                : "Siap dilanjutkan ke form pesan"}
            </span>
          </div>
        </div>
        <div className="esb-sticky-actions">
          <Link href="/pre-order" className="esb-sticky-cta">
            Lanjut Pesan ({totalQty}) →
          </Link>
          <button
            type="button"
            className="esb-sticky-clear"
            onClick={clearReservationDraft}
            aria-label="Hapus daftar pesanan"
            title="Hapus daftar pesanan"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
