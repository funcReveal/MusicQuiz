import type { RefObject } from "react";
import { Bolt, Pause, PlayArrow, Repeat, VolumeUp } from "@mui/icons-material";

type PlayerPanelProps = {
  selectedVideoId: string | null;
  selectedTitle: string;
  selectedUploader: string;
  selectedDuration?: string;
  selectedClipDurationLabel: string;
  selectedClipDurationSec: string;
  clipCurrentSec: string;
  clipDurationSec: string;
  clipProgressPercent: number;
  startSec: number;
  effectiveEnd: number;
  currentTimeSec: number;
  onProgressChange: (value: number) => void;
  onTogglePlayback: () => void;
  isPlayerReady: boolean;
  isPlaying: boolean;
  onVolumeChange: (value: number) => void;
  volume: number;
  autoPlayOnSwitch: boolean;
  onAutoPlayChange: (value: boolean) => void;
  autoPlayLabel: string;
  loopEnabled: boolean;
  onLoopChange: (value: boolean) => void;
  loopLabel: string;
  playLabel: string;
  pauseLabel: string;
  volumeLabel: string;
  noSelectionLabel: string;
  playerContainerRef: RefObject<HTMLDivElement | null>;
  thumbnail?: string;
};

const PlayerPanel = ({
  selectedVideoId,
  selectedTitle,
  selectedUploader,
  selectedDuration,
  selectedClipDurationLabel,
  selectedClipDurationSec,
  clipCurrentSec,
  clipDurationSec,
  clipProgressPercent,
  startSec,
  effectiveEnd,
  currentTimeSec,
  onProgressChange,
  onTogglePlayback,
  isPlayerReady,
  isPlaying,
  onVolumeChange,
  volume,
  autoPlayOnSwitch,
  onAutoPlayChange,
  autoPlayLabel,
  loopEnabled,
  onLoopChange,
  loopLabel,
  playLabel,
  pauseLabel,
  noSelectionLabel,
  playerContainerRef,
  thumbnail,
}: PlayerPanelProps) => {
  return (
    <div className="p-2.5">
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-900 aspect-16/6">
        {selectedVideoId ? (
          <>
            <div ref={playerContainerRef} className="h-full w-full" />
            <div className="absolute inset-0 z-10" aria-hidden="true" />
          </>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={selectedTitle}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500">
            {noSelectionLabel}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-100 line-clamp-1">
            {selectedTitle}
          </div>
          <div className="text-[11px] text-slate-400">
            {selectedUploader}
            {selectedDuration ? ` · ${selectedDuration}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-[9px] uppercase tracking-[0.3em] text-slate-500">
          {selectedClipDurationLabel} {selectedClipDurationSec}
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{clipCurrentSec}</span>
          <span>{clipDurationSec}</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300"
            style={{ width: `${clipProgressPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={Math.floor(startSec)}
          max={Math.floor(effectiveEnd)}
          step={1}
          value={Math.floor(currentTimeSec)}
          onChange={(e) => onProgressChange(Number(e.target.value))}
          className="mt-1.5 w-full accent-sky-400"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlayback}
          disabled={!isPlayerReady}
          aria-label={isPlaying ? pauseLabel : playLabel}
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-slate-100 transition ${
            isPlaying
              ? "border-sky-400/70 bg-sky-400/15"
              : "border-slate-700 bg-slate-900/80"
          } hover:border-sky-300 disabled:opacity-50`}
        >
          {isPlaying ? (
            <Pause fontSize="small" />
          ) : (
            <PlayArrow fontSize="small" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onAutoPlayChange(!autoPlayOnSwitch)}
          aria-pressed={autoPlayOnSwitch}
          title={autoPlayLabel}
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-slate-100 transition ${
            autoPlayOnSwitch
              ? "border-emerald-400/70 bg-emerald-400/15"
              : "border-slate-700 bg-slate-900/80"
          } hover:border-emerald-300`}
        >
          <Bolt fontSize="small" />
        </button>
        <button
          type="button"
          onClick={() => onLoopChange(!loopEnabled)}
          aria-pressed={loopEnabled}
          title={loopLabel}
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-slate-100 transition ${
            loopEnabled
              ? "border-amber-400/70 bg-amber-400/15"
              : "border-slate-700 bg-slate-900/80"
          } hover:border-amber-300`}
        >
          <Repeat fontSize="small" />
        </button>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300">
          <VolumeUp fontSize="small" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-20 accent-sky-400"
          />
          <span className="w-6 text-right text-[10px] text-slate-400">
            {volume}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlayerPanel;
