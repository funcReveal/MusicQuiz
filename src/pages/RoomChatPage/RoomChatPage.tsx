import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

import ChatPanel from "./components/ChatPanel";
import HeaderSection from "./components/HeaderSection";
import RoomCreationSection from "./components/RoomCreationSection";
import UsernameStep from "./components/UsernameStep";
import type {
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
  const [playlistStage, setPlaylistStage] = useState<"input" | "preview">(
    "input"
  );
  const [playlistLocked, setPlaylistLocked] = useState(false);
  const [lastFetchedPlaylistId, setLastFetchedPlaylistId] = useState<
    string | null
  >(null);

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
      s.emit("listRooms", (ack: Ack<RoomSummary[]>) => {
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

    s.emit(
      "createRoom",
      { roomName: trimmed, username },
      (ack: Ack<RoomState>) => {
        if (!ack) return;
        if (ack.ok) {
          const state = ack.data;
          setCurrentRoom(state.room);
          setParticipants(state.participants);
          setMessages(state.messages);
          currentRoomIdRef.current = state.room.id;
          setRoomNameInput("");
          setStatusText(`成功建立房間：${state.room.name}`);
        } else {
          setStatusText(`建立房間失敗：${ack.error}`);
        }
      }
    );
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
        setStatusText(`已加入房間：${state.room.name}`);
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

    s.emit(
      "sendMessage",
      { roomId: currentRoom.id, content: trimmed },
      (ack) => {
        if (!ack) return;
        if (!ack.ok) {
          setStatusText(`訊息傳送失敗：${ack.error}`);
        }
      }
    );

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

  const formatDuration = (iso8601: string | undefined) => {
    if (!iso8601) return undefined;
    const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    const displayHours = Math.floor(totalSeconds / 3600);
    const displayMinutes = Math.floor((totalSeconds % 3600) / 60);
    const displaySeconds = totalSeconds % 60;

    if (displayHours > 0) {
      return `${displayHours}:${displayMinutes
        .toString()
        .padStart(2, "0")}:${displaySeconds.toString().padStart(2, "0")}`;
    }

    return `${displayMinutes}:${displaySeconds.toString().padStart(2, "0")}`;
  };

  const handleFetchPlaylist = async () => {
    setPlaylistError(null);
    if (playlistLocked && lastFetchedPlaylistId) {
      setPlaylistError("歌單已鎖定，如要重選請先返回歌單挑選");
      return;
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      setPlaylistError("請輸入有效的播放清單網址");
      return;
    }

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
    if (!apiKey) {
      setPlaylistError("尚未設置 YouTube API 金鑰 (VITE_YOUTUBE_API_KEY)");
      return;
    }

    setPlaylistLoading(true);
    try {
      const items: PlaylistItem[] = [];
      let nextPageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          part: "snippet,contentDetails",
          maxResults: "50",
          playlistId,
          key: apiKey,
        });

        if (nextPageToken) {
          params.set("pageToken", nextPageToken);
        }

        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`
        );
        if (!res.ok) {
          throw new Error("取得播放清單失敗，請稍後再試");
        }

        const data = await res.json();
        const playlistVideos = (data.items ?? []) as Array<{
          snippet?: {
            title?: string;
            channelTitle?: string;
            videoOwnerChannelTitle?: string;
            resourceId?: { videoId?: string };
          };
          contentDetails?: { videoId?: string };
        }>;

        const videoIds = playlistVideos
          .map(
            (item) =>
              item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
          )
          .filter((id): id is string => Boolean(id));

        const durationMap = new Map<string, string | undefined>();
        if (videoIds.length > 0) {
          const videoParams = new URLSearchParams({
            part: "contentDetails",
            id: videoIds.join(","),
            key: apiKey,
          });

          const videoRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`
          );
          if (videoRes.ok) {
            const videoData = await videoRes.json();
            (
              videoData.items as
                | Array<{ id?: string; contentDetails?: { duration?: string } }>
                | undefined
            )?.forEach((video) => {
              if (video.id) {
                durationMap.set(
                  video.id,
                  formatDuration(video.contentDetails?.duration)
                );
              }
            });
          }
        }

        items.push(
          ...playlistVideos.map((item) => {
            const videoId =
              item.contentDetails?.videoId ??
              item.snippet?.resourceId?.videoId ??
              "";
            return {
              title: item.snippet?.title ?? "未命名影片",
              url: videoId
                ? `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`
                : "",
              uploader:
                item.snippet?.videoOwnerChannelTitle ??
                item.snippet?.channelTitle ??
                "",
              duration: videoId ? durationMap.get(videoId) : undefined,
            } satisfies PlaylistItem;
          })
        );

        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      setPlaylistItems(items);
      setPlaylistStage("preview");
      setPlaylistLocked(true);
      setLastFetchedPlaylistId(playlistId);
      setStatusText(`已載入播放清單，共 ${items.length} 首歌曲`);
    } catch (error) {
      console.error(error);
      setPlaylistError("取得播放清單時發生錯誤，請確認網址後再試");
      setPlaylistItems([]);
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handleResetPlaylist = () => {
    setPlaylistUrl("");
    setPlaylistItems([]);
    setPlaylistError(null);
    setPlaylistStage("input");
    setPlaylistLocked(false);
    setLastFetchedPlaylistId(null);
    setStatusText("已返回歌單挑選，可重新貼上新清單");
  };

  return (
    <div className="flex flex-col w-95/100 space-y-4">
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
            playlistStage={playlistStage}
            playlistLocked={playlistLocked}
            rooms={rooms}
            username={username}
            currentRoomId={currentRoomIdRef.current}
            onRoomNameChange={setRoomNameInput}
            onPlaylistUrlChange={setPlaylistUrl}
            onFetchPlaylist={handleFetchPlaylist}
            onResetPlaylist={handleResetPlaylist}
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
