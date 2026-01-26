import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

import HeaderSection from "./components/HeaderSection";
import RoomCreationSection from "./components/RoomCreationSection";
import UsernameStep from "./components/UsernameStep";
import GameRoomPage from "../GameRoomPage/GameRoomPage";
import RoomLobby from "../../features/RoomLobby/RoomLobby";
import InvitedPage from "../../features/Invited/Invited";
import type {
  Ack,
  ChatMessage,
  ClientSocket,
  GameState,
  PlaylistItem,
  RoomParticipant,
  RoomState,
  RoomSummary,
} from "./types";
import { Button, Snackbar } from "@mui/material";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_PAGE_SIZE = 50;
const CHUNK_SIZE = 200;
const QUESTION_MIN = 5;
const QUESTION_MAX = 100;
const QUESTION_STEP = 5;
const STORAGE_KEYS = {
  clientId: "mq_clientId",
  username: "mq_username",
  roomId: "mq_roomId",
  questionCount: "mq_questionCount",
  roomPasswordPrefix: "mq_roomPassword:",
};

interface RoomChatPageProps {
  routeRoomId?: string | null;
  inviteId?: string | null;
  initialView?: "list" | "create";
}

const RoomChatPage: React.FC<RoomChatPageProps> = ({
  routeRoomId = null,
  inviteId = null,
  initialView = "list",
}) => {
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState(
    () => localStorage.getItem(STORAGE_KEYS.username) ?? "",
  );
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.username) ?? null,
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
  const [roomNameInput, setRoomNameInput] = useState(`${username}'s room`);
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<RoomState["room"] | null>(
    null,
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
    "input",
  );
  const [playlistLocked, setPlaylistLocked] = useState(false);
  const [lastFetchedPlaylistId, setLastFetchedPlaylistId] = useState<
    string | null
  >(() => null);
  const [playlistViewItems, setPlaylistViewItems] = useState<PlaylistItem[]>(
    [],
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
  const getQuestionMax = (playlistCount: number) =>
    playlistCount > 0 ? Math.min(QUESTION_MAX, playlistCount) : QUESTION_MAX;
  const clampQuestionCount = (value: number, maxValue: number) =>
    Math.min(maxValue, Math.max(QUESTION_MIN, value));
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.questionCount));
    const initial = Number.isFinite(saved) ? saved : 10;
    return clampQuestionCount(initial, getQuestionMax(0));
  });
  const [inviteRoomId] = useState<string | null>(() => {
    if (inviteId) return inviteId;
    const params = new URLSearchParams(window.location.search);
    return params.get("roomId");
  });
  const isInviteMode = Boolean(inviteRoomId);
  const [inviteNotFound, setInviteNotFound] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "create">(initialView);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gamePlaylist, setGamePlaylist] = useState<PlaylistItem[]>([]);
  const [isGameView, setIsGameView] = useState(false);
  const [routeRoomResolved, setRouteRoomResolved] = useState<boolean>(
    () => !routeRoomId,
  );
  const [hostRoomPassword, setHostRoomPassword] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const socketRef = useRef<ClientSocket | null>(null);
  const currentRoomIdRef = useRef<string | null>(
    routeRoomId ?? localStorage.getItem(STORAGE_KEYS.roomId),
  );
  const serverOffsetRef = useRef(0);

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

  const roomPasswordKey = (roomId: string) =>
    `${STORAGE_KEYS.roomPasswordPrefix}${roomId}`;

  const saveRoomPassword = (roomId: string, password: string | null) => {
    if (password) {
      localStorage.setItem(roomPasswordKey(roomId), password);
    } else {
      localStorage.removeItem(roomPasswordKey(roomId));
    }
  };

  const readRoomPassword = (roomId: string) =>
    localStorage.getItem(roomPasswordKey(roomId));

  const updateQuestionCount = (value: number) => {
    const clamped = clampQuestionCount(
      value,
      getQuestionMax(playlistItems.length),
    );
    setQuestionCount(clamped);
    localStorage.setItem(STORAGE_KEYS.questionCount, String(clamped));
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

  const syncServerOffset = useCallback((serverNow: number) => {
    const offset = serverNow - Date.now();
    serverOffsetRef.current = offset;
    setServerOffsetMs(offset);
  }, []);

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

  const fetchPlaylistPage = (
    roomId: string,
    page: number,
    pageSize?: number,
    opts?: { reset?: boolean },
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
        }>,
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
      },
    );
  };

  const fetchCompletePlaylist = useCallback(
    (roomId: string) =>
      new Promise<PlaylistItem[]>((resolve) => {
        const s = getSocket();
        if (!s) {
          resolve([]);
          return;
        }
        const aggregated: PlaylistItem[] = [];
        const pageSize = Math.max(playlistPageSize, DEFAULT_PAGE_SIZE);

        const loadPage = (page: number) => {
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
              }>,
            ) => {
              if (ack?.ok) {
                aggregated.push(...ack.data.items);
                if (
                  aggregated.length < ack.data.totalCount &&
                  ack.data.items.length > 0
                ) {
                  loadPage(page + 1);
                } else {
                  resolve(aggregated);
                }
              } else {
                resolve(aggregated);
              }
            },
          );
        };

        loadPage(1);
      }),
    [playlistPageSize],
  );

  useEffect(() => {
    if (!username) return;

    const s = io(SOCKET_URL, {
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
              syncServerOffset(state.serverNow);
              setCurrentRoom(state.room);
              setParticipants(state.participants);
              setMessages(state.messages);
              setPlaylistProgress({
                received: state.room.playlist.receivedCount,
                total: state.room.playlist.totalCount,
                ready: state.room.playlist.ready,
              });
              setGameState(state.gameState ?? null);
              if (state.gameState?.status === "playing") {
                setIsGameView(true);
                void fetchCompletePlaylist(state.room.id).then(setGamePlaylist);
              } else {
                setIsGameView(false);
                setGamePlaylist([]);
              }
              fetchPlaylistPage(
                state.room.id,
                1,
                state.room.playlist.pageSize,
                {
                  reset: true,
                },
              );
              persistRoomId(state.room.id);
              setStatusText(`恢復房間：${state.room.name}`);
              setRouteRoomResolved(true);
            } else {
              persistRoomId(null);
              setRouteRoomResolved(true);
            }
          },
        );
      }
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      setStatusText("與伺服器斷線，將嘗試自動恢復");
      setRouteRoomResolved(false);
      setCurrentRoom(null);
      setParticipants([]);
      setMessages([]);
      setGameState(null);
      setGamePlaylist([]);
      setIsGameView(false);
      setPlaylistViewItems([]);
      setPlaylistHasMore(false);
      setPlaylistLoadingMore(false);
      setServerOffsetMs(0);
      serverOffsetRef.current = 0;
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
      syncServerOffset(state.serverNow);
      setCurrentRoom(state.room);
      setParticipants(state.participants);
      setMessages(state.messages);
      setPlaylistProgress({
        received: state.room.playlist.receivedCount,
        total: state.room.playlist.totalCount,
        ready: state.room.playlist.ready,
      });
      setGameState(state.gameState ?? null);
      if (state.gameState?.status === "playing") {
        setIsGameView(true);
        void fetchCompletePlaylist(state.room.id).then(setGamePlaylist);
      } else {
        setIsGameView(false);
        setGamePlaylist([]);
      }
      fetchPlaylistPage(state.room.id, 1, state.room.playlist.pageSize, {
        reset: true,
      });
      persistRoomId(state.room.id);
      setStatusText(`已加入房間：${state.room.name}`);
      setRouteRoomResolved(true);
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
        prev ? { ...prev, playlist: { ...playlist, items: [] } } : prev,
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

    s.on("gameStarted", ({ roomId, gameState, serverNow }) => {
      if (roomId !== currentRoomIdRef.current) return;
      syncServerOffset(serverNow);
      setGameState(gameState);
      setIsGameView(true);
      void fetchCompletePlaylist(roomId).then(setGamePlaylist);
      setStatusText("遊戲已開始，切換至遊戲頁面");
    });

    s.on("gameUpdated", ({ roomId, gameState, serverNow }) => {
      if (roomId !== currentRoomIdRef.current) return;
      syncServerOffset(serverNow);
      setGameState(gameState);
      if (gameState?.status === "playing") {
        setIsGameView(true);
      }
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
      gameSettings: {
        questionCount: clampQuestionCount(
          questionCount,
          getQuestionMax(playlistItems.length),
        ),
      },
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
        syncServerOffset(state.serverNow);
        setCurrentRoom(state.room);
        setParticipants(state.participants);
        setMessages(state.messages);
        persistRoomId(state.room.id);
        const createdPassword = roomPasswordInput.trim();
        saveRoomPassword(state.room.id, createdPassword || null);
        setHostRoomPassword(createdPassword || null);
        setRoomNameInput("");
        setStatusText(`已建立房間：${state.room.name}`);
        setPlaylistProgress({
          received: state.room.playlist.receivedCount,
          total: state.room.playlist.totalCount,
          ready: state.room.playlist.ready,
        });
        setGameState(state.gameState ?? null);
        setIsGameView(false);
        setGamePlaylist([]);
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
                () => resolve(),
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
          syncServerOffset(state.serverNow);
          setCurrentRoom(state.room);
          setParticipants(state.participants);
          setMessages(state.messages);
          setPlaylistProgress({
            received: state.room.playlist.receivedCount,
            total: state.room.playlist.totalCount,
            ready: state.room.playlist.ready,
          });
          setGameState(state.gameState ?? null);
          if (state.gameState?.status === "playing") {
            setIsGameView(true);
            void fetchCompletePlaylist(state.room.id).then(setGamePlaylist);
          } else {
            setIsGameView(false);
            setGamePlaylist([]);
          }
          fetchPlaylistPage(state.room.id, 1, state.room.playlist.pageSize, {
            reset: true,
          });
          persistRoomId(state.room.id);
          setJoinPasswordInput("");
          setStatusText(`已加入房間：${state.room.name}`);
        } else {
          setStatusText(`加入房間失敗：${ack.error}`);
        }
      },
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
        setGameState(null);
        setGamePlaylist([]);
        setIsGameView(false);
        setPlaylistViewItems([]);
        setPlaylistHasMore(false);
        setPlaylistLoadingMore(false);
        persistRoomId(null);
        setStatusText("已離開房間");
        navigate("/rooms", { replace: true });
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

  const handleStartGame = () => {
    const s = getSocket();
    if (!s || !currentRoom) {
      setStatusText("尚未加入任何房間");
      return;
    }
    if (!playlistProgress.ready) {
      setStatusText("播放清單尚未準備完成");
      return;
    }

    s.emit(
      "startGame",
      { roomId: currentRoom.id },
      (ack: Ack<{ gameState: GameState; serverNow: number }>) => {
        if (!ack) return;
        if (ack.ok) {
          syncServerOffset(ack.data.serverNow);
          setGameState(ack.data.gameState);
          setIsGameView(true);
          void fetchCompletePlaylist(currentRoom.id).then(setGamePlaylist);
          setStatusText("遊戲即將開始");
        } else {
          setStatusText(`開始遊戲失敗：${ack.error}`);
        }
      },
    );
  };

  // 遊戲結束自動回聊天室
  useEffect(() => {
    if (gameState?.status === "ended" && isGameView) {
      setIsGameView(false);
      setStatusText("遊戲已結束，返回聊天室");
    }
  }, [gameState?.status, isGameView]);

  const handleSubmitChoice = (choiceIndex: number) => {
    const s = getSocket();
    if (!s || !currentRoom || !gameState) return;
    if (gameState.phase !== "guess") return;
    s.emit("submitAnswer", { roomId: currentRoom.id, choiceIndex }, (ack) => {
      if (ack && !ack.ok) {
        setStatusText(`提交答案失敗：${ack.error}`);
      }
    });
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

    if (!API_URL) {
      setPlaylistError("尚未設定 API 位置 (VITE_API_URL)");
      return;
    }

    setPlaylistLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/playlists/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId, url: playlistUrl }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "讀取播放清單失敗，請稍後重試");
      }

      const data = payload as {
        playlistId: string;
        items: PlaylistItem[];
        expectedCount: number | null;
        skippedCount: number;
      };

      if (!data?.items || data.items.length === 0) {
        throw new Error(
          "清單沒有可用影片，可能為私人/受限或自動合輯不受支援。",
        );
      }

      setPlaylistItems(data.items);
      setPlaylistStage("preview");
      setPlaylistLocked(true);
      setLastFetchedPlaylistId(data.playlistId ?? playlistId);

      if (
        data.expectedCount !== null &&
        data.expectedCount !== data.items.length
      ) {
        setStatusText(
          `已載入播放清單，共 ${data.items.length} 首（已略過私人或無法存取的影片）`,
        );
      } else {
        setStatusText(`已載入播放清單，共 ${data.items.length} 首`);
      }
    } catch (error) {
      console.error(error);
      setPlaylistError(
        error instanceof Error
          ? error.message
          : "讀取播放清單時發生錯誤，請確認網路後重試",
      );
      setPlaylistItems([]);
      setPlaylistStage("input");
      setPlaylistLocked(false);
      setLastFetchedPlaylistId(null);
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

  const questionMaxLimit = getQuestionMax(playlistItems.length);

  useEffect(() => {
    if (currentRoom?.id) {
      navigate(`/rooms/${currentRoom.id}`, { replace: true });
    }
  }, [currentRoom?.id, navigate]);

  useEffect(() => {
    if (playlistItems.length === 0) return;
    const maxValue = getQuestionMax(playlistItems.length);
    if (questionCount > maxValue) {
      setQuestionCount(maxValue);
      localStorage.setItem(STORAGE_KEYS.questionCount, String(maxValue));
    }
  }, [playlistItems.length, questionCount]);

  useEffect(() => {
    if (!currentRoom?.id) {
      setHostRoomPassword(null);
      return;
    }
    if (currentRoom.hostClientId !== clientId) {
      setHostRoomPassword(null);
      return;
    }
    if (!currentRoom.hasPassword) {
      setHostRoomPassword(null);
      return;
    }
    setHostRoomPassword(readRoomPassword(currentRoom.id));
  }, [
    clientId,
    currentRoom?.hasPassword,
    currentRoom?.hostClientId,
    currentRoom?.id,
  ]);

  // 房內路由但尚未載入完成：避免閃到房間列表
  if (routeRoomId && !currentRoom && !routeRoomResolved) {
    return (
      <div className="flex flex-col w-95/100 space-y-4">
        <HeaderSection
          serverUrl={SOCKET_URL}
          isConnected={isConnected}
          displayUsername={displayUsername}
        />
        <div className="w-full md:w-4/5 lg:w-3/5 mx-auto mt-6">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
            正在載入房間資訊…
          </div>
        </div>
        {statusText && (
          <Snackbar message={`Status: ${statusText}`} open={true} />
        )}
      </div>
    );
  }

  // 遊戲模式：全屏顯示遊戲頁（保留 Header 以便退出/提示）
  if (currentRoom && gameState && isGameView) {
    return (
      <div className="flex flex-col w-full min-h-screen space-y-4">
        <HeaderSection
          serverUrl={SOCKET_URL}
          isConnected={isConnected}
          displayUsername={displayUsername}
        />
        <div className="flex w-full justify-center">
          <GameRoomPage
            room={currentRoom}
            gameState={gameState}
            playlist={
              gamePlaylist.length > 0 ? gamePlaylist : playlistViewItems
            }
            onBack={() => setIsGameView(false)}
            onSubmitChoice={handleSubmitChoice}
            participants={participants}
            meClientId={clientId}
            messages={messages}
            messageInput={messageInput}
            onMessageChange={setMessageInput}
            onSendMessage={handleSendMessage}
            username={username}
            serverOffsetMs={serverOffsetMs}
          />
        </div>
        {statusText && (
          <Snackbar message={`Status: ${statusText}`} open={true} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-95/100 space-y-4">
      <HeaderSection
        serverUrl={SOCKET_URL}
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
              <InvitedPage
                joinPassword={joinPasswordInput}
                inviteRoom={
                  inviteRoomId
                    ? (rooms.find((room) => room.id === inviteRoomId) ?? null)
                    : null
                }
                inviteRoomId={inviteRoomId}
                inviteNotFound={inviteNotFound}
                onJoinPasswordChange={setJoinPasswordInput}
                onJoinRoom={handleJoinRoom}
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
                    onClick={() => {
                      // setViewMode("list");
                      navigate("/rooms", { replace: true });
                    }}
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
                  onQuestionCountChange={updateQuestionCount}
                  questionMin={QUESTION_MIN}
                  questionMax={questionMaxLimit}
                  questionStep={QUESTION_STEP}
                  questionControlsEnabled={playlistItems.length > 0}
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
                    onClick={() => {
                      // setViewMode("create");
                      navigate("/rooms/create", { replace: true });
                    }}
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
          <RoomLobby
            currentRoom={currentRoom}
            participants={participants}
            messages={messages}
            username={username}
            roomPassword={hostRoomPassword}
            messageInput={messageInput}
            playlistItems={playlistViewItems}
            playlistHasMore={playlistHasMore}
            playlistLoadingMore={playlistLoadingMore}
            playlistProgress={playlistProgress}
            isHost={currentRoom.hostClientId === clientId}
            gameState={gameState}
            canStartGame={playlistProgress.ready}
            onLeave={handleLeaveRoom}
            onInputChange={setMessageInput}
            onSend={handleSendMessage}
            onLoadMorePlaylist={loadMorePlaylist}
            onStartGame={handleStartGame}
            onOpenGame={() => setIsGameView(true)}
            onInvite={async () => {
              if (!currentRoom) return;
              const url = new URL(window.location.href);
              url.pathname = `/invited/${currentRoom.id}`;
              url.search = "";
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

      {/* {statusText && (
        // <div className="text-xs text-slate-400 mt-1">Status: {statusText}</div>
        <Snackbar message={`Status: ${statusText}`} open={true} />
      )} */}
    </div>
  );
};

export default RoomChatPage;
