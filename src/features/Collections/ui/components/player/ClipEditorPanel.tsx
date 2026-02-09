import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useRef,
  useState,
} from "react";
import { Popover, Slider } from "@mui/material";

type ClipEditorPanelProps = {
  title: string;
  startLabel: string;
  endLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  startSec: number;
  endSec: number;
  maxSec: number;
  onRangeChange: (value: number[], activeThumb: number) => void;
  onRangeCommit: (value: number[], activeThumb: number) => void;
  onStartThumbPress: () => void;
  onEndThumbPress: () => void;
  formatSeconds: (value: number) => string;
  startTimeInput: string;
  endTimeInput: string;
  onStartInputChange: (value: string) => void;
  onEndInputChange: (value: string) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  onStartKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onEndKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const ClipEditorPanel = ({
  title,
  startLabel,
  endLabel,
  startTimeLabel,
  endTimeLabel,
  startTimeInput,
  endTimeInput,
  onStartInputChange,
  onEndInputChange,
  onStartBlur,
  onEndBlur,
  onStartKeyDown,
  onEndKeyDown,
  startSec,
  endSec,
  maxSec,
  onRangeChange,
  onRangeCommit,
  onStartThumbPress,
  onEndThumbPress,
  formatSeconds,
}: ClipEditorPanelProps) => {
  const activeThumbRef = useRef(0);
  const [editing, setEditing] = useState<"start" | "end" | null>(null);
  const [anchorPosition, setAnchorPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const sliderWrapRef = useRef<HTMLDivElement | null>(null);

  const handleThumbPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    const target = event.currentTarget;
    const index = target.getAttribute("data-index");
    if (index == "0") {
      onStartThumbPress();
    } else if (index == "1") {
      onEndThumbPress();
    }
  };

  const handleTrackContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (editing) return;
    if (!sliderWrapRef.current) return;
    const rect = sliderWrapRef.current.getBoundingClientRect();
    const ratio = Math.min(
      Math.max(0, (event.clientX - rect.left) / rect.width),
      1,
    );
    const clicked = ratio * maxSec;
    const next =
      Math.abs(clicked - startSec) <= Math.abs(clicked - endSec)
        ? "start"
        : "end";
    setEditing(next);
    setAnchorPosition({ top: event.clientY, left: event.clientX });
  };

  return (
    <div className="relative overflow-hidden px-3 pt-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
      />

      <div className="relative space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[13px] font-semibold text-[var(--mc-text)]">
            {title}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--mc-text-muted)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/55 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mc-accent)] shadow-[0_0_10px_var(--mc-glow)]" />
            <span className="text-[var(--mc-text)]">{startLabel}</span>
            {formatSeconds(startSec)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/55 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mc-accent-2)] shadow-[0_0_10px_rgba(234,179,8,0.25)]" />
            <span className="text-[var(--mc-text)]">{endLabel}</span>
            {formatSeconds(endSec)}
          </span>
        </div>

        <div
          ref={sliderWrapRef}
          className="relative py-2"
          onContextMenu={handleTrackContextMenu}
        >
          <Slider
            value={[startSec, endSec]}
            min={0}
            max={maxSec}
            onChange={(_, value, activeThumb) => {
              if (!Array.isArray(value)) return;
              activeThumbRef.current = activeThumb;
              onRangeChange(value as number[], activeThumb);
            }}
            onChangeCommitted={(_, value) => {
              if (!Array.isArray(value)) return;
              onRangeCommit(value as number[], activeThumbRef.current);
            }}
            slotProps={{
              thumb: {
                onPointerDown: handleThumbPointerDown,
              },
            }}
            disableSwap
            sx={{
              paddingTop: "10px",
              paddingBottom: "10px",
              "& .MuiSlider-rail": {
                height: 28,
                borderRadius: 1,
                backgroundColor:
                  "color-mix(in srgb, var(--mc-surface) 65%, black)",
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(245,158,11,0.10), rgba(245,158,11,0.10) 1px, transparent 1px, transparent 10px)",
                border: "1px solid var(--mc-border)",
                opacity: 1,
              },
              "& .MuiSlider-track": {
                height: 28,
                borderRadius: 0,
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--mc-accent) 88%, white) 0%, var(--mc-accent-2) 100%)",
                border: "1px solid rgba(0,0,0,0.35)",
                boxShadow:
                  "0 0 0 1px rgba(245,158,11,0.20), 0 10px 24px -16px rgba(245,158,11,0.55)",
              },
              "& .MuiSlider-thumb": {
                width: 8,
                height: 32,
                borderRadius: 2,
                backgroundColor: "var(--mc-text)",
                border: "1px solid rgba(0,0,0,0.45)",
                boxShadow:
                  "0 0 0 1px var(--mc-border), 0 0 18px rgba(245,158,11,0.18)",
                transition:
                  "background-color 120ms ease, box-shadow 120ms ease",
              },
              "& .MuiSlider-thumb:hover": {
                backgroundColor: "var(--mc-accent-2)",
                boxShadow:
                  "0 0 0 1px rgba(234,179,8,0.55), 0 0 24px rgba(234,179,8,0.22)",
              },
              "& .MuiSlider-thumb.Mui-active": {
                boxShadow:
                  "0 0 0 1px rgba(245,158,11,0.65), 0 0 26px rgba(245,158,11,0.28)",
              },
              "& .MuiSlider-thumb.Mui-focusVisible": {
                boxShadow:
                  "0 0 0 2px rgba(245,158,11,0.35), 0 0 0 6px rgba(245,158,11,0.12)",
              },
              "& .MuiSlider-thumb::before, & .MuiSlider-thumb::after": {
                boxShadow: "none",
              },
            }}
          />

          <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-[var(--mc-text-muted)]">
            <span className="opacity-80">0:00</span>
            <span className="opacity-80">{formatSeconds(maxSec)}</span>
          </div>
        </div>

        <Popover
          open={Boolean(editing) && Boolean(anchorPosition)}
          onClose={() => {
            setEditing(null);
            setAnchorPosition(null);
          }}
          anchorReference="anchorPosition"
          anchorPosition={anchorPosition ?? { top: 0, left: 0 }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            className:
              "rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/95 px-3 py-2 text-[11px] text-[var(--mc-text)] shadow-[0_18px_44px_-30px_rgba(0,0,0,0.9)] backdrop-blur",
          }}
        >
          <div className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(320px 190px at 15% 15%, rgba(245,158,11,0.14), transparent 72%), radial-gradient(300px 180px at 90% 10%, rgba(234,179,8,0.10), transparent 75%), repeating-linear-gradient(0deg, rgba(248,242,232,0.03), rgba(248,242,232,0.03) 1px, transparent 1px, transparent 3px)",
              }}
            />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--mc-text-muted)]">
                Edit Time
              </div>
              <div className="mt-1 flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--mc-text-muted)]">
                    {startTimeLabel}
                  </span>
                  <input
                    type="text"
                    value={startTimeInput}
                    placeholder="mm:ss"
                    onChange={(e) => onStartInputChange(e.target.value)}
                    onBlur={onStartBlur}
                    onKeyDown={onStartKeyDown}
                    className="w-24 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-2.5 py-1.5 text-[12px] text-[var(--mc-text)] placeholder:text-[var(--mc-text-muted)]/60 focus:border-[var(--mc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mc-glow)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--mc-text-muted)]">
                    {endTimeLabel}
                  </span>
                  <input
                    type="text"
                    value={endTimeInput}
                    placeholder="mm:ss"
                    onChange={(e) => onEndInputChange(e.target.value)}
                    onBlur={onEndBlur}
                    onKeyDown={onEndKeyDown}
                    className="w-24 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-2.5 py-1.5 text-[12px] text-[var(--mc-text)] placeholder:text-[var(--mc-text-muted)]/60 focus:border-[var(--mc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mc-glow)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAnchorPosition(null);
                  }}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/50 text-[12px] text-[var(--mc-text-muted)] transition hover:border-[var(--mc-accent)]/70 hover:text-[var(--mc-text)]"
                  title="關閉"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 text-[10px] text-[var(--mc-text-muted)]">
                Enter 可套用，Esc 或點外部可關閉。
              </div>
            </div>
          </div>
        </Popover>
      </div>
    </div>
  );
};

export default ClipEditorPanel;
