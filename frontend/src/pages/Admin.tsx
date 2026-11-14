import { useEffect, useMemo, useRef, useState, useCallback, type ComponentType } from "react";
import "./admin.css";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import {
  Box,
  ClipboardList,
  ChevronRight,
  Copy,
  DollarSign,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  fetchManagedProducts,
  fetchPreOrders,
  fetchPreOrderStatusCounts,
  fetchHeroConfig,
  fetchProductCategories,
  fetchWhatsAppNumber,
  hasSupabaseConfig,
  notifyDpConfirmed,
  restoreProduct,
  signInAdmin,
  signOutAdmin,
  statusAdminSession,
  touchAdminSession,
  updatePreOrderStatus,
  updatePreOrderGroupStatus,
  updateHeroConfig,
  updateProductCategories,
  updateWhatsAppNumber,
  updateProduct,
  uploadProductImage,
  type PreOrder,
  type Product,
  type ProductCategoryItem,
  type PreOrderStatusCounts,
  type HeroConfig,
} from "@/lib/api";
import BrandLogo from "@/components/BrandLogo";
import { isSupabaseStorageUrl, productImageUrl, validateImageUrl } from "@/lib/images";
import { formatHarga, normalizeWhatsApp, PRODUCTION_SITE_URL } from "@/lib/site";
import { homeContent } from "@/content/homeContent";

const BASE_URL_KEY = "fm_base_url";
const WA_KEY = "fm_wa";
const SIDEBAR_PREFERENCE_KEY = "fm_admin_sidebar_collapsed";

const defaultHeroConfig: HeroConfig = {
  eyebrow: homeContent.hero.eyebrow,
  headline: homeContent.hero.headline,
  description: homeContent.hero.description,
  ctaText: homeContent.hero.ctaButton,
  ctaLink: "#chapters",
  bgImageUrl: homeContent.hero.bgImage,
};

const TIER_OPTIONS = [
  { value: "classic", label: "A Chapter Classic" },
  { value: "signature", label: "A Chapter Signature" },
  { value: "masterpiece", label: "A Chapter Masterpiece" },
];

const ORDER_STATUSES = [
  { value: "waiting_dp", label: "Menunggu DP" },
  { value: "dp_verified", label: "DP Diterima (50%)" },
  { value: "completed", label: "Selesai / Terkirim" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;

function getOrderStatus(status?: string): typeof ORDER_STATUSES[number]["value"] {
  const normalized = (status || "").toLowerCase();
  if (["new", "waiting_dp"].includes(normalized)) return "waiting_dp";
  if (["dp_verified", "in_production", "in_progress"].includes(normalized)) return "dp_verified";
  if (["contacted", "paid", "completed"].includes(normalized)) return "completed";
  return ORDER_STATUSES.find(option => option.value === normalized)?.value || "waiting_dp";
}

function isDpReceivedStatus(status?: string): boolean {
  const normalized = (status || "").toLowerCase();
  return ["paid", "dp_verified", "in_production", "in_progress", "completed"].includes(normalized);
}

type AdminTab = "dashboard" | "produk" | "pesanan" | "keuangan" | "pengaturan";

interface FormState {
  id: string;
  tier: string;
  kategori: string;
  nama: string;
  harga: string;
  bunga: string;
  deskripsi: string;
  bahan: string;
  ukuran: string;
  namaPembeli: string;
  recipientWhatsapp: string;
  orderId: string;
  dari: string;
  pesan: string;
  fotoProduk: string;
  galleryPhotos: string[];
  audioUrl: string;
  audioDurasi: number;
  videoUrl: string;
  fotoVault: string;
  vaultPin: string;
  isCatalog: boolean;
}

const MAX_GALLERY_PHOTOS = 4;

const EMPTY: FormState = {
  id: "",
  tier: "",
  kategori: "",
  nama: "",
  harga: "",
  bunga: "",
  deskripsi: "",
  bahan: "",
  ukuran: "",
  namaPembeli: "",
  recipientWhatsapp: "",
  orderId: "",
  dari: "",
  pesan: "",
  fotoProduk: "",
  galleryPhotos: [],
  audioUrl: "",
  audioDurasi: 0,
  videoUrl: "",
  fotoVault: "",
  vaultPin: "",
  isCatalog: false,
};

function productToForm(product: Product): FormState {
  return {
    id: product.id,
    tier: product.tier,
    kategori: product.kategori || product.bunga || "",
    nama: product.nama_produk,
    harga: product.harga,
    bunga: product.bunga,
    deskripsi: product.deskripsi,
    bahan: product.bahan,
    ukuran: product.ukuran,
    namaPembeli: product.nama_pembeli,
    recipientWhatsapp: product.recipient_whatsapp || "",
    orderId: product.order_id || "",
    dari: product.dari,
    pesan: product.pesan_personal,
    fotoProduk: product.foto_produk,
    galleryPhotos: product.gallery_photos || [],
    audioUrl: product.audio_url || "",
    audioDurasi: product.audio_durasi || 0,
    videoUrl: product.video_url || "",
    fotoVault: product.foto_vault || "",
    vaultPin: product.vault_pin || "",
    isCatalog: Boolean(product.is_catalog),
  };
}

function getLocalOriginUrl(): string {
  const { protocol, host } = window.location;
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const origin = `${protocol}//${host}`;
  return base ? `${origin}${base}` : origin;
}

function getAutoBaseUrl(): string {
  return PRODUCTION_SITE_URL;
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

function LoginGate({ onLogin, notice }: { onLogin: () => void; notice?: string }) {
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
          <div className="login-logo" aria-label="A Chapter">
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
        <div className="login-logo" aria-label="A Chapter">
          <BrandLogo className="brand-logo-img login-logo-img" />
        </div>
        <div className="login-subtitle">Admin Panel</div>
        <div className="login-icon">Admin</div>
        {notice && (
          <div
            role="status"
            style={{
              margin: "0 0 14px",
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(197, 168, 128, 0.14)",
              border: "1px solid rgba(197, 168, 128, 0.45)",
              color: "#531B21",
              fontSize: 13,
              lineHeight: 1.55,
              textAlign: "center",
            }}
          >
            {notice}
          </div>
        )}
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
  const [sessionNotice, setSessionNotice] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (window.innerWidth < 768) return true;
    return localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
  });
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [waNum, setWaNum] = useState("");
  const [categories, setCategories] = useState<ProductCategoryItem[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [savingCategories, setSavingCategories] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(defaultHeroConfig);
  const [savingHeroConfig, setSavingHeroConfig] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [managedProducts, setManagedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [preOrderOffset, setPreOrderOffset] = useState(0);
  const [hasMorePreOrders, setHasMorePreOrders] = useState(false);
  const [operationalCounts, setOperationalCounts] = useState<PreOrderStatusCounts>({
    waiting_dp: 0,
    dp_verified: 0,
    completed: 0,
    cancelled: 0,
  });
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilterStatus, setOrderFilterStatus] = useState<"all" | typeof ORDER_STATUSES[number]["value"]>("all");
  const [financialSearch, setFinancialSearch] = useState("");
  const [financialPeriod, setFinancialPeriod] = useState<"all" | "month" | "30days">("all");
  const [editingId, setEditingId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productViewTab, setProductViewTab] = useState<"catalog" | "orders">("catalog");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastLevel, setToastLevel] = useState<"info" | "success" | "alert">("info");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const produkUploadRef = useRef<HTMLInputElement>(null);
  const galleryUploadRef = useRef<HTMLInputElement>(null);
  const heroUploadRef = useRef<HTMLInputElement>(null);
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
    document.title = "Admin — A Chapter";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    let active = true;
    statusAdminSession().then((status) => {
      if (!active) return;
      if (status.authenticated && status.isAdmin) {
        setSessionNotice("");
        setAuthed(true);
        return;
      }
      if (status.reason === "idle") {
        setSessionNotice(
          "Sesi berakhir karena panel admin tidak aktif lebih dari 60 menit. Silakan login kembali."
        );
      }
      void signOutAdmin();
    });
    return () => {
      active = false;
    };
  }, []);

  // Sesi berakhir di server (idle timeout / refresh token mati): langsung
  // kembalikan UI ke halaman login tanpa menunggu request berikutnya.
  useEffect(() => {
    const onExpired = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      setSessionNotice(
        reason === "idle"
          ? "Sesi berakhir karena panel admin tidak aktif lebih dari 60 menit. Silakan login kembali."
          : "Sesi admin berakhir. Silakan login kembali."
      );
      setAuthed(false);
    };
    window.addEventListener("fm:admin-expired", onExpired);
    return () => window.removeEventListener("fm:admin-expired", onExpired);
  }, []);

  // Heartbeat idle timeout: hanya berjalan saat tab terlihat DAN window fokus.
  // Pindah tab/minimize/aplikasi lain menghentikannya, sehingga setelah
  // 60 menit panel ditinggalkan sesi ditolak server. Selama panel benar-benar
  // dilihat, sesi tidak pernah mendekati kedaluwarsa.
  useEffect(() => {
    if (!authed) return;
    let timer: number | undefined;

    const isActive = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const beat = () => {
      if (isActive()) void touchAdminSession();
    };
    const start = () => {
      if (timer !== undefined) return;
      beat();
      timer = window.setInterval(beat, 60_000);
    };
    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const sync = () => {
      if (isActive()) start();
      else stop();
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("pointerdown", sync);
    document.addEventListener("keydown", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("pointerdown", sync);
      document.removeEventListener("keydown", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
    };
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const saved = localStorage.getItem(BASE_URL_KEY)?.trim();
    // Default strictly to PRODUCTION_SITE_URL if unconfigured, localhost, or legacy floramory domain
    const isLocalhost = saved ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(saved) : false;
    const isLegacyDomain = saved ? saved.includes("floramory.store") : false;
    const initialUrl = saved && !isLocalhost && !isLegacyDomain ? saved : PRODUCTION_SITE_URL;
    setBaseUrl(initialUrl);
    if (!saved || isLocalhost || isLegacyDomain) localStorage.setItem(BASE_URL_KEY, initialUrl);
    setWaNum(localStorage.getItem(WA_KEY) || "");
    fetchWhatsAppNumber().then((value) => {
      if (value) {
        setWaNum(value);
        localStorage.setItem(WA_KEY, value);
      }
    });
    fetchProductCategories().then((cats) => {
      setCategories(cats);
    });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    let active = true;
    void fetchHeroConfig().then(config => {
      if (active && config) setHeroConfig(config);
    });
    return () => {
      active = false;
    };
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

  // Auto-sync: polling berkala (30s) & sinkronisasi saat tab kembali aktif
  useEffect(() => {
    if (!authed) return;
    setRealtimeConnected(true);

    let prevWaiting = operationalCounts.waiting_dp ?? 0;

    const syncOrders = async () => {
      try {
        const counts = await fetchPreOrderStatusCounts();
        const currentWaiting = counts.waiting_dp ?? 0;
        if (currentWaiting > prevWaiting) {
          showToast("🛎️ Ada pre-order baru masuk!", "alert");
          void loadPreOrders();
        }
        prevWaiting = currentWaiting;
        setOperationalCounts(counts);
      } catch {
        // Abaikan error background polling
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncOrders();
      }
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncOrders();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setRealtimeConnected(false);
    };
  }, [authed, showToast, operationalCounts.waiting_dp]);

  const saveConfig = async () => {
    const clean = (baseUrl || PRODUCTION_SITE_URL).trim().replace(/\/+$/, "");
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
    showToast(`Base URL diset ke domain produksi (${auto})`);
  };

  const useLocalUrl = () => {
    const local = getLocalOriginUrl();
    setBaseUrl(local);
    localStorage.setItem(BASE_URL_KEY, local);
    showToast(`Base URL diset ke host lokal (${local})`, "alert");
  };

  const getPreviewUrl = () => {
    const rawBase = (localStorage.getItem(BASE_URL_KEY) || baseUrl || PRODUCTION_SITE_URL).trim();
    const b = rawBase.replace(/\/+$/, "");
    const productId = form.id.trim();
    if (!productId || !b) return null;
    const qrTargetUrl = `${b}/produk?id=${encodeURIComponent(productId)}`;
    return qrTargetUrl;
  };

  const productFromForm = (): Product => {
    const existing = editingId ? managedProducts.find(p => p.id === editingId) : null;
    const cat = form.kategori.trim();
    return {
      id: form.id.trim().toUpperCase(),
      nama_produk: form.nama,
      tier: form.tier,
      kategori: cat,
      harga: form.harga,
      bunga: form.bunga || cat,
      deskripsi: form.deskripsi,
      bahan: form.bahan,
      ukuran: form.ukuran,
      nama_pembeli: form.isCatalog ? "" : form.namaPembeli,
      recipient_whatsapp: form.isCatalog ? "" : form.recipientWhatsapp.trim(),
      order_id: form.isCatalog ? null : (form.orderId || null),
      dari: form.isCatalog ? "" : form.dari,
      pesan_personal: form.isCatalog ? "" : form.pesan,
      foto_produk: form.fotoProduk,
      gallery_photos: form.isCatalog ? form.galleryPhotos : (existing?.gallery_photos || []),
      foto_qr: "",
      audio_url: form.isCatalog ? "" : form.audioUrl.trim(),
      audio_durasi: form.isCatalog ? 0 : (form.audioDurasi || existing?.audio_durasi || 0),
      video_url: form.isCatalog ? "" : form.videoUrl.trim(),
      foto_vault: form.isCatalog ? "" : form.fotoVault.trim(),
      vault_pin: form.isCatalog ? "" : form.vaultPin.trim(),
      is_catalog: form.isCatalog,
    };
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

    // Validasi URL foto produk manual (opsional namun harus http/https kala diisi).
    const fotoProdukError = form.isCatalog ? validateImageUrl(form.fotoProduk) : null;
    if (fotoProdukError) {
      showToast(fotoProdukError);
      return;
    }

    setSavingProduct(true);
    try {
      if (editingId) await updateProduct(editingId, productFromForm());
      else await createProduct(productFromForm());
      await loadProducts();
      if (!form.isCatalog) {
        const url = getPreviewUrl();
        if (url) {
          setGeneratedUrl(url);
          setQrVisible(true);
        }
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

  // Unggah foto produk: dikompresi & di-resize ke WebP di browser (maks 5 MB),
  // lalu dikirim lewat sesi admin (cookie) ke Supabase Storage.
  // URL Storage yang dihasilkan otomatis di-optimasi CDN saat ditampilkan.
  const handleImageUpload = async (file: File) => {
    if (uploadingImage) return;
    const trimmedId = form.id.trim();
    if (!trimmedId) {
      showToast("Harap isi ID Produk terlebih dahulu sebelum mengunggah foto.", "alert");
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadProductImage(trimmedId, "produk", file);
      setForm(f => ({ ...f, fotoProduk: url }));
      showToast("Foto produk terunggah (WebP, otomatis dioptimasi)");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengunggah foto");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    if (uploadingGallery) return;
    const trimmedId = form.id.trim();
    if (!trimmedId) {
      showToast("Harap isi ID Produk terlebih dahulu sebelum mengunggah foto.", "alert");
      return;
    }

    const slotsLeft = MAX_GALLERY_PHOTOS - form.galleryPhotos.length;
    if (slotsLeft <= 0) {
      showToast(`Galeri sudah penuh (maks. ${MAX_GALLERY_PHOTOS} foto).`, "alert");
      return;
    }

    const selected = Array.from(files).slice(0, slotsLeft);
    if (selected.length === 0) return;

    setUploadingGallery(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < selected.length; i++) {
        const slot = `gallery-${Date.now()}-${i}` as const;
        const url = await uploadProductImage(trimmedId, slot, selected[i]);
        urls.push(url);
      }
      setForm(f => ({
        ...f,
        galleryPhotos: [...f.galleryPhotos, ...urls].slice(0, MAX_GALLERY_PHOTOS),
      }));
      showToast(`${urls.length} foto galeri terunggah (WebP, otomatis dioptimasi)`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengunggah foto galeri", "alert");
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryPhoto = (url: string) => {
    setForm(f => ({ ...f, galleryPhotos: f.galleryPhotos.filter(item => item !== url) }));
  };

  const handleHeroImageUpload = async (file: File) => {
    if (uploadingHeroImage) return;
    setUploadingHeroImage(true);
    try {
      const url = await uploadProductImage("site-settings-hero", "produk", file);
      setHeroConfig(current => ({ ...current, bgImageUrl: url }));
      showToast("Foto banner berhasil diunggah.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengunggah foto banner.", "alert");
    } finally {
      setUploadingHeroImage(false);
    }
  };

  const saveHeroConfig = async () => {
    setSavingHeroConfig(true);
    try {
      await updateHeroConfig({
        ...heroConfig,
        bgImageUrl: heroConfig.bgImageUrl || "",
      });
      showToast("Hero banner berhasil diperbarui!", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan hero banner.", "alert");
    } finally {
      setSavingHeroConfig(false);
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

  const handleArchiveProduct = async (product: Product) => {
    const ok = window.confirm(`Arsipkan produk ${product.id}? Produk disembunyikan dari katalog, tetapi datanya tetap tersimpan dan bisa dipulihkan.`);
    if (!ok) return;

    try {
      await archiveProduct(product.id);
      setManagedProducts(products => products.map(item =>
        item.id === product.id ? { ...item, deleted_at: new Date().toISOString() } : item
      ));
      if (editingId === product.id) resetForm();
      await loadProducts();
      showToast("Produk diarsipkan. Data tetap aman dan bisa dipulihkan.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengarsipkan produk");
    }
  };

  const handleRestoreProduct = async (product: Product) => {
    try {
      await restoreProduct(product.id);
      setManagedProducts(products => products.map(item =>
        item.id === product.id ? { ...item, deleted_at: null } : item
      ));
      await loadProducts();
      showToast("Produk berhasil dipulihkan.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memulihkan produk");
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const ok = window.confirm(`Hapus permanen produk ${product.id}? Tindakan ini tidak bisa dibatalkan. Gunakan "Arsipkan" jika hanya ingin menyembunyikannya.`);
    if (!ok) return;

    try {
      await deleteProduct(product.id, [product.foto_produk, product.foto_qr, product.foto_vault, ...(product.gallery_photos || [])]);
      setManagedProducts(products => products.filter(item => item.id !== product.id));
      if (editingId === product.id) resetForm();
      await loadProducts();
      showToast("Produk berhasil dihapus secara permanen", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus produk");
    }
  };

  const processOrderToProduct = (order: PreOrder) => {
    const rawId = order.id ? order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() : "";
    const uniqueId = `ORD-${rawId || Date.now().toString().slice(-6)}`;

    const linkedProduct = managedProducts.find(item => item.id === order.product_id)
      || managedProducts.find(item => item.nama_produk.toLowerCase() === (order.product_name || "").toLowerCase());

    setEditingId("");
    setForm({
      ...EMPTY,
      id: uniqueId,
      isCatalog: false,
      nama: order.product_name || linkedProduct?.nama_produk || (order.product_id ? `Pesanan #${order.product_id}` : "Kado Botani A Chapter"),
      tier: linkedProduct?.tier || "classic",
      harga: linkedProduct?.harga || "",
      bunga: linkedProduct?.bunga || "",
      bahan: linkedProduct?.bahan || "Epoxy resin + stainless steel",
      ukuran: linkedProduct?.ukuran || "",
      deskripsi: order.custom_request ? `Catatan kustom: ${order.custom_request}` : (linkedProduct?.deskripsi || ""),
      namaPembeli: order.recipient_name || order.customer_name || "",
      recipientWhatsapp: order.recipient_whatsapp || order.whatsapp || "",
      orderId: order.id || "",
      dari: order.sender_name || order.customer_name || "",
      pesan: order.personal_message || order.custom_request || "",
      fotoProduk: linkedProduct?.foto_produk || "",
      audioUrl: order.audio_url || "",
      audioDurasi: order.audio_durasi || 0,
      videoUrl: order.video_url || "",
      fotoVault: order.foto_vault || "",
      vaultPin: order.vault_pin || "",
    });

    setProductFormOpen(true);
    setActiveTab("produk");
    setProductViewTab("orders");
    setQrVisible(false);
    setGeneratedUrl("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`Form kado fisik #${uniqueId} siap. Masukkan link media & simpan.`);
  };

  const setOrderStatus = async (order: PreOrder, status: string) => {
    if (!order.id) return;
    const previousStatus = getOrderStatus(order.status);
    const nextStatus = getOrderStatus(status);
    const isGroupDpVerification = Boolean(order.group_id) && nextStatus === "dp_verified";
    try {
      // Satu grup = satu reservasi. Verifikasi DP dari dropdown item mana pun
      // harus membuka gate vault semua karya, bukan hanya item yang dipilih.
      if (isGroupDpVerification && order.group_id) {
        await updatePreOrderGroupStatus(order.group_id, status);
        setPreOrders(orders =>
          orders.map(item =>
            item.group_id === order.group_id ? { ...item, status } : item
          )
        );
        const counts = await fetchPreOrderStatusCounts();
        setOperationalCounts(counts);
        void notifyDpConfirmed(order.id).catch(error => {
          console.warn("[DP_NOTIFICATION_AUDIT_ERROR]", error);
        });
        const itemCount =
          order.group_item_count ||
          preOrders.filter(item => item.group_id === order.group_id).length;
        showToast(
          `DP grup ${order.group_number || order.group_id} diverifikasi untuk ${itemCount} karya.`,
          "success"
        );
        return;
      }

      await updatePreOrderStatus(order.id, status);
      setPreOrders(orders => orders.map(item => item.id === order.id ? { ...item, status } : item));
      if (previousStatus !== nextStatus) {
        setOperationalCounts(counts => {
          const updated = { ...counts };
          updated[previousStatus] = Math.max(0, counts[previousStatus] - 1);
          updated[nextStatus] = counts[nextStatus] + 1;
          return updated;
        });
        if (previousStatus === "waiting_dp" && (nextStatus === "dp_verified" || nextStatus === "completed")) {
          void notifyDpConfirmed(order.id).catch(error => {
            console.warn("[DP_NOTIFICATION_AUDIT_ERROR]", error);
          });
          showToast("DP dikonfirmasi. Gunakan tombol 'Kirim Link WA' untuk mengirim tautan ke pemesan.", "success");
          return;
        }
      }
      const statusLabel = ORDER_STATUSES.find(option => option.value === status)?.label || status;
      showToast(`Status pesanan diperbarui: ${statusLabel}`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengubah status pre-order");
    }
  };

  const verifyGroupDp = async (order: PreOrder) => {
    if (!order.group_id) return;
    const groupOrders = preOrders.filter(item => item.group_id === order.group_id);
    try {
      await updatePreOrderGroupStatus(order.group_id, "dp_verified");
      setPreOrders(orders =>
        orders.map(item =>
          item.group_id === order.group_id ? { ...item, status: "dp_verified" } : item
        )
      );
      const firstOrder = groupOrders.find(item => item.id);
      if (firstOrder?.id) {
        void notifyDpConfirmed(firstOrder.id).catch(error => {
          console.warn("[DP_NOTIFICATION_AUDIT_ERROR]", error);
        });
      }
      showToast(
        `DP grup ${order.group_number || order.group_id} diverifikasi untuk ${groupOrders.length} karya.`,
        "success"
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memverifikasi DP grup");
    }
  };

  const logout = async () => {
    await signOutAdmin();
    setSessionNotice("");
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

    // High-resolution canvas for physical printing (acrylic tags, sticker paper, gift cards)
    // Canvas dimensions: 1200 x 1500 px (well above 1024x1024 minimum requirement)
    const printCanvas = document.createElement("canvas");
    printCanvas.width = 1200;
    printCanvas.height = 1500;
    const ctx = printCanvas.getContext("2d");
    if (!ctx) {
      showToast("Gagal membuat canvas cetak resolusi tinggi");
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Luxury botanical card background
    ctx.fillStyle = "#fafbff";
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, 1200, 1500, 48);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, 1200, 1500);
    }

    // Subtle aesthetic outer border
    ctx.strokeStyle = "rgba(105, 112, 153, 0.25)";
    ctx.lineWidth = 4;
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, 1200, 1500, 48);
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, 1200, 1500);
    }

    // 2. Draw 1024x1024 QR Code at 1:1 pixel mapping with quiet zone
    // Positioned centered horizontally: (1200 - 1024) / 2 = 88 px, top margin = 80 px
    ctx.drawImage(canvas, 88, 80, 1024, 1024);

    // 3. Micro-QR Frame & Branding Integration
    // Primary brand header
    ctx.fillStyle = "#111111";
    ctx.font = "bold 64px 'Cormorant Garamond', Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A Chapter", 600, 1170);

    // Subtitle
    ctx.fillStyle = "#4f557d";
    ctx.font = "500 36px 'DM Sans', -apple-system, sans-serif";
    ctx.fillText("Smart Eco-Preserved Artware · Memory Vault", 600, 1230);

    // Product Serial / Identifier
    const productId = form.id.trim() || "new";
    ctx.fillStyle = "#697099";
    ctx.font = "bold 32px 'SF Mono', Menlo, Consolas, monospace";
    ctx.fillText("#" + productId, 600, 1290);

    // Micro-QR Whisper / Instruction
    ctx.fillStyle = "#4a4a4a";
    ctx.font = "26px 'DM Sans', -apple-system, sans-serif";
    ctx.fillText("Scan untuk info produk & pesan personal", 600, 1350);

    // 4. Download Trigger with required naming pattern: achapter-qr-${product.id || 'new'}.png
    const link = document.createElement("a");
    link.download = `achapter-qr-${form.id.trim() || "new"}.png`;
    link.href = printCanvas.toDataURL("image/png");
    link.click();
    showToast("QR Code resolusi cetak (1200×1500) berhasil didownload", "success");
  };

  const copyProductQrUrl = (productId: string) => {
    const base = (localStorage.getItem(BASE_URL_KEY) || baseUrl || PRODUCTION_SITE_URL).trim().replace(/\/+$/, "");
    const productUrl = `${base}/produk?id=${encodeURIComponent(productId)}`;
    navigator.clipboard.writeText(productUrl).then(() => showToast(`URL QR #${productId} disalin ke clipboard`));
  };

  const downloadProductQR = (product: Product) => {
    const base = (localStorage.getItem(BASE_URL_KEY) || baseUrl || PRODUCTION_SITE_URL).trim().replace(/\/+$/, "");
    const productUrl = `${base}/produk?id=${encodeURIComponent(product.id)}`;
    setForm(productToForm(product));
    setGeneratedUrl(productUrl);
    setQrVisible(true);
    setTimeout(() => {
      downloadQR();
    }, 100);
  };

  const exportPreOrders = () => {
    const columns = [
      "id",
      "customer_name",
      "whatsapp",
      "product_name",
      "status",
      "created_at",
      "custom_request",
    ] as const;
    const escapeCsv = (value: string | number | undefined) => {
      const text = String(value ?? "");
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
    link.download = `achapter-orders-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportFinancialReport = () => {
    const columns = ["Tanggal", "Nama Pelanggan", "Produk", "Nilai Penuh", "Nilai DP", "Sisa", "Status Pembayaran"];
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = filteredFinancialTransactions.map(({ order, product, amount, receivedAmount, remainingBalance, isFullySettled }) => [
      order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) : "",
      order.customer_name || "Tanpa nama",
      product?.nama_produk || order.product_name || order.product_id || "Produk tidak ditemukan",
      amount,
      receivedAmount,
      remainingBalance,
      isFullySettled ? "Lunas (100%)" : "DP Diterima (50%)",
    ]);
    const csv = [
      columns.map(escapeCsv).join(","),
      ...rows.map(row => row.map(escapeCsv).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `achapter-laporan-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const catalogProducts = useMemo(
    () => activeProducts.filter(p => p.is_catalog === true),
    [activeProducts]
  );
  const orderProducts = useMemo(
    () => activeProducts.filter(p => !p.is_catalog),
    [activeProducts]
  );
  const search = productSearch.trim().toLowerCase();
  const currentTabProducts = productViewTab === "catalog" ? catalogProducts : orderProducts;
  const filteredProducts = currentTabProducts.filter(p =>
    !search ||
    p.id.toLowerCase().includes(search) ||
    p.nama_produk.toLowerCase().includes(search) ||
    p.tier.toLowerCase().includes(search) ||
    (Boolean(p.nama_pembeli) && p.nama_pembeli.toLowerCase().includes(search))
  );
  const recentProducts = activeProducts.slice(0, 5);
  const tierCounts = TIER_OPTIONS.map(option => ({
    ...option,
    count: activeProducts.filter(product => product.tier === option.value).length,
  }));
  const previewUrl = getPreviewUrl();
  const financialTransactions = useMemo(() => preOrders
    .filter(order => isDpReceivedStatus(order.status))
    .map(order => {
      const product = managedProducts.find(item => item.id === order.product_id)
        || managedProducts.find(item => item.nama_produk.toLowerCase() === order.product_name.toLowerCase());
      const amount = product ? parsePrice(product.harga) : 0;
      const normalizedStatus = (order.status || "").toLowerCase();
      const isFullySettled = ["paid", "completed"].includes(normalizedStatus);
      const receivedAmount = isFullySettled ? amount : amount * 0.5;
      return {
        order,
        product,
        amount,
        receivedAmount,
        remainingBalance: amount - receivedAmount,
        isFullySettled,
      };
    }), [managedProducts, preOrders]);
  const totalOmzet = financialTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalCashIn = financialTransactions.reduce((sum, transaction) => sum + transaction.receivedAmount, 0);
  const totalRemaining = totalOmzet - totalCashIn;
  const averageTransaction = financialTransactions.length ? totalOmzet / financialTransactions.length : 0;
  const normalizedFinancialSearch = financialSearch.trim().toLowerCase();
  const now = new Date();
  const financialPeriodStart = financialPeriod === "month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : financialPeriod === "30days"
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : null;
  const filteredFinancialTransactions = financialTransactions.filter(({ order, product }) => {
    const matchesSearch = !normalizedFinancialSearch || [
      order.customer_name,
      order.whatsapp,
      product?.nama_produk,
      order.product_name,
      order.product_id,
    ].some(value => (value || "").toLowerCase().includes(normalizedFinancialSearch));
    if (!matchesSearch) return false;
    if (!financialPeriodStart) return true;
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    return createdAt !== null && !Number.isNaN(createdAt.getTime()) && createdAt >= financialPeriodStart && createdAt <= now;
  });
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
  const tabs: { id: AdminTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "produk", label: "Produk", icon: Box },
    { id: "pesanan", label: "Pesanan", icon: ClipboardList },
    { id: "keuangan", label: "Keuangan", icon: TrendingUp },
    { id: "pengaturan", label: "Pengaturan", icon: Settings },
  ];

  if (!authed) return (
    <LoginGate
      notice={sessionNotice}
      onLogin={() => {
        setSessionNotice("");
        setAuthed(true);
      }}
    />
  );

  const renderProductForm = () => (
    <>
      <button className="admin-outline-btn admin-back-to-products" onClick={() => setProductFormOpen(false)}>
        ← Kembali ke Daftar Produk
      </button>
      <div className="admin-panel-card admin-product-form-card">
      <div className="admin-panel-head">
        <div>
          <h2>Informasi Produk</h2>
          <p>{editingId ? `Edit data produk ${form.id}.` : "Pilih tipe dan lengkapi detail produk."}</p>
        </div>
        {editingId && <span className="admin-pill">Edit #{editingId}</span>}
      </div>

      <div className="admin-form-group" style={{ marginBottom: "1.25rem" }}>
        <label className="admin-form-label">Tipe Produk / Entitas</label>
        <div className="admin-type-pills">
          <button
            type="button"
            className={`admin-type-pill${form.isCatalog ? " active" : ""}`}
            onClick={() => { setForm(f => ({ ...f, isCatalog: true })); setQrVisible(false); setGeneratedUrl(""); }}
          >
            🛍️ Katalog Toko Publik
          </button>
          <button
            type="button"
            className={`admin-type-pill${!form.isCatalog ? " active" : ""}`}
            onClick={() => setForm(f => ({ ...f, isCatalog: false }))}
          >
            💌 Pesanan Khusus (Vault QR)
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: "6px" }}>
          {form.isCatalog
            ? "Produk ini akan tampil di etalase homepage publik (tanpa data pribadi/pesan kenangan)."
            : "Pesanan kado fisik privat: hanya dapat diakses lewat scan QR fisik atau admin, tidak bocor ke etalase publik."}
        </p>
      </div>

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label className="admin-form-label">ID Produk <span className="required-star">*</span></label>
          <input className="admin-form-input" type="text" placeholder="Contoh: ROSA-001"
            value={form.id} disabled={Boolean(editingId)} onChange={e => setForm(f => ({ ...f, id: e.target.value.toUpperCase() }))} />
          <p className="form-hint">{editingId ? "ID dikunci saat edit agar QR lama tetap valid." : "Kode unik per produk."}</p>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Kategori Produk</label>
          <select
            className="admin-form-select"
            value={form.kategori}
            onChange={e => setForm(f => ({ ...f, kategori: e.target.value, bunga: f.bunga || e.target.value }))}
          >
            <option value="">— Pilih Kategori Produk —</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <p className="form-hint">Atur daftar kategori di tab <strong>Pengaturan</strong>.</p>
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label className="admin-form-label">Lini Produk <span className="required-star">*</span></label>
          <select className="admin-form-select" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
            <option value="">Pilih tier</option>
            {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Harga <span className="required-star">*</span></label>
          <input className="admin-form-input" type="text" placeholder="Contoh: Rp55.000"
            value={form.harga} onChange={e => setForm(f => ({ ...f, harga: e.target.value }))} />
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label">Nama Produk <span className="required-star">*</span></label>
        <input className="admin-form-input" type="text" placeholder="Contoh: Cincin Mawar Rosa Eternal"
          value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
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

      {!form.isCatalog && (
        <div className="admin-panel-card admin-product-form-card">
          <div className="admin-panel-head">
            <div>
              <h2>Lampiran Memory Vault (Pesanan Kado Fisik)</h2>
              <p>Isi pesan personal dan media kenangan yang tampil saat QR fisik dipindai.</p>
            </div>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="vault-pin">PIN Kartu Fisik (6 Digit)</label>
            <div className="admin-upload-row">
              <input
                id="vault-pin"
                className="admin-form-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Contoh: 749201"
                value={form.vaultPin}
                onChange={event => setForm(f => ({
                  ...f,
                  vaultPin: event.target.value.replace(/\D/g, "").slice(0, 6),
                }))}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.12em" }}
              />
              <button
                type="button"
                className="admin-outline-btn"
                onClick={() => setForm(f => ({
                  ...f,
                  vaultPin: String(Math.floor(100000 + Math.random() * 900000)),
                }))}
              >
                Acak PIN
              </button>
            </div>
            <p className="form-hint">
              PIN rahasia di balik stiker gosok kartu ucapan. Pembeli/penerima memasukkan PIN ini untuk membuka Memory Vault.
            </p>
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label className="admin-form-label">Nama Penerima</label>
              <input className="admin-form-input" type="text" placeholder="Nama di kartu QR"
                value={form.namaPembeli} onChange={e => setForm(f => ({ ...f, namaPembeli: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="recipient-whatsapp">
                WhatsApp Penerima (Opsional)
              </label>
              <input
                id="recipient-whatsapp"
                className="admin-form-input"
                type="tel"
                inputMode="tel"
                placeholder="Contoh: 08123456789 atau 628..."
                value={form.recipientWhatsapp}
                onChange={e => setForm(f => ({
                  ...f,
                  recipientWhatsapp: e.target.value.replace(/[^\d+ -]/g, ""),
                }))}
              />
              <p className="form-hint">
                Nomor kontak penerima untuk keperluan konfirmasi kurir atau bantuan fisik kado.
              </p>
            </div>
          </div>
          <div className="admin-form-row">
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
      )}

      {form.isCatalog && (
        <div className="admin-panel-card admin-product-form-card">
          <div className="admin-panel-head">
            <div>
              <h2>Unggah Foto Produk</h2>
              <p>Tambahkan gambar produk yang akan digunakan di katalog.</p>
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
                disabled={uploadingImage || !form.id.trim()}
                title={!form.id.trim() ? "Isi ID Produk dulu" : "Unggah & kompresi ke WebP (maks 5 MB)"}
                onClick={() => produkUploadRef.current?.click()}
              >
                {uploadingImage ? "Mengunggah..." : "Unggah & Optimasi"}
              </button>
              <input
                ref={produkUploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                className="admin-upload-input"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
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
            <label className="admin-form-label">Galeri Foto Produk (Multi-Gambar)</label>
            <div className="admin-upload-row">
              <button
                type="button"
                className="admin-upload-btn"
                disabled={uploadingGallery || !form.id.trim() || form.galleryPhotos.length >= MAX_GALLERY_PHOTOS}
                title={!form.id.trim() ? "Isi ID Produk dulu" : "Pilih beberapa foto sekaligus (maks. 5 MB per foto)"}
                onClick={() => galleryUploadRef.current?.click()}
              >
                {uploadingGallery ? "Mengunggah..." : "Tambah Foto Galeri"}
              </button>
              <input
                ref={galleryUploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                multiple
                className="admin-upload-input"
                onChange={e => {
                  if (e.target.files?.length) void handleGalleryUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {form.galleryPhotos.length > 0 ? (
              <div className="admin-gallery-grid">
                {form.galleryPhotos.map(url => (
                  <div className="admin-gallery-item" key={url}>
                    <img src={productImageUrl(url, "thumb")} alt="Foto galeri produk" />
                    <button
                      type="button"
                      className="admin-gallery-remove"
                      onClick={() => removeGalleryPhoto(url)}
                      aria-label="Hapus foto galeri"
                      title="Hapus foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-hint">Belum ada foto galeri. Foto tambahan akan tampil di halaman detail (View Folio).</p>
            )}
            <p className="form-hint">
              Maks. {MAX_GALLERY_PHOTOS} foto tambahan · bisa pilih beberapa file sekaligus · otomatis WebP.
            </p>
          </div>
        </div>
      )}

      <div className="admin-panel-card admin-product-form-card">
        <div className="admin-form-actions">
          <button type="button" className="btn-generate" onClick={saveProductAndGenerateQR} disabled={savingProduct}>
            {savingProduct
              ? "Menyimpan..."
              : form.isCatalog
                ? (editingId ? "Update Katalog" : "Simpan ke Katalog")
                : (editingId ? "Update & Tampilkan QR" : "Simpan & Tampilkan QR")}
          </button>
          <button type="button" className="btn-reset" onClick={resetForm}>Bersihkan</button>
        </div>
        {!form.isCatalog && qrVisible && (
          <div className="admin-inline-qr">
            <div ref={qrRef}>
              <QRCode
                value={generatedUrl}
                size={1024}
                fgColor="#111111"
                bgColor="#fafbff"
                level="H"
                marginSize={2}
                style={{ width: "168px", height: "168px", display: "block" }}
              />
            </div>
            <div>
              <strong>{form.nama || form.id}</strong>
              <span>{generatedUrl}</span>
              {/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(generatedUrl) && (
                <div style={{ color: "#c0392b", fontSize: "0.75rem", fontWeight: 600, marginTop: "4px" }}>
                  ⚠️ URL lokal terdeteksi: Jangan cetak ke media fisik (akrilik/stiker)!
                </div>
              )}
              <div className="admin-inline-qr-actions">
                <button type="button" onClick={downloadQR}>Download PNG</button>
                <button type="button" onClick={copyUrl}>Salin URL</button>
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
          <h2>Manajemen Produk & Kado Fisik</h2>
          <p>{catalogProducts.length} produk katalog publik, {orderProducts.length} pesanan kado fisik ({archivedProducts.length} terarsip).</p>
        </div>
        <div className="admin-panel-head-actions">
          <button className="admin-primary-btn" onClick={() => {
            resetForm();
            setForm(f => ({ ...f, isCatalog: productViewTab === "catalog" }));
            setProductFormOpen(true);
          }}>
            {productViewTab === "catalog" ? "+ Tambah Produk Katalog" : "+ Buat Kado Fisik Baru"}
          </button>
        </div>
      </div>

      <div className="admin-product-tabs">
        <button
          type="button"
          className={`admin-product-tab${productViewTab === "catalog" ? " active" : ""}`}
          onClick={() => setProductViewTab("catalog")}
        >
          🛍️ Etalase Toko <span className="badge">{catalogProducts.length}</span>
        </button>
        <button
          type="button"
          className={`admin-product-tab${productViewTab === "orders" ? " active" : ""}`}
          onClick={() => setProductViewTab("orders")}
        >
          💌 Pesanan Kado Fisik <span className="badge">{orderProducts.length}</span>
        </button>
      </div>

      <input
        className="admin-form-input admin-product-search"
        type="search"
        placeholder={productViewTab === "catalog" ? "Cari produk katalog (ID, nama, tier)..." : "Cari kado fisik (ID, nama, penerima, tier)..."}
        value={productSearch}
        onChange={e => setProductSearch(e.target.value)}
      />
      <div className="admin-list">
        {loadingProducts ? (
          <div className="manage-empty">Memuat data...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="manage-empty">
            {productViewTab === "catalog"
              ? "Belum ada produk etalase toko."
              : "Belum ada pesanan kado fisik tersimpan."}
          </div>
        ) : filteredProducts.map(product => {
          const base = (localStorage.getItem(BASE_URL_KEY) || baseUrl || PRODUCTION_SITE_URL).trim().replace(/\/+$/, "");
          const productUrl = `${base}/produk?id=${encodeURIComponent(product.id)}`;
          const recipientWhatsapp = normalizeWhatsApp(product.recipient_whatsapp || "");
          return (
            <div className={`admin-list-item admin-product-row${editingId === product.id ? " active" : ""}`} key={product.id}>
              <div className="admin-list-main">
                <strong>{product.nama_produk || product.id}</strong>
                <span className="admin-product-id">#{product.id}</span>
                {!product.is_catalog && (
                  <span className="admin-product-recipient">
                    {product.nama_pembeli && (
                      <>Penerima: {product.nama_pembeli}{recipientWhatsapp && " · "}</>
                    )}
                    {recipientWhatsapp && (
                      <>
                        <Phone size={13} aria-hidden="true" /> WA:{" "}
                        <a
                          href={`https://wa.me/${recipientWhatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Hubungi penerima ${product.nama_pembeli || product.id} melalui WhatsApp`}
                        >
                          {product.recipient_whatsapp}
                        </a>
                      </>
                    )}
                  </span>
                )}
              </div>
              <span className={`admin-product-status${product.deleted_at || product.status === "archived" ? " is-archived" : " is-active"}`}>
                {product.deleted_at ? "Dihapus" : product.status === "archived" ? "Terarsip" : "Aktif"}
              </span>
              <span className={`admin-tier-badge tier-${product.tier.toLowerCase()}`}>
                {TIER_OPTIONS.find(option => option.value === product.tier.toLowerCase())?.label || product.tier}
              </span>
              <span className="admin-product-price">{formatHarga(product.harga) || "Tanpa harga"}</span>
              <div className="admin-list-actions">
                <button type="button" onClick={() => editProduct(product)}>Edit</button>
                <a href={productUrl} target="_blank" rel="noopener noreferrer">Cek</a>
                <details className="admin-product-more">
                  <summary aria-label={`Aksi lainnya untuk ${product.nama_produk || product.id}`} title="Aksi lainnya">
                    <MoreVertical size={16} aria-hidden="true" />
                  </summary>
                  <div className="admin-product-more-menu">
                    {!product.is_catalog && (
                      <>
                        <button type="button" onClick={event => {
                          copyProductQrUrl(product.id);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}>Salin QR</button>
                        <button type="button" onClick={event => {
                          downloadProductQR(product);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}>Download QR</button>
                      </>
                    )}
                    {product.deleted_at ? (
                      <button type="button" onClick={event => {
                        void handleRestoreProduct(product);
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}>Pulihkan</button>
                    ) : (
                      <>
                        <button type="button" onClick={event => {
                          void handleArchiveProduct(product);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}>Arsipkan</button>
                        <button type="button" className="danger" onClick={event => {
                          void handleDeleteProduct(product);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}>Hapus permanen</button>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPreOrders = () => (
    <div className="admin-panel-card">
      <div className="admin-panel-head">
        <div>
          <p>{orderStatusCounts.waiting_dp ?? operationalCounts.waiting_dp ?? 0} pesanan menunggu DP.</p>
        </div>
        <div className="admin-panel-head-actions">
          <button className="admin-outline-btn" onClick={exportPreOrders}>
            <Download size={16} /> Export CSV
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
          const activeBaseUrl = (localStorage.getItem(BASE_URL_KEY) || baseUrl || PRODUCTION_SITE_URL)
            .trim()
            .replace(/\/+$/, "");
          const setupToken = order.vault_setup_token || order.id || "";
          const vaultUrl = `${activeBaseUrl}/vault-setup?token=${encodeURIComponent(setupToken)}`;
          return (
            <div className="admin-list-item admin-order-row" key={order.id || `${order.whatsapp}-${order.created_at}`}>
              <div className="admin-order-main">
                <div className="admin-order-primary">
                  <div className="admin-order-heading">
                    <strong>{order.customer_name || "Tanpa nama"}</strong>
                    <span className="admin-order-date">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }) : ""}
                    </span>
                  </div>
                  <span className="admin-order-meta admin-order-phone">
                    <Phone size={13} aria-hidden="true" />
                    {order.whatsapp ? (
                      <a href={`https://wa.me/${normalizeWhatsApp(order.whatsapp)}`} target="_blank" rel="noopener noreferrer">
                        {order.whatsapp}
                      </a>
                    ) : "Tidak tersedia"}
                  </span>
                  <span className="admin-order-meta admin-order-product">
                    {order.product_name || order.product_id || "Produk belum dipilih"}
                  </span>
                  {order.nuansa && (
                    <span className="admin-order-meta admin-order-group-detail">
                      Nuansa: {order.nuansa}{order.inisial ? ` · Inisial: ${order.inisial}` : ""}
                    </span>
                  )}
                  {order.group_number && (
                    <span className="admin-order-meta admin-order-group-detail">
                      Grup <strong>{order.group_number}</strong> · Karya {order.group_item_index || 1} dari {order.group_item_count || 1}
                    </span>
                  )}
                  {Boolean(order.group_total_amount) && (
                    <span className="admin-order-meta admin-order-group-detail">
                      Total grup {formatHarga(String(order.group_total_amount))} · DP 50% {formatHarga(String(order.group_dp_amount || 0))}
                    </span>
                  )}
                </div>
                <div className="admin-order-payment">
                  <span className="admin-status-caption">Status Pembayaran</span>
                  <select
                    className={`admin-order-status-select status-${currentStatus}`}
                    value={currentStatus}
                    disabled={!order.id}
                    aria-label={`Status pembayaran pesanan ${customerName}`}
                    onChange={event => void setOrderStatus(order, event.target.value)}
                  >
                    {ORDER_STATUSES.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}
                  </select>
                  {order.group_id && (
                    <span className="admin-order-meta admin-order-group-detail">
                      Pilih “DP Diterima” untuk memverifikasi seluruh karya dalam grup ini.
                    </span>
                  )}
                  {order.group_id && (
                    <button
                      type="button"
                      className="admin-outline-btn admin-group-verify"
                      onClick={() => void verifyGroupDp(order)}
                    >
                      Verifikasi DP Semua Item
                    </button>
                  )}
                </div>
                <div className="admin-order-memory">
                  <span className="admin-status-caption">Status Memori Vault</span>
                  <div className="admin-order-pin-row">
                    <span className={`admin-order-pin-status ${order.vault_pin ? "ready" : "pending"}`}>
                      {order.vault_pin ? "Siap Cetak / Pasang Stiker Gosok" : "Menunggu Pengisian Kenangan"}
                    </span>
                    {order.vault_pin && (
                      <span className="admin-order-pin">
                        PIN Kartu: <strong>{order.vault_pin}</strong>
                        <button
                          type="button"
                          className="admin-order-pin-copy"
                          aria-label={`Salin PIN kartu pesanan ${order.order_number || order.id || customerName}`}
                          title="Salin PIN"
                          onClick={() => void (async () => {
                            try {
                              await navigator.clipboard.writeText(order.vault_pin || "");
                              showToast("PIN kartu berhasil disalin.", "success");
                            } catch (error) {
                              console.error("[VAULT_PIN_COPY_ERROR]", error);
                              showToast("Gagal menyalin PIN. Periksa izin clipboard browser.", "alert");
                            }
                          })()}
                        >
                          <Copy size={14} aria-hidden="true" />
                          <span>Salin PIN</span>
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                {(order.recipient_name || order.personal_message || order.custom_request) && (
                  <details className="admin-order-note">
                    <summary>
                      <ChevronRight size={14} className="admin-note-chevron" aria-hidden="true" />
                      {order.recipient_name ? `Penerima: ${order.recipient_name}` : "Detail pesan"}
                    </summary>
                    {(order.personal_message || order.custom_request) && (
                      <p>{order.personal_message || order.custom_request}</p>
                    )}
                  </details>
                )}
              </div>
              <div className="admin-list-actions">
                <button
                  type="button"
                  aria-label={`Salin link Vault untuk pesanan ${order.order_number || order.id || customerName}`}
                  className="admin-outline-btn"
                  disabled={!order.id}
                  onClick={() => void (async () => {
                    try {
                      await navigator.clipboard.writeText(vaultUrl);
                      showToast("Link Vault berhasil disalin.", "success");
                    } catch (error) {
                      console.error("[VAULT_LINK_COPY_ERROR]", error);
                      showToast("Gagal menyalin link Vault. Periksa izin clipboard browser.", "alert");
                    }
                  })()}
                >
                  Salin Link Vault
                </button>
                <a
                  className="admin-outline-btn"
                  aria-label={`Kirim link Vault melalui WhatsApp kepada ${customerName}`}
                  aria-disabled={!order.id}
                  href={`https://wa.me/${normalizeWhatsApp(order.whatsapp)}?text=${encodeURIComponent(
                    `Halo ${customerName}, DP untuk pesanan ${order.order_number || order.id} sudah dikonfirmasi. Berikut link rahasia Memory Vault A Chapter: ${vaultUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Kirim Link WA
                </a>
                <button
                  type="button"
                  className="admin-order-sync-btn"
                  onClick={() => {
                    if (window.confirm("Proses pesanan ini menjadi produk dan buat QR Vault? Aksi ini akan mengunci data pesanan.")) {
                      processOrderToProduct(order);
                    }
                  }}
                >
                  ✦ Proses jadi Produk &amp; Cetak QR
                </button>
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

  const renderOrders = renderPreOrders;

  const renderFinancialReport = () => (
    <>
      <section className="admin-financial-stats">
        <article className="admin-financial-card">
          <span className="admin-financial-icon is-omzet"><DollarSign size={20} /></span>
          <div><p>Total Omzet</p><strong>{formatCurrency(totalOmzet)}</strong></div>
        </article>
        <article className="admin-financial-card">
          <span className="admin-financial-icon is-cash"><Wallet size={20} /></span>
          <div>
            <p>Kas / DP Diterima</p>
            <strong>{formatCurrency(totalCashIn)}</strong>
            <small className="admin-financial-subtotal">Sisa piutang: {formatCurrency(totalRemaining)}</small>
          </div>
        </article>
        <article className="admin-financial-card">
          <span className="admin-financial-icon is-count"><ClipboardList size={20} /></span>
          <div><p>Total Transaksi</p><strong>{financialTransactions.length}</strong></div>
        </article>
        <article className="admin-financial-card">
          <span className="admin-financial-icon is-average"><TrendingUp size={20} /></span>
          <div><p>Rata-rata Order</p><strong>{formatCurrency(averageTransaction)}</strong></div>
        </article>
      </section>
      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div>
            <h2>Daftar Transaksi</h2>
            <p>{loadingOrders ? "Memuat seluruh data pre-order..." : `${financialTransactions.length} Pre-order terkonfirmasi (DP diterima atau lunas).`}</p>
          </div>
        </div>
        <div className="admin-financial-controls">
          <input
            className="admin-form-input"
            type="search"
            value={financialSearch}
            onChange={event => setFinancialSearch(event.target.value)}
            placeholder="Cari pelanggan, WhatsApp, atau produk"
            aria-label="Cari laporan keuangan"
          />
          <select
            className="admin-form-select"
            value={financialPeriod}
            onChange={event => {
              const value = event.target.value;
              setFinancialPeriod(value === "month" || value === "30days" ? value : "all");
            }}
            aria-label="Filter periode laporan keuangan"
          >
            <option value="all">Semua periode</option>
            <option value="month">Bulan ini</option>
            <option value="30days">30 hari terakhir</option>
          </select>
          <button className="admin-outline-btn" onClick={exportFinancialReport} disabled={loadingOrders || filteredFinancialTransactions.length === 0}>
            <Download size={16} /> Export Laporan Keuangan (CSV)
          </button>
        </div>
        {loadingOrders ? (
          <div className="manage-empty">Memuat laporan keuangan...</div>
        ) : financialTransactions.length === 0 ? (
          <div className="manage-empty">Belum ada Pre-order terkonfirmasi (DP diterima atau lunas).</div>
        ) : filteredFinancialTransactions.length === 0 ? (
          <div className="manage-empty">Tidak ada transaksi yang cocok dengan pencarian atau periode ini.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-financial-table">
              <thead>
                <tr><th>Tanggal</th><th>Pelanggan</th><th>Produk</th><th>Nilai Transaksi</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredFinancialTransactions.map(({ order, product, amount, receivedAmount, remainingBalance, isFullySettled }) => (
                  <tr key={order.id || `${order.whatsapp}-${order.created_at}`}>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) : "-"}</td>
                    <td>{order.customer_name || "Tanpa nama"}</td>
                    <td>{product?.nama_produk || order.product_name || order.product_id || "Produk tidak ditemukan"}</td>
                    <td>{product ? formatCurrency(amount) : "Harga tidak tersedia"}</td>
                    <td>{product ? formatCurrency(receivedAmount) : "Harga tidak tersedia"}</td>
                    <td>{product ? formatCurrency(remainingBalance) : "Harga tidak tersedia"}</td>
                    <td>
                      <span className={`status-badge ${isFullySettled ? "status-completed" : "status-waiting_dp"}`}>
                        {isFullySettled ? "Lunas (100%)" : "DP 50%"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>Total ({filteredFinancialTransactions.length} transaksi)</th>
                  <th>{formatCurrency(filteredFinancialTransactions.reduce((sum, transaction) => sum + transaction.amount, 0))}</th>
                  <th>{formatCurrency(filteredFinancialTransactions.reduce((sum, transaction) => sum + transaction.receivedAmount, 0))}</th>
                  <th>{formatCurrency(filteredFinancialTransactions.reduce((sum, transaction) => sum + transaction.remainingBalance, 0))}</th>
                  <th />
                </tr>
              </tfoot>
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
        <div className="admin-stat-card"><span>{operationalCounts.waiting_dp}</span><p>Menunggu DP</p></div>
        <div className="admin-stat-card"><span>{operationalCounts.dp_verified || 0}</span><p>DP Diterima (50%)</p></div>
        <div className="admin-stat-card"><span>{operationalCounts.completed}</span><p>Selesai</p></div>
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
          <label className="admin-form-label">Base URL website (Target QR Code)</label>
          <div className="settings-input-group" style={{ display: "flex", gap: "8px" }}>
            <input className="admin-form-input" type="text" placeholder="https://www.achapter.my.id"
              value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
            <button type="button" className="btn-save-config" onClick={useAutoUrl} title="Set ke domain produksi">Produksi</button>
            <button type="button" className="admin-outline-btn" onClick={useLocalUrl} title="Set ke host browser saat ini (dev mode)">Lokal</button>
            <button
              type="button"
              className="admin-outline-btn"
              onClick={() => {
                const ip = window.prompt(
                  "Masukkan alamat IP lokal (contoh: 192.168.1.10:5173):",
                  "192.168.1.10:5173"
                );
                if (ip) {
                  const url = `http://${ip.replace(/^https?:\/\//, "")}`;
                  setBaseUrl(url);
                  localStorage.setItem(BASE_URL_KEY, url);
                  showToast(`Base URL diset ke IP lokal (${url})`, "alert");
                }
              }}
              title="Isi IP LAN untuk test langsung dari HP"
            >
              IP Lokal
            </button>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "#4f557d", wordBreak: "break-all" }}>
            <strong>URL aktif di QR:</strong>{" "}
            {(baseUrl || PRODUCTION_SITE_URL).replace(/\/+$/, "")}/produk?id=<em>&lt;ID produk&gt;</em>
          </div>
          <small style={{ display: "block", marginTop: "4px", color: "#697099", fontSize: "0.75rem" }}>
            Default selalu mengarah ke <strong>{PRODUCTION_SITE_URL}</strong> agar QR fisik yang dicetak tidak memuat link localhost.
          </small>
          {/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl) && (
            <div style={{ marginTop: "6px", color: "#c0392b", fontSize: "0.75rem", fontWeight: 600 }}>
              ⚠️ Peringatan: Base URL sedang mengarah ke localhost. Jangan cetak QR fisik dengan URL ini!
            </div>
          )}
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
            <h2>Kelola Kategori Produk</h2>
            <p>Kategori ini akan otomatis muncul di form pemesanan dan filter katalog.</p>
          </div>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label">Tambah Kategori Baru</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              className="admin-form-input"
              type="text"
              placeholder="Contoh: Keychain, Bag Charm, Buket"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const name = newCatName.trim();
                  if (!name) return;
                  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                    showToast("Kategori sudah ada", "alert");
                    return;
                  }
                  const updated = [...categories, { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name }];
                  setCategories(updated);
                  setNewCatName("");
                  setSavingCategories(true);
                  updateProductCategories(updated)
                    .then(() => showToast(`Kategori "${name}" berhasil ditambahkan`, "success"))
                    .catch(() => showToast("Gagal menyimpan kategori", "alert"))
                    .finally(() => setSavingCategories(false));
                }
              }}
            />
            <button
              type="button"
              className="btn-save-config"
              disabled={savingCategories || !newCatName.trim()}
              onClick={() => {
                const name = newCatName.trim();
                if (!name) return;
                if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                  showToast("Kategori sudah ada", "alert");
                  return;
                }
                const updated = [...categories, { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name }];
                setCategories(updated);
                setNewCatName("");
                setSavingCategories(true);
                updateProductCategories(updated)
                  .then(() => showToast(`Kategori "${name}" berhasil ditambahkan`, "success"))
                  .catch(() => showToast("Gagal menyimpan kategori", "alert"))
                  .finally(() => setSavingCategories(false));
              }}
            >
              + Tambah
            </button>
          </div>
          <p className="form-hint" style={{ marginTop: "6px" }}>
            Tekan Enter atau klik tombol Tambah untuk menyimpan.
          </p>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label">Daftar Kategori Aktif ({categories.length})</label>
          {categories.length === 0 ? (
            <p className="form-hint">Belum ada kategori. Tambahkan di atas.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    background: "#f0f2fa",
                    border: "1px solid #d4daf0",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    color: "#283049",
                  }}
                >
                  <span>{cat.name}</span>
                  <button
                    type="button"
                    title={`Hapus kategori ${cat.name}`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#b03a2e",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "1rem",
                      lineHeight: 1,
                      padding: "0 2px",
                    }}
                    onClick={() => {
                      if (!window.confirm(`Hapus kategori "${cat.name}"?`)) return;
                      const updated = categories.filter(c => c.id !== cat.id);
                      setCategories(updated);
                      setSavingCategories(true);
                      updateProductCategories(updated)
                        .then(() => showToast(`Kategori "${cat.name}" dihapus`, "success"))
                        .catch(() => showToast("Gagal memperbarui kategori", "alert"))
                        .finally(() => setSavingCategories(false));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="admin-panel-card" style={{ gridColumn: "1 / -1" }}>
        <div className="admin-panel-head">
          <div>
            <h2>Pengaturan Hero Banner (Slide 1)</h2>
            <p>Konten editorial yang tampil di bagian atas halaman utama.</p>
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="hero-eyebrow">Eyebrow text</label>
          <input
            id="hero-eyebrow"
            className="admin-form-input"
            value={heroConfig.eyebrow}
            onChange={event => setHeroConfig(current => ({ ...current, eyebrow: event.target.value }))}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="hero-headline">Headline</label>
          <textarea
            id="hero-headline"
            className="admin-form-input"
            rows={3}
            value={heroConfig.headline}
            onChange={event => setHeroConfig(current => ({ ...current, headline: event.target.value }))}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="hero-description">Description</label>
          <textarea
            id="hero-description"
            className="admin-form-input"
            rows={4}
            value={heroConfig.description}
            onChange={event => setHeroConfig(current => ({ ...current, description: event.target.value }))}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="hero-cta-text">CTA Button Label</label>
          <input
            id="hero-cta-text"
            className="admin-form-input"
            value={heroConfig.ctaText}
            onChange={event => setHeroConfig(current => ({ ...current, ctaText: event.target.value }))}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="hero-cta-link">CTA Button Link</label>
          <input
            id="hero-cta-link"
            className="admin-form-input"
            value={heroConfig.ctaLink}
            onChange={event => setHeroConfig(current => ({ ...current, ctaLink: event.target.value }))}
            placeholder="#chapters"
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="hero-background-url">Background Image URL</label>
          <input
            id="hero-background-url"
            className="admin-form-input"
            type="url"
            value={heroConfig.bgImageUrl || ""}
            onChange={event => setHeroConfig(current => ({ ...current, bgImageUrl: event.target.value }))}
            placeholder="https://..."
          />
          <input
            ref={heroUploadRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            hidden
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void handleHeroImageUpload(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="admin-outline-btn"
            style={{ marginTop: 8 }}
            onClick={() => heroUploadRef.current?.click()}
            disabled={uploadingHeroImage}
          >
            {uploadingHeroImage ? "Mengunggah..." : "Upload Foto Banner"}
          </button>
        </div>
        <button
          type="button"
          className="btn-generate"
          onClick={() => void saveHeroConfig()}
          disabled={savingHeroConfig}
        >
          <span className="hero-config-save-content">
            {savingHeroConfig && <RefreshCw size={16} className="hero-config-spinner" aria-hidden="true" />}
            {savingHeroConfig ? "Menyimpan..." : "Simpan Perubahan Banner"}
          </span>
        </button>
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
    dashboard: { title: "Dashboard", desc: "Ringkasan katalog dan pesanan A Chapter." },
    produk: { title: "Produk", desc: "Kelola katalog produk A Chapter." },
    pesanan: { title: "Pesanan", desc: "Kelola pre-order dan pakai data Memory Vault pelanggan." },
    keuangan: { title: "Keuangan", desc: "Pantau Pre-order terkonfirmasi (DP diterima atau lunas)." },
    pengaturan: { title: "Pengaturan", desc: "Atur domain QR dan nomor WhatsApp aktif." },
  };

  const renderContent = () => {
    if (activeTab === "dashboard") return renderDashboard();
    if (activeTab === "produk") return productFormOpen ? renderProductForm() : renderProductList();
    if (activeTab === "pesanan") return renderPreOrders();
    if (activeTab === "keuangan") return renderFinancialReport();
    return renderSettings();
  };

  return (
    <div className={`admin-shell${sidebarCollapsed ? " is-sidebar-collapsed" : " admin-sidebar-open"}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-main">
            <div className="admin-brand-mark">A</div>
            <div className="admin-brand-info">
              <strong aria-label="A Chapter">A Chapter</strong>
              <span>Admin Panel</span>
            </div>
          </div>
          <button
            type="button"
            className="admin-sidebar-burger"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Perluas menu sidebar" : "Ciutkan menu sidebar"}
            title={sidebarCollapsed ? "Perluas menu sidebar" : "Ciutkan menu sidebar"}
          >
            <Menu size={18} />
          </button>
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
        <div className="admin-sidebar-footer">
          <p>Smart Eco-Preserved Artware</p>
          <span>Sumber data: Supabase</span>
          <div className="admin-realtime-indicator">
            <span className={`admin-realtime-dot${realtimeConnected ? " connected" : ""}`} />
            <span>{realtimeConnected ? "Auto-sync aktif" : "Auto-sync nonaktif"}</span>
          </div>
          <button onClick={logout}><LogOut size={16} /><span>Keluar</span></button>
        </div>
      </aside>

      {!sidebarCollapsed && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Tutup menu admin"
        />
      )}

      <main className="admin-main">
        <header className="admin-main-header">
          <div className="admin-header-title">
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              aria-expanded={!sidebarCollapsed}
              title="Toggle sidebar (Ctrl+B)"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1>{activeTab === "produk" && productFormOpen ? (editingId ? "Edit Produk" : "Tambah Produk Baru") : titleMap[activeTab].title}</h1>
              <p>{activeTab === "produk" && productFormOpen ? "Lengkapi detail produk dan Memory Vault." : titleMap[activeTab].desc}</p>
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
        {renderContent()}
      </main>

      <div className={`admin-toast${toastVisible ? " show" : ""} admin-toast--${toastLevel}`}>{toastMsg}</div>
    </div>
  );
}
