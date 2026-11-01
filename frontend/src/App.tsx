import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import Home from "@/pages/Home";
import Produk from "@/pages/Produk";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";

// Admin panel — loaded as a separate chunk only when /admin route is visited.
// All admin logic, CRUD operations, lucide-react, qrcode.react, and Supabase
// session management live inside Admin.tsx and are never downloaded by public visitors.
const Admin = lazy(() => import("./pages/Admin"));

function LoadingPage() {
  return (
    <div className="loading-screen">
      <span style={{ opacity: 0.5 }}>Loading...</span>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/produk" component={Produk} />
      <Route path="/admin">
        <Suspense fallback={<LoadingPage />}>
          <Admin />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
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
