import { useState, useEffect, useRef } from "react";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import {
  createProduct,
  deleteProduct,
  fetchManagedProducts,
  fetchPreOrders,
  fetchWhatsAppNumber,
  hasSupabaseConfig,
  hasSupabaseSession,
  signInAdmin,
  signOutAdmin,
  updatePreOrderStatus,
  updateWhatsAppNumber,
  updateProduct,
  type PreOrder,
  type Product,
} from "@/lib/sheets";

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
  namaPembeli: string; dari: string; pesan: string; fotoProduk: string; fotoQr: string;
}

const EMPTY: FormState = { id: "", tier: "", nama: "", harga: "", bunga: "", deskripsi: "", bahan: "", ukuran: "", namaPembeli: "", dari: "", pesan: "", fotoProduk: "", fotoQr: "" };

function productToForm(product: Product): FormState {
  return {
    id: product.id,
    tier: product.tier,
    nama: product.nama_produk,
    harga: product.harga,
    bunga: product.bunga,
    deskripsi: product.deskripsi,
    bahan: product.bahan,
    ukuran: product.ukuran,
    namaPembeli: product.nama_pembeli,
    dari: product.dari,
    pesan: product.pesan_personal,
    fotoProduk: product.foto_produk || product.foto_url,
    fotoQr: product.foto_qr,
  };
}

function getAutoBaseUrl(): string {
  const { protocol, host, pathname } = window.location;
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const origin = `${protocol}//${host}`;
  return base ? `${origin}${base}` : origin;
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const useSupabaseAuth = hasSupabaseConfig();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useSupabaseAuth) {
      setLoading(true);
      try {
        await signInAdmin(email.trim(), pw);
        onLogin();
      } catch (err) {
        setError(true);
        setErrorMsg(err instanceof Error ? err.message : "Login Supabase gagal");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onLogin();
    } else {
      setError(true);
      setErrorMsg("Password salah. Coba lagi.");
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
          {useSupabaseAuth && (
            <div className="login-input-wrap" style={{ marginBottom: 10 }}>
              <input
                className={`login-input${error ? " login-input-error" : ""}`}
                type="email"
                placeholder="Email admin Supabase"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(false); }}
                autoFocus
              />
            </div>
          )}
          <div className="login-input-wrap">
            <input
              className={`login-input${error ? " login-input-error" : ""}`}
              type={show ? "text" : "password"}
              placeholder={useSupabaseAuth ? "Password Supabase" : "Masukkan password admin"}
              value={pw}
              onChange={e => { setPw(e.target.value); setError(false); }}
              autoFocus={!useSupabaseAuth}
            />
            <button type="button" className="login-eye" onClick={() => setShow(s => !s)}>
              {show ? "🙈" : "👁"}
            </button>
          </div>
          {error && <div className="login-error">{errorMsg}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Masuk..." : "Masuk →"}
          </button>
        </form>
        <p className="login-hint">
          {useSupabaseAuth
            ? "Gunakan akun admin yang dibuat di Supabase Authentication."
            : <>Password default: <code>floramory2026</code></>}
        </p>
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
  const [savingProduct, setSavingProduct] = useState(false);
  const [managedProducts, setManagedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasSupabaseConfig()) {
      if (hasSupabaseSession()) setAuthed(true);
      return;
    }
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
    fetchWhatsAppNumber().then((value) => {
      if (value) {
        setWaNum(value);
        localStorage.setItem(WA_KEY, value);
      }
    });
  }, [authed]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const list = await fetchManagedProducts();
      setManagedProducts(list);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat produk");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPreOrders = async () => {
    setLoadingOrders(true);
    try {
      const list = await fetchPreOrders();
      setPreOrders(list);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat pre-order");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (authed) {
      void loadProducts();
      void loadPreOrders();
    }
  }, [authed]);

  const saveConfig = async () => {
    const clean = baseUrl.trim().replace(/\/$/, "");
    localStorage.setItem(BASE_URL_KEY, clean);
    localStorage.setItem(WA_KEY, waNum.trim());
    try {
      await updateWhatsAppNumber(waNum);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
      showToast("Konfigurasi tersimpan ✓");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nomor WA tersimpan lokal, tetapi gagal tersimpan ke Supabase");
    }
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

  const productFromForm = (): Product => ({
    id: form.id,
    nama_produk: form.nama,
    tier: form.tier,
    harga: form.harga,
    bunga: form.bunga,
    deskripsi: form.deskripsi,
    bahan: form.bahan,
    ukuran: form.ukuran,
    nama_pembeli: form.namaPembeli,
    dari: form.dari,
    pesan_personal: form.pesan,
    foto_produk: form.fotoProduk,
    foto_qr: form.fotoQr,
    foto_url: form.fotoProduk,
  });

  const generateQR = () => {
    const url = getPreviewUrl();
    if (!url) { showToast("⚠ Isi ID Produk terlebih dahulu"); return; }
    setGeneratedUrl(url);
    setQrVisible(true);
    showToast("QR Code berhasil dibuat! ✓");
  };

  const saveProductAndGenerateQR = async () => {
    if (!canGenerate) { showToast("⚠ Isi ID Produk dan Base URL terlebih dahulu"); return; }
    if (!form.nama.trim() || !form.tier.trim() || !form.harga.trim()) {
      showToast("⚠ Lengkapi nama produk, tier, dan harga");
      return;
    }

    setSavingProduct(true);
    try {
      if (editingId) {
        await updateProduct(editingId, productFromForm());
      } else {
        await createProduct(productFromForm());
      }
      generateQR();
      await loadProducts();
      showToast(editingId ? "Produk diperbarui dan QR siap diprint! ✓" : "Produk tersimpan dan QR siap diprint! ✓");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan produk");
    } finally {
      setSavingProduct(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId("");
    setQrVisible(false);
    setGeneratedUrl("");
  };

  const editProduct = (product: Product) => {
    setForm(productToForm(product));
    setEditingId(product.id);
    setQrVisible(false);
    setGeneratedUrl("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`Mode edit: ${product.id}`);
  };

  const archiveProduct = async (product: Product) => {
    const ok = window.confirm(`Hapus produk ${product.id}? Produk akan disembunyikan dari halaman utama dan QR.`);
    if (!ok) return;

    try {
      await deleteProduct(product.id);
      if (editingId === product.id) resetForm();
      await loadProducts();
      showToast("Produk berhasil dihapus dari tampilan publik");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus produk");
    }
  };

  const useOrderMemory = (order: PreOrder) => {
    setForm(f => ({
      ...f,
      namaPembeli: order.recipient_name || order.customer_name,
      dari: order.sender_name || order.customer_name,
      pesan: order.personal_message || order.custom_request,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Data Memory Vault dari pre-order sudah dimasukkan");
  };

  const setOrderStatus = async (order: PreOrder, status: string) => {
    if (!order.id) return;
    try {
      await updatePreOrderStatus(order.id, status);
      await loadPreOrders();
      showToast("Status pre-order diperbarui");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengubah status pre-order");
    }
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    signOutAdmin();
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
  const activeProducts = managedProducts.filter(p => (p.status || "active") === "active");
  const archivedProducts = managedProducts.filter(p => p.status === "archived");
  const search = productSearch.trim().toLowerCase();
  const filteredProducts = activeProducts.filter(p =>
    !search ||
    p.id.toLowerCase().includes(search) ||
    p.nama_produk.toLowerCase().includes(search) ||
    p.tier.toLowerCase().includes(search)
  );
  const newOrders = preOrders.filter(order => (order.status || "new") === "new");

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
                      value={form.id} disabled={Boolean(editingId)} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
                    <p className="form-hint">{editingId ? "ID dikunci saat edit agar QR lama tetap valid." : "Kode unik per produk. Gunakan format: JENIS-NOMOR"}</p>
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
                    value={form.fotoProduk} onChange={e => setForm(f => ({ ...f, fotoProduk: e.target.value }))} />
                  <p className="form-hint">Untuk katalog dan tampilan produk di halaman utama. Simpan di kolom <code>foto_produk</code>.</p>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">URL Foto QR</label>
                  <input className="admin-form-input" type="text" placeholder="https://drive.google.com/uc?id=..."
                    value={form.fotoQr} onChange={e => setForm(f => ({ ...f, fotoQr: e.target.value }))} />
                  <p className="form-hint">Untuk halaman yang terbuka setelah QR discan. Simpan di kolom <code>foto_QR</code>.</p>
                </div>
              </div>
            </div>

            <div className="url-preview">
              <strong>URL QR Code:</strong><br />
              {previewUrl
                ? <strong style={{ color: "var(--sage)" }}>{previewUrl}</strong>
                : <span>— isi ID Produk untuk melihat URL —</span>}
            </div>

            <button className="btn-generate" onClick={saveProductAndGenerateQR} disabled={!canGenerate || savingProduct}>
              {savingProduct ? "Menyimpan Produk..." : editingId ? "Update Produk + Generate QR →" : "Simpan Produk + Generate QR →"}
            </button>
            <button className="btn-secondary-admin" onClick={generateQR} disabled={!canGenerate || savingProduct}>
              Generate QR Saja
            </button>
            <button className="btn-reset" onClick={resetForm}>Bersihkan form</button>
          </div>

          {/* RIGHT: QR + GUIDE */}
          <div>
            <div className="card manage-card">
              <div className="card-header">
                <div className="card-num">{activeProducts.length}</div>
                <h2>Kelola produk</h2>
              </div>
              <div className="card-body">
                <div className="manage-toolbar">
                  <input
                    className="admin-form-input"
                    type="search"
                    placeholder="Cari ID, nama, atau tier"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                  <button className="btn-save-config" onClick={loadProducts} disabled={loadingProducts}>
                    {loadingProducts ? "..." : "Refresh"}
                  </button>
                </div>

                {loadingProducts ? (
                  <div className="manage-empty">Memuat produk...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="manage-empty">
                    {activeProducts.length === 0 ? "Belum ada produk aktif." : "Produk tidak ditemukan."}
                  </div>
                ) : (
                  <div className="product-admin-list">
                    {filteredProducts.map(product => {
                      const productUrl = `${(localStorage.getItem(BASE_URL_KEY) || baseUrl).trim().replace(/\/$/, "")}/produk?id=${product.id}`;
                      return (
                        <div className={`product-admin-item${editingId === product.id ? " editing" : ""}`} key={product.id}>
                          <div className="product-admin-main">
                            <div className="product-admin-name">{product.nama_produk || product.id}</div>
                            <div className="product-admin-meta">#{product.id} · {product.tier} · {product.harga || "Tanpa harga"}</div>
                          </div>
                          <div className="product-admin-actions">
                            <button onClick={() => editProduct(product)}>Edit</button>
                            <a href={productUrl} target="_blank" rel="noopener noreferrer">Cek</a>
                            <button className="danger" onClick={() => archiveProduct(product)}>Hapus</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="manage-summary">
                  <span>{activeProducts.length} aktif</span>
                  <span>{archivedProducts.length} terhapus</span>
                </div>
              </div>
            </div>

            <div className="card manage-card">
              <div className="card-header">
                <div className="card-num">{newOrders.length}</div>
                <h2>Pre-order masuk</h2>
              </div>
              <div className="card-body">
                <div className="manage-toolbar">
                  <div className="manage-empty" style={{ padding: "8px 10px", textAlign: "left" }}>
                    Data dari form pemesanan pelanggan
                  </div>
                  <button className="btn-save-config" onClick={loadPreOrders} disabled={loadingOrders}>
                    {loadingOrders ? "..." : "Refresh"}
                  </button>
                </div>

                {loadingOrders ? (
                  <div className="manage-empty">Memuat pre-order...</div>
                ) : preOrders.length === 0 ? (
                  <div className="manage-empty">Belum ada pre-order.</div>
                ) : (
                  <div className="product-admin-list">
                    {preOrders.slice(0, 8).map(order => (
                      <div className={`product-admin-item${(order.status || "new") === "new" ? " editing" : ""}`} key={order.id || `${order.whatsapp}-${order.created_at}`}>
                        <div className="product-admin-main">
                          <div className="product-admin-name">{order.customer_name || "Tanpa nama"}</div>
                          <div className="product-admin-meta">
                            {order.whatsapp || "Tanpa WA"} · {order.product_name || order.product_id || "Produk belum dipilih"}
                          </div>
                          {(order.recipient_name || order.personal_message) && (
                            <div className="product-admin-note">
                              Untuk {order.recipient_name || "penerima"}: {order.personal_message || order.custom_request}
                            </div>
                          )}
                        </div>
                        <div className="product-admin-actions">
                          <button onClick={() => useOrderMemory(order)}>Pakai</button>
                          <a href={`https://wa.me/${order.whatsapp}`} target="_blank" rel="noopener noreferrer">WA</a>
                          <button onClick={() => setOrderStatus(order, (order.status || "new") === "new" ? "contacted" : "new")}>
                            {(order.status || "new") === "new" ? "Kontak" : "Baru"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
              <div className="guide-header">Operasional website</div>
              <div className="guide-body">
                {[
                  { n: 1, t: <>Data utama produk disimpan di <strong>Supabase</strong>. Halaman utama dan QR hanya menampilkan produk dengan status aktif.</> },
                  { n: 2, t: <>Gunakan tombol <strong>Simpan/Update Produk + Generate QR</strong> agar data produk dan QR selalu memakai ID yang sama.</> },
                  { n: 3, t: <>Kolom wajib: <code className="step-code">id, nama_produk, tier, harga</code></> },
                  { n: 4, t: <>Hapus produk dari admin akan mengarsipkan produk, sehingga tidak muncul di publik tetapi masih bisa dicek di Supabase.</> },
                  { n: 5, t: <>Sebelum cetak QR, klik <strong>Cek</strong> pada daftar produk untuk memastikan halaman detail terbuka dengan benar.</> },
                ].map(({ n, t }) => (
                  <div className="guide-step" key={n}>
                    <div className="step-num">{n}</div>
                    <div className="step-text">{t}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="guide-card">
              <div className="guide-header">Struktur data Supabase</div>
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
                      ["foto_produk", "Link foto untuk katalog/halaman utama", false],
                      ["foto_QR", "Link foto untuk halaman scan QR", false],
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
