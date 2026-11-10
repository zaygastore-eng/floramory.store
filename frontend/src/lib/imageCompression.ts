// Kompresi foto sisi klien sebelum upload ke Supabase Storage.
//
// Foto kamera ponsel modern sering berukuran 4.000–8.000 px dan 5–12 MB.
// Tampilan polaroid digital di vault hanya membutuhkan sisi terpanjang
// sekitar 1.600 px, sehingga kompresi di browser menghemat kuota pelanggan,
// mempercepat upload, dan mengurangi beban storage/CDN.
//
// Tidak ada dependency tambahan: memakai Canvas API bawaan browser.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
// Foto kecil tidak perlu diproses ulang.
const SKIP_BELOW_BYTES = 450 * 1024;
// Jika hasil kompresi tidak lebih kecil, pertahankan berkas asli.
const MIN_SAVING_RATIO = 0.92;

export interface CompressedImageResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  didCompress: boolean;
}

function fallbackResult(file: File): CompressedImageResult {
  return {
    file,
    originalBytes: file.size,
    compressedBytes: file.size,
    width: 0,
    height: 0,
    didCompress: false,
  };
}

function renameAsJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "vault-photo";
  return `${base}.jpg`;
}

async function loadImageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari lama / format tertentu bisa gagal di createImageBitmap.
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca berkas gambar."));
    };
    image.src = objectUrl;
  });
}

function closeSource(source: ImageBitmap | HTMLImageElement): void {
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });
}

/**
 * Kompres foto menjadi JPEG dengan sisi terpanjang maksimal 1600 px.
 * Selalu resolve (tidak pernah reject): jika gagal, berkas asli dikembalikan
 * agar proses upload tetap berjalan.
 */
export async function compressVaultPhoto(file: File): Promise<CompressedImageResult> {
  const fallback = fallbackResult(file);

  if (!file.type.startsWith("image/") || file.size <= SKIP_BELOW_BYTES) {
    return fallback;
  }

  let source: ImageBitmap | HTMLImageElement | null = null;
  try {
    source = await loadImageSource(file);
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    if (!sourceWidth || !sourceHeight) return fallback;

    const longestSide = Math.max(sourceWidth, sourceHeight);
    const scale = Math.min(1, MAX_DIMENSION / longestSide);

    // Sudah cukup kecil dan bukan berkas besar: tidak perlu encode ulang.
    if (scale >= 1 && file.size <= 1.2 * 1024 * 1024) {
      return { ...fallback, width: sourceWidth, height: sourceHeight };
    }

    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return fallback;

    // Latar putih agar PNG transparan tidak menjadi hitam saat dikonversi ke JPEG.
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToJpeg(canvas);
    if (!blob) {
      return { ...fallback, width: targetWidth, height: targetHeight };
    }

    // Hanya pakai hasil kompresi jika benar-benar lebih hemat.
    if (blob.size >= file.size * MIN_SAVING_RATIO) {
      return {
        ...fallback,
        width: targetWidth,
        height: targetHeight,
      };
    }

    return {
      file: new File([blob], renameAsJpeg(file.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      }),
      originalBytes: file.size,
      compressedBytes: blob.size,
      width: targetWidth,
      height: targetHeight,
      didCompress: true,
    };
  } catch {
    return fallback;
  } finally {
    if (source) closeSource(source);
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
