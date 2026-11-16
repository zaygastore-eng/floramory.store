export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
export const PRODUCTION_SITE_URL = String(
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://www.achapter.my.id"
).replace(/\/+$/, "");

export function assetUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}

export function pageUrl(path = "/"): string {
  if (!path || path === "/") return BASE_PATH || "/";
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}

export function logoUrl(): string {
  return assetUrl("/a-chapter-logo.png");
}

export function normalizeWhatsApp(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8") && !digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

export function formatHarga(raw: string): string {
  if (!raw) return "";

  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  // Nilai yang sudah berupa label (mis. "Mulai Rp 1.850.000") dibiarkan.
  if (/[a-zA-Z]/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return trimmed;

  const amount = Number(digits);
  if (!Number.isSafeInteger(amount)) return trimmed;

  return `Rp${amount.toLocaleString("id-ID")}`;
}

export interface GroupCommissionWhatsAppItem {
  productName: string;
  qty: number;
  colorPalette: string;
  initial: string;
}

export function formatGroupCommissionWhatsApp(params: {
  customerName: string;
  groupNumber?: string;
  items: GroupCommissionWhatsAppItem[];
  totalAmount?: number;
  dpAmount?: number;
  isVip?: boolean;
  shippingCity?: string;
  shippingAddress?: string;
}): string {
  const lines = params.items.map((item, index) => {
    const qtyLabel = item.qty > 1 ? `${item.qty}× ` : "";
    const initial = item.initial.trim() ? ` (Inisial: ${item.initial.trim()})` : "";
    return `${index + 1}. ${qtyLabel}${item.productName.trim()} — ${item.colorPalette.trim()}${initial}`;
  });

  const totalKarya = params.items.reduce((sum, item) => sum + Math.max(1, item.qty), 0);
  const summary: string[] = [
    `Halo Concierge A Chapter, saya baru mengirim pre-order:`,
    "",
    `• Nama Pemesan: ${params.customerName.trim()}`,
  ];

  if (params.groupNumber) {
    summary.push(`• Nomor Pre-Order: ${params.groupNumber}`);
  }

  summary.push(`• Jumlah Karya: ${totalKarya}`, "", "RINCIAN KARYA", ...lines, "");

  if (typeof params.totalAmount === "number" && params.totalAmount > 0) {
    summary.push(`• Total: Rp ${params.totalAmount.toLocaleString("id-ID")}`);
  }
  if (typeof params.dpAmount === "number" && params.dpAmount > 0) {
    summary.push(`• DP 50% (manual): Rp ${params.dpAmount.toLocaleString("id-ID")}`);
  }

  const city = params.shippingCity?.trim();
  const address = params.shippingAddress?.trim();
  if (city) summary.push(`• Kota/Kecamatan: ${city}`);
  if (address) summary.push(`• Alamat: ${address}`);

  summary.push(
    `• Status VIP Waiting List: ${params.isVip ? "Ya (Klaim Early-Bird Privilege)" : "Belum Terdaftar"}`,
    "",
    "Mohon konfirmasi ketersediaan, estimasi pengerjaan, ongkos kirim, dan instruksi pembayaran DP 50% secara manual. Terima kasih."
  );

  return summary.join("\n");
}
