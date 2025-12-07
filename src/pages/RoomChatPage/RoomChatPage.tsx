import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button, Snackbar } from "@mui/material";

const SERVER_URL = import.meta.env.VITE_SOCKET_URL;
const DEFAULT_PAGE_SIZE = 50;
const CHUNK_SIZE = 200;
const STORAGE_KEYS = {
  clientId: "mq_clientId",
  username: "mq_username",
  roomId: "mq_roomId",
};

const RoomChatPage: React.FC = () => {
  const [usernameInput, setUsernameInput] = useState(
    () => localStorage.getItem(STORAGE_KEYS.username) ?? ""
  );
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.username) ?? null
  );
  const [clientId] = useState<string>(() => {
    const existing = localStorage.getItem(STORAGE_KEYS.clientId);
    if (existing) return existing;
    const generated =
      crypto.randomUUID?.() ??
      `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEYS.clientId, generated);
    return generated;
  });
  const [isConnected, setIsConnected] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<RoomState["room"] | null>(
    null
  );
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
  >(() => null);
  const [playlistViewItems, setPlaylistViewItems] = useState<PlaylistItem[]>(
    []
  );
  const [playlistHasMore, setPlaylistHasMore] = useState(false);
  const [playlistLoadingMore, setPlaylistLoadingMore] = useState(false);
  const [playlistPageCursor, setPlaylistPageCursor] = useState(1);
  const [playlistPageSize, setPlaylistPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [playlistProgress, setPlaylistProgress] = useState<{
    received: number;
    total: number;
    ready: boolean;
  }>({ received: 0, total: 0, ready: false });
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [inviteRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("roomId");
  });
  const isInviteMode = Boolean(inviteRoomId);
  const [inviteNotFound, setInviteNotFound] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "create">("list");

  const socketRef = useRef<ClientSocket | null>(null);
  const currentRoomIdRef = useRef<string | null>(
    localStorage.getItem(STORAGE_KEYS.roomId)
  );

  const displayUsername = useMemo(() => username ?? "(未設定)", [username]);

  const persistUsername = (name: string) => {
    setUsername(name);
    localStorage.setItem(STORAGE_KEYS.username, name);
  };

  const persistRoomId = (id: string | null) => {
    currentRoomIdRef.current = id;
    if (id) {
      localStorage.setItem(STORAGE_KEYS.roomId, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.roomId);
    }
  };

  const handleSetUsername = () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setStatusText("請先輸入使用者名稱");
      return;
    }
    persistUsername(trimmed);
    setStatusText(null);
  };

  const getSocket = () => socketRef.current;

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

  const fetchPlaylistPage = (
    roomId: string,
    page: number,
    pageSize?: number,
    opts?: { reset?: boolean }
  ) => {
    const s = getSocket();
    if (!s) {
      if (opts?.reset) {
        setPlaylistViewItems([]);
        setPlaylistHasMore(false);
      }
      return;
    }
    if (opts?.reset) {
      setPlaylistViewItems([]);
      setPlaylistHasMore(false);
      setPlaylistPageCursor(1);
      setPlaylistLoadingMore(true);
    } else {
      setPlaylistLoadingMore(true);
    }
    s.emit(
      "getPlaylistPage",
      { roomId, page, pageSize },
      (
        ack: Ack<{
          items: PlaylistItem[];
          totalCount: number;
          page: number;
          pageSize: number;
          ready: boolean;
        }>
      ) => {
        if (ack?.ok) {
          setPlaylistViewItems((prev) => {
            const next = opts?.reset
              ? ack.data.items
              : [...prev, ...ack.data.items];
            const total = ack.data.totalCount;
            setPlaylistHasMore(next.length < total);
            return next;
          });
          setPlaylistPageCursor(ack.data.page);
          setPlaylistPageSize(ack.data.pageSize);
          setPlaylistProgress((prev) => ({
            ...prev,
            total: ack.data.totalCount,
            ready: ack.data.ready,
          }));
        }
        setPlaylistLoadingMore(false);
      }
    );
  };

  useEffect(() => {
    if (!username) return;

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      auth: { clientId },
    });

    socketRef.current = s;

    s.on("connect", () => {
      setIsConnected(true);
      setStatusText("已連線伺服器");
      s.emit("listRooms", (ack: Ack<RoomSummary[]>) => {
        if (ack && ack.ok) {
          setRooms(ack.data);
          if (isInviteMode) {
            const found = inviteRoomId
              ? ack.data.some((r) => r.id === inviteRoomId)
              : false;
            setInviteNotFound(!found);
            if (!found && inviteRoomId) {
              setStatusText("受邀房間不存在或已關閉");
            }
          }
        }
      });

      const storedRoomId = currentRoomIdRef.current;
      if (storedRoomId) {
        s.emit(
          "resumeSession",
          { roomId: storedRoomId, username },
          (ack: Ack<RoomState>) => {
            if (ack?.ok) {
              const state = ack.data;
              setCurrentRoom(state.room);
              setParticipants(state.participants);
              setMessages(state.messages);
              setPlaylistProgress({
                received: state.room.playlist.receivedCount,
                total: state.room.playlist.totalCount,
                ready: state.room.playlist.ready,
              });
              fetchPlaylistPage(
                state.room.id,
                1,
                state.room.playlist.pageSize,
                {
                  reset: true,
                }
              );
              persistRoomId(state.room.id);
              setStatusText(`恢復房間：${state.room.name}`);
            } else {
              persistRoomId(null);
            }
          }
        );
      }
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      setStatusText("與伺服器斷線，將嘗試自動恢復");
      setCurrentRoom(null);
      setParticipants([]);
      setMessages([]);
      setPlaylistViewItems([]);
      setPlaylistHasMore(false);
      setPlaylistLoadingMore(false);
    });

    s.on("roomsUpdated", (updatedRooms: RoomSummary[]) => {
      setRooms(updatedRooms);
      if (!currentRoom && viewMode === "list") {
        // keep list visible
      }
      if (isInviteMode && inviteRoomId) {
        const found = updatedRooms.some((r) => r.id === inviteRoomId);
        setInviteNotFound(!found);
        if (!found) {
          setStatusText("受邀房間不存在或已關閉");
        }
      }
    });

    s.on("joinedRoom", (state) => {
      setCurrentRoom(state.room);
      setParticipants(state.participants);
      setMessages(state.messages);
      setPlaylistProgress({
        received: state.room.playlist.receivedCount,
        total: state.room.playlist.totalCount,
        ready: state.room.playlist.ready,
      });
      fetchPlaylistPage(state.room.id, 1, state.room.playlist.pageSize, {
        reset: true,
      });
      persistRoomId(state.room.id);
      setStatusText(`已加入房間：${state.room.name}`);
    });

    s.on("participantsUpdated", ({ roomId, participants, hostClientId }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setParticipants(participants);
      setCurrentRoom((prev) => (prev ? { ...prev, hostClientId } : prev));
    });

    s.on("userLeft", ({ roomId, clientId: leftId }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setParticipants((prev) => prev.filter((p) => p.clientId !== leftId));
    });

    s.on("playlistProgress", ({ roomId, receivedCount, totalCount, ready }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setPlaylistProgress({
        received: receivedCount,
        total: totalCount,
        ready,
      });
    });

    s.on("playlistUpdated", ({ roomId, playlist }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setCurrentRoom((prev) =>
        prev ? { ...prev, playlist: { ...playlist, items: [] } } : prev
      );
      setPlaylistProgress({
        received: playlist.receivedCount,
        total: playlist.totalCount,
        ready: playlist.ready,
      });
      fetchPlaylistPage(roomId, 1, playlist.pageSize, { reset: true });
    });

    s.on("messageAdded", ({ roomId, message }) => {
      if (roomId !== currentRoomIdRef.current) return;
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [username, clientId]);

  const handleCreateRoom = async () => {
    const s = getSocket();
    if (!s || !username) {
      setStatusText("尚未設定使用者名稱");
      return;
    }
    const trimmed = roomNameInput.trim();
    if (!trimmed) {
      setStatusText("請輸入房間名稱");
      return;
    }
    if (playlistItems.length === 0 || !lastFetchedPlaylistId) {
      setStatusText("請先載入播放清單");
      return;
    }

    const uploadId =
      crypto.randomUUID?.() ??
      `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
    const firstChunk = playlistItems.slice(0, CHUNK_SIZE);
    const remaining = playlistItems.slice(CHUNK_SIZE);
    const isLast = remaining.length === 0;

    const payload = {
      roomName: trimmed,
      username,
      password: roomPasswordInput.trim() || undefined,
      gameSettings: { questionCount },
      playlist: {
        uploadId,
        id: lastFetchedPlaylistId,
        totalCount: playlistItems.length,
        items: firstChunk,
        isLast,
        pageSize: DEFAULT_PAGE_SIZE,
      },
    };

    s.emit("createRoom", payload, async (ack: Ack<RoomState>) => {
      if (!ack) return;
      if (ack.ok) {
        const state = ack.data;
        setCurrentRoom(state.room);
        setParticipants(state.participants);
        setMessages(state.messages);
        persistRoomId(state.room.id);
        setRoomNameInput("");
        setStatusText(`已建立房間：${state.room.name}`);
        setPlaylistProgress({
          received: state.room.playlist.receivedCount,
          total: state.room.playlist.totalCount,
          ready: state.room.playlist.ready,
        });
        fetchPlaylistPage(state.room.id, 1, state.room.playlist.pageSize, {
          reset: true,
        });

        if (remaining.length > 0) {
          for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
            const chunk = remaining.slice(i, i + CHUNK_SIZE);
            const isLastChunk = i + CHUNK_SIZE >= remaining.length;
            await new Promise<void>((resolve) => {
              s.emit(
                "uploadPlaylistChunk",
                {
                  roomId: state.room.id,
                  uploadId,
                  items: chunk,
                  isLast: isLastChunk,
                },
                () => resolve()
              );
            });
          }
        }
      } else {
        setStatusText(`建立房間失敗：${ack.error}`);
      }
    });
  };

  const handleJoinRoom = (roomId: string, hasPassword: boolean) => {
    const s = getSocket();
    if (!s || !username) {
      setStatusText("尚未設定使用者名稱");
      return;
    }

    s.emit(
      "joinRoom",
      {
        roomId,
        username,
        password: hasPassword ? joinPasswordInput.trim() || "" : undefined,
      },
      (ack: Ack<RoomState>) => {
        if (!ack) return;
        if (ack.ok) {
          const state = ack.data;
          setCurrentRoom(state.room);
          setParticipants(state.participants);
          setMessages(state.messages);
          setPlaylistProgress({
            received: state.room.playlist.receivedCount,
            total: state.room.playlist.totalCount,
            ready: state.room.playlist.ready,
          });
          fetchPlaylistPage(state.room.id, 1, state.room.playlist.pageSize, {
            reset: true,
          });
          persistRoomId(state.room.id);
          setJoinPasswordInput("");
          setStatusText(`已加入房間：${state.room.name}`);
        } else {
          setStatusText(`加入房間失敗：${ack.error}`);
        }
      }
    );
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
        setPlaylistViewItems([]);
        setPlaylistHasMore(false);
        setPlaylistLoadingMore(false);
        persistRoomId(null);
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

    s.emit("sendMessage", { content: trimmed }, (ack) => {
      if (!ack) return;
      if (!ack.ok) {
        setStatusText(`訊息送出失敗：${ack.error}`);
      }
    });

    setMessageInput("");
  };

  const handleFetchPlaylist = async () => {
    setPlaylistError(null);
    if (playlistLocked && lastFetchedPlaylistId) {
      setPlaylistError("播放清單已鎖定，如需重選請按「重選播放清單」");
      return;
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      setPlaylistError("請貼上有效的播放清單網址");
      return;
    }

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
    if (!apiKey) {
      setPlaylistError("尚未設定 YouTube API 金鑰 (VITE_YOUTUBE_API_KEY)");
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
          throw new Error("讀取播放清單失敗，請稍後再試");
        }

        const data = await res.json();
        const playlistVideos = (data.items ?? []) as Array<{
          snippet?: {
            title?: string;
            channelTitle?: string;
            videoOwnerChannelTitle?: string;
            resourceId?: { videoId?: string };
            thumbnails?: Record<
              string,
              { url?: string; width?: number; height?: number }
            >;
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
            const thumb =
              item.snippet?.thumbnails?.maxres?.url ??
              item.snippet?.thumbnails?.standard?.url ??
              item.snippet?.thumbnails?.high?.url ??
              item.snippet?.thumbnails?.medium?.url ??
              item.snippet?.thumbnails?.default?.url ??
              undefined;
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
              thumbnail: thumb,
            } satisfies PlaylistItem;
          })
        );

        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      setPlaylistItems(items);
      setPlaylistStage("preview");
      setPlaylistLocked(true);
      setLastFetchedPlaylistId(playlistId);
      setStatusText(`已載入播放清單，共 ${items.length} 首`);
    } catch (error) {
      console.error(error);
      setPlaylistError("讀取播放清單時發生錯誤，請確認網路後重試");
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
    setStatusText("已重置播放清單，請重新選擇");
  };

  const loadMorePlaylist = useCallback(() => {
    if (!currentRoom) return;
    if (playlistLoadingMore || !playlistHasMore) return;
    fetchPlaylistPage(currentRoom.id, playlistPageCursor + 1, playlistPageSize);
  }, [
    currentRoom,
    playlistHasMore,
    playlistLoadingMore,
    playlistPageCursor,
    playlistPageSize,
  ]);

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

      <div className="flex gap-4 flex-row justify-center">
        {!currentRoom?.id && username && (
          <>
            {isInviteMode ? (
              <RoomCreationSection
                roomName={roomNameInput}
                roomPassword={roomPasswordInput}
                playlistUrl={playlistUrl}
                playlistItems={playlistItems}
                playlistError={playlistError}
                playlistLoading={playlistLoading}
                playlistStage={playlistStage}
                playlistLocked={playlistLocked}
                rooms={rooms}
                username={username}
                currentRoomId={currentRoomIdRef.current}
                joinPassword={joinPasswordInput}
                playlistProgress={playlistProgress}
                inviteRoom={
                  inviteRoomId
                    ? rooms.find((room) => room.id === inviteRoomId) ?? null
                    : null
                }
                inviteRoomId={inviteRoomId}
                isInviteMode={true}
                inviteNotFound={inviteNotFound}
                questionCount={questionCount}
                onQuestionCountChange={setQuestionCount}
                onRoomNameChange={setRoomNameInput}
                onRoomPasswordChange={setRoomPasswordInput}
                onJoinPasswordChange={setJoinPasswordInput}
                onPlaylistUrlChange={setPlaylistUrl}
                onFetchPlaylist={handleFetchPlaylist}
                onResetPlaylist={handleResetPlaylist}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                showRoomList={false}
              />
            ) : viewMode === "create" ? (
              <div className="w-full md:w-full lg:w-3/5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg text-slate-100 font-semibold">
                    建立房間
                  </h2>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setViewMode("list")}
                  >
                    返回列表
                  </Button>
                </div>
                <RoomCreationSection
                  roomName={roomNameInput}
                  roomPassword={roomPasswordInput}
                  playlistUrl={playlistUrl}
                  playlistItems={playlistItems}
                  playlistError={playlistError}
                  playlistLoading={playlistLoading}
                  playlistStage={playlistStage}
                  playlistLocked={playlistLocked}
                  rooms={[]}
                  username={username}
                  currentRoomId={currentRoomIdRef.current}
                  joinPassword={joinPasswordInput}
                  playlistProgress={playlistProgress}
                  inviteRoom={null}
                  inviteRoomId={null}
                  isInviteMode={false}
                  inviteNotFound={false}
                  questionCount={questionCount}
                  onQuestionCountChange={setQuestionCount}
                  onRoomNameChange={setRoomNameInput}
                  onRoomPasswordChange={setRoomPasswordInput}
                  onJoinPasswordChange={setJoinPasswordInput}
                  onPlaylistUrlChange={setPlaylistUrl}
                  onFetchPlaylist={handleFetchPlaylist}
                  onResetPlaylist={handleResetPlaylist}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  showRoomList={false}
                />
              </div>
            ) : (
              <div className="w-full md:w-full lg:w-3/5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg text-slate-100 font-semibold">
                    房間列表
                  </h2>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setViewMode("create")}
                  >
                    建立房間
                  </Button>
                </div>
                <div className="w-full max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 divide-y divide-slate-800 shadow-inner shadow-slate-900/60">
                  {rooms.length === 0 ? (
                    <div className="flex items-center justify-center min-h-40 text-xl text-slate-300">
                      目前沒有房間，試著建立一個吧！
                    </div>
                  ) : (
                    rooms.map((room) => {
                      const isCurrent = currentRoomIdRef.current === room.id;
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
                              {isCurrent && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Players: {room.playerCount} ・ 清單{" "}
                              {room.playlistCount} 首 ・{" "}
                              {new Date(room.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {room.hasPassword && (
                              <input
                                className="w-28 px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200"
                                placeholder="房間密碼"
                                value={joinPasswordInput}
                                onChange={(e) =>
                                  setJoinPasswordInput(e.target.value)
                                }
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
          </>
        )}

        {currentRoom?.id && (
          <ChatPanel
            currentRoom={currentRoom}
            participants={participants}
            messages={messages}
            username={username}
            messageInput={messageInput}
            playlistItems={playlistViewItems}
            playlistHasMore={playlistHasMore}
            playlistLoadingMore={playlistLoadingMore}
            playlistProgress={playlistProgress}
            isHost={currentRoom.hostClientId === clientId}
            onLeave={handleLeaveRoom}
            onInputChange={setMessageInput}
            onSend={handleSendMessage}
            onLoadMorePlaylist={loadMorePlaylist}
            onInvite={async () => {
              if (!currentRoom) return;
              const url = new URL(window.location.href);
              url.searchParams.set("roomId", currentRoom.id);
              const inviteText = url.toString();
              if (navigator.clipboard?.writeText) {
                try {
                  await navigator.clipboard.writeText(inviteText);
                  setStatusText("已複製邀請連結");
                } catch (err) {
                  console.error(err);
                  setStatusText("複製邀請連結失敗");
                }
              } else {
                setStatusText(inviteText);
              }
            }}
          />
        )}
      </div>

      {statusText && (
        // <div className="text-xs text-slate-400 mt-1">Status: {statusText}</div>
        <Snackbar message={`Status: ${statusText}`} open={true} />
      )}
    </div>
  );
};

export default RoomChatPage;
