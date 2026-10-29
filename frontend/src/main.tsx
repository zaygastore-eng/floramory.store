import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { ensureBaseMeta } from "./lib/seo";
import "./index.css";

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserSessionIntegration(),
      Sentry.globalHandlersIntegration({
        onerror: true,
        onunhandledrejection: true,
      }),
    ],
  });
}

ensureBaseMeta();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("[Floramory] Root element #root not found in DOM. Check index.html.");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
