import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock, Lock, Search, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  fetchWhatsAppNumber,
  lookupOrderStatus,
  type OrderStatusLookupResult,
} from "@/lib/api";
import { applyPageMeta } from "@/lib/seo";
import { formatHarga, normalizeWhatsApp } from "@/lib/site";
import { dpStatusLabel } from "@/lib/vaultDesign";

const STATUS_STEPS = [
  { key: "new", label: "Pesanan Diterima" },
  { key: "dp_verified", label: "DP 50% Terverifikasi" },
  { key: "in_production", label: "Produksi Atelier" },
  { key: "completed", label: "Selesai & Dikirim" },
] as const;

function stepIndexForStatus(status: string): number {
  const s = status.toLowerCase();
  if (s === "completed" || s === "paid") return 3;
  if (s === "in_production" || s === "in_progress") return 2;
  if (s === "dp_verified") return 1;
  return 0;
}

export default function OrderTracking() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OrderStatusLookupResult | null>(null);
  const [waNumber, setWaNumber] = useState("6285235242425");

  useEffect(() => {
    window.scrollTo(0, 0);
    applyPageMeta({
      title: "Cek Status Pesanan — A Chapter",
      description:
        "Pantau status pre-order karya botani abadi dan akses ulang tautan Memory Vault Setup Anda.",
      path: "/cek-pesanan",
    });

    fetchWhatsAppNumber()
      .then((num) => setWaNumber(normalizeWhatsApp(num) || "6285235242425"))
      .catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("no") || params.get("order") || "";
    if (ref) setOrderNumber(ref.toUpperCase());
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanOrder = orderNumber.trim().toUpperCase().replace(/^#/, "");
    const cleanLast4 = phoneLast4.replace(/\D/g, "").slice(-4);

    if (!cleanOrder || cleanLast4.length !== 4) {
      setError("Isi nomor pesanan (contoh: GRP-...) dan 4 digit terakhir nomor WhatsApp Anda.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await lookupOrderStatus(cleanOrder, cleanLast4);
      if (!res.ok || !res.summary) {
        setError(res.message || "Pesanan tidak ditemukan atau 4 digit WhatsApp tidak cocok.");
        return;
      }
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memeriksa status pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const summary = result?.summary;
  const items = result?.items || [];
  const isCancelled = summary?.status === "cancelled";
  const currentStep = summary ? stepIndexForStatus(summary.status) : 0;

  return (
    <div className="subpage-wrapper public-v2 reservation-page">
      <SiteHeader />

      <main className="subpage-main">
        <section className="reservation-hero">
          <span className="reservation-eyebrow">A CHAPTER · ORDER STATUS</span>
          <h1>Cek Progres Pesanan Anda</h1>
          <p>
            Masukkan nomor pesanan (mis. <strong>GRP-...</strong> atau <strong>ORD-...</strong>) dan
            4 digit terakhir nomor WhatsApp yang Anda gunakan saat memesan.
          </p>
        </section>

        <div className="reservation-container" style={{ maxWidth: "760px" }}>
          <form className="vault-setup-card" onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <div>
                <label className="vault-file-label" htmlFor="track-order-number">
                  Nomor Pesanan
                </label>
                <input
                  id="track-order-number"
                  type="text"
                  className="admin-input"
                  placeholder="Contoh: GRP-A1B2C3D4E5"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div>
                <label className="vault-file-label" htmlFor="track-phone-last4">
                  4 Digit Terakhir WhatsApp
                </label>
                <input
                  id="track-phone-last4"
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  className="admin-input"
                  placeholder="Contoh: 2425"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="vault-setup-error" role="alert" style={{ marginTop: "1rem" }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <button
                type="submit"
                className="reservation-primary-btn"
                disabled={loading}
                style={{ minHeight: "46px", paddingInline: "1.5rem" }}
              >
                <Search size={16} aria-hidden="true" />
                <span>{loading ? "Memeriksa..." : "Cek Status Pesanan"}</span>
              </button>
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Halo Concierge A Chapter, saya ingin menanyakan progres pesanan saya.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="reservation-secondary-btn"
              >
                Tanya Concierge via WhatsApp
              </a>
            </div>
          </form>

          {summary && (
            <div className="vault-setup-card" style={{ marginTop: "1.5rem" }} role="status">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(83,27,33,0.1)" }}>
                <div>
                  <span className="meta-bar-tag">NOMOR PESANAN</span>
                  <strong className="meta-bar-id">#{summary.group_number}</strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "#756C64" }}>
                    Pemesan: <strong>{summary.customer_name}</strong> · {summary.item_count} karya
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="meta-bar-tag">STATUS SAAT INI</span>
                  <strong style={{ color: isCancelled ? "#b71c1c" : "#531B21", fontSize: "0.95rem" }}>
                    {dpStatusLabel(summary.status)}
                  </strong>
                  {summary.total_amount > 0 && (
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#756C64" }}>
                      Total {formatHarga(String(summary.total_amount))} · DP {formatHarga(String(summary.dp_amount))}
                    </p>
                  )}
                </div>
              </div>

              {!isCancelled && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.65rem", margin: "1.25rem 0" }}>
                  {STATUS_STEPS.map((step, idx) => {
                    const done = idx <= currentStep;
                    return (
                      <div
                        key={step.key}
                        style={{
                          padding: "0.7rem 0.75rem",
                          borderRadius: "8px",
                          border: done ? "1.5px solid #531B21" : "1px solid rgba(35,43,56,0.12)",
                          background: done ? "#FFF8EE" : "#FAF7F2",
                          color: done ? "#531B21" : "#8A746A",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.45rem",
                          fontSize: "0.78rem",
                          fontWeight: done ? 700 : 500,
                        }}
                      >
                        {done ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {items.map((item) => (
                  <div
                    key={item.order_number}
                    style={{
                      padding: "0.9rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(83,27,33,0.14)",
                      background: "#FDFBF7",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#232B38", fontSize: "0.95rem" }}>
                        {item.product_name || "Karya A Chapter"}
                      </strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#756C64" }}>
                        ID Karya: {item.order_number}
                        {item.nuansa ? ` · Nuansa: ${item.nuansa}` : ""}
                        {item.inisial ? ` · Inisial: ${item.inisial}` : ""}
                      </p>
                    </div>

                    <div>
                      {item.vault_locked ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: 600, color: "#2f6b47" }}>
                          <Lock size={14} /> Memory Vault sudah dikunci
                        </span>
                      ) : item.vault_setup_url ? (
                        <Link
                          href={item.vault_setup_url}
                          className="reservation-primary-btn"
                          style={{ minHeight: "38px", padding: "0.45rem 1rem", fontSize: "0.76rem" }}
                        >
                          <Sparkles size={14} aria-hidden="true" />
                          <span>Lengkapi Memory Vault →</span>
                        </Link>
                      ) : (
                        <span style={{ fontSize: "0.78rem", color: "#8A746A" }}>
                          Menunggu verifikasi DP 50%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
