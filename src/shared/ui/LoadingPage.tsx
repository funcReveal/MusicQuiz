import { useEffect, useState } from "react";

type LoadingPageProps = {
  title?: string;
  subtitle?: string;
  showReloadHintAfterMs?: number;
};

const LoadingPage = ({
  title = "Loading...",
  subtitle = "Please wait a moment.",
  showReloadHintAfterMs = 15000,
}: LoadingPageProps) => {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!showReloadHintAfterMs || showReloadHintAfterMs <= 0) return;
    const id = window.setTimeout(() => setShowHint(true), showReloadHintAfterMs);
    return () => window.clearTimeout(id);
  }, [showReloadHintAfterMs]);

  return (
    <div className="min-h-[70vh] w-full rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]">
      <div className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[var(--mc-border)] border-t-[var(--mc-accent)]" />
        <div className="text-xs uppercase tracking-[0.35em] text-[var(--mc-text-muted)]">
          Loading
        </div>
        <div className="text-lg font-semibold text-[var(--mc-text)]">
          {title}
        </div>
        <div className="text-sm text-[var(--mc-text-muted)]">{subtitle}</div>

        {showHint && (
          <div className="mt-2 max-w-md space-y-3">
            <div className="text-xs text-[var(--mc-text-muted)]">
              Still loading. If this takes too long, try refreshing the page.
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--mc-text)] hover:border-[var(--mc-accent)]"
            >
              Reload
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingPage;
