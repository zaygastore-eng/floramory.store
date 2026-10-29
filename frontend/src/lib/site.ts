export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  return assetUrl("/floramory-logo.png");
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
