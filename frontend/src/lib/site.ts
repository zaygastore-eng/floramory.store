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
  if (!/^\d+$/.test(raw)) return raw;

  const normalized = raw.replace(/^0+(?=\d)/, "");
  return `Rp${normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
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
}): string {
  const lines = params.items.map((item, index) => {
    const qtyLabel = item.qty > 1 ? `${item.qty}× ` : "";
    const initial = item.initial.trim() ? ` (Inisial: ${item.initial.trim()})` : "";
    return `${index + 1}. ${qtyLabel}${item.productName.trim()} — ${item.colorPalette.trim()}${initial}`;
  });

  const totalKarya = params.items.reduce((sum, item) => sum + Math.max(1, item.qty), 0);
  const summary: string[] = [
    `Halo Concierge A Chapter, saya ingin menyegel pre-order:`,
    "",
    `• Nama Pemesan: ${params.customerName.trim()}`,
  ];

  if (params.groupNumber) {
    summary.push(`• Nomor Reservasi: ${params.groupNumber}`);
  }

  summary.push(`• Jumlah Karya: ${totalKarya}`, "", "RINCIAN KARYA", ...lines, "");

  if (typeof params.totalAmount === "number" && params.totalAmount > 0) {
    summary.push(`• Total: Rp ${params.totalAmount.toLocaleString("id-ID")}`);
  }
  if (typeof params.dpAmount === "number" && params.dpAmount > 0) {
    summary.push(`• DP 50%: Rp ${params.dpAmount.toLocaleString("id-ID")}`);
  }

  summary.push(
    `• Status VIP Waiting List: ${params.isVip ? "Ya (Klaim Early-Bird Privilege)" : "Belum Terdaftar"}`,
    "",
    "Mohon verifikasi ketersediaan slot, nomor registrasi arsip, dan langkah pengisian brankas memori saya. Terima kasih."
  );

  return summary.join("\n");
}
