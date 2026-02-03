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
  RoomParticipant,
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
    const stored = localStorage.getItem("mq_volume");
    if (stored === null) return 50;
    const parsed = Number(stored);
    return Number.isFinite(parsed)
      ? Math.min(100, Math.max(0, parsed))
      : 50;
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
  const [playerVideoId, setPlayerVideoId] = useState<string | null>(null);
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
  const remainingToStartMs = Math.max(0, gameState.startedAt - nowMs);
  const startCountdownSec = Math.max(
    1,
    Math.min(3, Math.ceil(remainingToStartMs / 1000)),
  );
  const isInitialCountdown = waitingToStart && trackCursor === 0;
  const isInterTrackWait = waitingToStart && !isInitialCountdown;
  const isFinalCountdown = isInitialCountdown && startCountdownSec <= 3;
  const countdownTone = isFinalCountdown
    ? "border-rose-400/70 bg-rose-500/20 text-rose-100 shadow-[0_0_35px_rgba(244,63,94,0.45)]"
    : "border-amber-400/60 bg-amber-400/15 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.35)]";
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
        if (!currentId) return;
        if (lastTrackLoadKeyRef.current === trackLoadKey) return;
        const startSec = waitingToStart
          ? clipStartSec
          : computeServerPositionSec();
        playerStartRef.current = startSec;
        loadTrack(currentId, startSec, clipEndSec, !waitingToStart);
        lastTrackLoadKeyRef.current = trackLoadKey;
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
      if (document.visibilityState !== "visible") return;
      if (!playerReadyRef.current) return;
      if (waitingToStart) return;
      startPlayback();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [startPlayback, waitingToStart]);

  // Keyboard shortcuts for answering (default Q/W/A/S, user customizable via inputs below).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        if (active.tagName === "TEXTAREA" || active.isContentEditable) {
          return;
        }
        if (active.tagName === "INPUT") {
          const input = active as HTMLInputElement;
          const type = (input.type || "text").toLowerCase();
          // Allow key bindings even when the volume slider (range) is focused.
          if (type !== "range") {
            return;
          }
        }
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

  const effectivePlayerVideoId = playerVideoId ?? videoId;
  const iframeSrc = effectivePlayerVideoId
    ? `https://www.youtube-nocookie.com/embed/${effectivePlayerVideoId}?autoplay=0&controls=0&disablekb=1&enablejsapi=1&rel=0&playsinline=1&modestbranding=1&fs=0`
    : null;
  // 影片持續渲染，僅用覆蓋層控制可見，避免切換時 iframe 被刷新
  const shouldShowVideo = true;

  const phaseLabel = isEnded
    ? "已結束"
    : gameState.phase === "guess"
      ? "猜歌"
      : "公布答案";

  const activePhaseDurationMs =
    gameState.phase === "guess"
      ? gameState.guessDurationMs
      : gameState.revealDurationMs;
  const progressPct =
    phaseEndsAt === gameState.startedAt || activePhaseDurationMs <= 0
      ? 0
      : ((activePhaseDurationMs - phaseRemainingMs) / activePhaseDurationMs) *
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
  const SCOREBOARD_SLOTS = 6;
  const scoreboardEntries = scoreboardList.slice(0, SCOREBOARD_SLOTS);
  const fillerCount = Math.max(0, SCOREBOARD_SLOTS - scoreboardEntries.length);
  type ScoreboardRow =
    | { type: "player"; player: RoomParticipant }
    | { type: "placeholder"; key: string };
  const scoreboardRows: ScoreboardRow[] = [
    ...scoreboardEntries.map((player) => ({ type: "player" as const, player })),
    ...Array.from({ length: fillerCount }, (_, idx) => ({
      type: "placeholder" as const,
      key: `placeholder-${idx}`,
    })),
  ];

  const recentMessages = messages.slice(-80);

  // （預熱暫停使用，以排除干擾播放的可能）

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  return (
    <div className="game-room-shell">
      <div className="game-room-grid grid w-full grid-cols-1 gap-3 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr] lg:h-[calc(100vh-140px)] lg:items-stretch">
        {/* 左側：分數榜 + 聊天 */}
        <aside className="game-room-panel game-room-panel--left flex h-full flex-col gap-3 p-3 text-slate-50 overflow-hidden">
          <div className="flex items-center gap-3">
            <div>
              <p className="game-room-kicker">Scoreboard</p>
              <p className="game-room-title">分數榜</p>
            </div>
            <span className="ml-2 text-[11px] text-slate-400">
              (前五名 + 自己)
            </span>
            <Chip
              label={`已答 ${lockedCount}/${participants.length || 0}`}
              size="small"
              color="success"
              variant="outlined"
              className="ml-auto game-room-chip"
            />
          </div>
          <div className="space-y-2">
            {scoreboardRows.length === 0 ? (
              <div className="text-xs text-slate-500">尚無玩家</div>
            ) : (
              scoreboardRows.map((row, idx) => {
                if (row.type === "placeholder") {
                  return (
                    <div
                      key={row.key}
                      className="game-room-score-row game-room-score-row--placeholder flex items-center justify-between text-sm"
                      aria-hidden="true"
                    >
                      <span className="truncate flex items-center gap-2">
                        {idx + 1}. <span>等待加入</span>
                      </span>
                      <span className="text-[11px] text-slate-500">--</span>
                    </div>
                  );
                }
                const p = row.player;
                return (
                  <div
                    key={p.clientId}
                    className={`game-room-score-row flex items-center justify-between text-sm ${gameState.lockedClientIds?.includes(p.clientId)
                      ? "game-room-score-row--locked"
                      : ""
                      } ${p.clientId === meClientId ? "game-room-score-row--me" : ""
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
                );
              })
            )}
          </div>
          <div className="h-px bg-slate-800/80" />

          <div className="game-room-chat flex min-h-[240px] flex-1 flex-col p-3 gap-2 overflow-hidden">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
              <div className="flex items-center gap-2">
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
                      <div className="game-room-chat-bubble max-w-[80%] px-3 py-2 text-xs">
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
        <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          {/* 播放區 */}
          <div className="game-room-panel game-room-panel--accent p-3 text-slate-50 flex-none">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <p className="game-room-kicker">Now Playing</p>
                  <p className="game-room-title">{room.name}</p>
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

            <div className="game-room-media-frame relative w-full overflow-hidden h-[180px] sm:h-[240px] md:h-[280px] xl:h-[300px]">
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
                    if (!playerVideoId && videoId) {
                      setPlayerVideoId(videoId);
                    }
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
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95">
                  {isInitialCountdown ? (
                    <>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                        開始倒數
                      </div>
                      <div
                        className={`mt-4 flex h-28 w-28 items-center justify-center rounded-full border ${countdownTone}`}
                      >
                        <span className="text-5xl font-black tracking-widest sm:text-6xl">
                          {startCountdownSec}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-300">
                        遊戲即將開始，請準備
                      </p>
                    </>
                  ) : waitingToStart ? null : (
                    <>
                      <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-700 shadow-lg shadow-emerald-500/30" />
                      <p className="mt-2 text-xs text-slate-300">
                        猜歌中，影片已隱藏
                      </p>
                    </>
                  )}
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
          <div className="game-room-panel game-room-panel--warm p-3 text-slate-50 flex-1 min-h-0 flex flex-col">
            {isInitialCountdown ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                  即將開始
                </div>
                <div
                  className={`mt-5 flex h-28 w-28 items-center justify-center rounded-full border ${countdownTone}`}
                >
                  <span className="text-5xl font-black tracking-widest sm:text-6xl">
                    {startCountdownSec}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  倒數結束後即可開始作答
                </p>
              </div>
            ) : (
              <>
                <div className="game-room-answer-body">
                  <div className="mb-3 flex items-center gap-3">

                    <div>
                      <p className="game-room-kicker">Phase</p>
                      <p className="game-room-title">
                        {isInterTrackWait ? "下一首準備中" : phaseLabel}
                      </p>
                    </div>
                    <Chip
                      label={
                        isInterTrackWait
                          ? `${startCountdownSec}s`
                          : `${Math.ceil(phaseRemainingMs / 1000)}s`
                      }
                      size="small"
                      color={
                        isInterTrackWait
                          ? "info"
                          : gameState.phase === "guess"
                            ? "warning"
                            : "success"
                      }
                      variant="outlined"
                      className="game-room-chip"
                    />
                  </div>

                  <LinearProgress
                    variant={isInterTrackWait ? "indeterminate" : "determinate"}
                    value={
                      isInterTrackWait ? undefined : Math.min(100, Math.max(0, progressPct))
                    }
                    color={
                      isInterTrackWait
                        ? "info"
                        : gameState.phase === "guess"
                          ? "warning"
                          : "success"
                    }
                  />

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {isInterTrackWait
                      ? Array.from(
                        {
                          length: Math.max(4, gameState.choices.length),
                        },
                        (_, idx) => (
                          <Button
                            key={`placeholder-${idx}`}
                            fullWidth
                            size="large"
                            disabled
                            variant="outlined"
                            className="game-room-choice-placeholder justify-start"
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="truncate text-slate-500">
                                下一首準備中
                              </span>
                              <span className="ml-3 inline-flex h-6 w-6 flex-none items-center justify-center rounded border border-slate-800 text-[11px] font-semibold text-slate-500">
                                —
                              </span>
                            </div>
                          </Button>
                        ),
                      )
                      : gameState.choices.map((choice, idx) => {
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
                </div>

                <div className="game-room-reveal mt-3">
                  {isReveal ? (
                    <div className="game-room-reveal-card rounded-lg border border-emerald-700 bg-emerald-900/30">
                      <p className="text-sm font-semibold text-emerald-100">
                        正確答案
                      </p>
                      <p className="game-room-reveal-answer mt-1 text-sm text-emerald-50">
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
                    <div
                      className="game-room-reveal-card game-room-reveal-placeholder rounded-lg border border-transparent bg-transparent"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default GameRoomPage;
