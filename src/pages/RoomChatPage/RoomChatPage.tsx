import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

import ChatPanel from "./components/ChatPanel";
import HeaderSection from "./components/HeaderSection";
import RoomCreationSection from "./components/RoomCreationSection";
import UsernameStep from "./components/UsernameStep";
import {
  Ack,
  ChatMessage,
  ClientSocket,
  PlaylistItem,
  RoomParticipant,
  RoomState,
  RoomSummary,
} from "./types";

const SERVER_URL = "http://217.142.240.18:3000";

const RoomChatPage: React.FC = () => {
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<RoomSummary | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  const socketRef = useRef<ClientSocket | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  const displayUsername = useMemo(() => username ?? "(not set)", [username]);

  const handleSetUsername = () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setStatusText("請先輸入使用者名稱");
      return;
    }
    setUsername(trimmed);
    setStatusText(null);
  };

  useEffect(() => {
    currentRoomIdRef.current = currentRoom?.id ?? null;
  }, [currentRoom]);

  useEffect(() => {
    if (!username) return;

    const s = io(SERVER_URL, {
      transports: ["websocket"],
    });

    socketRef.current = s;

    s.on("connect", () => {
      setIsConnected(true);
      setStatusText("Connected to server");
      s.emit("listRooms", (ack) => {
        if (ack && ack.ok) {
          setRooms(ack.data);
        }
      });
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      setStatusText("Disconnected from server");
      setCurrentRoom(null);
      setParticipants([]);
      setMessages([]);
      currentRoomIdRef.current = null;
    });

    s.on("roomsUpdated", (updatedRooms) => setRooms(updatedRooms));

    s.on("joinedRoom", (state) => {
      setCurrentRoom(state.room);
      setParticipants(state.participants);
      setMessages(state.messages);
      currentRoomIdRef.current = state.room.id;
      setStatusText(`Joined room: ${state.room.name}`);
    });

    s.on("userJoined", ({ roomId, participant }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === participant.socketId);
        if (exists) return prev;
        return [...prev, participant];
      });
    });

    s.on("userLeft", ({ roomId, socketId }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    s.on("messageAdded", ({ roomId, message }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      currentRoomIdRef.current = null;
    };
  }, [username]);

  const getSocket = () => socketRef.current;

  const handleCreateRoom = () => {
    const s = getSocket();
    if (!s || !username) {
      setStatusText("尚未連線或尚未設定使用者名稱");
      return;
    }
    const trimmed = roomNameInput.trim();
    if (!trimmed) {
      setStatusText("請輸入房間名稱");
      return;
    }

    s.emit("createRoom", { roomName: trimmed, username }, (ack: Ack<RoomState>) => {
      if (!ack) return;
      if (ack.ok) {
        const state = ack.data;
        setCurrentRoom(state.room);
        setParticipants(state.participants);
        setMessages(state.messages);
        currentRoomIdRef.current = state.room.id;
        setRoomNameInput("");
        setStatusText(`房間建立成功：${state.room.name}`);
      } else {
        setStatusText(`建立房間失敗：${ack.error}`);
      }
    });
  };

  const handleJoinRoom = (roomId: string) => {
    const s = getSocket();
    if (!s || !username) {
      setStatusText("尚未連線或尚未設定使用者名稱");
      return;
    }

    s.emit("joinRoom", { roomId, username }, (ack: Ack<RoomState>) => {
      if (!ack) return;
      if (ack.ok) {
        const state = ack.data;
        setCurrentRoom(state.room);
        setParticipants(state.participants);
        setMessages(state.messages);
        currentRoomIdRef.current = state.room.id;
        setStatusText(`加入房間：${state.room.name}`);
      } else {
        setStatusText(`加入房間失敗：${ack.error}`);
      }
    });
  };

  const handleLeaveRoom = () => {
    const s = getSocket();
    if (!s || !currentRoom) return;

    s.emit("leaveRoom", { roomId: currentRoom.id }, (ack: Ack<null>) => {
      if (!ack) return;
      if (ack.ok) {
        setCurrentRoom(null);
        setParticipants([]);
        setMessages([]);
        currentRoomIdRef.current = null;
        setStatusText("已離開房間");
      } else {
        setStatusText(`離開房間失敗：${ack.error}`);
      }
    });
  };

  const handleSendMessage = () => {
    const s = getSocket();
    if (!s || !currentRoom) {
      setStatusText("尚未加入任何房間");
      return;
    }
    const trimmed = messageInput.trim();
    if (!trimmed) return;

    s.emit("sendMessage", { roomId: currentRoom.id, content: trimmed }, (ack) => {
      if (!ack) return;
      if (!ack.ok) {
        setStatusText(`訊息發送失敗：${ack.error}`);
      }
    });

    setMessageInput("");
  };

  const extractPlaylistId = (url: string) => {
    try {
      const parsed = new URL(url.trim());
      const listId = parsed.searchParams.get("list");
      if (listId) return listId;
      const segments = parsed.pathname.split("/");
      const last = segments[segments.length - 1];
      return last || null;
    } catch (error) {
      console.error("Invalid playlist url", error);
      return null;
    }
  };

  const handleFetchPlaylist = async () => {
    setPlaylistError(null);
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      setPlaylistError("請輸入有效的播放清單網址");
      return;
    }

    setPlaylistLoading(true);
    try {
      const res = await fetch(`https://piped.video/api/v1/playlists/${playlistId}`);
      if (!res.ok) {
        throw new Error("無法取得播放清單，請稍後再試");
      }
      const data = await res.json();
      type PipedPlaylistStream = {
        title: string;
        url?: string;
        id?: string;
        uploaderName?: string;
        uploader?: string;
        duration?: string;
      };

      const items: PlaylistItem[] = (data.relatedStreams as PipedPlaylistStream[] | undefined)?.map((item) => ({
        title: item.title,
        url: `https://www.youtube.com/watch?v=${item.url ?? item.id ?? ""}&list=${playlistId}`,
        uploader: item.uploaderName ?? item.uploader ?? "",
        duration: item.duration ?? undefined,
      })) ?? [];
      setPlaylistItems(items);
      setStatusText(`已載入播放清單，共 ${items.length} 首歌曲`);
    } catch (error) {
      console.error(error);
      setPlaylistError("解析播放清單時發生錯誤，請確認連結後重試");
      setPlaylistItems([]);
    } finally {
      setPlaylistLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <HeaderSection
        serverUrl={SERVER_URL}
        isConnected={isConnected}
        displayUsername={displayUsername}
      />

      {!username && (
        <UsernameStep
          usernameInput={usernameInput}
          onInputChange={setUsernameInput}
          onConfirm={handleSetUsername}
        />
      )}

      <div className="flex gap-4">
        {!currentRoom?.id && username && (
          <RoomCreationSection
            roomName={roomNameInput}
            playlistUrl={playlistUrl}
            playlistItems={playlistItems}
            playlistError={playlistError}
            playlistLoading={playlistLoading}
            rooms={rooms}
            username={username}
            currentRoomId={currentRoomIdRef.current}
            onRoomNameChange={setRoomNameInput}
            onPlaylistUrlChange={setPlaylistUrl}
            onFetchPlaylist={handleFetchPlaylist}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {currentRoom?.id && (
          <ChatPanel
            currentRoom={currentRoom}
            participants={participants}
            messages={messages}
            username={username}
            messageInput={messageInput}
            onLeave={handleLeaveRoom}
            onInputChange={setMessageInput}
            onSend={handleSendMessage}
          />
        )}
      </div>

      {statusText && (
        <div className="text-xs text-slate-400 mt-1">Status: {statusText}</div>
      )}
    </div>
  );
};

export default RoomChatPage;
