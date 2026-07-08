import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import {
  Box,
  ClipboardList,
  Copy,
  Database,
  Download,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
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
const SQL_DRAFT_KEY = "fm_sql_draft";
const ADMIN_PASSWORD = "floramory2026";

const TIER_OPTIONS = [
  { value: "classic", label: "Floramory Classic" },
  { value: "signature", label: "Floramory Signature" },
  { value: "masterpiece", label: "Floramory Masterpiece" },
];

type AdminTab = "dashboard" | "produk" | "pesanan" | "sql" | "pengaturan";

const DEFAULT_SQL = `-- Floramory Supabase SQL
-- Tulis atau tempel SQL di sini, lalu salin ke Supabase SQL Editor.

create table if not exists public.products (
  id text primary key,
  nama_produk text not null,
  tier text not null default 'classic',
  harga text not null default '',
  bunga text not null default '',
  deskripsi text not null default '',
  bahan text not null default '',
  ukuran text not null default '',
  nama_pembeli text not null default '',
  dari text not null default '',
  pesan_personal text not null default '',
  foto_produk text not null default '',
  foto_qr text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preorder_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  whatsapp text not null default '',
  product_id text not null default '',
  product_name text not null default '',
  custom_request text not null default '',
  recipient_name text not null default '',
  sender_name text not null default '',
  personal_message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.preorder_orders enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Authenticated admin can manage products" on public.products;

create policy "Public can read active products"
on public.products
for select
to anon, authenticated
using (status = 'active');

create policy "Authenticated admin can manage products"
on public.products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can create preorder" on public.preorder_orders;
drop policy if exists "Authenticated admin can manage preorder" on public.preorder_orders;

create policy "Public can create preorder"
on public.preorder_orders
for insert
to anon, authenticated
with check (true);

create policy "Authenticated admin can manage preorder"
on public.preorder_orders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read app settings" on public.app_settings;
drop policy if exists "Authenticated admin can manage app settings" on public.app_settings;

create policy "Public can read app settings"
on public.app_settings
for select
to anon, authenticated
using (true);

create policy "Authenticated admin can manage app settings"
on public.app_settings
for all
to authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert on public.preorder_orders to anon, authenticated;
grant select on public.app_settings to anon, authenticated;`;

interface FormState {
  id: string;
  tier: string;
  nama: string;
  harga: string;
  bunga: string;
  deskripsi: string;
  bahan: string;
  ukuran: string;
  namaPembeli: string;
  dari: string;
  pesan: string;
  fotoProduk: string;
  fotoQr: string;
}

const EMPTY: FormState = {
  id: "",
  tier: "",
  nama: "",
  harga: "",
  bunga: "",
  deskripsi: "",
  bahan: "",
  ukuran: "",
  namaPembeli: "",
  dari: "",
  pesan: "",
  fotoProduk: "",
  fotoQr: "",
};

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
  const { protocol, host } = window.location;
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const origin = `${protocol}//${host}`;
  return base ? `${origin}${base}` : origin;
}

function countSqlStatements(sql: string): number {
  return sql
    .split(";")
    .map(part => part.trim())
    .filter(Boolean).length;
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
        <div className="login-icon">Admin</div>
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
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {error && <div className="login-error">{errorMsg}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Masuk..." : "Masuk"}
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
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
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
  const [sqlDraft, setSqlDraft] = useState(DEFAULT_SQL);
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
    if (!saved) localStorage.setItem(BASE_URL_KEY, auto);
    setWaNum(localStorage.getItem(WA_KEY) || "");
    fetchWhatsAppNumber().then((value) => {
      if (value) {
        setWaNum(value);
        localStorage.setItem(WA_KEY, value);
      }
    });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    setSqlDraft(localStorage.getItem(SQL_DRAFT_KEY) || DEFAULT_SQL);
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    localStorage.setItem(SQL_DRAFT_KEY, sqlDraft);
  }, [authed, sqlDraft]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      setManagedProducts(await fetchManagedProducts());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat produk");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPreOrders = async () => {
    setLoadingOrders(true);
    try {
      setPreOrders(await fetchPreOrders());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat pre-order");
    } finally {
      setLoadingOrders(false);
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadProducts(), loadPreOrders()]);
  };

  useEffect(() => {
    if (authed) void reloadAll();
  }, [authed]);

  const saveConfig = async () => {
    const clean = baseUrl.trim().replace(/\/$/, "");
    localStorage.setItem(BASE_URL_KEY, clean);
    localStorage.setItem(WA_KEY, waNum.trim());
    try {
      await updateWhatsAppNumber(waNum);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
      showToast("Konfigurasi tersimpan");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nomor WA tersimpan lokal, tetapi gagal tersimpan ke Supabase");
    }
  };

  const useAutoUrl = () => {
    const auto = getAutoBaseUrl();
    setBaseUrl(auto);
    localStorage.setItem(BASE_URL_KEY, auto);
    showToast("Base URL diambil otomatis");
  };

  const getPreviewUrl = () => {
    const b = (localStorage.getItem(BASE_URL_KEY) || baseUrl).trim().replace(/\/$/, "");
    if (!form.id.trim() || !b) return null;
    return `${b}/produk?id=${form.id.trim()}`;
  };

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
    if (!url) {
      showToast("Isi ID Produk dan Base URL terlebih dahulu");
      return;
    }
    setGeneratedUrl(url);
    setQrVisible(true);
    showToast("QR Code berhasil dibuat");
  };

  const saveProductAndGenerateQR = async () => {
    if (!form.id.trim() || !baseUrl.trim()) {
      showToast("Isi ID Produk dan Base URL terlebih dahulu");
      return;
    }
    if (!form.nama.trim() || !form.tier.trim() || !form.harga.trim()) {
      showToast("Lengkapi nama produk, tier, dan harga");
      return;
    }

    setSavingProduct(true);
    try {
      if (editingId) await updateProduct(editingId, productFromForm());
      else await createProduct(productFromForm());
      await loadProducts();
      const url = getPreviewUrl();
      if (url) {
        setGeneratedUrl(url);
        setQrVisible(true);
      }
      showToast(editingId ? "Produk diperbarui" : "Produk tersimpan");
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
    setActiveTab("produk");
    setQrVisible(false);
    setGeneratedUrl("");
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
    setActiveTab("produk");
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
    navigator.clipboard.writeText(generatedUrl).then(() => showToast("URL disalin ke clipboard"));
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) {
      showToast("Gagal download, canvas tidak tersedia");
      return;
    }
    const printCanvas = document.createElement("canvas");
    printCanvas.width = 300;
    printCanvas.height = 340;
    const ctx = printCanvas.getContext("2d")!;
    ctx.fillStyle = "#faf7f2";
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, 300, 340, 16);
      ctx.fill();
    } else ctx.fillRect(0, 0, 300, 340);
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
    ctx.fillText("#" + (form.id || "-"), 150, 294);
    ctx.fillStyle = "#c8dbc5";
    ctx.font = "9px sans-serif";
    ctx.fillText("Scan untuk info produk & pesan personal", 150, 316);
    const link = document.createElement("a");
    link.download = `floramory-qr-${form.id || "produk"}.png`;
    link.href = printCanvas.toDataURL("image/png");
    link.click();
    showToast("QR Code berhasil didownload");
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlDraft).then(() => showToast("SQL disalin. Tempel di Supabase SQL Editor."));
  };

  const downloadSql = () => {
    const blob = new Blob([sqlDraft], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "floramory-supabase.sql";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    showToast("File SQL berhasil didownload");
  };

  const resetSqlDraft = () => {
    const ok = window.confirm("Reset isi SQL editor ke template awal?");
    if (!ok) return;
    setSqlDraft(DEFAULT_SQL);
    showToast("Template SQL dimuat ulang");
  };

  const activeProducts = useMemo(
    () => managedProducts.filter(p => (p.status || "active") === "active"),
    [managedProducts]
  );
  const archivedProducts = useMemo(
    () => managedProducts.filter(p => p.status === "archived"),
    [managedProducts]
  );
  const newOrders = useMemo(
    () => preOrders.filter(order => (order.status || "new") === "new"),
    [preOrders]
  );
  const search = productSearch.trim().toLowerCase();
  const filteredProducts = activeProducts.filter(p =>
    !search ||
    p.id.toLowerCase().includes(search) ||
    p.nama_produk.toLowerCase().includes(search) ||
    p.tier.toLowerCase().includes(search)
  );
  const recentProducts = activeProducts.slice(0, 5);
  const tierCounts = TIER_OPTIONS.map(option => ({
    ...option,
    count: activeProducts.filter(product => product.tier === option.value).length,
  }));
  const previewUrl = getPreviewUrl();
  const sqlStats = useMemo(() => {
    const lines = sqlDraft.split(/\r?\n/).length;
    const statements = countSqlStatements(sqlDraft);
    const hasDangerousCommand = /\b(drop|truncate|delete\s+from|alter\s+table)\b/i.test(sqlDraft);
    return { lines, statements, hasDangerousCommand };
  }, [sqlDraft]);

  const tabs: { id: AdminTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "produk", label: "Produk", icon: Box },
    { id: "pesanan", label: "Pesanan", icon: ClipboardList },
    { id: "sql", label: "SQL", icon: Database },
    { id: "pengaturan", label: "Pengaturan", icon: Settings },
  ];

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  const renderProductForm = () => (
    <div className="admin-panel-card">
      <div className="admin-panel-head">
        <div>
          <h2>{editingId ? "Edit Produk" : "Tambah Produk"}</h2>
          <p>Lengkapi data katalog dan foto sebelum membuat QR.</p>
        </div>
        {editingId && <span className="admin-pill">Edit #{editingId}</span>}
      </div>

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label className="admin-form-label">ID Produk <span className="required-star">*</span></label>
          <input className="admin-form-input" type="text" placeholder="Contoh: ROSA-001"
            value={form.id} disabled={Boolean(editingId)} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
          <p className="form-hint">{editingId ? "ID dikunci saat edit agar QR lama tetap valid." : "Kode unik per produk."}</p>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Lini Produk <span className="required-star">*</span></label>
          <select className="admin-form-select" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
            <option value="">Pilih tier</option>
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
          <input className="admin-form-input" type="text" placeholder="Contoh: Rp55.000"
            value={form.harga} onChange={e => setForm(f => ({ ...f, harga: e.target.value }))} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Jenis Bunga</label>
          <input className="admin-form-input" type="text" placeholder="Contoh: Melati"
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
          <input className="admin-form-input" type="text" placeholder="Epoxy resin + stainless steel"
            value={form.bahan} onChange={e => setForm(f => ({ ...f, bahan: e.target.value }))} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Ukuran</label>
          <input className="admin-form-input" type="text" placeholder="Diameter 17mm"
            value={form.ukuran} onChange={e => setForm(f => ({ ...f, ukuran: e.target.value }))} />
        </div>
      </div>


      <div className="admin-subsection-title">Foto</div>
      <div className="admin-form-group">
        <label className="admin-form-label">URL Foto Produk</label>
        <input className="admin-form-input" type="text" placeholder="https://..."
          value={form.fotoProduk} onChange={e => setForm(f => ({ ...f, fotoProduk: e.target.value }))} />
      </div>
      <div className="admin-form-group">
        <label className="admin-form-label">URL Foto QR</label>
        <input className="admin-form-input" type="text" placeholder="https://..."
          value={form.fotoQr} onChange={e => setForm(f => ({ ...f, fotoQr: e.target.value }))} />
      </div>

      <div className="admin-form-actions">
        <button className="btn-generate" onClick={saveProductAndGenerateQR} disabled={savingProduct}>
          {savingProduct ? "Menyimpan..." : editingId ? "Update Produk" : "Simpan Produk"}
        </button>
        <button className="btn-secondary-admin" onClick={generateQR}>Generate QR</button>
        <button className="btn-reset" onClick={resetForm}>Bersihkan</button>
      </div>
      {qrVisible && (
        <div className="admin-inline-qr">
          <div ref={qrRef}>
            <QRCode value={generatedUrl} size={168} fgColor="#2d2820" bgColor="#faf7f2" level="M" />
          </div>
          <div>
            <strong>{form.nama || form.id}</strong>
            <span>{generatedUrl}</span>
            <div className="admin-inline-qr-actions">
              <button onClick={downloadQR}>Download PNG</button>
              <button onClick={copyUrl}>Salin URL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderProductList = () => (
    <div className="admin-panel-card">
      <div className="admin-panel-head">
        <div>
          <h2>Daftar Produk</h2>
          <p>{activeProducts.length} aktif, {archivedProducts.length} terarsip.</p>
        </div>
        <button className="admin-outline-btn" onClick={loadProducts} disabled={loadingProducts}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <input
        className="admin-form-input"
        type="search"
        placeholder="Cari ID, nama, atau tier"
        value={productSearch}
        onChange={e => setProductSearch(e.target.value)}
      />
      <div className="admin-list">
        {loadingProducts ? (
          <div className="manage-empty">Memuat produk...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="manage-empty">Belum ada produk aktif.</div>
        ) : filteredProducts.map(product => {
          const productUrl = `${(localStorage.getItem(BASE_URL_KEY) || baseUrl).trim().replace(/\/$/, "")}/produk?id=${product.id}`;
          return (
            <div className={`admin-list-item${editingId === product.id ? " active" : ""}`} key={product.id}>
              <div>
                <strong>{product.nama_produk || product.id}</strong>
                <span>#{product.id} / {product.tier} / {product.harga || "Tanpa harga"}</span>
              </div>
              <div className="admin-list-actions">
                <button onClick={() => editProduct(product)}>Edit</button>
                <a href={productUrl} target="_blank" rel="noopener noreferrer">Cek</a>
                <button className="danger" onClick={() => archiveProduct(product)}>Hapus</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="admin-panel-card">
      <div className="admin-panel-head">
        <div>
          <h2>Pesanan Pre-order</h2>
          <p>{newOrders.length} pesanan baru dari form pelanggan.</p>
        </div>
        <button className="admin-outline-btn" onClick={loadPreOrders} disabled={loadingOrders}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <div className="admin-list">
        {loadingOrders ? (
          <div className="manage-empty">Memuat pre-order...</div>
        ) : preOrders.length === 0 ? (
          <div className="manage-empty">Belum ada pre-order.</div>
        ) : preOrders.map(order => (
          <div className={`admin-list-item${(order.status || "new") === "new" ? " active" : ""}`} key={order.id || `${order.whatsapp}-${order.created_at}`}>
            <div>
              <strong>{order.customer_name || "Tanpa nama"}</strong>
              <span>{order.whatsapp || "Tanpa WA"} / {order.product_name || order.product_id || "Produk belum dipilih"}</span>
              {(order.recipient_name || order.personal_message || order.custom_request) && (
                <p className="admin-list-note">
                  Untuk {order.recipient_name || "penerima"}: {order.personal_message || order.custom_request}
                </p>
              )}
            </div>
            <div className="admin-list-actions">
              <button onClick={() => useOrderMemory(order)}>Pakai</button>
              <a href={`https://wa.me/${order.whatsapp}`} target="_blank" rel="noopener noreferrer">WA</a>
              <button onClick={() => setOrderStatus(order, (order.status || "new") === "new" ? "contacted" : "new")}>
                {(order.status || "new") === "new" ? "Kontak" : "Baru"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDashboard = () => (
    <>
      <section className="admin-stats-grid">
        <div className="admin-stat-card"><span>{activeProducts.length}</span><p>Total produk</p></div>
        {tierCounts.map(tier => (
          <div className="admin-stat-card" key={tier.value}><span>{tier.count}</span><p>{tier.label}</p></div>
        ))}
        <div className="admin-stat-card"><span>{newOrders.length}</span><p>Pesanan baru</p></div>
      </section>
      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div>
            <h2>Produk terbaru</h2>
            <p>5 entri terakhir dari sumber data.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Nama Produk</th><th>Tier</th><th>Harga</th><th>Bunga</th></tr></thead>
            <tbody>
              {recentProducts.length === 0 ? (
                <tr><td colSpan={4}>Belum ada produk aktif.</td></tr>
              ) : recentProducts.map(product => (
                <tr key={product.id}>
                  <td>{product.nama_produk}</td>
                  <td>{product.tier}</td>
                  <td>{product.harga}</td>
                  <td>{product.bunga || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderSettings = () => (
    <div className="admin-two-col">
      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div>
            <h2>Pengaturan Website</h2>
            <p>Base URL dipakai untuk QR, WhatsApp dipakai di halaman scan.</p>
          </div>
          {configSaved && <span className="admin-pill">Tersimpan</span>}
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Base URL website</label>
          <div className="settings-input-group">
            <input className="admin-form-input" type="text" placeholder="https://floramorystore.vercel.app"
              value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
            <button className="btn-save-config" onClick={useAutoUrl}>Auto</button>
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Nomor WhatsApp</label>
          <input className="admin-form-input" type="text" placeholder="6281234567890"
            value={waNum} onChange={e => setWaNum(e.target.value)} />
        </div>
        <button className="btn-generate" onClick={saveConfig}>Simpan Pengaturan</button>
      </div>
      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div>
            <h2>Catatan Operasional</h2>
            <p>Checklist singkat sebelum produk dicetak.</p>
          </div>
        </div>
        <div className="admin-check-list">
          <p>Produk aktif hanya muncul jika status Supabase adalah active.</p>
          <p>Jangan cetak QR dari URL localhost.</p>
          <p>Gunakan Supabase Storage untuk foto yang stabil.</p>
          <p>Setelah mengubah environment Vercel, lakukan redeploy.</p>
        </div>
      </div>
    </div>
  );

  const renderSqlEditor = () => (
    <div className="admin-two-col sql-layout">
      <div className="admin-panel-card sql-editor-card">
        <div className="admin-panel-head">
          <div>
            <h2>SQL Editor</h2>
            <p>Siapkan query di website, lalu salin dan jalankan di Supabase.</p>
          </div>
          <span className="admin-pill">{sqlStats.statements} statement</span>
        </div>
        <textarea
          className="sql-editor"
          spellCheck={false}
          value={sqlDraft}
          onChange={e => setSqlDraft(e.target.value)}
        />
        <div className="sql-toolbar">
          <button className="admin-outline-btn" onClick={copySql}><Copy size={16} /> Salin SQL</button>
          <button className="admin-outline-btn" onClick={downloadSql}><Download size={16} /> Download</button>
          <button className="admin-outline-btn danger" onClick={resetSqlDraft}><Trash2 size={16} /> Reset</button>
        </div>
      </div>

      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div>
            <h2>Panduan Supabase</h2>
            <p>Editor ini tidak mengeksekusi SQL langsung agar database tetap aman.</p>
          </div>
        </div>
        <div className="admin-check-list sql-guide">
          <p>Buka Supabase Dashboard, lalu masuk ke menu SQL Editor.</p>
          <p>Klik New query, tempel SQL dari tombol Salin SQL.</p>
          <p>Jalankan query, lalu cek tabel products, preorder_orders, dan app_settings.</p>
          <p>Setelah berhasil, isi environment VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</p>
        </div>
        <div className={`sql-warning${sqlStats.hasDangerousCommand ? " show" : ""}`}>
          Query berisi perintah berisiko. Pastikan kamu sudah backup database sebelum menjalankannya.
        </div>
        <div className="sql-meta-grid">
          <div><strong>{sqlStats.lines}</strong><span>Baris</span></div>
          <div><strong>{sqlDraft.length}</strong><span>Karakter</span></div>
          <div><strong>{hasSupabaseConfig() ? "Aktif" : "Belum"}</strong><span>Env Supabase</span></div>
        </div>
      </div>
    </div>
  );

  const titleMap: Record<AdminTab, { title: string; desc: string }> = {
    dashboard: { title: "Dashboard", desc: "Ringkasan katalog dan pesanan Floramory." },
    produk: { title: "Produk", desc: "Tambah, edit, dan arsipkan produk katalog." },
    pesanan: { title: "Pesanan", desc: "Kelola pre-order dan pakai data Memory Vault pelanggan." },
    sql: { title: "SQL Editor", desc: "Tulis, simpan draft, dan salin query untuk Supabase." },
    pengaturan: { title: "Pengaturan", desc: "Atur domain QR dan nomor WhatsApp aktif." },
  };

  const renderContent = () => {
    if (activeTab === "dashboard") return renderDashboard();
    if (activeTab === "produk") return <div className="admin-two-col wide-left">{renderProductForm()}{renderProductList()}</div>;
    if (activeTab === "pesanan") return renderOrders();
    if (activeTab === "sql") return renderSqlEditor();
    return renderSettings();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">F</div>
          <div>
            <strong>Floramory</strong>
            <span>Admin Panel</span>
          </div>
        </div>
        <nav className="admin-side-nav">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <p>Smart Eco-Preserved Artware</p>
          <span>Sumber data: {hasSupabaseConfig() ? "Supabase" : "Fallback lokal"}</span>
          <button onClick={logout}><LogOut size={16} /> Keluar</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-main-header">
          <div>
            <h1>{titleMap[activeTab].title}</h1>
            <p>{titleMap[activeTab].desc}</p>
          </div>
          <button className="admin-outline-btn" onClick={reloadAll} disabled={loadingProducts || loadingOrders}>
            <RefreshCw size={16} />
            Muat ulang data
          </button>
        </header>
        {renderContent()}
      </main>

      <div className={`admin-toast${toastVisible ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}
