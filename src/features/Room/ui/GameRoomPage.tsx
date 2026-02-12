import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Switch,
  Typography,
} from "@mui/material";
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
  onExitGame: () => void;
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

const extractYouTubeId = (
  url: string | null | undefined,
  fallbackId?: string | null,
): string | null => {
  if (fallbackId) return fallbackId;
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  const parseUrl = (value: string) => {
    const parsed = new URL(value);
    const vid = parsed.searchParams.get("v");
    if (vid) return vid;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.pop() || null;
  };
  try {
    return parseUrl(raw);
  } catch {
    try {
      return parseUrl(`https://${raw}`);
    } catch {
      const match =
        raw.match(/[?&]v=([^&]+)/) ||
        raw.match(/youtu\.be\/([^?&]+)/) ||
        raw.match(/youtube\.com\/embed\/([^?&]+)/);
      return match?.[1] ?? null;
    }
  }
};

const SILENT_AUDIO_SRC =
  "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA";

const GameRoomPage: React.FC<GameRoomPageProps> = ({
  room,
  gameState,
  playlist,
  onExitGame,
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
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50;
  });
  const requiresAudioGesture = useMemo(() => {
    if (typeof navigator === "undefined" || typeof window === "undefined") {
      return false;
    }
    const legacyNavigator = navigator as Navigator & {
      msMaxTouchPoints?: number;
    };
    const ua = navigator.userAgent || "";
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isIpadDesktopUa =
      navigator.platform === "MacIntel" &&
      (navigator.maxTouchPoints > 1 || (legacyNavigator.msMaxTouchPoints ?? 0) > 1);
    return isMobileUa || isIpadDesktopUa;
  }, []);
  const [audioUnlocked, setAudioUnlocked] = useState(() => !requiresAudioGesture);
  const audioUnlockedRef = useRef(!requiresAudioGesture);
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
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const { keyBindings } = useKeyBindings();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasStartedPlaybackRef = useRef(false);
  const playerReadyRef = useRef(false);
  const lastSyncMsRef = useRef<number>(0);
  const lastTrackLoadKeyRef = useRef<string | null>(null);
  const lastLoadedVideoIdRef = useRef<string | null>(null);
  const lastTrackSessionRef = useRef<string | null>(null);
  const lastPassiveResumeRef = useRef<number>(0);
  const resumeNeedsSyncRef = useRef(false);
  const resumeResyncTimerRef = useRef<number | null>(null);
  const resyncTimersRef = useRef<number[]>([]);
  const initialResyncTimersRef = useRef<number[]>([]);
  const initialResyncScheduledRef = useRef(false);
  const lastTimeRequestAtMsRef = useRef<number>(0);
  const lastPlayerStateRef = useRef<number | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayerTimeSecRef = useRef<number | null>(null);
  const lastPlayerTimeAtMsRef = useRef<number>(0);
  const lastTimeRequestReasonRef = useRef("init");

  const openExitConfirm = () => setExitConfirmOpen(true);
  const closeExitConfirm = () => setExitConfirmOpen(false);
  const handleExitConfirm = () => {
    setExitConfirmOpen(false);
    onExitGame();
  };
  const revealReplayRef = useRef(false);
  const lastRevealStartKeyRef = useRef<string | null>(null);
  const PLAYER_ID = "mq-main-player";
  const DRIFT_TOLERANCE_SEC = 1;
  const RESUME_DRIFT_TOLERANCE_SEC = 1.2;
  const WATCHDOG_DRIFT_TOLERANCE_SEC = 1.2;
  const WATCHDOG_REQUEST_INTERVAL_MS = 1000;
  const getServerNowMs = useCallback(
    () => Date.now() + serverOffsetMs,
    [serverOffsetMs],
  );
  const markAudioUnlocked = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
  }, []);
  useEffect(() => {
    lastSyncMsRef.current = Date.now() + serverOffsetMs;
  }, [serverOffsetMs]);
  const postPlayerMessage = useCallback(
    (payload: Record<string, unknown>, logLabel: string) => {
      try {
        const frame = iframeRef.current;
        if (!frame || !frame.isConnected) return false;
        const target = frame.contentWindow;
        if (!target) return false;
        target.postMessage(JSON.stringify(payload), "*");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("disconnected port")) {
          return false;
        }
        console.error(`${logLabel} failed`, err);
        return false;
      }
    },
    [],
  );
  const applyVolume = useCallback(
    (val: number) => {
      const safeVolume = Math.min(100, Math.max(0, val));
      postPlayerMessage(
        {
          event: "command",
          func: "setVolume",
          args: [safeVolume],
        },
        "setVolume",
      );
    },
    [postPlayerMessage],
  );

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
  const revealDurationSec = Math.max(0, gameState.revealDurationMs / 1000);
  const revealStartAt = gameState.revealEndsAt - gameState.revealDurationMs;
  const clipLengthSec = Math.max(0.01, clipEndSec - clipStartSec);

  const computeServerPositionSec = useCallback(() => {
    const elapsed = Math.max(
      0,
      (getServerNowMs() - gameState.startedAt) / 1000,
    );
    return Math.min(clipEndSec, clipStartSec + elapsed);
  }, [clipEndSec, clipStartSec, gameState.startedAt, getServerNowMs]);
  const computeRevealPositionSec = useCallback(() => {
    const elapsed = Math.max(0, (getServerNowMs() - revealStartAt) / 1000);
    const effectiveElapsed =
      revealDurationSec > 0 ? Math.min(elapsed, revealDurationSec) : elapsed;
    const offset = clipLengthSec > 0 ? effectiveElapsed % clipLengthSec : 0;
    return Math.min(clipEndSec, clipStartSec + offset);
  }, [
    clipEndSec,
    clipLengthSec,
    clipStartSec,
    getServerNowMs,
    revealDurationSec,
    revealStartAt,
  ]);
  const getDesiredPositionSec = useCallback(() => {
    if (revealReplayRef.current) {
      return computeRevealPositionSec();
    }
    return computeServerPositionSec();
  }, [computeRevealPositionSec, computeServerPositionSec]);
  const getEstimatedLocalPositionSec = useCallback(() => {
    const elapsed = (getServerNowMs() - lastSyncMsRef.current) / 1000;
    return Math.min(clipEndSec, Math.max(0, playerStartRef.current + elapsed));
  }, [clipEndSec, getServerNowMs]);

  const videoId = item ? extractYouTubeId(item.url, item.videoId) : null;
  const phaseEndsAt =
    gameState.phase === "guess"
      ? gameState.startedAt + gameState.guessDurationMs
      : gameState.revealEndsAt;
  const phaseRemainingMs = Math.max(0, phaseEndsAt - nowMs);
  const revealCountdownMs = Math.max(0, gameState.revealEndsAt - nowMs);
  const isEnded = gameState.status === "ended";
  const isReveal = gameState.phase === "reveal";
  const showVideo = showVideoOverride ?? gameState.showVideo ?? true;
  const selectedChoice =
    selectedChoiceState.trackIndex === currentTrackIndex
      ? selectedChoiceState.choiceIndex
      : null;

  const trackLoadKey = `${videoId ?? "none"}:${clipStartSec}-${clipEndSec}`;
  const trackSessionKey = `${currentTrackIndex}`;
  const isTrackLoading = loadedTrackKey !== trackLoadKey;
  const shouldShowGestureOverlay =
    !isEnded && requiresAudioGesture && !audioUnlocked;
  const showGuessMask = gameState.phase === "guess" && !isEnded && !waitingToStart;
  const showPreStartMask =
    waitingToStart &&
    !isEnded &&
    !shouldShowGestureOverlay;
  const showLoadingMask =
    isTrackLoading && !isReveal && !requiresAudioGesture && !waitingToStart;
  const shouldHideVideoFrame =
    shouldShowGestureOverlay || showPreStartMask || showLoadingMask || showGuessMask;
  const correctChoiceIndex = currentTrackIndex;

  const postCommand = useCallback(
    (func: string, args: unknown[] = []) => {
      postPlayerMessage(
        {
          event: "command",
          func,
          args,
          id: PLAYER_ID,
        },
        func,
      );
    },
    [postPlayerMessage],
  );
  const requestPlayerTime = useCallback(
    (reason: string) => {
      if (!playerReadyRef.current) return;
      lastTimeRequestReasonRef.current = reason;
      lastTimeRequestAtMsRef.current = getServerNowMs();
      postCommand("getCurrentTime");
    },
    [getServerNowMs, postCommand],
  );
  const getFreshPlayerTimeSec = useCallback(() => {
    const nowMs = getServerNowMs();
    if (nowMs - lastPlayerTimeAtMsRef.current > 2000) return null;
    return lastPlayerTimeSecRef.current;
  }, [getServerNowMs]);

  const updateMediaSession = useCallback(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    if (typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Muizo",
        artist: "",
        album: "",
      });
      navigator.mediaSession.playbackState =
        waitingToStart || isEnded ? "paused" : "playing";
    } catch (err) {
      console.error("mediaSession setup failed", err);
    }
  }, [isEnded, waitingToStart]);

  const startSilentAudio = useCallback(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;
    audio.loop = true;
    audio.preload = "auto";
    audio.muted = false;
    audio.volume = 0;
    updateMediaSession();
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {

      });
    }
    window.setTimeout(() => {
      updateMediaSession();
    }, 300);
  }, [updateMediaSession]);

  const stopSilentAudio = useCallback(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (err) {
      console.error("Failed to stop silent audio", err);
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
      postCommand(autoplay ? "loadVideoById" : "cueVideoById", [payload]);
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
    (forcedPosition?: number, forceSeek = false) => {
      if (requiresAudioGesture && !audioUnlockedRef.current) return;
      const serverNowMs = getServerNowMs();
      if (serverNowMs < gameState.startedAt) return;
      const rawStartPos = forcedPosition ?? getDesiredPositionSec();
      const startPos = Math.min(
        clipEndSec,
        Math.max(clipStartSec, rawStartPos),
      );
      const estimated = getEstimatedLocalPositionSec();
      const needsSeek =
        forceSeek || Math.abs(estimated - startPos) > DRIFT_TOLERANCE_SEC;
      if (Math.abs(playerStartRef.current - startPos) > 0.01) {
        playerStartRef.current = startPos;
      }
      lastSyncMsRef.current = serverNowMs;

      if (needsSeek) {
        postCommand("seekTo", [startPos, true]);
      }
      startSilentAudio();
      postCommand("playVideo");
      applyVolume(volume);
    },
    [
      applyVolume,
      clipEndSec,
      clipStartSec,
      getEstimatedLocalPositionSec,
      getDesiredPositionSec,
      getServerNowMs,
      gameState.startedAt,
      postCommand,
      requiresAudioGesture,
      startSilentAudio,
      volume,
    ],
  );
  const unlockAudioAndStart = useCallback(() => {
    if (!audioUnlockedRef.current) {
      markAudioUnlocked();
    }
    startSilentAudio();
    if (!playerReadyRef.current) return;
    const serverNow = getServerNowMs();
    if (serverNow < gameState.startedAt) {
      // Prime autoplay permission during user gesture before round start.
      postCommand("seekTo", [clipStartSec, true]);
      postCommand("playVideo");
      postCommand("pauseVideo");
      postCommand("seekTo", [clipStartSec, true]);
      return;
    }
    startPlayback();
  }, [
    clipStartSec,
    gameState.startedAt,
    getServerNowMs,
    markAudioUnlocked,
    postCommand,
    startPlayback,
    startSilentAudio,
  ]);

  const syncToServerPosition = useCallback(
    (
      _reason: string,
      forceSeek = false,
      toleranceSec = RESUME_DRIFT_TOLERANCE_SEC,
      requirePlayerTime = false,
    ) => {
      const serverPosition = getDesiredPositionSec();
      const playerTime = getFreshPlayerTimeSec();
      if (requirePlayerTime && playerTime === null) {
        return false;
      }
      const estimated = playerTime ?? getEstimatedLocalPositionSec();
      const drift = Math.abs(estimated - serverPosition);
      const shouldSeek =
        drift > toleranceSec || (forceSeek && playerTime === null);
      if (shouldSeek) {
        startPlayback(serverPosition, true);
        return true;
      }
      playerStartRef.current = serverPosition;
      lastSyncMsRef.current = getServerNowMs();
      postCommand("playVideo");
      applyVolume(volume);
      return false;
    },
    [
      applyVolume,
      getEstimatedLocalPositionSec,
      getDesiredPositionSec,
      getFreshPlayerTimeSec,
      getServerNowMs,
      postCommand,
      startPlayback,
      volume,
    ],
  );

  const scheduleResumeResync = useCallback(() => {
    if (resumeResyncTimerRef.current !== null) {
      window.clearTimeout(resumeResyncTimerRef.current);
      resumeResyncTimerRef.current = null;
    }
    resyncTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    resyncTimersRef.current = [];
    const checkpoints = [150, 650, 1200];
    checkpoints.forEach((delayMs) => {
      const timerId = window.setTimeout(() => {
        if (!playerReadyRef.current) return;
        if (document.visibilityState !== "visible") return;
        if (getServerNowMs() < gameState.startedAt) return;
        requestPlayerTime(`resume-${delayMs}`);
        window.setTimeout(() => {
          syncToServerPosition(
            `resume-check-${delayMs}`,
            false,
            RESUME_DRIFT_TOLERANCE_SEC,
            true,
          );
        }, 120);
      }, delayMs);
      resyncTimersRef.current.push(timerId);
    });
  }, [
    getServerNowMs,
    gameState.startedAt,
    requestPlayerTime,
    syncToServerPosition,
  ]);

  const scheduleInitialResync = useCallback(() => {
    if (initialResyncScheduledRef.current) return;
    initialResyncScheduledRef.current = true;
    initialResyncTimersRef.current.forEach((timerId) =>
      window.clearTimeout(timerId),
    );
    initialResyncTimersRef.current = [];
    const checkpoints = [1000, 2000, 3000, 4000, 5000];
    checkpoints.forEach((delayMs, idx) => {
      const timerId = window.setTimeout(() => {
        if (!playerReadyRef.current) return;
        if (document.visibilityState !== "visible") return;
        if (getServerNowMs() < gameState.startedAt) return;
        requestPlayerTime(`initial-${idx + 1}`);
        window.setTimeout(() => {
          syncToServerPosition(`initial-check-${idx + 1}`, false, 0.8, true);
        }, 120);
      }, delayMs);
      initialResyncTimersRef.current.push(timerId);
    });
  }, [
    getServerNowMs,
    gameState.startedAt,
    requestPlayerTime,
    syncToServerPosition,
  ]);

  useEffect(() => {
    return () => {
      if (resumeResyncTimerRef.current !== null) {
        window.clearTimeout(resumeResyncTimerRef.current);
      }
      resyncTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      initialResyncTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      stopSilentAudio();
    };
  }, [stopSilentAudio]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = getServerNowMs();
      setNowMs(now);
      if (
        resumeNeedsSyncRef.current &&
        playerReadyRef.current &&
        now >= gameState.startedAt
      ) {
        if (document.visibilityState !== "visible") {
          return;
        }
        resumeNeedsSyncRef.current = false;
        requestPlayerTime("interval-resume");
        return;
      }
      if (
        playerReadyRef.current &&
        now >= gameState.startedAt &&
        lastPlayerStateRef.current !== 1
      ) {
        startPlayback();
      }
      if (
        playerReadyRef.current &&
        hasStartedPlaybackRef.current &&
        now >= gameState.startedAt &&
        now - lastTimeRequestAtMsRef.current >= WATCHDOG_REQUEST_INTERVAL_MS
      ) {
        requestPlayerTime("watchdog");
      }
    }, 500);
    return () => clearInterval(interval);
  }, [
    getServerNowMs,
    gameState.startedAt,
    requestPlayerTime,
    startPlayback,
  ]);

  useEffect(() => {
    applyVolume(volume);
    localStorage.setItem("mq_volume", String(volume));
  }, [applyVolume, volume]);

  useEffect(() => {
    if (isEnded) {
      stopSilentAudio();
    }
  }, [isEnded, stopSilentAudio]);

  useEffect(() => {
    applyVolume(volume);
  }, [applyVolume, currentTrackIndex, gameState.startedAt, volume]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    if (typeof MediaMetadata === "undefined") return;
    try {
      const noop = () => { };
      const handleMediaSeek = () => {
        resumeNeedsSyncRef.current = true;
        requestPlayerTime("media-seek");
        window.setTimeout(() => {
          syncToServerPosition("media-seek");
          scheduleResumeResync();
        }, 120);
      };
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
          if (
            action === "seekbackward" ||
            action === "seekforward" ||
            action === "seekto"
          ) {
            navigator.mediaSession.setActionHandler(action, handleMediaSeek);
          } else {
            navigator.mediaSession.setActionHandler(action, noop);
          }
        } catch (err) {
          console.error("Failed to set media session action handler", err);
        }
      });
      updateMediaSession();
    } catch (err) {
      console.error("mediaSession setup failed", err);
    }
  }, [
    currentTrackIndex,
    isEnded,
    isReveal,
    requestPlayerTime,
    scheduleResumeResync,
    syncToServerPosition,
    updateMediaSession,
    waitingToStart,
  ]);

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
        setLoadedTrackKey(trackLoadKey);
        lastTrackLoadKeyRef.current = trackLoadKey;
        if (!waitingToStart) {
          startPlayback(startSec);
        }
      }

      if (data.event === "onStateChange") {
        lastPlayerStateRef.current =
          typeof data.info === "number" ? data.info : null;
        if (data.info === 1) {
          hasStartedPlaybackRef.current = true;
          lastSyncMsRef.current = getServerNowMs();
          setLoadedTrackKey(trackLoadKey);
          requestPlayerTime("state-playing");
          scheduleInitialResync();
          startSilentAudio();
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
        if (data.info === 0 && isReveal) {
          revealReplayRef.current = true;
          startPlayback(computeRevealPositionSec(), true);
        }
      }
      if (data.event === "infoDelivery") {
        const info = (data as { info?: { currentTime?: number } }).info;
        if (typeof info?.currentTime === "number") {
          lastPlayerTimeSecRef.current = info.currentTime;
          lastPlayerTimeAtMsRef.current = getServerNowMs();
          if (
            lastTimeRequestReasonRef.current === "watchdog" &&
            lastPlayerStateRef.current === 1 &&
            document.visibilityState === "visible"
          ) {
            syncToServerPosition(
              "watchdog",
              false,
              WATCHDOG_DRIFT_TOLERANCE_SEC,
            );
          }
          if (resumeNeedsSyncRef.current) {
            resumeNeedsSyncRef.current = false;
            if (document.visibilityState !== "visible") {
              return;
            }
            const didSeek = syncToServerPosition(
              "infoDelivery",
              false,
              RESUME_DRIFT_TOLERANCE_SEC,
              true,
            );
            if (didSeek) {
              scheduleResumeResync();
            }
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
    computeRevealPositionSec,
    getDesiredPositionSec,
    getServerNowMs,
    isReveal,
    loadTrack,
    postCommand,
    requestPlayerTime,
    scheduleInitialResync,
    startPlayback,
    startSilentAudio,
    syncToServerPosition,
    trackLoadKey,
    videoId,
    waitingToStart,
    markAudioUnlocked,
    scheduleResumeResync,
  ]);

  useEffect(() => {
    if (!videoId) return;
    if (!playerReadyRef.current) return;
    if (lastTrackLoadKeyRef.current === trackLoadKey) return;

    if (lastTrackSessionRef.current !== trackSessionKey) {
      lastTrackSessionRef.current = trackSessionKey;
      hasStartedPlaybackRef.current = false;
      playerStartRef.current = computeServerPositionSec();
    }

    revealReplayRef.current = false;
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

  useEffect(() => {
    if (!isReveal) {
      revealReplayRef.current = false;
      lastRevealStartKeyRef.current = null;
      return;
    }
    const revealKey = `${trackLoadKey}:reveal`;
    if (lastRevealStartKeyRef.current === revealKey) return;
    lastRevealStartKeyRef.current = revealKey;
    const serverAtEnd = computeServerPositionSec() >= clipEndSec - 0.05;
    const playerEnded = lastPlayerStateRef.current === 0;
    if (serverAtEnd || playerEnded) {
      revealReplayRef.current = true;
      startPlayback(computeRevealPositionSec(), true);
    }
  }, [
    clipEndSec,
    computeRevealPositionSec,
    computeServerPositionSec,
    isReveal,
    startPlayback,
    trackLoadKey,
  ]);

  useEffect(() => {
    if (waitingToStart) {
      hasStartedPlaybackRef.current = false;
      postCommand("pauseVideo");
      postCommand("seekTo", [clipStartSec, true]);
    }
  }, [clipStartSec, postCommand, waitingToStart]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        resumeNeedsSyncRef.current = true;
        resyncTimersRef.current.forEach((timerId) =>
          window.clearTimeout(timerId),
        );
        resyncTimersRef.current = [];
        return;
      }
      const serverNow = getServerNowMs();
      setNowMs(serverNow);
      if (!playerReadyRef.current) return;
      if (gameState.startedAt > serverNow) {
        resumeNeedsSyncRef.current = true;
        return;
      }
      resumeNeedsSyncRef.current = false;
      postCommand("playVideo");
      applyVolume(volume);
      startSilentAudio();
      requestPlayerTime("visibility");
      resumeNeedsSyncRef.current = true;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [
    computeServerPositionSec,
    getServerNowMs,
    applyVolume,
    postCommand,
    requestPlayerTime,
    scheduleResumeResync,
    gameState.startedAt,
    startSilentAudio,
    volume,
  ]);

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
    ? `https://www.youtube-nocookie.com/embed/${effectivePlayerVideoId}?autoplay=0&controls=1&enablejsapi=1&rel=0&playsinline=1`
    : null;
  const shouldShowVideo = true;

  const phaseLabel = isEnded
    ? "已結束"
    : gameState.phase === "guess"
      ? "猜歌中"
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

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  return (
    <div className="game-room-shell">
      <div className="game-room-grid grid w-full grid-cols-1 gap-3 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr] lg:h-[calc(100vh-140px)] lg:items-stretch">
        <aside className="game-room-panel game-room-panel--left flex h-full flex-col gap-3 p-3 text-slate-50 overflow-hidden">
          <div className="flex items-center gap-3">
            <div>
              <p className="game-room-kicker">排行榜</p>
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
                          label={`第${lockedOrder.indexOf(p.clientId) + 1}答`}
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
                          <span className="ml-1 text-amber-300">
                            x{p.combo}
                          </span>
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
                  <p className="game-room-kicker">正在播放</p>
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
                onClick={openExitConfirm}
              >
                退出遊戲
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
                    opacity: shouldHideVideoFrame ? 0 : shouldShowVideo ? 1 : 1,
                  }}
                  ref={iframeRef}
                  onLoad={() => {
                    if (!playerVideoId && videoId) {
                      setPlayerVideoId(videoId);
                    }
                    postPlayerMessage(
                      { event: "listening", id: PLAYER_ID },
                      "player event binding",
                    );
                    applyVolume(volume);
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                  暫時沒有可播放的影片來源
                </div>
              )}
              <audio
                ref={silentAudioRef}
                src={SILENT_AUDIO_SRC}
                loop
                preload="auto"
                playsInline
                className="hidden"
                aria-hidden="true"
              />
              {shouldShowGestureOverlay && (
                <div
                  className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
                  onPointerDown={unlockAudioAndStart}
                  role="button"
                  tabIndex={0}
                  aria-label="點擊後開始播放"
                >
                  <div className="mx-4 w-full max-w-sm rounded-2xl border border-emerald-300/40 bg-slate-900/85 px-6 py-6 text-center shadow-[0_20px_60px_rgba(2,6,23,0.6)]">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-300/60 bg-emerald-400/15 px-5 py-2 text-base font-semibold text-emerald-100"
                    >
                      點擊後開始播放
                    </button>
                    <p className="mt-3 text-xs text-slate-300">
                      手機瀏覽器需要先手勢觸發，音樂才能播放
                    </p>
                  </div>
                </div>
              )}
              {showGuessMask && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95">
                  <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-700 shadow-lg shadow-emerald-500/30" />
                  <p className="mt-2 text-xs text-slate-300">
                    猜歌中，影片已隱藏
                  </p>
                </div>
              )}
              {showPreStartMask && (
                <div className="pointer-events-none absolute inset-0 z-20 bg-slate-950/95" />
              )}
              {showLoadingMask && (
                <div className="pointer-events-none absolute inset-0 z-20 bg-slate-950" />
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
                      <p className="game-room-kicker">階段</p>
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
                      isInterTrackWait
                        ? undefined
                        : Math.min(100, Math.max(0, progressPct))
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
                                --
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
                          下一首將在 {Math.ceil(revealCountdownMs / 1000)}{" "}
                          秒後開始
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
                            onClick={openExitConfirm}
                          >
                            退出遊戲
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
        <Dialog open={exitConfirmOpen} onClose={closeExitConfirm}>
          <DialogTitle>退出遊戲？</DialogTitle>
          <DialogContent>
            <Typography variant="body2" className="text-slate-600">
              確定要放棄本局並返回房間列表嗎？
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeExitConfirm} variant="text">
              取消
            </Button>
            <Button onClick={handleExitConfirm} variant="contained" color="error">
              退出遊戲
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default GameRoomPage;
