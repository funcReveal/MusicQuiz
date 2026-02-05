import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
import { RoomContext, type RoomContextValue } from "./RoomContext";
import {
  API_URL,
  CHUNK_SIZE,
  DEFAULT_PAGE_SIZE,
  QUESTION_MAX,
  SOCKET_URL,
  WORKER_API_URL,
} from "./roomConstants";
import { clampQuestionCount, getQuestionMax, normalizePlaylistItems } from "./roomUtils";
import { ensureFreshAuthToken } from "../../../shared/auth/token";
import {
  clearRoomPassword,
  clearStoredRoomId,
  clearStoredUsername,
  getOrCreateClientId,
  getRoomPassword,
  getStoredRoomId,
  getStoredUsername,
  setRoomPassword,
  setStoredQuestionCount,
  setStoredRoomId,
  setStoredUsername,
} from "./roomStorage";
import { apiFetchRoomById, apiFetchRooms } from "./roomApi";
import { connectRoomSocket, disconnectRoomSocket } from "./roomSocket";
import { useRoomAuth } from "./useRoomAuth";
import { useRoomPlaylist } from "./useRoomPlaylist";
import { useRoomCollections } from "./useRoomCollections";

export const RoomProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [usernameInput, setUsernameInput] = useState(
    () => getStoredUsername() ?? "",
  );
  const [username, setUsername] = useState<string | null>(
    () => getStoredUsername() ?? null,
  );
  const [localClientId] = useState<string>(() => getOrCreateClientId());
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
    getStoredRoomId(),
  );
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);
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
    currentRoomId ?? getStoredRoomId(),
  );
  const serverOffsetRef = useRef(0);

  const displayUsername = useMemo(() => username ?? "(未設定)", [username]);

  const persistUsername = useCallback((name: string) => {
    setUsername(name);
    setStoredUsername(name);
  }, []);

  const clearAuth = useCallback(() => {
    setUsername(null);
    clearStoredUsername();
    setUsernameInput("");
  }, []);

  const onResetCollectionRef = useRef<() => void>(() => {});

  const {
    authToken,
    authUser,
    authLoading,
    needsNicknameConfirm,
    nicknameDraft,
    isProfileEditorOpen,
    setNicknameDraft,
    refreshAuthToken,
    confirmNickname,
    openProfileEditor,
    closeProfileEditor,
    loginWithGoogle,
    logout,
  } = useRoomAuth({
    apiUrl: API_URL,
    workerUrl: WORKER_API_URL,
    username,
    persistUsername,
    setStatusText,
    onClearAuth: clearAuth,
  });

  const authClientId = authUser?.id ?? null;
  const clientId = useMemo(
    () => authClientId ?? localClientId,
    [authClientId, localClientId],
  );

  const {
    playlistUrl,
    setPlaylistUrl,
    playlistItems,
    playlistError,
    playlistLoading,
    playlistStage,
    playlistLocked,
    lastFetchedPlaylistId,
    lastFetchedPlaylistTitle,
    questionCount,
    questionMin,
    questionMaxLimit,
    questionStep,
    updateQuestionCount,
    handleFetchPlaylist,
    handleResetPlaylist,
    youtubePlaylists,
    youtubePlaylistsLoading,
    youtubePlaylistsError,
    fetchYoutubePlaylists,
    importYoutubePlaylist,
    applyPlaylistSource,
    clearPlaylistError,
    resetPlaylistState,
    resetYoutubePlaylists,
  } = useRoomPlaylist({
    apiUrl: API_URL,
    authToken,
    refreshAuthToken,
    setStatusText,
    onResetCollection: () => onResetCollectionRef.current(),
  });

  const handleUpdateQuestionCount = useCallback(
    (value: number) => {
      const clamped = updateQuestionCount(value);
      setStoredQuestionCount(clamped);
    },
    [updateQuestionCount],
  );

  const {
    collections,
    collectionsLoading,
    collectionsError,
    selectedCollectionId,
    collectionItemsLoading,
    collectionItemsError,
    selectCollection,
    fetchCollections,
    loadCollectionItems,
    resetCollectionsState,
    resetCollectionSelection,
    clearCollectionsError,
  } = useRoomCollections({
    workerUrl: WORKER_API_URL,
    authToken,
    ownerId: authUser?.id ?? null,
    refreshAuthToken,
    setStatusText,
    onPlaylistLoaded: (items, sourceId) => {
      applyPlaylistSource(items, sourceId);
      setPlaylistUrl("");
    },
    onPlaylistReset: () => {
      clearPlaylistError();
    },
  });

  useEffect(() => {
    onResetCollectionRef.current = resetCollectionSelection;
  }, [resetCollectionSelection]);

  useEffect(() => {
    if (authToken) return;
    resetYoutubePlaylists();
    resetCollectionsState();
    resetPlaylistState();
  }, [authToken, resetCollectionsState, resetPlaylistState, resetYoutubePlaylists]);

 

  const persistRoomId = useCallback((id: string | null) => {
    currentRoomIdRef.current = id;
    setCurrentRoomId(id);
    if (id) {
      setStoredRoomId(id);
    } else {
      clearStoredRoomId();
    }
  }, []);

  const saveRoomPassword = useCallback((roomId: string, password: string | null) => {
    if (password) {
      setRoomPassword(roomId, password);
    } else {
      clearRoomPassword(roomId);
    }
  }, []);

  const readRoomPassword = (roomId: string) => getRoomPassword(roomId);

  const handleSetUsername = useCallback(() => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setStatusText("請先輸入使用者名稱");
      return;
    }
    persistUsername(trimmed);
    setStatusText(null);
  }, [persistUsername, usernameInput]);


  const getSocket = useCallback(() => socketRef.current, []);

  const syncServerOffset = useCallback((serverNow: number) => {
    const offset = serverNow - Date.now();
    serverOffsetRef.current = offset;
    setServerOffsetMs(offset);
  }, []);

  const fetchRooms = useCallback(async () => {
    if (!API_URL) {
      setStatusText("尚未設定 API 位置 (API_URL)");
      return;
    }
    try {
      const { ok, payload } = await apiFetchRooms(API_URL);
      if (!ok) {
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
      setStatusText("尚未設定 API 位置 (API_URL)");
      return null;
    }
    try {
      const { ok, payload } = await apiFetchRoomById(API_URL, roomId);
      if (!ok) {
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

  const fetchPlaylistPage = useCallback((
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
  }, [getSocket]);

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
    [getSocket, playlistPageSize],
  );

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    const init = async () => {
      let token = authToken;
      if (token) {
        token = await ensureFreshAuthToken({
          token,
          refreshAuthToken,
        });
        if (!token) {
          if (!cancelled) {
            setStatusText("登入已過期，請重新登入");
          }
          return;
        }
      }
      if (cancelled) return;
      const authPayload = token ? { token, clientId } : { clientId };
      const s = connectRoomSocket(SOCKET_URL, authPayload, {
      onConnect: (socket) => {
        setIsConnected(true);
        setStatusText("已連線伺服器");
        void fetchRooms();

        const storedRoomId = currentRoomIdRef.current;
        if (storedRoomId) {
          socket.emit(
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
      },
      onDisconnect: () => {
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
      },
      onRoomsUpdated: (updatedRooms: RoomSummary[]) => {
        setRooms(updatedRooms);
        if (isInviteMode && inviteRoomId) {
          const found = updatedRooms.some((r) => r.id === inviteRoomId);
          setInviteNotFound(!found);
          if (!found) {
            setStatusText("受邀房間不存在或已關閉");
          }
        }
      },
      onJoinedRoom: (state) => {
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
      },
      onParticipantsUpdated: ({ roomId, participants, hostClientId }) => {
        if (roomId !== currentRoomIdRef.current) return;
        setParticipants(participants);
        setCurrentRoom((prev) => (prev ? { ...prev, hostClientId } : prev));
      },
      onUserLeft: ({ roomId, clientId: leftId }) => {
        if (roomId !== currentRoomIdRef.current) return;
        setParticipants((prev) => prev.filter((p) => p.clientId !== leftId));
      },
      onPlaylistProgress: ({ roomId, receivedCount, totalCount, ready }) => {
        if (roomId !== currentRoomIdRef.current) return;
        setPlaylistProgress({
          received: receivedCount,
          total: totalCount,
          ready,
        });
      },
      onPlaylistUpdated: ({ roomId, playlist }) => {
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
      },
      onMessageAdded: ({ roomId, message }) => {
        if (roomId !== currentRoomIdRef.current) return;
        setMessages((prev) => [...prev, message]);
      },
      onGameStarted: ({ roomId, gameState, serverNow }) => {
        if (roomId !== currentRoomIdRef.current) return;
        syncServerOffset(serverNow);
        setGameState(gameState);
        setIsGameView(true);
        void fetchCompletePlaylist(roomId).then(setGamePlaylist);
        setStatusText("遊戲已開始，切換至遊戲頁面");
      },
      onGameUpdated: ({ roomId, gameState, serverNow }) => {
        if (roomId !== currentRoomIdRef.current) return;
        syncServerOffset(serverNow);
        setGameState(gameState);
        if (gameState?.status === "playing") {
          setIsGameView(true);
        }
      },
    });

      socketRef.current = s;
    };

    void init();

    return () => {
      cancelled = true;
      disconnectRoomSocket(socketRef.current);
      socketRef.current = null;
    };
  }, [
    username,
    clientId,
    authToken,
    refreshAuthToken,
    fetchCompletePlaylist,
    fetchPlaylistPage,
    fetchRooms,
    inviteRoomId,
    isInviteMode,
    persistRoomId,
    syncServerOffset,
  ]);

  const handleCreateRoom = useCallback(async () => {
    const s = getSocket();
    if (!s || !username) {
      setStatusText("尚未設定使用者名稱");
      return;
    }
    if (authToken) {
      const token = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!token) {
        setStatusText("登入已過期，請重新登入");
        return;
      }
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
    const normalizedItems = normalizePlaylistItems(playlistItems);
    const firstChunk = normalizedItems.slice(0, CHUNK_SIZE);
    const remaining = normalizedItems.slice(CHUNK_SIZE);
    const isLast = remaining.length === 0;

    const payload = {
      roomName: trimmed,
      username,
      password: roomPasswordInput.trim() || undefined,
      gameSettings: {
        questionCount: clampQuestionCount(
          questionCount,
          getQuestionMax(normalizedItems.length),
        ),
      },
      playlist: {
        uploadId,
        id: lastFetchedPlaylistId,
        totalCount: normalizedItems.length,
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
  }, [
    authToken,
    fetchPlaylistPage,
    getSocket,
    lastFetchedPlaylistId,
    lastFetchedPlaylistTitle,
    playlistItems,
    questionCount,
    refreshAuthToken,
    roomNameInput,
    roomPasswordInput,
    saveRoomPassword,
    syncServerOffset,
    username,
    persistRoomId,
  ]);

  const handleJoinRoom = useCallback((roomId: string, hasPassword: boolean) => {
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
  }, [
    fetchCompletePlaylist,
    fetchPlaylistPage,
    getSocket,
    joinPasswordInput,
    persistRoomId,
    syncServerOffset,
    username,
  ]);

  const handleLeaveRoom = useCallback((onLeft?: () => void) => {
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
  }, [currentRoom, getSocket, persistRoomId]);

  const handleSendMessage = useCallback(() => {
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
  }, [currentRoom, getSocket, messageInput]);

  const handleStartGame = useCallback(() => {
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
  }, [
    currentRoom,
    fetchCompletePlaylist,
    getSocket,
    playlistProgress.ready,
    syncServerOffset,
  ]);

  useEffect(() => {
    if (gameState?.status === "ended" && isGameView) {
      setIsGameView(false);
      setStatusText("遊戲已結束，返回聊天室");
    }
  }, [gameState?.status, isGameView]);

  const handleSubmitChoice = useCallback((choiceIndex: number) => {
    const s = getSocket();
    if (!s || !currentRoom || !gameState) return;
    if (gameState.phase !== "guess") return;
    s.emit("submitAnswer", { roomId: currentRoom.id, choiceIndex }, (ack) => {
      if (ack && !ack.ok) {
        setStatusText(`提交答案失敗：{ack.error}`);
      }
    });
  }, [currentRoom, gameState, getSocket]);

  const resetCreateState = useCallback(() => {
    setRoomNameInput(username ? `${username}'s room` : "我的房間");
    setRoomPasswordInput("");
    resetPlaylistState();
    resetCollectionSelection();
    clearCollectionsError();
    setPlaylistViewItems([]);
    setPlaylistHasMore(false);
    setPlaylistLoadingMore(false);
    setPlaylistPageCursor(1);
    setPlaylistPageSize(DEFAULT_PAGE_SIZE);
    setPlaylistProgress({ received: 0, total: 0, ready: false });
  }, [clearCollectionsError, resetCollectionSelection, resetPlaylistState, username]);

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
    fetchPlaylistPage,
  ]);

  useEffect(() => {
    if (playlistItems.length === 0) return;
    if (questionCount > questionMaxLimit) {
      handleUpdateQuestionCount(questionMaxLimit);
    }
  }, [handleUpdateQuestionCount, playlistItems.length, questionCount, questionMaxLimit]);

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
        refreshAuthToken,
        loginWithGoogle,
        logout,
      needsNicknameConfirm,
      nicknameDraft,
      setNicknameDraft,
      confirmNickname,
      isProfileEditorOpen,
      openProfileEditor,
      closeProfileEditor,
      youtubePlaylists,
      youtubePlaylistsLoading,
      youtubePlaylistsError,
      fetchYoutubePlaylists,
      importYoutubePlaylist,
      collections,
      collectionsLoading,
      collectionsError,
      selectedCollectionId,
      collectionItemsLoading,
      collectionItemsError,
      fetchCollections,
      selectCollection,
      loadCollectionItems,
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
        lastFetchedPlaylistTitle,
      playlistViewItems,
      playlistHasMore,
      playlistLoadingMore,
      playlistPageCursor,
      playlistPageSize,
      playlistProgress,
      questionCount,
      questionMin,
      questionMax: QUESTION_MAX,
      questionStep,
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
      updateQuestionCount: handleUpdateQuestionCount,
      syncServerOffset,
      fetchRooms,
      fetchRoomById,
      resetCreateState,
    }),
    [
        authToken,
        authUser,
        authLoading,
        refreshAuthToken,
        loginWithGoogle,
        logout,
      needsNicknameConfirm,
      nicknameDraft,
      setNicknameDraft,
      confirmNickname,
      isProfileEditorOpen,
      openProfileEditor,
      closeProfileEditor,
      youtubePlaylists,
      youtubePlaylistsLoading,
      youtubePlaylistsError,
      fetchYoutubePlaylists,
      importYoutubePlaylist,
      collections,
      collectionsLoading,
      collectionsError,
      selectedCollectionId,
      collectionItemsLoading,
      collectionItemsError,
      fetchCollections,
      selectCollection,
      loadCollectionItems,
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
      questionMin,
      questionStep,
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
      setPlaylistUrl,
      handleSetUsername,
      handleCreateRoom,
      handleJoinRoom,
      handleLeaveRoom,
      handleSendMessage,
      handleStartGame,
      handleSubmitChoice,
      syncServerOffset,
      handleFetchPlaylist,
      handleResetPlaylist,
      loadMorePlaylist,
      handleUpdateQuestionCount,
      fetchRooms,
      fetchRoomById,
      resetCreateState,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
