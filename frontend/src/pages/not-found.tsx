import BrandLogo from "@/components/BrandLogo";
import { pageUrl } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="error-screen">
      <div className="error-icon">🌾</div>
      <div className="error-title">Halaman tidak ditemukan</div>
      <p className="error-msg">Halaman yang Anda cari tidak ada.</p>
      <br />
      <a href={pageUrl("/")} className="error-link">
        ← Kembali ke beranda
      </a>
    </div>
  );
}
