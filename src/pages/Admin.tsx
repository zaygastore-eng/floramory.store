import { useState, useEffect, useRef } from "react";
import { QRCodeCanvas as QRCode } from "qrcode.react";

const BASE_URL_KEY = "fm_base_url";
const WA_KEY = "fm_wa";
const AUTH_KEY = "fm_admin_auth";
const ADMIN_PASSWORD = "floramory2026";

const TIER_OPTIONS = [
  { value: "lite", label: "Floramory Lite" },
  { value: "signature", label: "Floramory Signature" },
  { value: "home", label: "Floramory Home" },
];

interface FormState {
  id: string; tier: string; nama: string; harga: string; bunga: string;
  deskripsi: string; bahan: string; ukuran: string;
  namaPembeli: string; dari: string; pesan: string; foto: string;
}

const EMPTY: FormState = { id: "", tier: "", nama: "", harga: "", bunga: "", deskripsi: "", bahan: "", ukuran: "", namaPembeli: "", dari: "", pesan: "", foto: "" };

function getAutoBaseUrl(): string {
  const { protocol, host, pathname } = window.location;
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const origin = `${protocol}//${host}`;
  return base ? `${origin}${base}` : origin;
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setTimeout(() => setError(false), 3000);
      setPw("");
    }
  };

  return (
    <div className="login-screen">
      <div className={`login-card${shake ? " shake" : ""}`}>
        <div className="login-logo">Flora<span>mory</span></div>
        <div className="login-subtitle">Admin Panel</div>
        <div className="login-icon">🔐</div>
        <form onSubmit={submit} style={{ width: "100%" }}>
          <div className="login-input-wrap">
            <input
              className={`login-input${error ? " login-input-error" : ""}`}
              type={show ? "text" : "password"}
              placeholder="Masukkan password admin"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(false); }}
              autoFocus
            />
            <button type="button" className="login-eye" onClick={() => setShow(s => !s)}>
              {show ? "🙈" : "👁"}
            </button>
          </div>
          {error && <div className="login-error">Password salah. Coba lagi.</div>}
          <button type="submit" className="login-btn">Masuk →</button>
        </form>
        <p className="login-hint">Password default: <code>floramory2026</code></p>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [waNum, setWaNum] = useState("");
  const [configSaved, setConfigSaved] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const saved = localStorage.getItem(BASE_URL_KEY);
    const auto = getAutoBaseUrl();
    setBaseUrl(saved || auto);
    if (!saved) {
      localStorage.setItem(BASE_URL_KEY, auto);
    }
    setWaNum(localStorage.getItem(WA_KEY) || "");
  }, [authed]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const saveConfig = () => {
    const clean = baseUrl.trim().replace(/\/$/, "");
    localStorage.setItem(BASE_URL_KEY, clean);
    localStorage.setItem(WA_KEY, waNum.trim());
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
    showToast("Konfigurasi tersimpan ✓");
  };

  const useAutoUrl = () => {
    const auto = getAutoBaseUrl();
    setBaseUrl(auto);
    localStorage.setItem(BASE_URL_KEY, auto);
    showToast("Base URL diambil otomatis ✓");
  };

  const getPreviewUrl = () => {
    const b = (localStorage.getItem(BASE_URL_KEY) || baseUrl).trim().replace(/\/$/, "");
    if (!form.id.trim() || !b) return null;
    return `${b}/produk?id=${form.id.trim()}`;
  };

  const canGenerate = !!form.id.trim() && !!((localStorage.getItem(BASE_URL_KEY) || baseUrl).trim());

  const generateQR = () => {
    const url = getPreviewUrl();
    if (!url) { showToast("⚠ Isi ID Produk terlebih dahulu"); return; }
    setGeneratedUrl(url);
    setQrVisible(true);
    showToast("QR Code berhasil dibuat! ✓");
  };

  const resetForm = () => {
    setForm(EMPTY);
    setQrVisible(false);
    setGeneratedUrl("");
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  };

  const copyUrl = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => showToast("URL disalin ke clipboard ✓"));
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) { showToast("Gagal download — canvas tidak tersedia"); return; }
    const printCanvas = document.createElement("canvas");
    printCanvas.width = 300; printCanvas.height = 340;
    const ctx = printCanvas.getContext("2d")!;
    ctx.fillStyle = "#faf7f2";
    if (ctx.roundRect) { ctx.roundRect(0, 0, 300, 340, 16); ctx.fill(); }
    else { ctx.fillRect(0, 0, 300, 340); }
    ctx.drawImage(canvas, 50, 30, 200, 200);
    ctx.fillStyle = "#2d2820";
    ctx.font = "bold 16px serif";
    ctx.textAlign = "center";
    ctx.fillText("Floramory", 150, 256);
    ctx.fillStyle = "#7a9b76";
    ctx.font = "11px sans-serif";
    ctx.fillText("Memory Vault", 150, 274);
    ctx.fillStyle = "#7a6e65";
    ctx.font = "10px monospace";
    ctx.fillText("#" + (form.id || "—"), 150, 294);
    ctx.fillStyle = "#c8dbc5";
    ctx.font = "9px sans-serif";
    ctx.fillText("Scan untuk info produk & pesan personal", 150, 316);
    const link = document.createElement("a");
    link.download = `floramory-qr-${form.id || "produk"}.png`;
    link.href = printCanvas.toDataURL("image/png");
    link.click();
    showToast("QR Code berhasil didownload ✓");
  };

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  const previewUrl = getPreviewUrl();

  return (
    <div style={{ background: "#f0ede8", minHeight: "100vh" }}>
      <nav className="admin-nav">
        <div className="nav-logo">Flora<span>mory</span>{" "}
          <span style={{ fontSize: "0.7rem", opacity: 0.5, fontFamily: "'DM Sans'", fontWeight: 300, marginLeft: 6 }}>Admin Panel</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="admin-nav-right">QR Generator</div>
          <button onClick={logout} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.5)", borderRadius: "20px", padding: "5px 14px",
            fontSize: "0.72rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.05em", textTransform: "uppercase"
          }}>Keluar</button>
        </div>
      </nav>

      <div className="admin-body">
        {/* CONFIG CARD */}
        <div className="guide-card" style={{ marginBottom: "1.5rem" }}>
          <div className="guide-header">⚙ Konfigurasi</div>
          <div className="guide-body">
            <div className="admin-form-row">
              <div className="admin-form-group" style={{ marginBottom: 0 }}>
                <label className="admin-form-label">Base URL website</label>
                <div className="settings-input-group">
                  <input className="admin-form-input" type="text" placeholder="https://namadomain.replit.app"
                    value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
                  <button className="btn-save-config" onClick={useAutoUrl} title="Gunakan URL website saat ini">
                    Auto
                  </button>
                  <button className="btn-save-config" onClick={saveConfig}>Simpan</button>
                </div>
                <div className={`config-saved${configSaved ? " show" : ""}`}>✓ Tersimpan</div>
                <p className="form-hint">
                  Klik <strong>Auto</strong> untuk menggunakan URL website ini secara otomatis, atau isi manual setelah deploy.
                </p>
              </div>
              <div className="admin-form-group" style={{ marginBottom: 0 }}>
                <label className="admin-form-label">Nomor WhatsApp</label>
                <div className="settings-input-group">
                  <input className="admin-form-input" type="text" placeholder="6281234567890"
                    value={waNum} onChange={e => setWaNum(e.target.value)} />
                  <button className="btn-save-config" onClick={saveConfig}>Simpan</button>
                </div>
                <p className="form-hint">Format: 628xxx (tanpa + atau spasi).</p>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-grid">
          {/* LEFT: FORM */}
          <div>
            <div className="card">
              <div className="card-header">
                <div className="card-num">1</div>
                <h2>Data produk</h2>
              </div>
              <div className="card-body">
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-form-label">ID Produk <span className="required-star">*</span></label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: ROSA-001"
                      value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
                    <p className="form-hint">Kode unik per produk. Gunakan format: JENIS-NOMOR</p>
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Lini Produk <span className="required-star">*</span></label>
                    <select className="admin-form-select" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
                      <option value="">— Pilih tier —</option>
                      {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Nama Produk <span className="required-star">*</span></label>
                  <input className="admin-form-input" type="text" placeholder="Contoh: Cincin Mawar Rosa Eternal"
                    value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-form-label">Harga <span className="required-star">*</span></label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: Rp 55.000"
                      value={form.harga} onChange={e => setForm(f => ({ ...f, harga: e.target.value }))} />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Jenis Bunga</label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: Rosa damascena"
                      value={form.bunga} onChange={e => setForm(f => ({ ...f, bunga: e.target.value }))} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Deskripsi Produk</label>
                  <textarea className="admin-form-textarea" placeholder="Ceritakan tentang produk ini..."
                    value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-form-label">Bahan</label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: Epoxy resin + stainless steel"
                      value={form.bahan} onChange={e => setForm(f => ({ ...f, bahan: e.target.value }))} />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Ukuran</label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: Diameter 17mm"
                      value={form.ukuran} onChange={e => setForm(f => ({ ...f, ukuran: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-num">2</div>
                <h2>Memory Vault — pesan personal</h2>
              </div>
              <div className="card-body">
                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-form-label">Nama Pembeli / Penerima</label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: Nabila Putri"
                      value={form.namaPembeli} onChange={e => setForm(f => ({ ...f, namaPembeli: e.target.value }))} />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Dari (pengirim)</label>
                    <input className="admin-form-input" type="text" placeholder="Contoh: Keluarga Putri"
                      value={form.dari} onChange={e => setForm(f => ({ ...f, dari: e.target.value }))} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Pesan Personal</label>
                  <textarea className="admin-form-textarea" style={{ minHeight: "100px" }}
                    placeholder="Tulis pesan yang akan muncul saat penerima scan QR produk ini..."
                    value={form.pesan} onChange={e => setForm(f => ({ ...f, pesan: e.target.value }))} />
                  <p className="form-hint">Kosongkan jika tidak ada pesan personal.</p>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">URL Foto Produk</label>
                  <input className="admin-form-input" type="text" placeholder="https://drive.google.com/uc?id=..."
                    value={form.foto} onChange={e => setForm(f => ({ ...f, foto: e.target.value }))} />
                  <p className="form-hint">Opsional. Upload ke Google Drive → Share → Anyone with link, lalu ubah ke format: https://drive.google.com/uc?id=FILE_ID</p>
                </div>
              </div>
            </div>

            <div className="url-preview">
              <strong>URL QR Code:</strong><br />
              {previewUrl
                ? <strong style={{ color: "var(--sage)" }}>{previewUrl}</strong>
                : <span>— isi ID Produk untuk melihat URL —</span>}
            </div>

            <button className="btn-generate" onClick={generateQR} disabled={!canGenerate}>
              Generate QR Code →
            </button>
            <button className="btn-reset" onClick={resetForm}>Bersihkan form</button>
          </div>

          {/* RIGHT: QR + GUIDE */}
          <div>
            {qrVisible && (
              <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div className="card-header">
                  <div className="card-num">✓</div>
                  <h2>QR Code siap diprint</h2>
                </div>
                <div className="card-body">
                  <div className="qr-result-box">
                    <div ref={qrRef} style={{ display: "inline-block", marginBottom: 12 }}>
                      <QRCode
                        value={generatedUrl}
                        size={200}
                        fgColor="#2d2820"
                        bgColor="#faf7f2"
                        level="M"
                      />
                    </div>
                    <div className="qr-product-name-label">{form.nama || form.id}</div>
                    <div className="qr-product-id-label">#{form.id}</div>
                  </div>
                  <div className="qr-url-box">{generatedUrl}</div>
                  <div className="qr-actions">
                    <button className="btn-download" onClick={downloadQR}>⬇ Download PNG</button>
                    <button className="btn-copy-url" onClick={copyUrl}>⎘ Salin URL</button>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5, textAlign: "center" }}>
                    Print QR ini dan tempel sebagai stiker pada produk. Ukuran minimal stiker: 2×2 cm.
                  </p>
                </div>
              </div>
            )}

            <div className="guide-card">
              <div className="guide-header">📊 Cara pakai Google Sheets</div>
              <div className="guide-body">
                {[
                  { n: 1, t: <>Data terhubung otomatis ke Google Sheets via URL CSV. Website otomatis mengambil data setiap kali diakses.</> },
                  { n: 2, t: <>Tambah produk baru: cukup <strong>tambah baris baru</strong> di Sheets. Website akan otomatis menampilkannya.</> },
                  { n: 3, t: <>Kolom wajib: <code className="step-code">id, nama_produk, tier, harga</code></> },
                  { n: 4, t: <>Hapus produk: hapus baris di Sheets. Tidak perlu update kode.</> },
                  { n: 5, t: <>Generate QR di sini → print stiker → tempel ke produk. URL QR otomatis sinkron dengan Sheets.</> },
                ].map(({ n, t }) => (
                  <div className="guide-step" key={n}>
                    <div className="step-num">{n}</div>
                    <div className="step-text">{t}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="guide-card">
              <div className="guide-header">📋 Struktur kolom Google Sheets</div>
              <div className="guide-body" style={{ padding: 0 }}>
                <table className="col-table">
                  <thead>
                    <tr><th>Kolom</th><th>Keterangan</th><th>Wajib?</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ["id", "Kode unik produk (ROSA-001)", true],
                      ["nama_produk", "Nama lengkap produk", true],
                      ["tier", "lite / signature / home", true],
                      ["harga", "Contoh: Rp 55.000", true],
                      ["bunga", "Nama spesies bunga", false],
                      ["deskripsi", "Deskripsi produk panjang", false],
                      ["bahan", "Material produk", false],
                      ["ukuran", "Dimensi produk", false],
                      ["nama_pembeli", "Nama penerima hadiah", false],
                      ["dari", "Nama pengirim", false],
                      ["pesan_personal", "Isi Memory Vault", false],
                      ["foto_url", "Link foto dari Google Drive", false],
                    ].map(([col, desc, req]) => (
                      <tr key={col as string}>
                        <td>{col as string}</td>
                        <td>{desc as string}</td>
                        <td className="required-col">{req ? "✓" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`admin-toast${toastVisible ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}
