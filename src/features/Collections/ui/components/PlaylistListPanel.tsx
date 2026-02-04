import type { DragEvent, RefObject } from "react";

type PlaylistItemView = {
  localId: string;
  title: string;
  uploader?: string;
  duration?: string;
  startSec: number;
  endSec: number;
  thumbnail?: string;
};

type PlaylistListPanelProps = {
  items: PlaylistItemView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDragStart: (event: DragEvent, index: number) => void;
  onDragOver: (event: DragEvent, index: number) => void;
  onDrop: (event: DragEvent, index: number) => void;
  onDragEnd: () => void;
  listRef: RefObject<HTMLDivElement | null>;
  registerItemRef: (node: HTMLDivElement | null, id: string) => void;
  dragInsertIndex: number | null;
  isDraggingList: boolean;
  dragIndex: number | null;
  highlightIndex: number | null;
  clipDurationLabel: string;
  formatSeconds: (value: number) => string;
  onAddSingleToggle: () => void;
  singleTrackOpen: boolean;
  singleTrackUrl: string;
  singleTrackTitle: string;
  singleTrackAnswer: string;
  singleTrackError: string | null;
  singleTrackLoading: boolean;
  isDuplicate: boolean;
  canEditSingleMeta: boolean;
  onSingleTrackUrlChange: (value: string) => void;
  onSingleTrackTitleChange: (value: string) => void;
  onSingleTrackAnswerChange: (value: string) => void;
  onSingleTrackCancel: () => void;
  onAddSingle: () => void;
};

const PlaylistListPanel = ({
  items,
  selectedIndex,
  onSelect,
  onRemove,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  listRef,
  registerItemRef,
  dragInsertIndex,
  isDraggingList,
  dragIndex,
  highlightIndex,
  clipDurationLabel,
  formatSeconds,
  onAddSingleToggle,
  singleTrackOpen,
  singleTrackUrl,
  singleTrackTitle,
  singleTrackAnswer,
  singleTrackError,
  singleTrackLoading,
  isDuplicate,
  canEditSingleMeta,
  onSingleTrackUrlChange,
  onSingleTrackTitleChange,
  onSingleTrackAnswerChange,
  onSingleTrackCancel,
  onAddSingle,
}: PlaylistListPanelProps) => {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <div className="space-y-2 lg:order-2 lg:sticky lg:top-24 self-start">
      <div className="flex items-center justify-between text-[11px] text-[var(--mc-text-muted)]">
        <span className="uppercase tracking-[0.22em]">曲目清單</span>
        <span>{items.length} 首</span>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={onAddSingleToggle}
          className={`w-full rounded-xl border border-dashed px-3 py-3 text-left text-[12px] text-[var(--mc-text-muted)] transition-colors ${
            singleTrackOpen
              ? "border-[var(--mc-accent)]/60 bg-[var(--mc-surface-strong)] opacity-60"
              : "border-[var(--mc-border)] bg-[var(--mc-surface)]/60 hover:border-[var(--mc-accent)]/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg text-[var(--mc-text)]">+</span>
            <span>貼上連結新增</span>
          </div>
        </button>
        <div
          className={`absolute left-0 top-0 z-20 w-full rounded-xl border border-[var(--mc-border)] bg-[var(--mc-surface-strong)] p-4 shadow-[0_16px_36px_-20px_rgba(0,0,0,0.8)] transition-all duration-200 ease-out ${
            singleTrackOpen
              ? "opacity-100 scale-100"
              : "pointer-events-none opacity-0 scale-95"
          }`}
          aria-hidden={!singleTrackOpen}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--mc-text-muted)]">
              連結一貼上就解析
            </div>
            <button
              type="button"
              onClick={onSingleTrackCancel}
              className="inline-flex items-center rounded-full border border-[var(--mc-border)] px-2 py-0.5 text-[10px] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
            >
              取消
            </button>
          </div>
          <div className="mt-2 space-y-2">
            <div className="relative">
              <input
                value={singleTrackUrl}
                onChange={(e) => onSingleTrackUrlChange(e.target.value)}
                placeholder="貼上 YouTube 連結"
                aria-invalid={isDuplicate}
                className={`w-full rounded-lg border bg-[var(--mc-surface)] px-2.5 py-2 text-xs text-[var(--mc-text)] transition-colors ${
                  isDuplicate
                    ? "border-rose-400/70 text-rose-100 placeholder:text-rose-200/70 focus:border-rose-400"
                    : "border-[var(--mc-border)]"
                }`}
              />
              {isDuplicate && (
                <div className="absolute left-0 top-full z-20 mt-1 rounded-md border border-rose-400/40 bg-rose-950/90 px-2 py-1 text-[10px] text-rose-100 shadow">
                  此影片已在清單內
                </div>
              )}
            </div>
            <input
              value={singleTrackTitle}
              onChange={(e) => onSingleTrackTitleChange(e.target.value)}
              placeholder="歌曲名稱（貼上連結後可編輯）"
              disabled={!canEditSingleMeta}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-2 py-1.5 text-xs text-[var(--mc-text)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              value={singleTrackAnswer}
              onChange={(e) => onSingleTrackAnswerChange(e.target.value)}
              placeholder="答案（貼上連結後可編輯）"
              disabled={!canEditSingleMeta}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-2 py-1.5 text-xs text-[var(--mc-text)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {singleTrackError && (
            <div className="mt-2 text-[11px] text-rose-300">
              {singleTrackError}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onAddSingle}
              disabled={isDuplicate}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--mc-accent)] px-3 py-1.5 text-[11px] font-semibold text-[#1a1207] hover:bg-[var(--mc-accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              新增
            </button>
            {singleTrackLoading && (
              <span className="text-[11px] text-[var(--mc-text-muted)]">
                解析中...
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        ref={listRef}
        className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1"
      >
        {(() => {
          const insertIndex =
            isDraggingList && dragInsertIndex !== null
              ? dragInsertIndex
              : null;
          return (
              <>
                {safeItems.map((item, idx) => {
                const isActive = idx === selectedIndex;
                const showPlaceholder = insertIndex === idx;
                const isDraggingItem = dragIndex === idx;
                return (
                  <div key={item.localId}>
                    {showPlaceholder && (
                      <div className="h-[72px] rounded-xl border border-dashed border-[var(--mc-accent)]/60 bg-[var(--mc-surface-strong)]/40" />
                    )}
                    <div
                      ref={(node) => registerItemRef(node, item.localId)}
                      onClick={() => onSelect(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(idx);
                        }
                      }}
                      draggable
                      onDragStart={(e) => onDragStart(e, idx)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      onDrop={(e) => onDrop(e, idx)}
                      onDragEnd={onDragEnd}
                      role="button"
                      tabIndex={0}
                      className={`relative flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                        isActive
                          ? "border-[var(--mc-accent)] bg-[var(--mc-surface-strong)]"
                          : `border-[var(--mc-border)] bg-[var(--mc-surface)]/60 ${
                              isDraggingList
                                ? ""
                                : "hover:border-[var(--mc-accent)]/60"
                            }`
                      } ${
                        highlightIndex === idx
                          ? "ring-1 ring-[var(--mc-accent)]/80 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
                          : ""
                      } ${isDraggingItem ? "opacity-50" : ""}`}
                    >
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--mc-surface-strong)]">
                        <span className="absolute left-1 top-1 rounded bg-[var(--mc-surface)]/80 px-1 py-0.5 text-[9px] text-[var(--mc-text)]">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(idx);
                          }}
                          className="absolute right-1 top-1 rounded bg-[var(--mc-surface)]/80 px-1 text-[9px] text-[var(--mc-text)] hover:bg-rose-500/80"
                          aria-label="Delete"
                        >
                          X
                        </button>
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[9px] text-slate-500">
                            無縮圖
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-[var(--mc-text)] truncate">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--mc-text-muted)]">
                          {item.duration ?? "--:--"} · {clipDurationLabel}{" "}
                          {formatSeconds(Math.max(0, item.endSec - item.startSec))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[10px] text-[var(--mc-text-muted)]">
                        <span className="rounded bg-[var(--mc-surface)]/80 px-1.5 py-0.5">
                          ⇅
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMove(idx, idx - 1);
                            }}
                            disabled={idx === 0}
                            className="rounded px-1.5 py-0.5 hover:bg-[var(--mc-surface-strong)] disabled:opacity-40"
                          >
                            上移
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMove(idx, idx + 1);
                            }}
                            disabled={idx === items.length - 1}
                            className="rounded px-1.5 py-0.5 hover:bg-slate-800 disabled:opacity-40"
                          >
                            下移
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {insertIndex === items.length && (
                <div
                  className="h-[72px] rounded-xl border border-dashed border-[var(--mc-accent)]/60 bg-[var(--mc-surface-strong)]/40"
                  onDragOver={(e) => onDragOver(e, items.length - 1)}
                  onDrop={(e) => onDrop(e, items.length)}
                />
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default PlaylistListPanel;
