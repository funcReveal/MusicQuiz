import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRoom } from "../model/useRoom";

const RoomListPage: React.FC = () => {
  const navigate = useNavigate();
  const [sortMode, setSortMode] = useState<"latest" | "popular">("latest");
  const [filterMode, setFilterMode] = useState<"all" | "open" | "locked">(
    "all"
  );
  const [statusMode, setStatusMode] = useState<"online" | "quiet">("online");
  const {
    username,
    rooms,
    currentRoom,
    currentRoomId,
    joinPasswordInput,
    setJoinPasswordInput,
    handleJoinRoom,
  } = useRoom();

  useEffect(() => {
    if (currentRoom?.id) {
      navigate(`/rooms/${currentRoom.id}`, { replace: true });
    }
  }, [currentRoom?.id, navigate]);

  const sortLabel = useMemo(
    () => (sortMode === "latest" ? "最新建立" : "最熱房間"),
    [sortMode]
  );
  const filterLabel = useMemo(() => {
    if (filterMode === "open") return "公開房間";
    if (filterMode === "locked") return "私密房間";
    return "全部房間";
  }, [filterMode]);
  const statusLabel = useMemo(
    () => (statusMode === "online" ? "目前在線" : "安靜時段"),
    [statusMode]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-6 pt-4 text-[var(--mc-text)]">
      {!currentRoom?.id && username && (
        <section className="w-full">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
                Music Quiz
              </div>
              <h2 className="text-xl font-semibold text-[var(--mc-text)]">
                房間列表
              </h2>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-accent)]/60 bg-[var(--mc-accent)]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-text)] transition hover:border-[var(--mc-accent)] hover:bg-[var(--mc-accent)]/30"
              onClick={() => navigate("/rooms/create", { replace: true })}
            >
              <span className="text-base leading-none">＋</span>
              建立新房間
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--mc-text-muted)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.7)]">
              控制台
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-4 py-2 text-xs text-[var(--mc-text)] transition hover:border-slate-700 hover:bg-[var(--mc-surface-strong)]/90"
                onClick={() =>
                  setSortMode((prev) =>
                    prev === "latest" ? "popular" : "latest"
                  )
                }
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--mc-text-muted)]">
                  排序
                </span>
                <span className="ml-2 font-semibold text-[var(--mc-text)]">
                  {sortLabel}
                </span>
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-4 py-2 text-xs text-[var(--mc-text)] transition hover:border-slate-700 hover:bg-[var(--mc-surface-strong)]/90"
                onClick={() =>
                  setFilterMode((prev) => {
                    if (prev === "all") return "open";
                    if (prev === "open") return "locked";
                    return "all";
                  })
                }
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--mc-text-muted)]">
                  篩選
                </span>
                <span className="ml-2 font-semibold text-[var(--mc-text)]">
                  {filterLabel}
                </span>
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--mc-accent-2)]/40 bg-[var(--mc-accent-2)]/10 px-4 py-2 text-xs text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-500/20"
                onClick={() =>
                  setStatusMode((prev) =>
                    prev === "online" ? "quiet" : "online"
                  )
                }
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">
                  狀態
                </span>
                <span className="ml-2 font-semibold">{statusLabel}</span>
              </button>
            </div>
          </div>

          <div className="relative rounded-3xl border border-[var(--mc-border)] bg-gradient-to-br from-[var(--mc-bg)] via-[var(--mc-bg)] to-[var(--mc-surface)] p-1 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.9)]">
            <div className="absolute inset-0 rounded-3xl border border-white/5" />
            <div className="relative space-y-3 rounded-[22px] bg-[var(--mc-surface)]/70 p-4">
              {rooms.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center text-[var(--mc-text-muted)]">
                  <div className="flex items-end gap-1">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <span
                        key={index}
                        className="h-6 w-1.5 rounded-full bg-[var(--mc-surface-strong)]/70"
                        style={{
                          animationDelay: `${index * 120}ms`,
                          animation: "room-eq 1.6s ease-in-out infinite",
                        }}
                      />
                    ))}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[var(--mc-text)]">
                      目前沒有房間
                    </div>
                    <div className="text-sm text-[var(--mc-text-muted)]">
                      建立一個新的房間，或稍後再回來看看。
                    </div>
                  </div>
                </div>
              ) : (
                rooms.map((room, index) => {
                  const isCurrent = currentRoomId === room.id;
                  const isFull = Boolean(
                    room.maxPlayers && room.playerCount >= room.maxPlayers,
                  );
                  return (
                    <div
                      key={room.id}
                      className={`group relative overflow-hidden rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-[var(--mc-surface-strong)]/80 ${
                        isCurrent ? "ring-1 ring-sky-400/60" : ""
                      }`}
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <div className="absolute -left-16 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-[var(--mc-accent)]/10 blur-2xl" />
                        <div className="absolute -right-16 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-[var(--mc-accent-2)]/10 blur-2xl" />
                      </div>

                      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-[var(--mc-text)]">
                              {room.name}
                            </h3>
                            {room.hasPassword && (
                              <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                                私密
                              </span>
                            )}
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                              題數 {room.gameSettings?.questionCount ?? "-"}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full border border-sky-400/60 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                                目前房間
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--mc-text-muted)]">
                            <span>
                              玩家 {room.playerCount}
                              {room.maxPlayers ? `/${room.maxPlayers}` : ""}
                            </span>
                            <span>播放清單 {room.playlistCount}</span>
                            <span>
                              建立 {new Date(room.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isFull && (
                            <span className="rounded-full border border-rose-400/40 bg-rose-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200">
                              已滿
                            </span>
                          )}
                          {room.hasPassword && (
                            <input
                              className="w-28 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-2 py-1 text-xs text-[var(--mc-text)] placeholder:text-slate-500 focus:border-[var(--mc-accent)] focus:outline-none"
                              placeholder="輸入密碼"
                              value={joinPasswordInput}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!/^[a-zA-Z0-9]*$/.test(value)) return;
                                setJoinPasswordInput(value);
                              }}
                              inputMode="text"
                              pattern="[A-Za-z0-9]*"
                            />
                          )}
                          <button
                            onClick={() =>
                              handleJoinRoom(room.id, room.hasPassword)
                            }
                            disabled={!username || isFull}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-accent)]/60 bg-[var(--mc-accent)]/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-text)] transition hover:border-[var(--mc-accent)] hover:bg-[var(--mc-accent)]/40 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            進入
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <style>
            {`
              @keyframes room-eq {
                0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
                50% { transform: scaleY(1); opacity: 0.9; }
              }
            `}
          </style>
        </section>
      )}
    </div>
  );
};

export default RoomListPage;
