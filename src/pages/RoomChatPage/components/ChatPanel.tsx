import React from "react";
import { ChatMessage, RoomParticipant, RoomSummary } from "../types";

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleTimeString();
};

interface ChatPanelProps {
  currentRoom: RoomSummary | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  username: string | null;
  messageInput: string;
  onLeave: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  currentRoom,
  participants,
  messages,
  username,
  messageInput,
  onLeave,
  onInputChange,
  onSend,
}) => {
  return (
    <section className=" flex flex-col w-full border border-slate-700 rounded-xl p-4 bg-slate-900/60 backdrop-blur-sm min-h-[320px]">
      <div className="flex items-center justify-between mb-3 ">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
          房間聊天
          {currentRoom ? (
            <span className="ml-2 text-xs text-slate-400">– {currentRoom.name}</span>
          ) : null}
        </h2>

        {currentRoom && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {participants.length} player
              {participants.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={onLeave}
              className="px-2.5 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-[11px] font-medium"
            >
              離開房間
            </button>
          </div>
        )}
      </div>

      <div className="mb-2 text-xs text-slate-300 flex items-start gap-1">
        <span className="font-semibold mt-[2px]">成員：</span>
        <div className="flex-1">
          {participants.length === 0 ? (
            <span className="text-slate-500">（目前沒有成員）</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {participants.map((p) => {
                const isSelf = p.username === username;
                return (
                  <span
                    key={p.socketId}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[11px] ${
                      isSelf
                        ? "bg-sky-500/15 border-sky-400/60 text-sky-200"
                        : "bg-slate-800/60 border-slate-600 text-slate-200"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {p.username}
                    {isSelf && <span className="opacity-80">（你）</span>}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950/70 p-3 mb-3 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <div className="text-xs text-slate-500 text-center">目前沒有訊息，送出第一則訊息吧。</div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.username === username;
            return (
              <div key={msg.id} className={`flex text-xs ${isSelf ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                    isSelf
                      ? "bg-sky-700 text-slate-50 rounded-br-sm"
                      : "bg-slate-700 text-slate-100 rounded-bl-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold text-[11px]">
                      {msg.username}
                      {isSelf && "（你）"}
                    </span>
                    <span className="text-[10px] opacity-70">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="text-[12px] leading-snug text-left">{msg.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/60"
          placeholder="輸入訊息後按 Enter 或按下 Send"
          value={messageInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          onClick={onSend}
          className="px-4 py-2 text-sm rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm shadow-sky-900/60"
        >
          Send
        </button>
      </div>
    </section>
  );
};

export default ChatPanel;
