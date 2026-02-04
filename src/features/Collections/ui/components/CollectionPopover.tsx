import { Popover } from "@mui/material";

type CollectionOption = { id: string; title?: string | null };

type CollectionPopoverProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  label: string;
  newLabel: string;
  collections: CollectionOption[];
  activeCollectionId: string | null;
  onCreateNew: () => void;
  onSelect: (id: string) => void;
};

const CollectionPopover = ({
  open,
  anchorEl,
  onClose,
  label,
  newLabel,
  collections,
  activeCollectionId,
  onCreateNew,
  onSelect,
}: CollectionPopoverProps) => {
  const safeCollections = Array.isArray(collections) ? collections : [];

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{
        paper: {
          className:
            "mt-2 w-72 rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/95 p-3 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]",
        },
      }}
    >
      <div className="text-xs text-[var(--mc-text-muted)]">{label}</div>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <button
          type="button"
          onClick={onCreateNew}
          className="w-full rounded-lg border border-dashed border-[var(--mc-border)] px-3 py-2 text-left text-xs text-[var(--mc-text-muted)] hover:border-[var(--mc-accent)]/60"
        >
          + {newLabel}
        </button>
        {safeCollections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`mt-1 w-full rounded-lg px-3 py-2 text-left text-xs transition ${
              item.id === activeCollectionId
                ? "bg-[var(--mc-surface-strong)] text-[var(--mc-text)]"
                : "text-[var(--mc-text-muted)] hover:bg-[var(--mc-surface-strong)]/70 hover:text-[var(--mc-text)]"
            }`}
          >
            {item.title || "未命名收藏庫"}
          </button>
        ))}
      </div>
    </Popover>
  );
};

export default CollectionPopover;
