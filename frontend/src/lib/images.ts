// Utilitas pemrosesan gambar: semua URL public Supabase Storage
// diteruskan ke Image Transform CDN (WebP/AVIF via format=auto) agar
// browser tidak menerima gambar asli berukuran besar. URL eksternal
// non-storage tidak bisa diubah-ubah muatannya — disarankan memakai
// Supabase Storage (lihat tombol unggah di panel admin).

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

// Branding lebar tetap di HTML attribute sebagai petunjuk layout.
// CDN hanya mengirim versi yang dipotong/diubah sesuai konteks.
export function productImageUrl(url: string, size: ProductImageSize = "thumb"): string {
  if (!url || !isSupabaseStorageUrl(url)) return url;
  // URL yang sudah memuat parameter transform (atau sudah di-optimasi)
  // dikembalikan apa adanya, hindari parameter ganda.
  if (/([?&])width=/.test(url)) return url;
  const opts =
    size === "large"
      ? { width: 1200, height: 1200, quality: 85 }
      : { width: 600, height: 600, quality: 80 };
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=${opts.width}&height=${opts.height}&resize=cover&format=auto&quality=${opts.quality}`;
}