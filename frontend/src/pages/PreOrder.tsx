import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/ProductImage";
import {
  createGroupPreOrder,
  fetchCatalogProducts,
  fetchWhatsAppNumber,
  tierLabel,
  type CatalogProduct,
  type PreOrderItemInput,
} from "@/lib/api";
import { applyPageMeta } from "@/lib/seo";
import {
  formatGroupCommissionWhatsApp,
  formatHarga,
  normalizeWhatsApp,
} from "@/lib/site";
import {
  NUANSA_WARNA_OPTIONS,
  RESERVATION_MAX_QTY,
  clampQty,
  clearReservationDraft,
  createReservationItem,
  loadReservationDraft,
  parseHargaAmount,
  saveReservationDraft,
  type ReservationDraftItem,
} from "@/lib/reservation";
import useToast from "@/hooks/useToast";

interface SuccessState {
  groupNumber: string;
  itemCount: number;
  totalAmount: number;
  dpAmount: number;
  waUrl: string;
}

const WA_PATTERN = /^(?:08\d{8,11}|628\d{8,11})$/;

export default function PreOrder() {
  const search = useSearch();
  const { toastMsg, toastVisible, showToast } = useToast(3500);

  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReservationDraftItem[]>(() => loadReservationDraft());
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [buyer, setBuyer] = useState({
    nama: "",
    wa: "",
    city: "",
    address: "",
    website: "",
    isVip: false,
  });

  const initializedRef = useRef(false);
  const formStartRef = useRef(Date.now());

  const activeCatalog = useMemo(
    () => catalog.filter(product => !product.isFallback),
    [catalog]
  );

  const productById = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const product of activeCatalog) map.set(product.id, product);
    return map;
  }, [activeCatalog]);

  useEffect(() => {
    applyPageMeta({
      title: "Pre-Order Karya — A Chapter",
      description:
        "Atur karya A Chapter yang sudah Anda pilih, lengkapi data pemesan dan pengiriman, lalu lanjutkan konfirmasi pre-order melalui WhatsApp.",
      path: "/pre-order",
      robots: "noindex, nofollow",
    });

    const initialDraft = loadReservationDraft();
    setItems(current => (current.length > 0 ? current : initialDraft));

    fetchCatalogProducts()
      .then(products => setCatalog(products))
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false));

    fetchWhatsAppNumber()
      .then(number => setWhatsappNumber(normalizeWhatsApp(number) || "6285235242425"))
      .catch(() => undefined);
  }, []);

  // Terapkan produk dari tautan lama (?product=ID) sekali setelah katalog siap.
  useEffect(() => {
    if (initializedRef.current || loading) return;
    initializedRef.current = true;

    const queryProduct = new URLSearchParams(search).get("product") || "";
    setItems(current => {
      const validIds = new Set(activeCatalog.map(product => product.id));
      const next = current.filter(item => !item.productId || validIds.has(item.productId));

      if (queryProduct && validIds.has(queryProduct)) {
        const alreadyAdded = next.some(item => item.productId === queryProduct);
        if (!alreadyAdded) next.push(createReservationItem(queryProduct));
      }

      return next;
    });
  }, [activeCatalog, loading, search]);

  useEffect(() => {
    saveReservationDraft(items);
  }, [items]);

  const updateItem = (uid: string, patch: Partial<ReservationDraftItem>) => {
    setItems(current =>
      current.map(item => (item.uid === uid ? { ...item, ...patch } : item))
    );
  };

  const addItem = () => {
    setItems(current => [
      ...current,
      createReservationItem(activeCatalog[0]?.id || ""),
    ]);
  };

  const removeItem = (uid: string) => {
    setItems(current => current.filter(item => item.uid !== uid));
  };

  const validItems = items.filter(item => item.productId && productById.has(item.productId));

  const unitCount = validItems.reduce((sum, item) => sum + Math.max(1, item.qty), 0);
  const totalAmount = validItems.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return sum + parseHargaAmount(product?.harga) * Math.max(1, item.qty);
  }, 0);
  const dpAmount = Math.ceil(totalAmount * 0.5);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!buyer.nama.trim() || !buyer.wa.trim()) {
      showToast("Isi nama lengkap dan nomor WhatsApp pemesan.");
      return;
    }

    const phoneDigits = buyer.wa.replace(/\D/g, "");
    if (!WA_PATTERN.test(phoneDigits)) {
      showToast("Nomor WhatsApp tidak valid. Gunakan format 08xx atau 62xx.");
      return;
    }

    if (validItems.length === 0) {
      showToast("Pilih minimal satu karya sebelum mengirim pre-order.");
      return;
    }

    const payloadItems: PreOrderItemInput[] = validItems.map(item => {
      const product = productById.get(item.productId);
      return {
        product_id: item.productId,
        product_name: product?.nama_produk || "",
        qty: Math.max(1, item.qty),
        nuansa: item.nuansa,
        inisial: item.inisial.trim(),
      };
    });

    setSubmitting(true);
    try {
      const result = await createGroupPreOrder(
        {
          customer_name: buyer.nama.trim(),
          whatsapp: normalizeWhatsApp(buyer.wa),
          is_vip: buyer.isVip,
          shipping_city: buyer.city.trim(),
          shipping_address: buyer.address.trim(),
          items: payloadItems,
        },
        {
          honeypot: buyer.website,
          fillMs: Date.now() - formStartRef.current,
        }
      );
      formStartRef.current = Date.now();

      if (!result.success || !result.groupId) {
        throw new Error("Permintaan belum tercatat. Silakan coba kembali atau hubungi concierge.");
      }

      const waMessage = formatGroupCommissionWhatsApp({
        customerName: buyer.nama,
        groupNumber: result.groupNumber,
        items: validItems.map(item => {
          const product = productById.get(item.productId);
          const nuansa = NUANSA_WARNA_OPTIONS.find(option => option.id === item.nuansa);
          return {
            productName: product?.nama_produk || "",
            qty: Math.max(1, item.qty),
            colorPalette: nuansa ? `${nuansa.label} (${nuansa.detail})` : item.nuansa,
            initial: item.inisial,
          };
        }),
        totalAmount: result.totalAmount || totalAmount,
        dpAmount: result.dpAmount || dpAmount,
        shippingCity: buyer.city,
        shippingAddress: buyer.address,
        isVip: buyer.isVip,
      });
      const waDigits = normalizeWhatsApp(whatsappNumber) || "6285235242425";
      const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`;

      setSuccess({
        groupNumber: result.groupNumber,
        itemCount: result.itemCount || unitCount,
        totalAmount: result.totalAmount || totalAmount,
        dpAmount: result.dpAmount || dpAmount,
        waUrl,
      });
      clearReservationDraft();
      setItems([]);
      setBuyer({ nama: "", wa: "", city: "", address: "", website: "", isVip: false });
      showToast("Pre-order berhasil dikirim.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengirim pre-order."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderEmptyState = () => (
    <div className="reservation-empty">
      <span className="reservation-eyebrow">YOUR PRE-ORDER SHEET</span>
      <h2>Belum ada karya dipilih.</h2>
      <p>
        Jelajahi koleksi, buka halaman karya, lalu atur warna dan jumlah sebelum
        melanjutkan pre-order.
      </p>
      <Link href="/shop" className="reservation-primary-btn">
        Jelajahi Koleksi →
      </Link>
    </div>
  );

  const renderSuccess = (state: SuccessState) => (
    <div className="reservation-success" role="status" aria-live="polite">
      <span className="reservation-success-seal" aria-hidden="true">
        <img src="/a-chapter-logo-light.png" alt="" />
      </span>
      <span className="reservation-eyebrow">A CHAPTER ATELIER · PESANAN TERCATAT</span>
      <h2>Pesanan Anda Tercatat</h2>
      <p className="reservation-success-lead">
        Langkah terakhir: klik tombol di bawah untuk mengirim rincian ini ke WhatsApp Atelier agar kami segera mengirimkan instruksi pembayaran DP 50%.
      </p>

      <div className="reservation-success-ref">
        <span>NO. PESANAN</span>
        <strong>#{state.groupNumber}</strong>
      </div>

      <div className="reservation-receipt-rows">
        <div className="reservation-receipt-row">
          <span>Jumlah Karya</span>
          <strong>{state.itemCount} karya</strong>
        </div>
        <div className="reservation-receipt-row">
          <span>Estimasi Harga Karya</span>
          <strong>{formatHarga(String(state.totalAmount))}</strong>
        </div>
        <div className="reservation-receipt-row is-highlight">
          <span>DP 50% (Estimasi Awal)</span>
          <strong>{formatHarga(String(state.dpAmount))}</strong>
        </div>
      </div>

      <div className="reservation-next-steps">
        <strong>Alur selanjutnya:</strong>
        <ol>
          <li>Klik tombol <strong>Bayar DP &amp; Konfirmasi via WhatsApp</strong> di bawah.</li>
          <li>Atelier mengonfirmasi ongkir &amp; mengirim QRIS / rekening DP 50%.</li>
          <li>Setelah DP masuk, Anda menerima tautan <em>Vault Setup</em> untuk mengisi foto, suara, dan surat.</li>
        </ol>
      </div>

      <a
        className="reservation-primary-btn"
        href={state.waUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Bayar DP &amp; Konfirmasi via WhatsApp →
      </a>

      <div className="reservation-success-actions">
        <Link href={`/cek-pesanan?no=${encodeURIComponent(state.groupNumber)}`} className="reservation-secondary-btn">
          Cek Status Pesanan
        </Link>
        <Link href="/shop" className="reservation-secondary-btn">
          Jelajahi Koleksi Lain
        </Link>
        <button
          type="button"
          className="reservation-secondary-btn"
          onClick={() => {
            setSuccess(null);
            setItems([]);
            clearReservationDraft();
          }}
        >
          Buat Pesanan Baru
        </button>
      </div>
    </div>
  );

  return (
    <div className="subpage-wrapper public-v2 reservation-page">
      <SiteHeader />

      <main className="subpage-main">
        <section className="reservation-hero">
          <span className="reservation-eyebrow">ATELIER PRE-ORDER · NO PAYMENT ON SITE</span>
          <h1>Susun Pre-Order Anda</h1>
          <p>
            Pilih warna dan jumlah pada tiap karya, lengkapi data pemesan, lalu
            konfirmasi melalui WhatsApp. DP 50% dibayarkan manual setelah atelier
            mengonfirmasi ketersediaan.
          </p>
        </section>

        <div className="reservation-container">
          {success ? (
            renderSuccess(success)
          ) : loading ? (
            <div className="reservation-loading" role="status">
              Memuat katalog karya...
            </div>
          ) : validItems.length === 0 && items.length === 0 ? (
            renderEmptyState()
          ) : (
            <form className="reservation-form" onSubmit={handleSubmit}>
              <div className="reservation-layout">
                <section className="reservation-items" aria-label="Daftar karya">
                  <div className="reservation-section-head">
                    <div>
                      <span className="reservation-eyebrow">01 · KARYA DIPILIH</span>
                      <h2>Karya dalam pre-order</h2>
                    </div>
                    <span className="reservation-count">{unitCount} karya</span>
                  </div>

                  {items.length === 0 ? (
                    <div className="reservation-items-empty">
                      <p>Belum ada karya. Tambahkan karya pertama untuk memulai.</p>
                    </div>
                  ) : (
                    <div className="reservation-item-list">
                      {items.map((item, index) => {
                        const product = productById.get(item.productId);
                        const nuansa = NUANSA_WARNA_OPTIONS.find(option => option.id === item.nuansa);
                        const unitPrice = parseHargaAmount(product?.harga);
                        const subtotal = unitPrice * Math.max(1, item.qty);
                        return (
                          <article className="reservation-item" key={item.uid}>
                            <div className="reservation-item-media">
                              <ProductImage
                                src={product?.foto_produk || ""}
                                size="thumb"
                                alt={product?.nama_produk || "Karya A Chapter"}
                                width={240}
                                height={300}
                                loading="lazy"
                                fallback={
                                  <div className="product-img-monogram" aria-label="A Chapter">
                                    <img
                                      src="/a-chapter-logo.png"
                                      alt="A Chapter"
                                      className="product-fallback-logo"
                                      width={120}
                                      height={36}
                                      loading="lazy"
                                    />
                                  </div>
                                }
                              />
                            </div>

                            <div className="reservation-item-body">
                              <div className="reservation-item-head">
                                <span className="reservation-item-index">KARYA {index + 1}</span>
                                <button
                                  type="button"
                                  className="reservation-remove-btn"
                                  onClick={() => removeItem(item.uid)}
                                  aria-label={`Hapus karya ${index + 1}`}
                                >
                                  Hapus
                                </button>
                              </div>

                              <label className="reservation-field">
                                <span>Produk</span>
                                <select
                                  className="reservation-input"
                                  value={item.productId}
                                  onChange={event =>
                                    updateItem(item.uid, { productId: event.target.value })
                                  }
                                >
                                  <option value="">Pilih karya</option>
                                  {activeCatalog.map(option => (
                                    <option key={option.id} value={option.id}>
                                      {option.nama_produk}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              {product && (
                                <p className="reservation-item-meta">
                                  {tierLabel(product.tier)} · {product.bunga || "Botanical keepsake"}
                                </p>
                              )}

                              <div className="reservation-item-options">
                                <div className="reservation-field">
                                  <span>Nuansa warna</span>
                                  <div
                                    className="reservation-swatches"
                                    role="radiogroup"
                                    aria-label={`Nuansa warna karya ${index + 1}`}
                                  >
                                    {NUANSA_WARNA_OPTIONS.map(option => {
                                      const selected = item.nuansa === option.id;
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          role="radio"
                                          aria-checked={selected}
                                          className={`reservation-swatch${selected ? " is-selected" : ""}`}
                                          onClick={() => updateItem(item.uid, { nuansa: option.id })}
                                          title={option.detail}
                                        >
                                          <span
                                            className="reservation-swatch-dot"
                                            style={{ backgroundColor: option.swatch }}
                                            aria-hidden="true"
                                          >
                                            {selected && <span className="reservation-swatch-check">✓</span>}
                                          </span>
                                          <span>{option.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="reservation-field reservation-qty-field">
                                  <span>Jumlah</span>
                                  <div className="reservation-qty" role="group" aria-label={`Jumlah karya ${index + 1}`}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItem(item.uid, { qty: clampQty(item.qty - 1) })
                                      }
                                      disabled={item.qty <= 1}
                                      aria-label="Kurangi jumlah"
                                    >
                                      −
                                    </button>
                                    <span aria-live="polite">{item.qty}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItem(item.uid, {
                                          qty: clampQty(item.qty + 1),
                                        })
                                      }
                                      disabled={item.qty >= RESERVATION_MAX_QTY}
                                      aria-label="Tambah jumlah"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <span className="reservation-hint">Maks. {RESERVATION_MAX_QTY}</span>
                                </div>
                              </div>

                              <label className="reservation-field">
                                <span>Inisial monogram <em>(opsional)</em></span>
                                <input
                                  className="reservation-input"
                                  type="text"
                                  maxLength={10}
                                  value={item.inisial}
                                  onChange={event =>
                                    updateItem(item.uid, { inisial: event.target.value })
                                  }
                                  placeholder="Contoh: A, R, atau 5"
                                  autoComplete="off"
                                />
                              </label>

                              <div className="reservation-item-foot">
                                <span>
                                  {item.qty} × {product ? formatHarga(product.harga) : "—"}
                                  {nuansa ? ` · ${nuansa.label}` : ""}
                                </span>
                                <strong>{product ? formatHarga(String(subtotal)) : "—"}</strong>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <button type="button" className="reservation-add-btn" onClick={addItem}>
                    + Tambah karya lain
                  </button>
                </section>

                <aside className="reservation-summary" aria-label="Ringkasan pre-order">
                  <span className="reservation-eyebrow">02 · DATA PEMESAN</span>
                  <h2>Lengkapi data pre-order</h2>

                  <div className="reservation-fields">
                    <label className="reservation-field">
                      <span>Nama lengkap *</span>
                      <input
                        className="reservation-input"
                        type="text"
                        maxLength={120}
                        autoComplete="name"
                        required
                        value={buyer.nama}
                        onChange={event =>
                          setBuyer(current => ({ ...current, nama: event.target.value }))
                        }
                        placeholder="Nama lengkap pemesan"
                      />
                    </label>

                    <label className="reservation-field">
                      <span>Nomor WhatsApp *</span>
                      <input
                        className="reservation-input"
                        type="tel"
                        inputMode="tel"
                        maxLength={20}
                        autoComplete="tel"
                        required
                        value={buyer.wa}
                        onChange={event =>
                          setBuyer(current => ({ ...current, wa: event.target.value }))
                        }
                        placeholder="08xx-xxxx-xxxx"
                      />
                      <span className="reservation-hint">Gunakan nomor aktif (08xx / 62xx).</span>
                    </label>

                    <div className="reservation-shipping">
                      <p className="reservation-shipping-title">
                        Pengiriman <span>(opsional)</span>
                      </p>
                      <p className="reservation-hint">
                        Boleh dikosongkan dan dilengkapi via WhatsApp.
                      </p>
                      <label className="reservation-field">
                        <span>Kota / Kecamatan</span>
                        <input
                          className="reservation-input"
                          type="text"
                          maxLength={100}
                          autoComplete="address-level2"
                          value={buyer.city}
                          onChange={event =>
                            setBuyer(current => ({ ...current, city: event.target.value }))
                          }
                          placeholder="Contoh: Surabaya, Gubeng"
                        />
                      </label>
                      <label className="reservation-field">
                        <span>Alamat lengkap</span>
                        <textarea
                          className="reservation-input reservation-textarea"
                          maxLength={300}
                          autoComplete="street-address"
                          value={buyer.address}
                          onChange={event =>
                            setBuyer(current => ({ ...current, address: event.target.value }))
                          }
                          placeholder="Nama jalan, nomor rumah, patokan..."
                          rows={3}
                        />
                      </label>
                    </div>

                    <label className="reservation-vip">
                      <input
                        type="checkbox"
                        checked={buyer.isVip}
                        onChange={event =>
                          setBuyer(current => ({ ...current, isVip: event.target.checked }))
                        }
                      />
                      <span>
                        Terdaftar di VIP Waiting List <em>(Early-Bird Privilege)</em>
                      </span>
                    </label>

                    <div className="form-honeypot" aria-hidden="true">
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={buyer.website}
                        onChange={event =>
                          setBuyer(current => ({ ...current, website: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="reservation-total">
                    <div>
                      <span>Total {unitCount} karya</span>
                      <strong>{totalAmount > 0 ? formatHarga(String(totalAmount)) : "Rp —"}</strong>
                    </div>
                    <div className="reservation-dp">
                      <span>DP 50% manual</span>
                      <strong>{dpAmount > 0 ? formatHarga(String(dpAmount)) : "Rp —"}</strong>
                    </div>
                  </div>

                  <p className="reservation-payment-note">
                    Tidak ada pembayaran di halaman ini. Setelah pre-order dikirim,
                    atelier akan mengonfirmasi ketersediaan dan instruksi DP 50%
                    melalui WhatsApp.
                  </p>

                  <button
                    type="submit"
                    className="reservation-primary-btn"
                    disabled={submitting || validItems.length === 0}
                  >
                    {submitting ? "Mengirim pre-order..." : "Kirim Pre-Order →"}
                  </button>

                  <p className="reservation-summary-note">
                    Dengan mengirim, Anda akan diarahkan untuk melanjutkan konfirmasi
                    melalui WhatsApp.
                  </p>
                </aside>
              </div>
            </form>
          )}
        </div>

        <div className={`fm-toast${toastVisible ? " show" : ""}`} role="status">
          {toastMsg}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
