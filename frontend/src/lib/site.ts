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

export function createWhatsAppOrderMessage(productName?: string, orderNumber?: string): string {
  if (orderNumber) {
    return `Halo A Chapter, saya ingin konfirmasi pesanan #${orderNumber}${productName ? ` (${productName})` : ""}.`;
  }
  return productName
    ? `Halo A Chapter, saya tertarik untuk memesan karya botani ${productName}.`
    : "Halo A Chapter, saya ingin berkonsultasi mengenai pemesanan kado botani & memory vault.";
}

export function formatOrderReceiptWhatsApp(params: {
  orderNumber: string;
  customerName: string;
  productName: string;
  totalPrice?: number | string;
  dpAmount?: number | string;
  recipientName?: string;
}): string {
  const total = typeof params.totalPrice === "number" ? formatHarga(String(params.totalPrice)) : (params.totalPrice ? formatHarga(String(params.totalPrice).replace(/[^\d]/g, "")) : "0");
  const dp = typeof params.dpAmount === "number" ? formatHarga(String(params.dpAmount)) : (params.dpAmount ? formatHarga(String(params.dpAmount).replace(/[^\d]/g, "")) : "0");

  return `Halo A Chapter Atelier, saya ingin konfirmasi pesanan:
• No. Arsip: #${params.orderNumber}
• Pemesan: ${params.customerName}
• Karya: ${params.productName}
• Total: ${total} (DP 50%: ${dp})
• Penerima Kado: ${params.recipientName || "-"}

Mohon informasi nomor rekening resmi atelier untuk pelunasan DP 50%. Terima kasih.`;
}

export function formatBespokeCommissionWhatsApp(params: {
  customerName: string;
  productName: string;
  moment?: string;
  notes?: string;
}): string {
  return `Halo Concierge A Chapter, saya ingin memesan karya botani abadi:
• Nama Pemesan: ${params.customerName.trim()}
• Pilihan Koleksi: ${params.productName.trim()}
• Momen: ${params.moment?.trim() || "-"}
• Catatan Khusus: ${params.notes?.trim() || "-"}

Mohon info ketersediaan slot dan langkah pengunggahan brankas memori berikutnya. Terima kasih.`;
}

export function formatVaultSetupInvitationWhatsApp(params: {
  orderNumber: string;
  customerName: string;
  tokenOrOrderId: string;
}): string {
  return `Terima kasih Kak ${params.customerName}, pembayaran DP 50% untuk pesanan #${params.orderNumber} telah kami terima.

Bunga pilihan Anda saat ini sedang memasuki tahap dehidrasi laboratorium.
Silakan lengkapi rekaman suara, foto polaroid, dan surat rahasia melalui link privat atelier berikut:
🔗 https://www.achapter.my.id/vault-setup?token=${params.tokenOrOrderId}

Karya akan mulai dicasting setelah memori selesai Anda susun.`;
}

export function formatGiftRecipientDeliverySurpriseWhatsApp(params: {
  recipientName: string;
  senderName: string;
}): string {
  return `Halo Kak ${params.recipientName}, sebuah kiriman karya botani abadi "A Chapter" telah tiba untuk Kakak dari seseorang yang spesial: ${params.senderName}.

Dekatkan kamera ponsel Kakak ke micro-chip yang tertanam di dasar bingkai untuk membuka babak kenangan rahasia yang tersimpan di dalamnya. ✨`;
}
