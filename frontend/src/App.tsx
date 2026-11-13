import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";

// Halaman sekunder dimuat sesuai kebutuhan agar bundle awal landing page tetap ringan.
// Home sengaja tetap eager karena merupakan entry point utama.
const ShopAll = lazy(() => import("@/pages/ShopAll"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Produk = lazy(() => import("@/pages/Produk"));
const AboutUs = lazy(() => import("@/pages/AboutUs"));
const SmartQrVault = lazy(() => import("@/pages/SmartQrVault"));
const VaultExperience = lazy(() => import("@/pages/VaultExperience"));

// Admin panel — loaded as a separate chunk only when /admin route is visited.
// All admin logic, CRUD operations, lucide-react, qrcode.react, and Supabase
// session management live inside Admin.tsx and are never downloaded by public visitors.
const Admin = lazy(() => import("./pages/Admin"));
const VaultSetup = lazy(() => import("./pages/VaultSetup"));

function LoadingPage() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-seal" aria-hidden="true">
        <img src="/a-chapter-logo-light.png" alt="A Chapter" className="loading-seal-logo" />
      </div>
      <span className="loading-brand">A CHAPTER</span>
      <span className="loading-caption">Menyiapkan arsip kenangan...</span>
      <div className="loading-dots" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/shop" component={ShopAll} />
        <Route path="/about" component={AboutUs} />
        <Route path="/smart-qr-vault" component={SmartQrVault} />
        <Route path="/vault" component={SmartQrVault} />
        <Route path="/vault/:id" component={VaultExperience} />
        <Route path="/v/:id" component={VaultExperience} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/produk/:id" component={ProductDetail} />
        <Route path="/produk" component={Produk} />
        <Route path="/vault-setup">
          <VaultSetup />
        </Route>
        <Route path="/admin">
          <Admin />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
