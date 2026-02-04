import { Button } from "@mui/material";

type EditHeaderProps = {
  title: string;
  titleDraft: string;
  isTitleEditing: boolean;
  onTitleDraftChange: (value: string) => void;
  onTitleSave: () => void;
  onTitleCancel: () => void;
  onStartEdit: () => void;
  showApplyPlaylistTitle: boolean;
  onApplyPlaylistTitle: () => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  isReadOnly: boolean;
  saveLabel: string;
  savingLabel: string;
  collectionCount: number;
  onCollectionButtonClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPlaylistButtonClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  collectionMenuOpen: boolean;
  playlistMenuOpen: boolean;
};

const EditHeader = ({
  title,
  titleDraft,
  isTitleEditing,
  onTitleDraftChange,
  onTitleSave,
  onTitleCancel,
  onStartEdit,
  showApplyPlaylistTitle,
  onApplyPlaylistTitle,
  onBack,
  onSave,
  isSaving,
  isReadOnly,
  saveLabel,
  savingLabel,
  collectionCount,
  onCollectionButtonClick,
  onPlaylistButtonClick,
  collectionMenuOpen,
  playlistMenuOpen,
}: EditHeaderProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
          Collection Studio
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isTitleEditing ? (
            <>
              <input
                value={titleDraft}
                onChange={(e) => onTitleDraftChange(e.target.value)}
                placeholder="輸入收藏庫名稱"
                className="min-w-[200px] rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)] px-3 py-1.5 text-base font-semibold text-[var(--mc-text)]"
              />
              <button
                type="button"
                onClick={onTitleSave}
                className="rounded-full border border-[var(--mc-border)] px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
              >
                儲存
              </button>
              <button
                type="button"
                onClick={onTitleCancel}
                className="rounded-full border border-[var(--mc-border)] px-3 py-1 text-xs text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-[var(--mc-text)]">
                {title || "未命名收藏庫"}
              </h2>
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
              >
                ✎ 編輯名稱
              </button>
              {showApplyPlaylistTitle && (
                <button
                  type="button"
                  onClick={onApplyPlaylistTitle}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
                >
                  套用播放清單名稱
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outlined" size="small" onClick={onBack}>
          返回收藏庫
        </Button>
        <button
          type="button"
          onClick={onCollectionButtonClick}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
        >
          收藏庫
          <span className="text-[10px] text-[var(--mc-text-muted)]">
            {collectionCount}
          </span>
          <span className="text-xs">{collectionMenuOpen ? "▲" : "▼"}</span>
        </button>
        <button
          type="button"
          onClick={onPlaylistButtonClick}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
        >
          播放清單
          <span className="text-xs">{playlistMenuOpen ? "▲" : "▼"}</span>
        </button>
        <Button
          variant="contained"
          size="small"
          onClick={onSave}
          disabled={isSaving || isReadOnly}
        >
          {isSaving ? savingLabel : saveLabel}
        </Button>
      </div>
    </div>
  );
};

export default EditHeader;
