// Utilitas URL gambar produk.

export type ProductImageSize = "thumb" | "large";

const STORAGE_PUBLIC_PATTERN = /\/storage\/v1\/object\/public\//;
export function isSupabaseStorageUrl(url: string): boolean {
  return STORAGE_PUBLIC_PATTERN.test(url);
}

export const IMAGE_URL_MAX_LENGTH = 2048;

// Validasi URL gambar yang diketik admin secara manual (kolom URL
// foto). Mengembalikan pesan error, atau null jika valid/opsional.
// Hanya http/https yang diterima — skema lain (javascript:, data:,
// file:) ditolak. Kualitas/kecepatan aktual tidak bisa diverifikasi dari
// URL; untuk itu admin disarankan memakai tombol unggah (storage).
export function validateImageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > IMAGE_URL_MAX_LENGTH) {
    return `URL terlalu panjang (maks. ${IMAGE_URL_MAX_LENGTH} karakter).`;
  }
  if (!/^https?:\/\//i.test(value)) {
    return "URL harus diawali http:// atau https://.";
  }
  try {
    const parsed = new URL(value);
    if (!parsed.hostname) return "URL tidak valid.";
  } catch {
    return "URL tidak valid.";
  }
  return null;
}

export function productImageUrl(url: string, _size: ProductImageSize = "thumb"): string {
  if (!url) return "";
  return url.trim();
}