import type { KeyboardEvent } from "react";
import { Slider } from "@mui/material";

type ClipEditorPanelProps = {
  title: string;
  startLabel: string;
  endLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  startSec: number;
  endSec: number;
  maxSec: number;
  onRangeChange: (value: number[]) => void;
  formatSeconds: (value: number) => string;
  startTimeInput: string;
  endTimeInput: string;
  onStartInputChange: (value: string) => void;
  onEndInputChange: (value: string) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  onStartKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onEndKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onNudgeStart: (delta: number) => void;
  onNudgeEnd: (delta: number) => void;
  answerLabel: string;
  answerValue: string;
  answerPlaceholder: string;
  onAnswerChange: (value: string) => void;
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
  formatSeconds,
  onNudgeStart,
  onNudgeEnd,
  answerLabel,
  answerValue,
  answerPlaceholder,
  onAnswerChange,
}: ClipEditorPanelProps) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-3">
      <div className="text-sm text-slate-200 font-medium">{title}</div>
      <div className="space-y-2">
        <Slider
          value={[startSec, endSec]}
          min={0}
          max={maxSec}
          onChange={(_, value) => {
            if (!Array.isArray(value)) return;
            onRangeChange(value as number[]);
          }}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => formatSeconds(value)}
          disableSwap
          sx={{
            color: "rgb(56 189 248)",
            "& .MuiSlider-thumb": {
              border: "2px solid rgb(15 23 42)",
            },
          }}
        />
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {startLabel} {formatSeconds(startSec)}
          </span>
          <span>
            {endLabel} {formatSeconds(endSec)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 w-24">{startTimeLabel}</label>
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={startTimeInput}
              placeholder="mm:ss"
              onChange={(e) => onStartInputChange(e.target.value)}
              onBlur={onStartBlur}
              onKeyDown={onStartKeyDown}
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onNudgeStart(1)}
                className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                aria-label="Nudge start forward"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onNudgeStart(-1)}
                className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                aria-label="Nudge start backward"
              >
                ▼
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 w-24">{endTimeLabel}</label>
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={endTimeInput}
              placeholder="mm:ss"
              onChange={(e) => onEndInputChange(e.target.value)}
              onBlur={onEndBlur}
              onKeyDown={onEndKeyDown}
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onNudgeEnd(1)}
                className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                aria-label="Nudge end forward"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onNudgeEnd(-1)}
                className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                aria-label="Nudge end backward"
              >
                ▼
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-300">{answerLabel}</label>
        <input
          value={answerValue}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder={answerPlaceholder}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      </div>
    </div>
  );
};

export default ClipEditorPanel;
