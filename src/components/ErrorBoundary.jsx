import { Component } from "react";
import { requiresPageReload } from "../utils/runtimeRecovery";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const reloadRequired = requiresPageReload(this.state.error);
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "inherit", color: "#991b1b", fontSize: 14 }}>
          <div>{reloadRequired ? "The application could not load correctly. Please reload the page." : "Something went wrong. Please try again."}</div>
          {reloadRequired && <div style={{ color: "#64748b", fontSize: 12 }}>Unsaved changes may be lost when you reload.</div>}
          {import.meta.env.DEV && this.state.error && (
            <pre style={{ maxWidth: 760, whiteSpace: "pre-wrap", color: "#7f1d1d", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 6, padding: 10, fontSize: 11 }}>
              {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
            </pre>
          )}
          <button
            onClick={() => reloadRequired ? window.location.reload() : this.setState({ hasError: false, error: null })}
            style={{ cursor: "pointer", padding: "6px 16px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", fontSize: 13, fontFamily: "inherit" }}
          >
            {reloadRequired ? "Reload page" : "Try again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
