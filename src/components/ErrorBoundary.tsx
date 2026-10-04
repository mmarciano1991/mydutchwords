/* ErrorBoundary — the last line of defence against a blank screen.

   A render error anywhere below it, or the app chunk failing to download
   (flaky connection, or a deploy that replaced the file mid-session), lands
   here instead of unmounting everything. Reloading fixes both cases in
   practice, and progress is safe: it is in local storage and the cloud. */
import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[woordkast] the app hit an error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-shell">
        <div className="phone">
          <div className="screen gutter error-screen" role="alert">
            <p className="error-screen__title">Something went wrong</p>
            <p className="error-screen__body">Your progress is saved. Reloading usually fixes this.</p>
            <button className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
