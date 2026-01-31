import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Chip, LinearProgress, Switch } from "@mui/material";
import type {
  ChatMessage,
  GameState,
  PlaylistItem,
  RoomState,
} from "../model/types";
import { useKeyBindings } from "../../Setting/ui/components/useKeyBindings";

interface GameRoomPageProps {
  room: RoomState["room"];
  gameState: GameState;
  playlist: PlaylistItem[];
  onBack: () => void;
  onSubmitChoice: (choiceIndex: number) => void;
  participants?: RoomState["participants"];
  meClientId?: string;
  messages?: ChatMessage[];
  messageInput?: string;
  onMessageChange?: (value: string) => void;
  onSendMessage?: () => void;
  username?: string | null;
  serverOffsetMs?: number;
}

const extractYouTubeId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const vid = parsed.searchParams.get("v");
    if (vid) return vid;
    const segments = parsed.pathname.split("/");
    return segments.pop() || null;
  } catch (err) {
    console.error("Failed to parse video id", err);
    return null;
  }
};

const GameRoomPage: React.FC<GameRoomPageProps> = ({
  room,
  gameState,
  playlist,
  onBack,
  onSubmitChoice,
  participants = [],
  meClientId,
  messages = [],
  messageInput = "",
  onMessageChange,
  onSendMessage,
  serverOffsetMs = 0,
}) => {
  const [volume, setVolume] = useState(() => {
    const stored = Number(localStorage.getItem("mq_volume"));
    return Number.isFinite(stored) ? Math.min(100, Math.max(0, stored)) : 100;
  });
  const [nowMs, setNowMs] = useState(() => Date.now() + serverOffsetMs);
  const playerStartRef = useRef(0);
  const [showVideoOverride, setShowVideoOverride] = useState<boolean | null>(
    null,
  );
  const [selectedChoiceState, setSelectedChoiceState] = useState<{
    trackIndex: number;
    choiceIndex: number | null;
  }>({ trackIndex: -1, choiceIndex: null });
  const [loadedTrackKey, setLoadedTrackKey] = useState<string | null>(null);
  const { keyBindings } = useKeyBindings();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasStartedPlaybackRef = useRef(false);
  const playerReadyRef = useRef(false);
  const lastSyncMsRef = useRef<number>(0);
  const lastTrackLoadKeyRef = useRef<string | null>(null);
  const lastLoadedVideoIdRef = useRef<string | null>(null);
  const lastTrackSessionRef = useRef<string | null>(null);
  const lastPassiveResumeRef = useRef<number>(0);
  const PLAYER_ID = "mq-main-player";
  const DRIFT_TOLERANCE_SEC = 1;
  const getServerNowMs = useCallback(
    () => Date.now() + serverOffsetMs,
    [serverOffsetMs],
  );
  useEffect(() => {
    lastSyncMsRef.current = Date.now() + serverOffsetMs;
  }, [serverOffsetMs]);

  const applyVolume = useCallback((val: number) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const safeVolume = Math.min(100, Math.max(0, val));
    try {
      target.postMessage(
        JSON.stringify({
          event: "command",
          func: "setVolume",
          args: [safeVolume],
        }),
        "*",
      );
    } catch (err) {
      console.error("setVolume failed", err);
    }
  }, []);

  const effectiveTrackOrder = useMemo(() => {
    if (gameState.trackOrder?.length) {
      return gameState.trackOrder;
    }
    return playlist.map((_, idx) => idx);
  }, [gameState.trackOrder, playlist]);

  const trackCursor = Math.max(0, gameState.trackCursor ?? 0);
  const trackOrderLength = effectiveTrackOrder.length || playlist.length || 0;
  const boundedCursor = Math.min(
    trackCursor,
    Math.max(trackOrderLength - 1, 0),
  );
  const currentTrackIndex =
    gameState.currentIndex ??
    effectiveTrackOrder[boundedCursor] ??
    effectiveTrackOrder[0] ??
    0;
  const waitingToStart = gameState.startedAt > nowMs;
  const lockedCount = gameState.lockedClientIds?.length ?? 0;
  const lockedOrder = gameState.lockedOrder ?? [];

  const item = useMemo(() => {
    return playlist[currentTrackIndex] ?? playlist[0];
  }, [playlist, currentTrackIndex]);

  const clipStartSec = Math.max(0, item?.startSec ?? 0);
  const fallbackDurationSec = Math.max(
    1,
    Math.round(gameState.guessDurationMs / 1000),
  );
  const clipEndSec =
    typeof item?.endSec === "number" && item.endSec > clipStartSec
      ? item.endSec
      : clipStartSec + fallbackDurationSec;

  const computeServerPositionSec = useCallback(
    () => {
      const elapsed = Math.max(
        0,
        Math.floor((getServerNowMs() - gameState.startedAt) / 1000),
      );
      return Math.min(clipEndSec, clipStartSec + elapsed);
    },
    [clipEndSec, clipStartSec, gameState.startedAt, getServerNowMs],
  );
  const getEstimatedLocalPositionSec = useCallback(() => {
    const elapsed = (getServerNowMs() - lastSyncMsRef.current) / 1000;
    return Math.min(
      clipEndSec,
      Math.max(0, playerStartRef.current + elapsed),
    );
  }, [clipEndSec, getServerNowMs]);

  const videoId = item ? extractYouTubeId(item.url) : null;
  const phaseEndsAt =
    gameState.phase === "guess"
      ? gameState.startedAt + gameState.guessDurationMs
      : gameState.revealEndsAt;
  const phaseRemainingMs = Math.max(0, phaseEndsAt - nowMs);
  const revealCountdownMs = Math.max(0, gameState.revealEndsAt - nowMs);
  const isEnded = gameState.status === "ended";
  const isReveal = gameState.phase === "reveal";
  const showVideo = showVideoOverride ?? (gameState.showVideo ?? true);
  const selectedChoice =
    selectedChoiceState.trackIndex === currentTrackIndex
      ? selectedChoiceState.choiceIndex
      : null;
  // 只用曲目索引決定是否重載，避免伺服器在公布階段更新 startedAt 時觸發重載
  const trackLoadKey = `${videoId ?? "none"}:${clipStartSec}-${clipEndSec}`;
  const trackSessionKey = `${currentTrackIndex}`;
  const isTrackLoading = loadedTrackKey !== trackLoadKey;
  const showLoadingMask = isTrackLoading && !isReveal;
  const correctChoiceIndex = currentTrackIndex;

  const postCommand = useCallback((func: string, args: unknown[] = []) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage(
        JSON.stringify({
          event: "command",
          func,
          args,
          id: PLAYER_ID,
        }),
        "*",
      );
    } catch (err) {
      console.error(`${func} failed`, err);
    }
  }, []);

  const loadTrack = useCallback(
    (
      id: string,
      startSeconds: number,
      endSeconds: number | undefined,
      autoplay: boolean,
    ) => {
      const payload = {
        videoId: id,
        startSeconds,
        ...(typeof endSeconds === "number" ? { endSeconds } : {}),
      };
      postCommand(autoplay ? "loadVideoById" : "cueVideoById", [
        payload,
      ]);
      lastLoadedVideoIdRef.current = id;
      lastSyncMsRef.current = getServerNowMs();
      if (!autoplay) {
        postCommand("pauseVideo");
        postCommand("seekTo", [startSeconds, true]);
      }
    },
    [getServerNowMs, postCommand],
  );

  const startPlayback = useCallback(
    (forcedPosition?: number) => {
      if (waitingToStart) return;
      const rawStartPos = forcedPosition ?? computeServerPositionSec();
      const startPos = Math.min(
        clipEndSec,
        Math.max(clipStartSec, rawStartPos),
      );
      const estimated = getEstimatedLocalPositionSec();
      const needsSeek = Math.abs(estimated - startPos) > DRIFT_TOLERANCE_SEC;
      if (Math.abs(playerStartRef.current - startPos) > 0.01) {
        playerStartRef.current = startPos;
      }
      lastSyncMsRef.current = getServerNowMs();

      if (needsSeek) {
        postCommand("seekTo", [startPos, true]);
      }
      postCommand("playVideo");
      hasStartedPlaybackRef.current = true;
      applyVolume(volume);
    },
    [
      applyVolume,
      clipEndSec,
      clipStartSec,
      computeServerPositionSec,
      getEstimatedLocalPositionSec,
      getServerNowMs,
      postCommand,
      volume,
      waitingToStart,
    ],
  );


  // 公布答案切換時，若音樂已在播，保持當前進度並標記載入完畢，避免重新 seek。
  useEffect(() => {
    const interval = setInterval(() => {
      const now = getServerNowMs();
      setNowMs(now);
      if (
        !hasStartedPlaybackRef.current &&
        playerReadyRef.current &&
        now >= gameState.startedAt
      ) {
        startPlayback();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [getServerNowMs, gameState.startedAt, startPlayback]);

  // 如果已在播放且進入公布階段，確保解除載入遮罩
  useEffect(() => {
    applyVolume(volume);
    localStorage.setItem("mq_volume", String(volume));
  }, [applyVolume, volume]);

  // Ensure volume is re-applied when the iframe is recreated for a new track.
  useEffect(() => {
    applyVolume(volume);
  }, [applyVolume, currentTrackIndex, gameState.startedAt, volume]);

  // Override media session to avoid exposing track info and disable remote controls/progress.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    if (typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Music Quiz",
        artist: isReveal ? "Reveal phase" : "Guess the song",
        album: "Now playing",
      });
      const noop = () => { };
      const actions: Array<MediaSessionAction> = [
        "play",
        "pause",
        "stop",
        "seekbackward",
        "seekforward",
        "seekto",
        "previoustrack",
        "nexttrack",
      ];
      actions.forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, noop);
        } catch {
          /* ignore unsupported actions */
        }
      });
      navigator.mediaSession.playbackState =
        waitingToStart || isEnded ? "paused" : "playing";
    } catch (err) {
      console.error("mediaSession setup failed", err);
    }
  }, [isReveal, waitingToStart, isEnded, currentTrackIndex]);

  // Listen for YouTube player readiness/state.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || "";
      const isYouTube =
        origin.includes("youtube.com") ||
        origin.includes("youtube-nocookie.com");
      if (!isYouTube || typeof event.data !== "string") return;

      let data: { event?: string; info?: number; id?: string };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.id && data.id !== PLAYER_ID) return;

      if (data.event === "onReady") {
        playerReadyRef.current = true;
        const currentId = videoId;
        const currentKey = `${currentId ?? "none"}`;
        if (!currentId) return;
        if (lastTrackLoadKeyRef.current) return; // already loaded first track
        const startSec = waitingToStart
          ? clipStartSec
          : computeServerPositionSec();
        playerStartRef.current = startSec;
        loadTrack(currentId, startSec, clipEndSec, !waitingToStart);
        lastTrackLoadKeyRef.current = currentKey;
        if (!waitingToStart) {
          startPlayback(startSec);
        }
      }

        if (data.event === "onStateChange") {
          if (data.info === 1) {
            hasStartedPlaybackRef.current = true;
            lastSyncMsRef.current = getServerNowMs();
            setLoadedTrackKey(trackLoadKey);
          }
        if (
          (data.info === 2 || data.info === 3) &&
          hasStartedPlaybackRef.current &&
          !waitingToStart
        ) {
          const now = Date.now();
          if (now - lastPassiveResumeRef.current > 1000) {
            lastPassiveResumeRef.current = now;
            // If YouTube pauses/buffers during phase switch, nudge play without seeking.
            postCommand("playVideo");
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    clipEndSec,
    clipStartSec,
    computeServerPositionSec,
    getServerNowMs,
    loadTrack,
    postCommand,
    startPlayback,
    trackLoadKey,
    videoId,
    waitingToStart,
  ]);

  // Load track when cursor changes without recreating iframe.
  useEffect(() => {
    if (!videoId) return;
    if (!playerReadyRef.current) return;
    if (lastTrackLoadKeyRef.current === trackLoadKey) return;

    if (lastTrackSessionRef.current !== trackSessionKey) {
      lastTrackSessionRef.current = trackSessionKey;
      hasStartedPlaybackRef.current = false;
      playerStartRef.current = computeServerPositionSec();
    }

    const autoplay = !waitingToStart;
    const startSec = autoplay ? computeServerPositionSec() : clipStartSec;
    playerStartRef.current = startSec;
    loadTrack(videoId, startSec, clipEndSec, autoplay);
    hasStartedPlaybackRef.current = false;
    lastTrackLoadKeyRef.current = trackLoadKey;
    if (autoplay) {
      startPlayback(startSec);
    }
  }, [
    computeServerPositionSec,
    loadTrack,
    startPlayback,
    trackLoadKey,
    trackSessionKey,
    videoId,
    waitingToStart,
    clipStartSec,
    clipEndSec,
  ]);

  // Stop audio during countdown and start exactly when countdown finishes.
  useEffect(() => {
    if (waitingToStart) {
      hasStartedPlaybackRef.current = false;
      postCommand("pauseVideo");
      postCommand("seekTo", [clipStartSec, true]);
    }
  }, [clipStartSec, postCommand, waitingToStart]);

  // When returning from background, re-seek to server time if drifted.
  useEffect(() => {
    const handleVisibility = () => {
      return;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Keyboard shortcuts for answering (default Q/W/A/S, user customizable via inputs below).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (isReveal || isEnded) return;
      if (!gameState.choices?.length) return;

      const pressed = e.key.toUpperCase();
      const match = Object.entries(keyBindings).find(
        ([, key]) => key.toUpperCase() === pressed,
      );
      if (!match) return;

      const idx = Number(match[0]);
      const choice = gameState.choices[idx];
      if (!choice) return;
      e.preventDefault();
      setSelectedChoiceState({
        trackIndex: currentTrackIndex,
        choiceIndex: choice.index,
      });
      onSubmitChoice(choice.index);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    currentTrackIndex,
    gameState.choices,
    isEnded,
    isReveal,
    keyBindings,
    onSubmitChoice,
  ]);

  const iframeSrc = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&controls=0&disablekb=1&enablejsapi=1&rel=0&playsinline=1&modestbranding=1&fs=0`
    : null;
  // 影片持續渲染，僅用覆蓋層控制可見，避免切換時 iframe 被刷新
  const shouldShowVideo = true;

  const phaseLabel = isEnded
    ? "已結束"
    : gameState.phase === "guess"
      ? "猜歌"
      : "公布答案";

  const progressPct =
    phaseEndsAt === gameState.startedAt
      ? 0
      : ((gameState.phase === "guess"
        ? gameState.guessDurationMs - phaseRemainingMs
        : gameState.revealDurationMs - phaseRemainingMs) /
        (gameState.phase === "guess"
          ? gameState.guessDurationMs
          : gameState.revealDurationMs)) *
      100;

  const sortedParticipants = participants
    .slice()
    .sort((a, b) => b.score - a.score);
  const topFive = sortedParticipants.slice(0, 5);
  const self = sortedParticipants.find((p) => p.clientId === meClientId);
  const scoreboardList =
    self && !topFive.some((p) => p.clientId === self.clientId)
      ? [...topFive, self]
      : topFive;

  const recentMessages = messages.slice(-80);

  // （預熱暫停使用，以排除干擾播放的可能）

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr] lg:max-h-[calc(100vh-140px)]">
      {/* 左側：分數榜 + 聊天 */}
      <aside className="flex h-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-slate-50 shadow-md overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
          <span className="text-sm font-semibold">分數榜</span>
          <span className="text-[11px] text-slate-400">(前五名 + 自己)</span>
          <Chip
            label={`已答 ${lockedCount}/${participants.length || 0}`}
            size="small"
            color="success"
            variant="outlined"
            className="ml-auto"
          />
        </div>
        <div className="space-y-2">
          {scoreboardList.length === 0 ? (
            <div className="text-xs text-slate-500">尚無玩家</div>
          ) : (
            scoreboardList.map((p, idx) => (
              <div
                key={p.clientId}
                className={`flex items-center justify-between rounded px-2 py-1 text-sm ${gameState.lockedClientIds?.includes(p.clientId)
                    ? "border border-emerald-500/50 bg-emerald-900/40 text-emerald-50"
                    : "bg-slate-800/40 text-slate-200"
                  } ${p.clientId === meClientId ? "ring-1 ring-emerald-400/70" : ""
                  }`}
              >
                <span className="truncate flex items-center gap-2">
                  {gameState.lockedClientIds?.includes(p.clientId) && (
                    <span
                      className="h-2 w-2 rounded-full bg-emerald-400"
                      title="已選答案"
                    />
                  )}
                  {idx + 1}.{" "}
                  {p.clientId === meClientId
                    ? `${p.username}（我）`
                    : p.username}
                </span>
                <div className="flex items-center gap-2">
                  {gameState.lockedClientIds?.includes(p.clientId) ? (
                    <Chip
                      label={`第${lockedOrder.indexOf(p.clientId) + 1 || "?"
                        }答`}
                      size="small"
                      color="success"
                      variant="filled"
                    />
                  ) : (
                    <Chip label="未答" size="small" variant="outlined" />
                  )}
                  <span className="font-semibold text-emerald-300">
                    {p.score}
                    {p.combo > 1 && (
                      <span className="ml-1 text-amber-300">x{p.combo}</span>
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="h-px bg-slate-800/80" />

        <div className="flex min-h-[300px] flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950/60 p-3 gap-2 overflow-hidden">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-4 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
              <span>聊天室</span>
            </div>
            <span className="text-xs text-slate-400">
              {messages.length} 則訊息
            </span>
          </div>
          <div className="h-px bg-slate-800/70" />
          <div
            ref={chatScrollRef}
            className="flex-1 md:max-h-80 overflow-y-auto overflow-x-hidden space-y-3 pr-1"
          >
            {recentMessages.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">
                目前沒有訊息
              </div>
            ) : (
              recentMessages.map((msg) => {
                // const isSelf = msg.username === username;
                return (
                  <div key={msg.id} className={`flex`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-xs shadow`}
                    >
                      <div className="flex items-center gap-4 text-[11px] text-slate-300">
                        <span className="font-semibold">
                          {msg.username}
                          {/* {isSelf && "（我）"} */}
                        </span>
                        <span className="text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="mt-1 whitespace-pre-wrap wrap-anywhere leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder="輸入訊息..."
              value={messageInput}
              onChange={(e) => onMessageChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSendMessage?.();
                }
              }}
            />
            <Button
              variant="contained"
              color="info"
              size="small"
              onClick={() => onSendMessage?.()}
            >
              送出
            </Button>
          </div>
        </div>
      </aside>

      {/* 右側：播放區 + 答題區 */}
      <section className="flex h-full flex-col gap-3 overflow-hidden">
        {/* 播放區 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-50 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-6 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
              <div>
                <p className="text-sm font-semibold">{room.name}</p>
                <p className="text-xs text-slate-400">
                  曲目 {boundedCursor + 1}/{trackOrderLength || "?"}
                </p>
              </div>
            </div>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={onBack}
            >
              返回聊天室
            </Button>
          </div>

          <div className="relative w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-inner h-[220px] sm:h-[280px] md:h-[320px] xl:h-[340px]">
            {iframeSrc ? (
              <iframe
                src={iframeSrc}
                className="h-full w-full object-contain"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Now playing"
                style={{
                  pointerEvents: "none",
                  opacity: shouldShowVideo ? 1 : 1,
                }}
                ref={iframeRef}
                onLoad={() => {
                  const target = iframeRef.current?.contentWindow;
                  if (target) {
                    try {
                      target.postMessage(
                        JSON.stringify({ event: "listening", id: PLAYER_ID }),
                        "*",
                      );
                    } catch (err) {
                      console.error("player event binding failed", err);
                    }
                  }
                  applyVolume(volume);
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                暫時沒有可播放的影片來源
              </div>
            )}
            {gameState.phase === "guess" && !isEnded && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
                <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-700 shadow-lg shadow-emerald-500/30" />
                <p className="mt-2 text-xs text-slate-300">
                  {waitingToStart
                    ? `遊戲即將開始 · ${Math.ceil(
                      (gameState.startedAt - nowMs) / 1000,
                    )}s`
                    : "猜歌中，影片已隱藏"}
                </p>
              </div>
            )}
            {/* 避免換曲瞬間曝光：僅在載入期間遮蔽 */}
            {showLoadingMask && (
              <div className="pointer-events-none absolute inset-0 bg-slate-950" />
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                color="info"
                checked={showVideo}
                onChange={(e) => setShowVideoOverride(e.target.checked)}
              />
              <span className="text-xs text-slate-300">
                公布階段顯示影片（猜歌時自動隱藏）
              </span>
            </div>
            <div className="flex items-center gap-2 sm:min-w-[200px]">
              <span className="text-xs text-slate-300">音量</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* 答題區 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-50 shadow-md">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-1.5 w-6 rounded-full bg-gradient-to-r from-amber-400 to-rose-400" />
            <span className="text-sm font-semibold">{phaseLabel}</span>
            <Chip
              label={`${Math.ceil(phaseRemainingMs / 1000)}s`}
              size="small"
              color={gameState.phase === "guess" ? "warning" : "success"}
              variant="outlined"
            />
          </div>

          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, progressPct))}
            color={gameState.phase === "guess" ? "warning" : "success"}
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {gameState.choices.map((choice, idx) => {
              const isSelected = selectedChoice === choice.index;
              const isCorrect = choice.index === correctChoiceIndex;
              const isLocked = isReveal || isEnded;

              return (
                <Button
                  key={`${choice.index}-${idx}`}
                  fullWidth
                  size="large"
                  disableRipple
                  aria-disabled={isLocked}
                  tabIndex={isLocked ? -1 : 0}
                  variant={
                    isReveal
                      ? isCorrect || isSelected
                        ? "contained"
                        : "outlined"
                      : isSelected
                        ? "contained"
                        : "outlined"
                  }
                  color={
                    isReveal
                      ? isCorrect
                        ? "success"
                        : isSelected
                          ? "error"
                          : "info"
                      : isSelected
                        ? "info"
                        : "info"
                  }
                  className={`justify-start ${isReveal
                      ? isCorrect
                        ? "bg-emerald-700/40"
                        : isSelected
                          ? "bg-rose-700/40"
                          : ""
                      : isSelected
                        ? "bg-sky-700/30"
                        : ""
                    } ${isLocked ? "pointer-events-none" : ""}`}
                  disabled={false}
                  onClick={() => {
                    if (isLocked) return;
                    setSelectedChoiceState({
                      trackIndex: currentTrackIndex,
                      choiceIndex: choice.index,
                    });
                    onSubmitChoice(choice.index);
                  }}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate">{choice.title}</span>
                    <span className="ml-3 inline-flex h-6 w-6 flex-none items-center justify-center rounded bg-slate-800 text-[11px] font-semibold text-slate-200 border border-slate-700">
                      {(keyBindings[idx] ?? "").toUpperCase()}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>

          <div className="mt-3 min-h-[120px]">
            {isReveal ? (
              <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3">
                <p className="text-sm font-semibold text-emerald-100">
                  正確答案
                </p>
                <p className="mt-1 text-sm text-emerald-50">
                  {gameState.answerTitle ?? "（未提供名稱）"}
                </p>
                {gameState.status === "playing" ? (
                  <p className="mt-1 text-xs text-emerald-200">
                    下一首將在 {Math.ceil(revealCountdownMs / 1000)} 秒後開始
                  </p>
                ) : (
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-emerald-200">
                      已播放完本輪歌曲，請房主挑選新的歌單。
                    </p>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={onBack}
                    >
                      返回聊天室
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-transparent bg-transparent p-3" />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default GameRoomPage;
