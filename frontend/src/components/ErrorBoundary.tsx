import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
    Sentry.captureReactException(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-icon">🌾</div>
          <div className="error-title">Terjadi kesalahan</div>
          <p className="error-msg">Maaf, terjadi kendala saat memuat halaman. Silakan muat ulang.</p>
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
