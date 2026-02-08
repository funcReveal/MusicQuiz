import { Button, Switch, TextField, Tooltip } from "@mui/material";
import ArrowBackIosNew from "@mui/icons-material/ArrowBackIosNew";
import CloudDoneOutlined from "@mui/icons-material/CloudDoneOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import CloudOffOutlined from "@mui/icons-material/CloudOffOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";

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
  savingLabel: string;
  savedLabel: string;
  saveErrorLabel: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  autoSaveNotice: { type: "success" | "error"; message: string } | null;
  hasUnsavedChanges: boolean;
  visibility: "private" | "public";
  onVisibilityChange: (value: "private" | "public") => void;
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
  savingLabel,
  savedLabel,
  saveErrorLabel,
  saveStatus,
  saveError,
  autoSaveNotice,
  hasUnsavedChanges,
  visibility,
  onVisibilityChange,
  collectionCount,
  onCollectionButtonClick,
  onPlaylistButtonClick,
  collectionMenuOpen,
  playlistMenuOpen,
}: EditHeaderProps) => {
  const showSaved =
    !hasUnsavedChanges && !isSaving && saveStatus !== "error" && !saveError;
  const isAutoSaving = isSaving && autoSaveNotice?.type === "success";
  const isAutoSaveError = autoSaveNotice?.type === "error";
  const buttonLabel = isAutoSaving
    ? "保存中"
    : isSaving
      ? savingLabel
      : saveStatus === "error"
        ? saveErrorLabel
        : showSaved
          ? autoSaveNotice?.type === "success"
            ? "已同步"
            : savedLabel
          : "保存";
  const buttonIcon = isAutoSaving ? (
    <CloudUploadOutlined fontSize="small" />
  ) : saveStatus === "error" || isAutoSaveError ? (
    <CloudOffOutlined fontSize="small" />
  ) : showSaved ? (
    <CloudDoneOutlined fontSize="small" />
  ) : (
    <SaveOutlined fontSize="small" />
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
          Collection Studio
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isTitleEditing ? (
            <>
              <TextField
                variant="standard"
                value={titleDraft}
                onChange={(e) => onTitleDraftChange(e.target.value)}
                placeholder="請輸入收藏庫名稱"
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
                編輯名稱
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
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/40 px-3 py-1 text-xs text-[var(--mc-text)] transition hover:border-[var(--mc-accent)]/60 hover:bg-[var(--mc-surface-strong)]/60"
        >
          <ArrowBackIosNew fontSize="inherit" />
          返回收藏庫
        </button>
        <button
          type="button"
          onClick={onCollectionButtonClick}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
        >
          <FolderOpenOutlined fontSize="inherit" />
          收藏庫
          <span className="text-[10px] text-[var(--mc-text-muted)]">
            {collectionCount}
          </span>
          {collectionMenuOpen ? (
            <ExpandLess fontSize="inherit" />
          ) : (
            <ExpandMore fontSize="inherit" />
          )}
        </button>
        <button
          type="button"
          onClick={onPlaylistButtonClick}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-3 py-1 text-xs text-[var(--mc-text)] hover:border-[var(--mc-accent)]/60"
        >
          播放清單
          {playlistMenuOpen ? (
            <ExpandLess fontSize="inherit" />
          ) : (
            <ExpandMore fontSize="inherit" />
          )}
        </button>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-2 py-1">
          <Tooltip title={visibility === "public" ? "公開中" : "私人"}>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--mc-text)]">
              {visibility === "public" ? (
                <PublicOutlined fontSize="small" />
              ) : (
                <LockOutlined fontSize="small" />
              )}
              {visibility === "public" ? "公開" : "私人"}
            </span>
          </Tooltip>
          <Switch
            size="small"
            checked={visibility === "public"}
            onChange={(_, checked) =>
              onVisibilityChange(checked ? "public" : "private")
            }
            sx={{
              "& .MuiSwitch-thumb": { backgroundColor: "var(--mc-text)" },
              "& .MuiSwitch-track": {
                backgroundColor: "var(--mc-border)",
                opacity: 1,
              },
              "& .Mui-checked + .MuiSwitch-track": {
                backgroundColor: "var(--mc-accent)",
                opacity: 0.65,
              },
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outlined"
            size="small"
            onClick={onSave}
            disabled={isSaving || isReadOnly || !hasUnsavedChanges}
            title={saveError ? `${saveErrorLabel}: ${saveError}` : undefined}
            startIcon={buttonIcon}
            className="min-w-[120px] w-[120px] shrink-0 justify-center !border-[var(--mc-border)] !bg-[var(--mc-surface-strong)]/70 !text-[var(--mc-text)] hover:!border-[var(--mc-accent)]/60 disabled:!border-[var(--mc-border)]/40 disabled:!bg-[var(--mc-surface)]/40 disabled:!text-[var(--mc-text-muted)] disabled:opacity-70"
            sx={{
              "& .MuiButton-startIcon": {
                marginLeft: 0,
                marginRight: "6px",
                width: 20,
                justifyContent: "center",
              },
            }}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditHeader;
