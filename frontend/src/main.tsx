import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ensureBaseMeta } from "./lib/seo";
import "./index.css";

ensureBaseMeta();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("[Floramory] Root element #root not found in DOM. Check index.html.");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Initialize Sentry asynchronously after first paint so it never blocks TTI.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const initSentry = () =>
    import("@sentry/react").then(({ init }) => init({ dsn, integrations: [] }));

  if ("requestIdleCallback" in window) {
    requestIdleCallback(initSentry, { timeout: 3000 });
  } else {
    setTimeout(initSentry, 1000);
  }
}
