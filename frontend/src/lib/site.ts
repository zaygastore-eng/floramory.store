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

export function formatBespokeCommissionWhatsApp(params: {
  customerName: string;
  collection: string;
  initial: string;
  colorPalette: string;
  notes?: string;
  isVip?: boolean;
}): string {
  return `Halo Concierge A Chapter, saya ingin menyegel pre-order:

• Nama Pemesan: ${params.customerName.trim()}
• Pilihan Koleksi: ${params.collection.trim()}
• Inisial Pilihan: ${params.initial.trim()}
• Nuansa Warna: ${params.colorPalette.trim()}
• Catatan Khusus / Ucapan: ${params.notes?.trim() || "-"}
• Status VIP Waiting List: ${params.isVip ? "Ya (Klaim Early-Bird Privilege)" : "Belum Terdaftar"}

Mohon verifikasi ketersediaan slot, nomor registrasi arsip, dan langkah pengisian brankas memori saya. Terima kasih.`;
}
