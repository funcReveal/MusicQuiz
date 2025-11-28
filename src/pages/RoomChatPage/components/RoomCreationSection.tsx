import React from "react";
import type { PlaylistItem, RoomSummary } from "../types";

interface RoomCreationSectionProps {
  roomName: string;
  playlistUrl: string;
  playlistItems: PlaylistItem[];
  playlistLoading: boolean;
  playlistError: string | null;
  rooms: RoomSummary[];
  username: string | null;
  currentRoomId: string | null;
  onRoomNameChange: (value: string) => void;
  onPlaylistUrlChange: (value: string) => void;
  onFetchPlaylist: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
}

const RoomCreationSection: React.FC<RoomCreationSectionProps> = ({
  roomName,
  playlistUrl,
  playlistItems,
  playlistError,
  playlistLoading,
  rooms,
  username,
  currentRoomId,
  onRoomNameChange,
  onPlaylistUrlChange,
  onFetchPlaylist,
  onCreateRoom,
  onJoinRoom,
}) => {
  return (
    <>
      <section className="border border-slate-700 rounded-xl p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-sky-400 to-violet-400" />
            建立房間
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60 disabled:opacity-50"
              placeholder="房間名稱，如：Quiz Room #1"
              value={roomName}
              onChange={(e) => onRoomNameChange(e.target.value)}
              disabled={!username}
            />
            <button
              onClick={onCreateRoom}
              disabled={!username || !roomName}
              className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-sm shadow-emerald-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              建立房間
            </button>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
            {playlistItems.length === 0 ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-300 font-semibold mb-1">
                    插入 YouTube 播放清單
                  </p>
                  <input
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/60"
                    placeholder="貼上播放清單連結（例如 https://www.youtube.com/playlist?list=...）"
                    value={playlistUrl}
                    onChange={(e) => onPlaylistUrlChange(e.target.value)}
                    disabled={!username}
                  />
                </div>
                <button
                  onClick={onFetchPlaylist}
                  disabled={!username || !playlistUrl || playlistLoading}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm shadow-sky-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {playlistLoading ? "載入中..." : "取得清單"}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {}}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shadow-sm shadow-sky-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  返回
                </button>
              </>
            )}
            {playlistError && (
              <p className="text-xs text-red-300">{playlistError}</p>
            )}
            {playlistItems.length > 0 && (
              <div className="space-y-1 text-xs text-slate-300">
                <p className="font-semibold">
                  已取得 {playlistItems.length} 首歌曲
                </p>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900/60">
                  {playlistItems.map((item, idx) => (
                    <div
                      key={`${item.title}-${idx}`}
                      className="px-3 py-2 flex items-center justify-between gap-2"
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
                        預覽
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 divide-y divide-slate-800">
        {rooms.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">
            目前沒有房間，試著建立一個吧。
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
                  className="px-3 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
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
