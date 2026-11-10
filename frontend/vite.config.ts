import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryUploadConfigured = Boolean(
    env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT
  );
  if (mode === "production" && env.VITE_SENTRY_DSN && !sentryUploadConfigured) {
    console.warn(
      "[sentry] Source map upload skipped. Configure SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT."
    );
  }
  const sentryPlugin =
    mode === "production" && sentryUploadConfigured
      ? sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN,
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          sourcemaps: {
            filesToDeleteAfterUpload: ["./dist/**/*.map"],
          },
        })
      : null;

  const rawPort = process.env.PORT || env.PORT || "5199";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH || "/";

  return {
    base: basePath,
    plugins: [
      react(),
      ...(sentryPlugin ? [sentryPlugin] : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      sourcemap: sentryPlugin !== null,
      rollupOptions: {
        output: {
          // Pisahkan vendor besar agar cache browser tidak invalid setiap deploy.
          // Hanya library spesifik yang dipecah; sisanya mengikuti chunking otomatis Vite.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@sentry")) return "vendor-sentry";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("qrcode")) return "vendor-qr";
            if (
              id.includes("react-dom") ||
              id.includes("/react/") ||
              id.includes("scheduler") ||
              id.includes("wouter")
            ) {
              return "vendor-react";
            }
            return;
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: env.VITE_SUPABASE_URL || "https://fcevjiflawxmzrccramo.supabase.co",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/functions/v1"),
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});