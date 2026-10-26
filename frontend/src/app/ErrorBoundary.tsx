import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last-resort UI for an unexpected render error outside a page's own states. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RepoScribe UI crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div
          role="alert"
          className="w-full max-w-lg rounded-panel border border-line bg-surface px-6 py-6 hairline"
        >
          <p className="eyebrow text-danger">Unexpected UI error</p>
          <h1 className="mt-2 text-h2 text-ink">This view could not be rendered.</h1>
          <p className="mt-3 text-[13px] leading-6 text-ink-muted">
            No repository data was changed. Reload the page to recover, or return to the start if
            the problem persists.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center rounded-control bg-accent px-4 text-[13px] font-semibold text-[#03140a] transition-colors hover:bg-accent-hover"
            >
              Reload page
            </button>
            <a
              href="/"
              className="inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated"
            >
              Back to the start
            </a>
          </div>
        </div>
      </div>
    );
  }
}
