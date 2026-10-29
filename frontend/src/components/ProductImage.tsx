import { useState, type ReactNode } from "react";
import { productImageUrl, type ProductImageSize } from "@/lib/images";

interface ProductImageProps {
  src: string;
  alt: string;
  size: ProductImageSize;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  fallback: ReactNode;
}

// Gambar produk dengan fallback: jika URL tidak diisi / bukan http
// atau gagal dimuat (URL rusak, CDN mati), tampilkan konten fallback
// (placeholder emoji) alih-alih area kosong.
export default function ProductImage({
  src,
  alt,
  size,
  className,
  width,
  height,
  loading,
  fallback,
}: ProductImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src.startsWith("http") || failedSrc === src) return <>{fallback}</>;
  const imageSrc = productImageUrl(src, size);
  const loaded = loadedSrc === imageSrc;

  return (
    <>
      {!loaded && <div className="img-skeleton" aria-hidden="true" />}
      <img
        className={className}
        src={imageSrc}
        alt={alt}
        decoding="async"
        loading={loading}
        width={width}
        height={height}
        onLoad={() => setLoadedSrc(imageSrc)}
        onError={() => setFailedSrc(src)}
      />
    </>
  );
}