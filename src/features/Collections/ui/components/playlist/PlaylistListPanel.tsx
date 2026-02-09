import { useMemo, useState } from "react";
import type { RefObject } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  onReorder: (from: number, to: number) => void;
  listRef: RefObject<HTMLDivElement | null>;
  registerItemRef: (node: HTMLDivElement | null, id: string) => void;
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

type SortableRowProps = {
  item: PlaylistItemView;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  isHighlighted: boolean;
  clipDurationLabel: string;
  formatSeconds: (value: number) => string;
  registerItemRef: (node: HTMLDivElement | null, id: string) => void;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

const SortableRow = ({
  item,
  index,
  isFirst,
  isLast,
  isActive,
  isHighlighted,
  clipDurationLabel,
  formatSeconds,
  registerItemRef,
  onSelect,
  onRemove,
  onMove,
}: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.localId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerItemRef(node, item.localId);
      }}
      style={style}
      onClick={() => onSelect(index)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(index);
        }
      }}
      className={`relative flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
        isActive
          ? "border-[var(--mc-accent)] bg-[var(--mc-surface-strong)]"
          : "border-[var(--mc-border)] bg-[var(--mc-surface)]/60 hover:border-[var(--mc-accent)]/60"
      } ${
        isHighlighted
          ? "ring-1 ring-[var(--mc-accent)]/80 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
          : ""
      } ${isDragging ? "opacity-0 pointer-events-none" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--mc-surface-strong)]">
        <span className="absolute left-1 top-1 rounded bg-[var(--mc-surface)]/80 px-1 py-0.5 text-[9px] text-[var(--mc-text)]">
          {index + 1}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(index);
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
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">
            -
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-[var(--mc-text)]">
          {item.title}
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--mc-text-muted)]">
          {item.duration ?? "--:--"} - {clipDurationLabel}{" "}
          {formatSeconds(Math.max(0, item.endSec - item.startSec))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-[10px] text-[var(--mc-text-muted)]">
        <span className="rounded bg-[var(--mc-surface)]/80 px-1.5 py-0.5">
          -
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMove(index, index - 1);
            }}
            disabled={isFirst}
            className="rounded px-1.5 py-0.5 hover:bg-[var(--mc-surface-strong)] disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMove(index, index + 1);
            }}
            disabled={isLast}
            className="rounded px-1.5 py-0.5 hover:bg-slate-800 disabled:opacity-40"
          >
            ↓
          </button>
        </div>
      </div>
    </div>
  );
};

const OverlayCard = ({
  item,
  index,
  clipDurationLabel,
  formatSeconds,
}: {
  item: PlaylistItemView;
  index: number;
  clipDurationLabel: string;
  formatSeconds: (value: number) => string;
}) => (
  <div className="pointer-events-none flex items-center gap-3 rounded-xl border border-[var(--mc-accent)] bg-[var(--mc-surface-strong)] p-2 text-left shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]">
    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--mc-surface)]">
      <span className="absolute left-1 top-1 rounded bg-[var(--mc-surface)]/80 px-1 py-0.5 text-[9px] text-[var(--mc-text)]">
        {index + 1}
      </span>
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">
          -
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[12px] text-[var(--mc-text)]">
        {item.title}
      </div>
      <div className="mt-0.5 text-[10px] text-[var(--mc-text-muted)]">
        {item.duration ?? "--:--"} - {clipDurationLabel}{" "}
        {formatSeconds(Math.max(0, item.endSec - item.startSec))}
      </div>
    </div>
  </div>
);

const PlaylistListPanel = ({
  items,
  selectedIndex,
  onSelect,
  onRemove,
  onMove,
  onReorder,
  listRef,
  registerItemRef,
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
  const itemIds = useMemo(
    () => safeItems.map((item) => item.localId),
    [safeItems],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const activeIndex = activeId ? itemIds.indexOf(activeId) : -1;
  const activeItem = activeIndex >= 0 ? safeItems[activeIndex] : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      const reordered = arrayMove(itemIds, oldIndex, newIndex);
      const nextIndex = reordered.indexOf(String(active.id));
      onReorder(oldIndex, nextIndex);
    }
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <div className="space-y-2 lg:sticky self-start">
      <div className="flex items-center justify-between text-[11px] text-[var(--mc-text-muted)]">
        <span className="uppercase tracking-[0.22em]">Playlist</span>
        <span>{items.length} items</span>
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
            <span>Add a single track</span>
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
              Paste a YouTube link
            </div>
            <button
              type="button"
              onClick={onSingleTrackCancel}
              className="inline-flex items-center rounded-full border border-[var(--mc-border)] px-2 py-0.5 text-[10px] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
            >
              Close
            </button>
          </div>
          <div className="mt-2 space-y-2">
            <div className="relative">
              <input
                value={singleTrackUrl}
                onChange={(event) => onSingleTrackUrlChange(event.target.value)}
                placeholder="YouTube link"
                aria-invalid={isDuplicate}
                className={`w-full rounded-lg border bg-[var(--mc-surface)] px-2.5 py-2 text-xs text-[var(--mc-text)] transition-colors ${
                  isDuplicate
                    ? "border-rose-400/70 text-rose-100 placeholder:text-rose-200/70 focus:border-rose-400"
                    : "border-[var(--mc-border)]"
                }`}
              />
              {isDuplicate && (
                <div className="absolute left-0 top-full z-20 mt-1 rounded-md border border-rose-400/40 bg-rose-950/90 px-2 py-1 text-[10px] text-rose-100 shadow">
                  This video is already in the list.
                </div>
              )}
            </div>
            <input
              value={singleTrackTitle}
              onChange={(event) => onSingleTrackTitleChange(event.target.value)}
              placeholder="Track title"
              disabled={!canEditSingleMeta}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-2 py-1.5 text-xs text-[var(--mc-text)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              value={singleTrackAnswer}
              onChange={(event) =>
                onSingleTrackAnswerChange(event.target.value)
              }
              placeholder="Answer"
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
              Add
            </button>
            {singleTrackLoading && (
              <span className="text-[11px] text-[var(--mc-text-muted)]">
                Loading...
              </span>
            )}
          </div>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div
            ref={listRef}
            className="space-y-2 max-h-[calc(100svh-420px)] lg:max-h-[calc(100vh-300px)] overflow-y-auto pr-1"
          >
            {safeItems.map((item, idx) => {
              const isActive = idx === selectedIndex;
              const isHighlighted = highlightIndex === idx;
              return (
                <div key={item.localId} className="relative">
                  <SortableRow
                    item={item}
                    index={idx}
                    isFirst={idx === 0}
                    isLast={idx === safeItems.length - 1}
                    isActive={isActive}
                    isHighlighted={isHighlighted}
                    clipDurationLabel={clipDurationLabel}
                    formatSeconds={formatSeconds}
                    registerItemRef={registerItemRef}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onMove={onMove}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <OverlayCard
              item={activeItem}
              index={activeIndex}
              clipDurationLabel={clipDurationLabel}
              formatSeconds={formatSeconds}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default PlaylistListPanel;
