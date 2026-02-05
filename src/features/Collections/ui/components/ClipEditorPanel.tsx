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
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 space-y-2">
      <div className="text-[13px] text-slate-200 font-medium">{title}</div>
      <div
        ref={sliderWrapRef}
        className="relative space-y-2"
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
            "& .MuiSlider-rail": {
              height: 30,
              backgroundColor: "rgba(0,80,80,1)",
              borderRadius: "0",
            },
            "& .MuiSlider-track": {
              height: 30,
              background: "rgba(0,80,80,1)",
              borderRadius: "0",
              border: "1px solid gray",
            },
            "& .MuiSlider-thumb": {
              width: 3,
              height: 30,
              borderRadius: 2,
              backgroundColor: "gray",
              boxShadow: "0 0 0 1px rgba(15,23,42,0.9)",
              transition: "background-color 0.15s",
            },
            "& .MuiSlider-thumb:hover": {
              color: "none",
              backgroundColor: "white",
            },
          }}
        />
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
              "rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-200 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.9)] backdrop-blur",
          }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Clip
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">
                  {startTimeLabel}
                </span>
                <input
                  type="text"
                  value={startTimeInput}
                  placeholder="mm:ss"
                  onChange={(e) => onStartInputChange(e.target.value)}
                  onBlur={onStartBlur}
                  onKeyDown={onStartKeyDown}
                  className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] text-slate-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">
                  {endTimeLabel}
                </span>
                <input
                  type="text"
                  value={endTimeInput}
                  placeholder="mm:ss"
                  onChange={(e) => onEndInputChange(e.target.value)}
                  onBlur={onEndBlur}
                  onKeyDown={onEndKeyDown}
                  className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAnchorPosition(null);
                }}
                className="ml-2 rounded-full border border-slate-700/80 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500"
              >
                x
              </button>
            </div>
          </div>
        </Popover>
      </div>
    </div>
  );
};

export default ClipEditorPanel;
