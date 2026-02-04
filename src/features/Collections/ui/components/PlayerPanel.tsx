import type { RefObject } from "react";

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
  playLabel,
  pauseLabel,
  volumeLabel,
  noSelectionLabel,
  playerContainerRef,
  thumbnail,
}: PlayerPanelProps) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
      <div className="relative aspect-video w-full max-w-xl mx-auto overflow-hidden rounded-lg bg-slate-900">
        {selectedVideoId ? (
          <>
            <div ref={playerContainerRef} className="h-full w-full" />
            <div className="absolute inset-0 z-10" aria-hidden="true" />
          </>
        ) : thumbnail ? (
          <img src={thumbnail} alt={selectedTitle} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500">
            {noSelectionLabel}
          </div>
        )}
      </div>
      <div className="mt-1 text-sm text-slate-100">{selectedTitle}</div>
      <div className="text-xs text-slate-400">
        {selectedUploader}
        {selectedDuration ? ` · ${selectedDuration}` : ""}
      </div>
      <div className="text-xs text-slate-400">
        {selectedClipDurationLabel}: {selectedClipDurationSec}
      </div>
      <div className="mt-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{clipCurrentSec}</span>
          <span>{clipDurationSec}</span>
        </div>
        <div className="mt-0.5 h-1 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-400"
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
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <button
          type="button"
          onClick={onTogglePlayback}
          disabled={!isPlayerReady}
          className="rounded-md border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-400 disabled:opacity-50"
        >
          {isPlaying ? pauseLabel : playLabel}
        </button>
        <div className="flex items-center gap-2">
          <span>{volumeLabel}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-28 accent-sky-400"
          />
          <span className="w-6 text-right">{volume}</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerPanel;
