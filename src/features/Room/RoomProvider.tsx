import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io } from "socket.io-client";

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
import {
  RoomContext,
  type RoomContextValue,
  type AuthUser,
} from "./RoomContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const API_URL = import.meta.env.VITE_API_URL;
const VITE_WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;
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
  authToken: "mq_authToken",
  authUser: "mq_authUser",
};

export const RoomProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [usernameInput, setUsernameInput] = useState(
    () => localStorage.getItem(STORAGE_KEYS.username) ?? "",
  );
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.username) ?? null,
  );
  const [authToken, setAuthToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.authToken),
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.authUser);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(false);
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
  const [roomNameInput, setRoomNameInput] = useState(() =>
    username ? `${username}'s room` : "我的房間",
  );
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<RoomState["room"] | null>(
    null,
  );
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.roomId),
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
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(null);
  const isInviteMode = Boolean(inviteRoomId);
  const [inviteNotFound, setInviteNotFound] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gamePlaylist, setGamePlaylist] = useState<PlaylistItem[]>([]);
  const [isGameView, setIsGameView] = useState(false);
  const [routeRoomResolved, setRouteRoomResolved] = useState<boolean>(() =>
    Boolean(currentRoomId),
  );
  const [hostRoomPassword, setHostRoomPassword] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const socketRef = useRef<ClientSocket | null>(null);
  const currentRoomIdRef = useRef<string | null>(
    currentRoomId ?? localStorage.getItem(STORAGE_KEYS.roomId),
  );
  const serverOffsetRef = useRef(0);
  const googleCodeClientRef = useRef<any>(null);
  const googleScriptPromiseRef = useRef<Promise<void> | null>(null);
  const handledRedirectRef = useRef(false);

  const displayUsername = useMemo(() => username ?? "(未設定)", [username]);

  const persistUsername = (name: string) => {
    setUsername(name);
    localStorage.setItem(STORAGE_KEYS.username, name);
  };

  const persistAuth = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    localStorage.setItem(STORAGE_KEYS.authToken, token);
    localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
    if (user.display_name) {
      persistUsername(user.display_name);
    }
  };

  const clearAuth = () => {
    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.authUser);
    setUsername(null);
    localStorage.removeItem(STORAGE_KEYS.username);
    setUsernameInput("");
  };

  const ensureGoogleScript = () => {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (googleScriptPromiseRef.current) return googleScriptPromiseRef.current;
    googleScriptPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(
        "script[data-google-identity]",
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Google script")),
        );
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google script"));
      document.head.appendChild(script);
    });
    return googleScriptPromiseRef.current;
  };

  const persistRoomId = (id: string | null) => {
    currentRoomIdRef.current = id;
    setCurrentRoomId(id);
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

  const exchangeGoogleCode = useCallback(
    async (code: string, redirectUri: string) => {
      if (!API_URL) {
        setStatusText("尚未設定 API 位置 (VITE_API_URL)");
        return;
      }
      setAuthLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.token) {
          throw new Error(payload?.error ?? "Google 登入失敗");
        }
        persistAuth(payload.token, payload.user as AuthUser);
        setStatusText("Google 登入成功");
      } catch (error) {
        setStatusText(
          error instanceof Error ? error.message : "Google 登入失敗",
        );
      } finally {
        setAuthLoading(false);
      }
    },
    [persistAuth, setStatusText],
  );

  const loginWithGoogle = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setStatusText("尚未設定 Google Client ID");
      return;
    }
    const redirectUri =
      import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? window.location.origin;
    const isMobile =
      /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) || window.matchMedia("(max-width: 768px)").matches;
    const uxMode = isMobile ? "redirect" : "popup";

    ensureGoogleScript()
      .then(() => {
        const codeClient =
          googleCodeClientRef.current ??
          window.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: "openid email profile",
            ux_mode: uxMode,
            redirect_uri: redirectUri,
            callback: (response: { code?: string; error?: string }) => {
              if (!response?.code) {
                setStatusText(response?.error ?? "Google 登入失敗");
                return;
              }
              exchangeGoogleCode(response.code, redirectUri);
            },
          });
        googleCodeClientRef.current = codeClient;
        codeClient.requestCode();
      })
      .catch((error) => {
        setStatusText(
          error instanceof Error ? error.message : "Google 登入失敗",
        );
      });
  }, [exchangeGoogleCode, setStatusText]);

  const logout = useCallback(() => {
    clearAuth();
    setStatusText("已登出");
  }, []);

  const getSocket = () => socketRef.current;

  useEffect(() => {
    if (authUser?.display_name && !username) {
      persistUsername(authUser.display_name);
    }
  }, [authUser?.display_name, username]);

  useEffect(() => {
    if (handledRedirectRef.current) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (!code && !error) return;
    handledRedirectRef.current = true;

    url.searchParams.delete("code");
    url.searchParams.delete("scope");
    url.searchParams.delete("authuser");
    url.searchParams.delete("prompt");
    url.searchParams.delete("error");
    window.history.replaceState({}, document.title, url.toString());

    if (error) {
      setStatusText(error);
      return;
    }

    const redirectUri =
      import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? window.location.origin;
    void exchangeGoogleCode(code, redirectUri);
  }, [exchangeGoogleCode, setStatusText]);

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

  const fetchRooms = useCallback(async () => {
    if (!API_URL) {
      setStatusText("尚未設定 API 位置 (VITE_API_URL)");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/rooms`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "無法取得房間列表");
      }
      const next = (payload?.rooms ?? payload) as RoomSummary[];
      setRooms(Array.isArray(next) ? next : []);
      if (isInviteMode && inviteRoomId) {
        const found = Array.isArray(next)
          ? next.some((room) => room.id === inviteRoomId)
          : false;
        setInviteNotFound(!found);
        if (!found) {
          setStatusText("受邀房間不存在或已關閉");
        }
      }
    } catch (error) {
      console.error(error);
      setStatusText("取得房間列表失敗");
    }
  }, [isInviteMode, inviteRoomId]);

  const fetchRoomById = useCallback(async (roomId: string) => {
    if (!API_URL) {
      setStatusText("尚未設定 API 位置 (VITE_API_URL)");
      return null;
    }
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        return null;
      }
      return (payload?.room ?? null) as RoomSummary | null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!inviteRoomId) {
      setInviteNotFound(false);
      return;
    }
    void fetchRoomById(inviteRoomId).then((room) => {
      setInviteNotFound(!room);
      if (!room) {
        setStatusText("受邀房間不存在或已關閉");
      }
    });
  }, [fetchRoomById, inviteRoomId]);

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

    const authPayload = authToken ? { token: authToken, clientId } : { clientId };
    const s = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: authPayload,
    });

    socketRef.current = s;

    s.on("connect", () => {
      setIsConnected(true);
      setStatusText("已連線伺服器");
      void fetchRooms();

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
      } else {
        setRouteRoomResolved(true);
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
  }, [
    username,
    clientId,
    authToken,
    fetchCompletePlaylist,
    fetchRooms,
    inviteRoomId,
    isInviteMode,
    syncServerOffset,
  ]);

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
        setStatusText(`建立房間失敗：{ack.error}`);
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
          setStatusText(`加入房間失敗：{ack.error}`);
        }
      },
    );
  };

  const handleLeaveRoom = (onLeft?: () => void) => {
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
        onLeft?.();
      } else {
        setStatusText(`離開房間失敗：{ack.error}`);
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
        setStatusText(`訊息送出失敗：{ack.error}`);
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
          setStatusText(`開始遊戲失敗：{ack.error}`);
        }
      },
    );
  };

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
        setStatusText(`提交答案失敗：{ack.error}`);
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
      setPlaylistError("尚未設定播放清單 API 位置 (VITE_API_URL)");
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

  const resetCreateState = useCallback(() => {
    setRoomNameInput(username ? `${username}'s room` : "我的房間");
    setRoomPasswordInput("");
    setPlaylistUrl("");
    setPlaylistItems([]);
    setPlaylistError(null);
    setPlaylistLoading(false);
    setPlaylistStage("input");
    setPlaylistLocked(false);
    setLastFetchedPlaylistId(null);
    setPlaylistViewItems([]);
    setPlaylistHasMore(false);
    setPlaylistLoadingMore(false);
    setPlaylistPageCursor(1);
    setPlaylistPageSize(DEFAULT_PAGE_SIZE);
    setPlaylistProgress({ received: 0, total: 0, ready: false });
  }, [username]);

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

  const setRouteRoomId = useCallback((value: string | null) => {
    currentRoomIdRef.current = value;
    setCurrentRoomId(value);
    if (value) {
      setRouteRoomResolved(false);
    }
  }, []);

  const value = useMemo<RoomContextValue>(
    () => ({
      authToken,
      authUser,
      authLoading,
      loginWithGoogle,
      logout,
      usernameInput,
      setUsernameInput,
      username,
      displayUsername,
      clientId,
      isConnected,
      rooms,
      roomNameInput,
      setRoomNameInput,
      roomPasswordInput,
      setRoomPasswordInput,
      joinPasswordInput,
      setJoinPasswordInput,
      currentRoom,
      currentRoomId,
      participants,
      messages,
      messageInput,
      setMessageInput,
      statusText,
      setStatusText,
      playlistUrl,
      setPlaylistUrl,
      playlistItems,
      playlistError,
      playlistLoading,
      playlistStage,
      playlistLocked,
      lastFetchedPlaylistId,
      playlistViewItems,
      playlistHasMore,
      playlistLoadingMore,
      playlistPageCursor,
      playlistPageSize,
      playlistProgress,
      questionCount,
      questionMin: QUESTION_MIN,
      questionMax: QUESTION_MAX,
      questionStep: QUESTION_STEP,
      questionMaxLimit,
      inviteRoomId,
      inviteNotFound,
      isInviteMode,
      gameState,
      gamePlaylist,
      isGameView,
      setIsGameView,
      routeRoomResolved,
      hostRoomPassword,
      serverOffsetMs,
      setInviteRoomId,
      setRouteRoomId,
      handleSetUsername,
      handleCreateRoom,
      handleJoinRoom,
      handleLeaveRoom,
      handleSendMessage,
      handleStartGame,
      handleSubmitChoice,
      handleFetchPlaylist,
      handleResetPlaylist,
      loadMorePlaylist,
      updateQuestionCount,
      syncServerOffset,
      fetchRooms,
      fetchRoomById,
      resetCreateState,
    }),
    [
      authToken,
      authUser,
      authLoading,
      loginWithGoogle,
      logout,
      usernameInput,
      username,
      displayUsername,
      clientId,
      isConnected,
      rooms,
      roomNameInput,
      roomPasswordInput,
      joinPasswordInput,
      currentRoom,
      currentRoomId,
      participants,
      messages,
      messageInput,
      statusText,
      setStatusText,
      playlistUrl,
      playlistItems,
      playlistError,
      playlistLoading,
      playlistStage,
      playlistLocked,
      lastFetchedPlaylistId,
      playlistViewItems,
      playlistHasMore,
      playlistLoadingMore,
      playlistPageCursor,
      playlistPageSize,
      playlistProgress,
      questionCount,
      questionMaxLimit,
      inviteRoomId,
      inviteNotFound,
      isInviteMode,
      gameState,
      gamePlaylist,
      isGameView,
      routeRoomResolved,
      hostRoomPassword,
      serverOffsetMs,
      setInviteRoomId,
      setRouteRoomId,
      fetchRooms,
      fetchRoomById,
      resetCreateState,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
