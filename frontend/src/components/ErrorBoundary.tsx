import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage?: string;
}

// Sentry is loaded asynchronously (see main.tsx). This module-level promise
// resolves once the chunk is available so captureReactException still fires.
let sentryCapture: ((error: Error, info: ErrorInfo) => void) | null = null;
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import("@sentry/react").then((Sentry) => {
    sentryCapture = (error, info) => Sentry.captureReactException(error, info);
  });
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
    sentryCapture?.(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-icon">🌾</div>
          <div className="error-title">Terjadi kesalahan</div>
          <p className="error-msg">{this.state.errorMessage || "Maaf, terjadi kendala saat memuat halaman."}</p>
          <br />
          <button type="button" className="error-link" onClick={() => window.location.reload()}>
            Muat ulang halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
