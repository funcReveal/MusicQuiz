type StatusRowProps = {
  collectionsLoading: boolean;
  itemsLoading: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  collectionsError: string | null;
  itemsError: string | null;
  saveError: string | null;
  saveErrorLabel: string;
  savedLabel: string;
  loadingLabel: string;
};

const StatusRow = ({
  collectionsLoading,
  itemsLoading,
  saveStatus,
  collectionsError,
  itemsError,
  saveError,
  saveErrorLabel,
  savedLabel,
  loadingLabel,
}: StatusRowProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {collectionsLoading && (
        <span className="rounded-full border border-[var(--mc-border)] px-2 py-0.5 text-[var(--mc-text-muted)]">
          {loadingLabel}
        </span>
      )}
      {itemsLoading && (
        <span className="rounded-full border border-[var(--mc-border)] px-2 py-0.5 text-[var(--mc-text-muted)]">
          {loadingLabel}
        </span>
      )}
      {saveStatus === "saved" && (
        <span className="rounded-full border border-emerald-400/50 px-2 py-0.5 text-emerald-300">
          {savedLabel}
        </span>
      )}
      {collectionsError && (
        <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-300">
          {collectionsError}
        </span>
      )}
      {itemsError && (
        <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-300">
          {itemsError}
        </span>
      )}
      {saveError && (
        <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-300">
          {saveErrorLabel}: {saveError}
        </span>
      )}
    </div>
  );
};

export default StatusRow;
