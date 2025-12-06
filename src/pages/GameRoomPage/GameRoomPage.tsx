import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, LinearProgress, Switch } from "@mui/material";
import type {
  ChatMessage,
  GameState,
  PlaylistItem,
  RoomState,
} from "../RoomChatPage/types";

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
  username,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [playerStart, setPlayerStart] = useState(() =>
    Math.max(0, Math.floor((Date.now() - gameState.startedAt) / 1000))
  );
  const [showVideo, setShowVideo] = useState(gameState.showVideo ?? true);
  const [volume, setVolume] = useState(100);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [preheatVideoId, setPreheatVideoId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const effectiveTrackOrder = useMemo(() => {
    if (gameState.trackOrder?.length) {
      return gameState.trackOrder;
    }
    return playlist.map((_, idx) => idx);
  }, [gameState.trackOrder, playlist]);

  const trackCursor = Math.max(0, gameState.trackCursor ?? 0);
  const trackOrderLength = effectiveTrackOrder.length || playlist.length || 0;
  const boundedCursor = Math.min(trackCursor, Math.max(trackOrderLength - 1, 0));
  const currentTrackIndex =
    gameState.currentIndex ??
    effectiveTrackOrder[boundedCursor] ??
    effectiveTrackOrder[0] ??
    0;

  useEffect(() => {
    setPlayerStart(
      Math.max(0, Math.floor((Date.now() - gameState.startedAt) / 1000))
    );
    setSelectedChoice(null);
    const interval = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(interval);
  }, [gameState.startedAt, gameState.currentIndex, currentTrackIndex]);

  useEffect(() => {
    setShowVideo(gameState.showVideo ?? true);
  }, [gameState.showVideo]);

  useEffect(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage(
        JSON.stringify({
          event: "command",
          func: "setVolume",
          args: [volume],
        }),
        "*"
      );
    } catch (err) {
      console.error("setVolume failed", err);
    }
  }, [volume]);

  const item = useMemo(() => {
    return playlist[currentTrackIndex] ?? playlist[0];
  }, [playlist, currentTrackIndex]);

  const videoId = item ? extractYouTubeId(item.url) : null;
  const phaseEndsAt =
    gameState.phase === "guess"
      ? gameState.startedAt + gameState.guessDurationMs
      : gameState.revealEndsAt;
  const waitingToStart = gameState.startedAt > nowMs;
  const phaseRemainingMs = Math.max(0, phaseEndsAt - nowMs);
  const revealCountdownMs = Math.max(0, gameState.revealEndsAt - nowMs);
  const isEnded = gameState.status === "ended";
  const isReveal = gameState.phase === "reveal";
  const correctChoiceIndex = currentTrackIndex;
  const nextTrackIndex =
    effectiveTrackOrder[Math.min(boundedCursor + 1, Math.max(trackOrderLength - 1, 0))];
  const nextVideoId =
    nextTrackIndex !== undefined && nextTrackIndex !== null
      ? extractYouTubeId(playlist[nextTrackIndex]?.url ?? "")
      : null;

  const iframeSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&start=${
        waitingToStart ? 0 : playerStart
      }&enablejsapi=1&rel=0&playsinline=1&modestbranding=1&fs=0`
    : null;

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

  const sortedParticipants = participants.slice().sort((a, b) => b.score - a.score);
  const topFive = sortedParticipants.slice(0, 5);
  const self = sortedParticipants.find((p) => p.clientId === meClientId);
  const scoreboardList =
    self && !topFive.some((p) => p.clientId === self.clientId)
      ? [...topFive, self]
      : topFive;

  const recentMessages = messages.slice(-80);

  // 預熱下一首（在公布階段尾端先啟動下一首靜音播放，降低背景被擋的機率）
  useEffect(() => {
    if (isReveal && phaseRemainingMs < 2000 && nextVideoId && preheatVideoId !== nextVideoId) {
      setPreheatVideoId(nextVideoId);
    }
  }, [isReveal, phaseRemainingMs, nextVideoId, preheatVideoId]);

  // 切歌後清掉預熱狀態
  useEffect(() => {
    setPreheatVideoId(null);
  }, [gameState.startedAt, boundedCursor]);

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr] lg:max-h-[calc(100vh-140px)]">
      {/* 左側：分數榜 + 聊天 */}
      <aside className="flex h-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-slate-50 shadow-md overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
          <span className="text-sm font-semibold">分數榜</span>
          <span className="text-[11px] text-slate-400">(前五名 + 自己)</span>
        </div>
        <div className="space-y-2">
          {scoreboardList.length === 0 ? (
            <div className="text-xs text-slate-500">尚無玩家</div>
          ) : (
            scoreboardList.map((p, idx) => (
              <div
                key={p.clientId}
                className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                  p.clientId === meClientId
                    ? "border border-emerald-600/50 bg-emerald-900/40 text-emerald-100"
                    : "bg-slate-800/40 text-slate-200"
                }`}
              >
                <span className="truncate">
                  {idx + 1}. {p.clientId === meClientId ? `${p.username}（我）` : p.username}
                </span>
                <span className="font-semibold text-emerald-300">
                  {p.score}
                  {p.combo > 1 && <span className="ml-1 text-amber-300">x{p.combo}</span>}
                </span>
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
            <span className="text-xs text-slate-400">{messages.length} 則訊息</span>
          </div>
          <div className="h-px bg-slate-800/70" />
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {recentMessages.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">目前沒有訊息</div>
            ) : (
              recentMessages.map((msg) => {
                const isSelf = msg.username === username;
                return (
                  <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-xs shadow ${
                        isSelf
                          ? "bg-sky-900/60 border border-sky-700/50 text-slate-50"
                          : "bg-slate-800/60 border border-slate-700 text-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                        <span className="font-semibold">
                          {msg.username}
                          {isSelf && "（我）"}
                        </span>
                        <span className="text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
            <Button variant="outlined" color="inherit" size="small" onClick={onBack}>
              返回聊天室
            </Button>
          </div>

          <div className="relative w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-inner h-[220px] sm:h-[280px] md:h-[320px] xl:h-[340px]">
            {iframeSrc ? (
              <iframe
                key={`${currentTrackIndex}-${gameState.startedAt}`}
                src={iframeSrc}
                className={`h-full w-full object-contain transition-opacity duration-300 ${
                  gameState.phase === "guess" || !showVideo ? "opacity-0" : "opacity-100"
                }`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Now playing"
                style={{ pointerEvents: "none" }}
                ref={iframeRef}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                暫時沒有可播放的影片來源
              </div>
            )}
            {preheatVideoId && (
              <iframe
                className="hidden"
                src={`https://www.youtube.com/embed/${preheatVideoId}?autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1&rel=0&modestbranding=1&fs=0`}
                allow="autoplay; encrypted-media"
                title="preheat-next-track"
              />
            )}
            {gameState.phase === "guess" && !isEnded && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-700 shadow-lg shadow-emerald-500/30" />
                <p className="mt-2 text-xs text-slate-300">
                  {waitingToStart
                    ? `遊戲即將開始 · ${Math.ceil((gameState.startedAt - nowMs) / 1000)}s`
                    : `${phaseLabel}中`}
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                color="info"
                checked={showVideo}
                onChange={(e) => setShowVideo(e.target.checked)}
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
                  className={`justify-start ${
                    isReveal
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
                    setSelectedChoice(choice.index);
                    onSubmitChoice(choice.index);
                  }}
                >
                  {choice.title}
                </Button>
              );
            })}
          </div>

          <div className="mt-3 min-h-[120px]">
            {isReveal ? (
              <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3">
                <p className="text-sm font-semibold text-emerald-100">正確答案</p>
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
                    <Button size="small" variant="outlined" color="inherit" onClick={onBack}>
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
