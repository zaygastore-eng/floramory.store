import { useEffect, useState, type ReactNode } from "react";
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src.startsWith("http") || failed) return <>{fallback}</>;

  return (
    <img
      className={className}
      src={productImageUrl(src, size)}
      alt={alt}
      decoding="async"
      loading={loading}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}