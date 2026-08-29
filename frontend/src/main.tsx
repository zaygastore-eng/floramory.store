import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ensureBaseMeta } from "./lib/seo";
import "./index.css";

ensureBaseMeta();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
