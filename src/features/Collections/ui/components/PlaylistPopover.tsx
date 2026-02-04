import { Popover } from "@mui/material";

type PlaylistPopoverProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  label: string;
  playlistUrl: string;
  onChangeUrl: (value: string) => void;
  onImport: () => void;
  playlistLoading: boolean;
  playlistError: string | null;
  playlistAddError: string | null;
};

const PlaylistPopover = ({
  open,
  anchorEl,
  onClose,
  label,
  playlistUrl,
  onChangeUrl,
  onImport,
  playlistLoading,
  playlistError,
  playlistAddError,
}: PlaylistPopoverProps) => {
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
            "mt-2 w-[360px] rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/95 p-3 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]",
        },
      }}
    >
      <div className="text-xs text-[var(--mc-text-muted)]">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={playlistUrl}
          onChange={(e) => onChangeUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onImport();
          }}
          placeholder="貼上 YouTube 播放清單連結"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)] px-3 py-2 text-xs text-[var(--mc-text)]"
        />
        <button
          type="button"
          onClick={onImport}
          disabled={playlistLoading}
          className="rounded-lg border border-[var(--mc-border)] px-3 py-2 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60 disabled:opacity-50"
        >
          {playlistLoading ? "取得中..." : "取得播放清單"}
        </button>
      </div>
      {playlistAddError && (
        <div className="mt-2 text-xs text-rose-300">{playlistAddError}</div>
      )}
      {playlistError && (
        <div className="mt-2 text-xs text-rose-300">{playlistError}</div>
      )}
    </Popover>
  );
};

export default PlaylistPopover;
