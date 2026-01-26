import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useRoom } from "../../features/Room/useRoom";

const RoomListPage: React.FC = () => {
  const navigate = useNavigate();
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


  return (
    <div className="flex gap-4 flex-row justify-center">
      {!currentRoom?.id && username && (
        <div className="w-full md:w-full lg:w-3/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg text-slate-100 font-semibold">房間列表</h2>
            <button
              className="cursor-pointer px-3 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-[transform,background-color] active:scale-[0.98]"
              onClick={() => navigate("/rooms/create", { replace: true })}
            >
              建立房間
            </button>
          </div>
          <div className="w-full max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 divide-y divide-slate-800 shadow-inner shadow-slate-900/60">
            {rooms.length === 0 ? (
              <div className="flex items-center justify-center min-h-40 text-xl text-slate-300">
                目前沒有房間，試著建立一個吧！
              </div>
            ) : (
              rooms.map((room) => {
                const isCurrent = currentRoomId === room.id;
                return (
                  <div
                    key={room.id}
                    className={`px-3 py-2.5 flex items-center justify-between text-sm transition-colors duration-300 ${
                      isCurrent
                        ? "bg-slate-900/90 border-l-2 border-l-sky-400"
                        : "hover:bg-slate-900/70"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-slate-100 flex items-center gap-2">
                        {room.name}
                        {room.hasPassword && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600">
                            密碼
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/40">
                          題數 {room.gameSettings?.questionCount ?? "-"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Players: {room.playerCount} ・ 清單 {room.playlistCount}{" "}
                        首 ・ {new Date(room.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {room.hasPassword && (
                          <input
                            className="w-28 px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                            placeholder="房間密碼"
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
                        disabled={!username}
                        className="cursor-pointer px-3 py-1.5 text-xs rounded-lg bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-[0.98]"
                      >
                        加入
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomListPage;
