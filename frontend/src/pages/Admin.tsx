import { useEffect, useMemo, useRef, useState, useCallback, type ComponentType } from "react";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import {
  Box,
  ClipboardList,
  DollarSign,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
  ExternalLink,
} from "lucide-react";
import {
  createProduct,
  deleteProduct,
  fetchManagedProducts,
  fetchPreOrders,
  fetchPreOrderStatusCounts,
  fetchWhatsAppNumber,
  hasSupabaseConfig,
  signInAdmin,
  signOutAdmin,
  statusAdminSession,
  updatePreOrderStatus,
  updateWhatsAppNumber,
  updateProduct,
  uploadProductImage,
  type PreOrder,
  type Product,
  type PreOrderStatusCounts,
  type ProductImageField,
} from "@/lib/sheets";
import BrandLogo from "@/components/BrandLogo";
import { isSupabaseStorageUrl, productImageUrl, validateImageUrl } from "@/lib/images";
import { formatHarga, normalizeWhatsApp } from "@/lib/site";
import { getSupabaseClient } from "@/lib/supabase";

const BASE_URL_KEY = "fm_base_url";
const WA_KEY = "fm_wa";
const SIDEBAR_PREFERENCE_KEY = "fm_admin_sidebar_collapsed";

const TIER_OPTIONS = [
  { value: "classic", label: "Floramory Classic" },
  { value: "signature", label: "Floramory Signature" },
  { value: "masterpiece", label: "Floramory Masterpiece" },
];

const ORDER_STATUSES = [
  { value: "new", label: "New Order" },
  { value: "dp_verified", label: "50% DP Received" },
  { value: "in_progress", label: "Lab Dehydration & UV Casting" },
  { value: "completed", label: "Delivered / Vault Active" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function getOrderStatus(status?: string): typeof ORDER_STATUSES[number]["value"] {
  const normalized = (status || "").toLowerCase();
  if (normalized === "contacted") return "in_progress";
  if (normalized === "paid") return "dp_verified";
  return ORDER_STATUSES.find(option => option.value === normalized)?.value || "new";
}

function isDpReceivedStatus(status?: string): boolean {
  const normalized = (status || "").toLowerCase();
  return normalized === "paid" || normalized === "dp_verified";
}

type AdminTab = "dashboard" | "produk" | "pesanan" | "keuangan" | "pengaturan";

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
    fotoProduk: product.foto_produk,
    fotoQr: product.foto_qr,
  };
}

function getAutoBaseUrl(): string {
  const { protocol, host } = window.location;
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const origin = `${protocol}//${host}`;
  return base ? `${origin}${base}` : origin;
}

function parsePrice(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const supabaseReady = hasSupabaseConfig();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
  };

  if (!supabaseReady) {
    return (
      <div className="login-screen admin-login-screen">
        <div className="login-card">
          <div className="login-logo" aria-label="Floramory">
            <BrandLogo className="brand-logo-img login-logo-img" />
          </div>
          <div className="login-subtitle">Admin Panel</div>
          <div className="login-icon">Admin</div>
          <p style={{ textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
            Supabase belum dikonfigurasi.
            <br />
            Isi <code>VITE_SUPABASE_URL</code> dan{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> lalu buat akun admin di Supabase
            Authentication untuk masuk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen admin-login-screen">
      <div className={`login-card${shake ? " shake" : ""}`}>
        <div className="login-logo" aria-label="Floramory">
          <BrandLogo className="brand-logo-img login-logo-img" />
        </div>
        <div className="login-subtitle">Admin Panel</div>
        <div className="login-icon">Admin</div>
        <form onSubmit={submit} style={{ width: "100%" }}>
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
          <div className="login-input-wrap">
            <input
              className={`login-input${error ? " login-input-error" : ""}`}
              type={show ? "text" : "password"}
              placeholder="Password Supabase"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(false); }}
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
          Gunakan akun admin yang dibuat di Supabase Authentication.
        </p>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (window.innerWidth < 768) return true;
    return localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
  });
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [waNum, setWaNum] = useState("");
  const [configSaved, setConfigSaved] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<ProductImageField | null>(null);
  const [managedProducts, setManagedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [preOrderOffset, setPreOrderOffset] = useState(0);
  const [hasMorePreOrders, setHasMorePreOrders] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [operationalCounts, setOperationalCounts] = useState<PreOrderStatusCounts>({
    new: 0,
    dp_verified: 0,
    in_progress: 0,
    completed: 0,
  });
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilterStatus, setOrderFilterStatus] = useState<"all" | typeof ORDER_STATUSES[number]["value"]>("all");
  const [printOrder, setPrintOrder] = useState<PreOrder | null>(null);
  const [editingId, setEditingId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastLevel, setToastLevel] = useState<"info" | "success" | "alert">("info");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const produkUploadRef = useRef<HTMLInputElement>(null);
  const qrUploadRef = useRef<HTMLInputElement>(null);
  const wasMobileViewport = useRef(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const isMobileViewport = window.innerWidth < 768;
      if (isMobileViewport === wasMobileViewport.current) return;
      wasMobileViewport.current = isMobileViewport;
      if (isMobileViewport) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true");
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);
    if (window.innerWidth >= 768) {
      localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(nextCollapsed));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [toggleSidebar]);

  useEffect(() => {
    if (!printOrder) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPrintOrder(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [printOrder]);

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");

    return () => {
      meta?.setAttribute("content", "index, follow");
    };
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Admin — Floramory";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    statusAdminSession().then((status: any) => {
      if (status.authenticated && status.isAdmin) setAuthed(true);
      else void signOutAdmin();
    });
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

  const showToast = useCallback((msg: string, level: "info" | "success" | "alert" = "info") => {
    setToastMsg(msg);
    setToastLevel(level);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), level === "alert" ? 5000 : 2500);
  }, []);

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
      const [page, counts] = await Promise.all([fetchPreOrders(0), fetchPreOrderStatusCounts()]);
      setPreOrders(page.orders);
      setPreOrderOffset(page.orders.length);
      setHasMorePreOrders(page.hasMore);
      setOperationalCounts(counts);
      setNewOrderCount(counts.new);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat pre-order");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadAllPreOrders = async () => {
    setLoadingOrders(true);
    try {
      const orders: PreOrder[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await fetchPreOrders(offset);
        if (page.orders.length === 0 && page.hasMore) {
          throw new Error("Gagal memuat seluruh data pre-order untuk laporan.");
        }
        orders.push(...page.orders);
        offset += page.orders.length;
        hasMore = page.hasMore;
      }
      const counts = await fetchPreOrderStatusCounts();
      setPreOrders(orders);
      setPreOrderOffset(orders.length);
      setHasMorePreOrders(false);
      setOperationalCounts(counts);
      setNewOrderCount(counts.new);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat data laporan keuangan");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadMorePreOrders = async () => {
    setLoadingOrders(true);
    try {
      const page = await fetchPreOrders(preOrderOffset);
      setPreOrders(prev => [...prev, ...page.orders]);
      setPreOrderOffset(preOrderOffset + page.orders.length);
      setHasMorePreOrders(page.hasMore);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat pre-order lainnya");
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

  // Supabase Realtime: subscribe ke INSERT baru di preorder_orders
  // saat admin sudah login. Auto-refresh pesanan + notifikasi.
  useEffect(() => {
    if (!authed) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel("admin-preorder-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "preorder_orders" },
        (payload: any) => {
          const name = (payload.new as { customer_name?: string })?.customer_name || "Seseorang";
          showToast(`🛎️ Pre-order baru dari ${name}!`, "alert");
          // Reload daftar pesanan & badge counter
          void loadPreOrders();
        }
      )
      .subscribe((status: any) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [authed, showToast]);

  const saveConfig = async () => {
    const clean = baseUrl.trim().replace(/\/$/, "");
    localStorage.setItem(BASE_URL_KEY, clean);
    localStorage.setItem(WA_KEY, waNum.trim());
    try {
      await updateWhatsAppNumber(normalizeWhatsApp(waNum) || waNum);
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

    // Validasi URL foto manual (opsional namun harus http/https kala diisi).
    const fotoProdukError = validateImageUrl(form.fotoProduk);
    const fotoQrError = validateImageUrl(form.fotoQr);
    if (fotoProdukError || fotoQrError) {
      showToast(fotoProdukError || fotoQrError || "");
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

  // Unggah foto: dikompresi & di-resize ke WebP di browser (maks 5 MB),
  // lalu dikirim lewat sesi admin (cookie) ke Supabase Storage.
  // URL Storage yang dihasilkan otomatis di-optimasi CDN saat ditampilkan.
  const handleImageUpload = async (field: ProductImageField, file: File) => {
    if (uploadingImage) return;
    const key = field === "produk" ? "fotoProduk" : "fotoQr";
    setUploadingImage(field);
    try {
      const url = await uploadProductImage(form.id, field, file);
      setForm(f => ({ ...f, [key]: url }));
      showToast(field === "produk" ? "Foto produk terunggah (WebP, otomatis dioptimasi)" : "Foto QR terunggah (WebP, otomatis dioptimasi)");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengunggah foto");
    } finally {
      setUploadingImage(null);
    }
  };

  const editProduct = (product: Product) => {
    setForm(productToForm(product));
    setEditingId(product.id);
    setProductFormOpen(true);
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
    setProductFormOpen(true);
    setActiveTab("produk");
    showToast("Data Memory Vault dari pre-order sudah dimasukkan");
  };

  const setOrderStatus = async (order: PreOrder, status: string) => {
    if (!order.id) return;
    try {
      await updatePreOrderStatus(order.id, status);
      const previousStatus = getOrderStatus(order.status);
      setPreOrders(orders => orders.map(item => item.id === order.id ? { ...item, status } : item));
      const nextStatus = getOrderStatus(status);
      if (previousStatus !== nextStatus) {
        setOperationalCounts(counts => {
          const updated = { ...counts };
          if (previousStatus !== "cancelled") {
            updated[previousStatus] = Math.max(0, counts[previousStatus] - 1);
          }
          if (nextStatus !== "cancelled") updated[nextStatus] = counts[nextStatus] + 1;
          return updated;
        });
        if (previousStatus === "new" && nextStatus !== "new") setNewOrderCount(count => Math.max(0, count - 1));
        if (previousStatus !== "new" && nextStatus === "new") setNewOrderCount(count => count + 1);
      }
      const statusLabel = ORDER_STATUSES.find(option => option.value === status)?.label || status;
      showToast(`Status pesanan diperbarui: ${statusLabel}`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengubah status pre-order");
    }
  };

  const logout = async () => {
    await signOutAdmin();
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
    ctx.fillStyle = "#fafbff";
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, 300, 340, 16);
      ctx.fill();
    } else ctx.fillRect(0, 0, 300, 340);
    ctx.drawImage(canvas, 50, 30, 200, 200);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 16px serif";
    ctx.textAlign = "center";
    ctx.fillText("Floramory", 150, 256);
    ctx.fillStyle = "#111111";
    ctx.font = "11px sans-serif";
    ctx.fillText("Memory Vault", 150, 274);
    ctx.fillStyle = "#111111";
    ctx.font = "10px monospace";
    ctx.fillText("#" + (form.id || "-"), 150, 294);
    ctx.fillStyle = "#111111";
    ctx.font = "9px sans-serif";
    ctx.fillText("Scan untuk info produk & pesan personal", 150, 316);
    const link = document.createElement("a");
    link.download = `floramory-qr-${form.id || "produk"}.png`;
    link.href = printCanvas.toDataURL("image/png");
    link.click();
    showToast("QR Code berhasil didownload");
  };

  const exportPreOrders = () => {
    const columns: (keyof PreOrder)[] = [
      "id",
      "customer_name",
      "whatsapp",
      "product_name",
      "status",
      "created_at",
      "custom_request",
    ];
    const escapeCsv = (value: string | undefined) => {
      const text = value || "";
      const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csv = [
      columns.join(","),
      ...preOrders.map(order => columns.map(column => escapeCsv(order[column])).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    link.href = url;
    link.download = `floramory-orders-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportFinancialReport = () => {
    const columns = ["Tanggal", "Nama Pelanggan", "Produk", "Nilai Transaksi", "Status Pembayaran"];
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = financialTransactions.map(({ order, product, amount }) => [
      order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID") : "",
      order.customer_name || "Tanpa nama",
      product?.nama_produk || order.product_name || order.product_id || "Produk tidak ditemukan",
      amount,
      isDpReceivedStatus(order.status) ? "DP Diterima (50%)" : "Selesai (100%)",
    ]);
    const csv = [
      columns.map(escapeCsv).join(","),
      ...rows.map(row => row.map(escapeCsv).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `floramory-laporan-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const activeProducts = useMemo(
    () => managedProducts.filter(p => (p.status || "active") === "active"),
    [managedProducts]
  );
  const archivedProducts = useMemo(
    () => managedProducts.filter(p => p.status === "archived"),
    [managedProducts]
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
  const financialTransactions = useMemo(() => preOrders
    .filter(order => ["completed", "dp_verified"].includes(getOrderStatus(order.status)))
    .map(order => {
      const product = managedProducts.find(item => item.id === order.product_id)
        || managedProducts.find(item => item.nama_produk.toLowerCase() === order.product_name.toLowerCase());
      const amount = product ? parsePrice(product.harga) : 0;
      return {
        order,
        product,
        amount,
        receivedAmount: isDpReceivedStatus(order.status) ? amount * 0.5 : amount,
      };
    }), [managedProducts, preOrders]);
  const totalRevenue = financialTransactions.reduce((sum, transaction) => sum + transaction.receivedAmount, 0);
  const averageTransaction = financialTransactions.length ? totalRevenue / financialTransactions.length : 0;
  const normalizedOrderSearch = orderSearch.trim().toLowerCase();
  const searchedOrders = preOrders.filter(order => {
    if (!normalizedOrderSearch) return true;
    return [
      order.customer_name,
      order.whatsapp,
      order.product_name,
      order.recipient_name,
    ].some(value => (value || "").toLowerCase().includes(normalizedOrderSearch));
  });
  const filteredOrders = searchedOrders.filter(order =>
    orderFilterStatus === "all" || getOrderStatus(order.status) === orderFilterStatus
  );
  const orderStatusCounts = ORDER_STATUSES.reduce<Record<string, number>>((counts, status) => {
    counts[status.value] = searchedOrders.filter(order => getOrderStatus(order.status) === status.value).length;
    return counts;
  }, {});
  const estimatedDpReceived = financialTransactions.reduce((sum, transaction) => sum + transaction.amount * 0.5, 0);

  const tabs: { id: AdminTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "produk", label: "Produk", icon: Box },
    { id: "pesanan", label: "Pesanan", icon: ClipboardList },
    { id: "keuangan", label: "Keuangan", icon: TrendingUp },
    { id: "pengaturan", label: "Pengaturan", icon: Settings },
  ];

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  const renderProductForm = () => (
    <>
      <button className="admin-outline-btn admin-back-to-products" onClick={() => setProductFormOpen(false)}>
        ← Kembali ke Daftar Produk
      </button>
      <div className="admin-panel-card admin-product-form-card">
      <div className="admin-panel-head">
        <div>
          <h2>Informasi Produk</h2>
          <p>{editingId ? `Edit data produk ${form.id}.` : "Lengkapi detail katalog produk."}</p>
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

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label className="admin-form-label">Nama Produk <span className="required-star">*</span></label>
          <input className="admin-form-input" type="text" placeholder="Contoh: Cincin Mawar Rosa Eternal"
            value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Harga <span className="required-star">*</span></label>
          <input className="admin-form-input" type="text" placeholder="Contoh: Rp55.000"
            value={form.harga} onChange={e => setForm(f => ({ ...f, harga: e.target.value }))} />
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label">Deskripsi Produk</label>
        <textarea className="admin-form-textarea" placeholder="Ceritakan tentang produk ini..."
          value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label">Jenis Bunga</label>
        <input className="admin-form-input" type="text" placeholder="Contoh: Melati"
          value={form.bunga} onChange={e => setForm(f => ({ ...f, bunga: e.target.value }))} />
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

      </div>
      <div className="admin-panel-card admin-product-form-card">
      <div className="admin-panel-head">
        <div>
          <h2>Memory Vault Default</h2>
          <p>Isi pesan dan nama default yang ditampilkan pada halaman QR produk.</p>
        </div>
      </div>
      <div className="admin-form-row">
        <div className="admin-form-group">
          <label className="admin-form-label">Nama Penerima</label>
          <input className="admin-form-input" type="text" placeholder="Nama di kartu QR"
            value={form.namaPembeli} onChange={e => setForm(f => ({ ...f, namaPembeli: e.target.value }))} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Dari / Pengirim</label>
          <input className="admin-form-input" type="text" placeholder="Contoh: Keluarga Putri"
            value={form.dari} onChange={e => setForm(f => ({ ...f, dari: e.target.value }))} />
        </div>
      </div>
      <div className="admin-form-group">
        <label className="admin-form-label">Pesan Personal</label>
        <textarea className="admin-form-textarea" placeholder="Pesan yang tampil saat QR dipindai"
          value={form.pesan} onChange={e => setForm(f => ({ ...f, pesan: e.target.value }))} />
      </div>

      </div>
      <div className="admin-panel-card admin-product-form-card">
      <div className="admin-panel-head">
        <div>
          <h2>Unggah Foto</h2>
          <p>Tambahkan gambar produk dan foto QR yang akan digunakan.</p>
        </div>
      </div>
      <div className="admin-form-group">
        <label className="admin-form-label">Foto Produk</label>
        <div className="admin-upload-row">
          <input className="admin-form-input" type="text" placeholder="URL atau unggah otomatis"
            value={form.fotoProduk} onChange={e => setForm(f => ({ ...f, fotoProduk: e.target.value }))} />
          <button
            type="button"
            className="admin-upload-btn"
            disabled={uploadingImage !== null || !form.id.trim()}
            title={!form.id.trim() ? "Isi ID Produk dulu" : "Unggah & kompresi ke WebP (maks 5 MB)"}
            onClick={() => produkUploadRef.current?.click()}
          >
            {uploadingImage === "produk" ? "Mengunggah..." : "Unggah & Optimasi"}
          </button>
          <input
            ref={produkUploadRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="admin-upload-input"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleImageUpload("produk", file);
              e.target.value = "";
            }}
          />
        </div>
        {form.fotoProduk.startsWith("http") && (
          <img className="admin-upload-preview" src={productImageUrl(form.fotoProduk, "thumb")} alt="Pratinjau foto produk" />
        )}
        {(() => {
          const err = form.fotoProduk.trim() ? validateImageUrl(form.fotoProduk) : null;
          if (err) return <p className="form-hint form-hint-error">{err}</p>;
          if (form.fotoProduk.trim() && !isSupabaseStorageUrl(form.fotoProduk)) {
            return (
              <p className="form-hint form-hint-warn">
                URL eksternal tidak dioptimasi CDN. Sambungkan ke storage dengan "Unggah & Optimasi".
              </p>
            );
          }
          return null;
        })()}
        <p className="form-hint">Maks. 5 MB · otomatis dikompresi ke WebP · thumbnail 600px dibuat CDN untuk katalog.</p>
      </div>
      <div className="admin-form-group">
        <label className="admin-form-label">Foto QR</label>
        <div className="admin-upload-row">
          <input className="admin-form-input" type="text" placeholder="URL atau unggah otomatis"
            value={form.fotoQr} onChange={e => setForm(f => ({ ...f, fotoQr: e.target.value }))} />
          <button
            type="button"
            className="admin-upload-btn"
            disabled={uploadingImage !== null || !form.id.trim()}
            title={!form.id.trim() ? "Isi ID Produk dulu" : "Unggah & kompresi ke WebP (maks 5 MB)"}
            onClick={() => qrUploadRef.current?.click()}
          >
            {uploadingImage === "qr" ? "Mengunggah..." : "Unggah & Optimasi"}
          </button>
          <input
            ref={qrUploadRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="admin-upload-input"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleImageUpload("qr", file);
              e.target.value = "";
            }}
          />
        </div>
        {form.fotoQr.startsWith("http") && (
          <img className="admin-upload-preview" src={productImageUrl(form.fotoQr, "thumb")} alt="Pratinjau foto QR" />
        )}
        {(() => {
          const err = form.fotoQr.trim() ? validateImageUrl(form.fotoQr) : null;
          if (err) return <p className="form-hint form-hint-error">{err}</p>;
          if (form.fotoQr.trim() && !isSupabaseStorageUrl(form.fotoQr)) {
            return (
              <p className="form-hint form-hint-warn">
                URL eksternal tidak dioptimasi CDN. Sambungkan ke storage dengan "Unggah & Optimasi".
              </p>
            );
          }
          return null;
        })()}
        <p className="form-hint">Maks. 5 MB · otomatis dikompresi ke WebP · tampil ukuran besar di halaman scan QR.</p>
      </div>

      <div className="admin-form-actions">
        <button type="button" className="btn-generate" onClick={saveProductAndGenerateQR} disabled={savingProduct}>
          {savingProduct ? "Menyimpan..." : editingId ? "Update Produk" : "Simpan Produk"}
        </button>
        <button type="button" className="btn-secondary-admin" onClick={generateQR}>Generate QR</button>
        <button type="button" className="btn-reset" onClick={resetForm}>Bersihkan</button>
      </div>
      {qrVisible && (
        <div className="admin-inline-qr">
          <div ref={qrRef}>
            <QRCode value={generatedUrl} size={168} fgColor="#111111" bgColor="#fafbff" level="M" />
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
    </>
  );

  const renderProductList = () => (
    <div className="admin-panel-card">
      <div className="admin-panel-head">
        <div>
          <h2>Daftar Produk</h2>
          <p>{activeProducts.length} aktif, {archivedProducts.length} terarsip.</p>
        </div>
        <div className="admin-panel-head-actions">
          <button className="admin-primary-btn" onClick={() => {
            resetForm();
            setProductFormOpen(true);
          }}>
            + Tambah Produk Baru
          </button>
          <button className="admin-outline-btn" onClick={loadProducts} disabled={loadingProducts}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
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
            <div className={`admin-list-item admin-product-row${editingId === product.id ? " active" : ""}`} key={product.id}>
              <div className="admin-list-main">
                <strong>{product.nama_produk || product.id}</strong>
                <span>#{product.id}</span>
              </div>
              <span className={`admin-tier-badge tier-${product.tier.toLowerCase()}`}>
                {TIER_OPTIONS.find(option => option.value === product.tier.toLowerCase())?.label || product.tier}
              </span>
              <span className="admin-product-price">{formatHarga(product.harga) || "Tanpa harga"}</span>
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
          <p>{newOrderCount} pesanan baru dari form pelanggan.</p>
        </div>
        <div className="admin-panel-head-actions">
          <button className="admin-outline-btn" onClick={exportPreOrders}>
            <Download size={16} /> Export CSV
          </button>
          <button className="admin-outline-btn" onClick={loadPreOrders} disabled={loadingOrders}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>
      <div className="admin-order-filters">
        <input
          className="admin-form-input"
          type="search"
          placeholder="Cari nama, WhatsApp, produk, atau penerima"
          value={orderSearch}
          onChange={event => setOrderSearch(event.target.value)}
          aria-label="Cari pre-order"
        />
        <div className="admin-order-filter-tabs" role="group" aria-label="Filter status pre-order">
          <button
            type="button"
            className={`admin-order-filter${orderFilterStatus === "all" ? " active" : ""}`}
            onClick={() => setOrderFilterStatus("all")}
            aria-pressed={orderFilterStatus === "all"}
          >
            Semua <span>{searchedOrders.length}</span>
          </button>
          {ORDER_STATUSES.map(status => (
            <button
              type="button"
              key={status.value}
              className={`admin-order-filter status-${status.value}${orderFilterStatus === status.value ? " active" : ""}`}
              onClick={() => setOrderFilterStatus(status.value)}
              aria-pressed={orderFilterStatus === status.value}
            >
              {status.label} <span>{orderStatusCounts[status.value] || 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="admin-list">
        {loadingOrders ? (
          <div className="manage-empty">Memuat pre-order...</div>
        ) : preOrders.length === 0 ? (
          <div className="manage-empty">Belum ada pre-order.</div>
        ) : filteredOrders.length === 0 ? (
          <div className="manage-empty">Tidak ada pre-order yang cocok dengan pencarian atau filter ini.</div>
        ) : filteredOrders.map(order => {
          const currentStatus = getOrderStatus(order.status);
          const customerName = order.customer_name || "Kak";
          const productName = order.product_name || order.product_id || "produk pilihan Anda";
          const base = (localStorage.getItem(BASE_URL_KEY) || baseUrl).trim().replace(/\/$/, "");
          const productUrl = `${base}/produk?id=${encodeURIComponent(order.product_id || "")}`;
          const linkedProduct = managedProducts.find(product => product.id === order.product_id);
          const dpAmount = linkedProduct
            ? formatCurrency(parsePrice(linkedProduct.harga) * 0.5)
            : "50% dari total pesanan";
          const dpMessage = `Halo Kak ${customerName}! Terima kasih sudah memesan ${productName} di Floramory. Untuk memulai pembuatan Memory Vault dan pengawetan bunga, silakan transfer DP 50% sebesar ${dpAmount} ke rekening resmi Floramory yang akan dikirimkan tim kami. Setelah transfer, mohon kirim bukti pembayaran di chat ini.`;
          const progressMessage = `Halo Kak ${customerName}! Karya botani pesanan Anda (${productName}) saat ini sedang menjalani dehidrasi silica di laboratorium dan casting kristal anti-UV. Kami akan mengabari Anda kembali saat karya siap.`;
          const vaultMessage = `Halo Kak ${customerName}! Memory Vault untuk ${order.recipient_name || "penerima hadiah"} sudah aktif. Pratinjau digital kado Anda dapat diakses di: ${productUrl}`;
          const whatsappNumber = normalizeWhatsApp(order.whatsapp);
          const directChatUrl = `https://wa.me/${whatsappNumber}`;
          const whatsappUrl = (message: string) =>
            `${directChatUrl}?text=${encodeURIComponent(message)}`;
          const vaultAvailable = currentStatus === "completed" && Boolean(order.product_id);
          return (
          <div className="admin-list-item admin-order-row" key={order.id || `${order.whatsapp}-${order.created_at}`}>
            <div className="admin-order-main">
              <div className="admin-order-primary">
                <strong>{order.customer_name || "Tanpa nama"}</strong>
                <span className="admin-order-meta">{order.whatsapp || "Tanpa WA"} / {order.product_name || order.product_id || "Produk belum dipilih"}</span>
                <span>{order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID") : ""}</span>
              </div>
              <select
                className={`admin-order-status-select status-${currentStatus}`}
                value={currentStatus}
                disabled={!order.id}
                aria-label={`Status pesanan ${customerName}`}
                onChange={event => void setOrderStatus(order, event.target.value)}
              >
                {ORDER_STATUSES.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}
              </select>
              {(order.recipient_name || order.personal_message || order.custom_request) && (
                <details className="admin-order-note">
                  <summary>
                    {order.recipient_name ? `Untuk ${order.recipient_name}: ` : ""}
                    {order.personal_message || order.custom_request}
                  </summary>
                </details>
              )}
            </div>
            <div className="admin-list-actions">
              <button type="button" className="admin-order-use" onClick={() => useOrderMemory(order)}>Pakai Data Memory</button>
              {whatsappNumber ? (
                <>
                  <a className="admin-order-whatsapp direct-wa" href={directChatUrl} target="_blank" rel="noopener noreferrer" title="Buka chat WhatsApp tanpa pesan">💬 Direct Chat</a>
                  <a className="admin-order-whatsapp" href={whatsappUrl(dpMessage)} target="_blank" rel="noopener noreferrer" title="Kirim instruksi pembayaran DP 50%">Confirm DP</a>
                  <a className="admin-order-whatsapp progress-wa" href={whatsappUrl(progressMessage)} target="_blank" rel="noopener noreferrer" title="Kirim kabar proses laboratorium">Progress Update</a>
                  {vaultAvailable ? (
                    <a className="admin-order-whatsapp vault-wa" href={whatsappUrl(vaultMessage)} target="_blank" rel="noopener noreferrer" title="Kirim tautan Memory Vault aktif">Send Vault Link</a>
                  ) : (
                    <button type="button" className="admin-order-whatsapp vault-wa is-disabled" disabled title="Tersedia setelah pesanan berstatus Delivered / Vault Active">Send Vault Link</button>
                  )}
                </>
              ) : (
                <span className="admin-order-wa-missing">Nomor WhatsApp tidak tersedia</span>
              )}
              <button type="button" className="admin-order-print" onClick={() => setPrintOrder(order)}>Cetak Label</button>
            </div>
          </div>
          );
        })}
      </div>
      {hasMorePreOrders && (
        <div className="admin-load-more">
          <button className="admin-outline-btn" onClick={loadMorePreOrders} disabled={loadingOrders}>
            Muat lebih banyak
          </button>
        </div>
      )}
    </div>
  );

  const renderFinancialReport = () => (
    <>
      <section className="admin-financial-stats">
        <article className="admin-financial-card">
          <span className="admin-financial-icon"><DollarSign size={20} /></span>
          <div><p>Total Pendapatan (Omzet)</p><strong>{formatCurrency(totalRevenue)}</strong></div>
        </article>
        <article className="admin-financial-card">
          <span className="admin-financial-icon"><ClipboardList size={20} /></span>
          <div><p>Jumlah Transaksi Selesai</p><strong>{financialTransactions.length}</strong></div>
        </article>
        <article className="admin-financial-card">
          <span className="admin-financial-icon"><Wallet size={20} /></span>
          <div><p>Estimasi DP Diterima (50%)</p><strong>{formatCurrency(estimatedDpReceived)}</strong></div>
        </article>
        <article className="admin-financial-card">
          <span className="admin-financial-icon"><TrendingUp size={20} /></span>
          <div><p>Rata-rata Nilai Transaksi</p><strong>{formatCurrency(averageTransaction)}</strong></div>
        </article>
      </section>
      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div>
            <h2>Daftar Transaksi Berhasil</h2>
            <p>{loadingOrders ? "Memuat seluruh data pre-order..." : `${financialTransactions.length} transaksi berstatus selesai atau lunas.`}</p>
          </div>
          <button className="admin-primary-btn" onClick={exportFinancialReport} disabled={loadingOrders || financialTransactions.length === 0}>
            <Download size={16} /> Export Laporan Keuangan (CSV)
          </button>
        </div>
        {loadingOrders ? (
          <div className="manage-empty">Memuat laporan keuangan...</div>
        ) : financialTransactions.length === 0 ? (
          <div className="manage-empty">Belum ada transaksi yang selesai atau lunas.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-financial-table">
              <thead>
                <tr><th>Tanggal</th><th>Nama Pelanggan</th><th>Produk</th><th>Nilai Transaksi</th><th>Status Pembayaran</th></tr>
              </thead>
              <tbody>
                {financialTransactions.map(({ order, product, amount }) => (
                  <tr key={order.id || `${order.whatsapp}-${order.created_at}`}>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID") : "-"}</td>
                    <td>{order.customer_name || "Tanpa nama"}</td>
                    <td>{product?.nama_produk || order.product_name || order.product_id || "Produk tidak ditemukan"}</td>
                    <td>{product ? formatCurrency(amount) : "Harga tidak tersedia"}</td>
                    <td>
                      <span className={`admin-payment-badge ${(order.status || "").toLowerCase()}`}>
                        {isDpReceivedStatus(order.status) ? "DP Diterima (50%)" : "Selesai (100%)"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  const renderDashboard = () => (
    <>
      <section className="admin-stats-grid">
        <div className="admin-stat-card"><span>{activeProducts.length}</span><p>Total produk</p></div>
        {tierCounts.map(tier => (
          <div className="admin-stat-card" key={tier.value}><span>{tier.count}</span><p>{tier.label}</p></div>
        ))}
        <div className="admin-stat-card"><span>{newOrderCount}</span><p>Pesanan baru</p></div>
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
                  <td>{formatHarga(product.harga)}</td>
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

  const titleMap: Record<AdminTab, { title: string; desc: string }> = {
    dashboard: { title: "Dashboard", desc: "Ringkasan katalog dan pesanan Floramory." },
    produk: { title: "Produk", desc: "Kelola katalog produk Floramory." },
    pesanan: { title: "Pesanan", desc: "Kelola pre-order dan pakai data Memory Vault pelanggan." },
    keuangan: { title: "Keuangan", desc: "Pantau omzet dari pre-order yang sudah selesai." },
    pengaturan: { title: "Pengaturan", desc: "Atur domain QR dan nomor WhatsApp aktif." },
  };

  const renderContent = () => {
    if (activeTab === "dashboard") return renderDashboard();
    if (activeTab === "produk") return productFormOpen ? renderProductForm() : renderProductList();
    if (activeTab === "pesanan") return renderOrders();
    if (activeTab === "keuangan") return renderFinancialReport();
    return renderSettings();
  };

  return (
    <div className={`admin-shell${sidebarCollapsed ? " is-sidebar-collapsed" : " admin-sidebar-open"}`}>
      {!sidebarCollapsed && <button className="admin-sidebar-backdrop" onClick={() => setSidebarCollapsed(true)} aria-label="Tutup menu admin" />}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">F</div>
          <div>
            <strong aria-label="Floramory">
              <BrandLogo className="brand-logo-img admin-brand-logo-img" />
            </strong>
            <span>Admin Panel</span>
          </div>
        </div>
        <nav className="admin-side-nav">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                aria-label={tab.label}
                className={activeTab === tab.id ? "active" : ""}
                title={sidebarCollapsed ? tab.label : undefined}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (window.innerWidth < 768) setSidebarCollapsed(true);
                  if (tab.id === "keuangan") void loadAllPreOrders();
                }}
              >
                <Icon size={16} />
                <span className="admin-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          className="admin-sidebar-collapse"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          <span>{sidebarCollapsed ? "Perluas menu" : "Ciutkan menu"}</span>
        </button>
        <div className="admin-sidebar-footer">
          <p>Smart Eco-Preserved Artware</p>
          <span>Sumber data: Supabase</span>
          <div className="admin-realtime-indicator">
            <span className={`admin-realtime-dot${realtimeConnected ? " connected" : ""}`} />
            <span>{realtimeConnected ? "Realtime aktif" : "Realtime nonaktif"}</span>
          </div>
          <button onClick={logout}><LogOut size={16} /><span>Keluar</span></button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-main-header">
          <div className="admin-header-title">
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              title="Toggle sidebar (Ctrl+B)"
            >
              {sidebarCollapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div>
              <h1>{activeTab === "produk" && productFormOpen ? (editingId ? "Edit Produk" : "Tambah Produk Baru") : titleMap[activeTab].title}</h1>
              <p>{activeTab === "produk" && productFormOpen ? "Lengkapi detail produk, Memory Vault, dan foto." : titleMap[activeTab].desc}</p>
            </div>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-outline-btn" onClick={() => activeTab === "keuangan" ? void loadAllPreOrders() : void reloadAll()} disabled={loadingProducts || loadingOrders}>
              <RefreshCw size={16} />
              Muat ulang data
            </button>
            <button type="button" className="admin-outline-btn admin-header-logout" onClick={logout}>
              <LogOut size={16} />
              Keluar
            </button>
          </div>
        </header>
        <section className="admin-command-bar" aria-label="Operational command bar">
          <div className="admin-command-metrics">
            <button
              type="button"
              className="admin-command-metric is-new"
              onClick={() => {
                setActiveTab("pesanan");
                setOrderSearch("");
                setOrderFilterStatus("new");
              }}
            >
              <span className="admin-command-label">New inquiries</span>
              <strong aria-live="polite">{newOrderCount}</strong>
              <span className="admin-command-caption">Needs first contact</span>
            </button>
            <button
              type="button"
              className="admin-command-metric is-deposit"
              onClick={() => {
                setActiveTab("pesanan");
                setOrderSearch("");
                setOrderFilterStatus("dp_verified");
              }}
            >
              <span className="admin-command-label">Pending 50% DP</span>
              <strong aria-live="polite">{operationalCounts.dp_verified}</strong>
              <span className="admin-command-caption">Deposit stage</span>
            </button>
            <button
              type="button"
              className="admin-command-metric is-lab"
              onClick={() => {
                setActiveTab("pesanan");
                setOrderSearch("");
                setOrderFilterStatus("in_progress");
              }}
            >
              <span className="admin-command-label">In lab</span>
              <strong aria-live="polite">{operationalCounts.in_progress}</strong>
              <span className="admin-command-caption">Dehydration &amp; UV casting</span>
            </button>
            <button
              type="button"
              className="admin-command-metric is-ready"
              onClick={() => {
                setActiveTab("pesanan");
                setOrderSearch("");
                setOrderFilterStatus("completed");
              }}
            >
              <span className="admin-command-label">Ready / vault active</span>
              <strong aria-live="polite">{operationalCounts.completed}</strong>
              <span className="admin-command-caption">Completed keepsakes</span>
            </button>
          </div>
          <div className="admin-command-actions">
            <button
              type="button"
              className="admin-command-new-product"
              onClick={() => {
                resetForm();
                setActiveTab("produk");
                setProductFormOpen(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Plus size={16} /> New Product
            </button>
            <button
              type="button"
              className="admin-command-store"
              onClick={() => window.open(getAutoBaseUrl(), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink size={15} /> Open Live Store
            </button>
            <span className="admin-command-realtime" role="status" aria-live="polite">
              <span className={`admin-realtime-dot${realtimeConnected ? " connected" : ""}`} />
              {realtimeConnected ? "Realtime connected" : "Realtime offline"}
            </span>
          </div>
        </section>
        {renderContent()}
      </main>

      {printOrder && (
        <div className="admin-print-overlay" onClick={event => {
          if (event.target === event.currentTarget) setPrintOrder(null);
        }}>
          <section className="admin-print-modal" role="dialog" aria-modal="true" aria-labelledby="packing-slip-title">
            <div className="admin-print-actions">
              <button type="button" className="admin-outline-btn" onClick={() => setPrintOrder(null)}>Tutup</button>
              <button type="button" className="admin-primary-btn" onClick={() => window.print()}>Print Label</button>
            </div>
            <article className="admin-packing-slip">
              <header className="admin-packing-brand">
                <BrandLogo className="brand-logo-img admin-packing-logo" />
                <p>Smart Eco-Preserved Artware</p>
              </header>
              <h2 id="packing-slip-title">Memory Vault</h2>
              <div className="admin-packing-qr">
                <QRCode
                  value={`${(localStorage.getItem(BASE_URL_KEY) || baseUrl).trim().replace(/\/$/, "")}/produk?id=${encodeURIComponent(printOrder.product_id || "")}`}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="admin-packing-recipient">
                <p><span>Kepada</span><strong>{printOrder.recipient_name || "-"}</strong></p>
                <p><span>Dari</span><strong>{printOrder.sender_name || printOrder.customer_name || "-"}</strong></p>
              </div>
              <div className="admin-packing-message">
                <span>Pesan Personal</span>
                <p>“{printOrder.personal_message || "-"}”</p>
              </div>
              <footer className="admin-packing-product">
                <strong>{printOrder.product_name || "Floramory Gift"}</strong>
                <span>Serial: #{printOrder.product_id || "-"}</span>
              </footer>
            </article>
          </section>
        </div>
      )}

      <div className={`admin-toast${toastVisible ? " show" : ""} admin-toast--${toastLevel}`}>{toastMsg}</div>
    </div>
  );
}
