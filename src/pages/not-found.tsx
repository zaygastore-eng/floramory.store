export default function NotFound() {
  return (
    <div className="error-screen">
      <div className="error-icon">🌾</div>
      <div className="error-title">Halaman tidak ditemukan</div>
      <p className="error-msg">Halaman yang Anda cari tidak ada.</p>
      <br />
      <a href="/" style={{ fontSize: "0.85rem", color: "var(--sage)", textDecoration: "none" }}>
        ← Kembali ke beranda
      </a>
    </div>
  );
}
