import React from "react";
import type { PlaylistItem, RoomSummary } from "../types";

interface RoomCreationSectionProps {
  roomName: string;
  playlistUrl: string;
  playlistItems: PlaylistItem[];
  playlistLoading: boolean;
  playlistError: string | null;
  playlistStage: "input" | "preview";
  playlistLocked: boolean;
  rooms: RoomSummary[];
  username: string | null;
  currentRoomId: string | null;
  onRoomNameChange: (value: string) => void;
  onPlaylistUrlChange: (value: string) => void;
  onFetchPlaylist: () => void;
  onResetPlaylist: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
}

const RoomCreationSection: React.FC<RoomCreationSectionProps> = ({
  roomName,
  playlistUrl,
  playlistItems,
  playlistError,
  playlistLoading,
  playlistStage,
  playlistLocked,
  rooms,
  username,
  currentRoomId,
  onRoomNameChange,
  onPlaylistUrlChange,
  onFetchPlaylist,
  onResetPlaylist,
  onCreateRoom,
  onJoinRoom,
}) => {
  const canCreateRoom = Boolean(username && roomName.trim());
  const showPlaylistInput = playlistStage === "input";

  return (
    <>
      <section className="border border-slate-700 rounded-xl p-4 bg-slate-900/60 backdrop-blur-sm shadow-lg shadow-slate-900/30 transition-[transform,shadow] duration-300">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-sky-400 to-violet-400" />
            建立房間
          </h2>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                showPlaylistInput
                  ? "border-slate-600 bg-slate-800/60"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {showPlaylistInput ? "待貼歌單" : "歌單已鎖定"}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                showPlaylistInput
                  ? "border-sky-400 text-sky-200"
                  : "border-slate-600 text-slate-400"
              }`}
            >
              1
            </span>
            <span className={showPlaylistInput ? "text-slate-200" : ""}>
              貼上歌單
            </span>
            <span className="h-px w-8 bg-slate-700" />
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                !showPlaylistInput
                  ? "border-emerald-400 text-emerald-200"
                  : "border-slate-600 text-slate-400"
              }`}
            >
              2
            </span>
            <span className={!showPlaylistInput ? "text-slate-200" : ""}>
              預覽並鎖定
            </span>
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60 disabled:opacity-50 transition-all"
              placeholder="房間名稱，例如：Quiz Room #1"
              value={roomName}
              onChange={(e) => onRoomNameChange(e.target.value)}
              disabled={!username}
            />
            <button
              onClick={onCreateRoom}
              disabled={!canCreateRoom}
              className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-sm shadow-emerald-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-[0.98]"
            >
              建立房間
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2 transition-[transform,shadow] duration-300 hover:shadow-slate-900/40">
          {showPlaylistInput ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-slate-300 font-semibold mb-1">
                  貼上 YouTube 播放清單
                </p>
                <input
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/60 transition-all"
                  placeholder="貼上播放清單連結，例如：https://www.youtube.com/playlist?list=..."
                  value={playlistUrl}
                  onChange={(e) => onPlaylistUrlChange(e.target.value)}
                  disabled={!username || playlistLoading || playlistLocked}
                />
              </div>
              <button
                onClick={onFetchPlaylist}
                disabled={
                  !username || !playlistUrl || playlistLoading || playlistLocked
                }
                className="cursor-pointer whitespace-nowrap px-3 py-2 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm shadow-sky-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-[0.98]"
              >
                {playlistLoading ? "載入中..." : "取得清單"}
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs text-slate-200 font-semibold">
                  歌單已鎖定
                </p>
                <p className="text-[11px] text-slate-400">
                  若要換清單，請點「返回歌單挑選」先解鎖再重新貼上。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onResetPlaylist}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium border border-slate-600 transition-[transform,background-color] active:scale-[0.98]"
                >
                  返回歌單挑選
                </button>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-200 text-xs font-semibold animate-pulse">
                  Lock
                </div>
              </div>
            </div>
          )}
          {playlistError && (
            <p className="text-xs text-red-300">{playlistError}</p>
          )}
          {playlistItems.length > 0 && (
            <div className="space-y-1 text-xs text-slate-300">
              <p className="font-semibold">
                已載入 {playlistItems.length} 首歌曲
              </p>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900/60">
                {playlistItems.map((item, idx) => (
                  <div
                    key={`${item.title}-${idx}`}
                    className="px-3 py-2 flex items-center justify-between gap-2 transition-all duration-300 hover:bg-slate-800/70"
                    style={{ transitionDelay: `${idx * 12}ms` }}
                  >
                    <div className="text-left">
                      <p className="text-slate-100">{item.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.uploader ?? "Unknown"}
                        {item.duration ? ` · ${item.duration}` : ""}
                      </p>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 text-[11px] hover:underline"
                    >
                      瀏覽
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 divide-y divide-slate-800 shadow-inner shadow-slate-900/60">
        {rooms.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">
            目前沒有房間，試著建立一個吧！
          </div>
        ) : (
          rooms.map((room) => {
            const isCurrent = currentRoomId === room.id;
            return (
              <div
                key={room.id}
                className={`px-3 py-2.5 flex items-center justify-between text-sm transition-colors ${
                  isCurrent
                    ? "bg-slate-900/90 border-l-2 border-l-sky-400"
                    : "hover:bg-slate-900/70"
                }`}
              >
                <div>
                  <div className="font-medium text-slate-100 flex items-center gap-2">
                    {room.name}
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Players: {room.playerCount} ·{" "}
                    {new Date(room.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={() => onJoinRoom(room.id)}
                  disabled={!username}
                  className="px-3 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-[0.98]"
                >
                  加入
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default RoomCreationSection;
