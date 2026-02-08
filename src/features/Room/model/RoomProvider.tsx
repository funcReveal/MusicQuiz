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
  PlaylistSuggestion,
  RoomParticipant,
  RoomState,
  RoomSummary,
} from "./types";
import { RoomContext, type RoomContextValue } from "./RoomContext";
import {
  API_URL,
  CHUNK_SIZE,
  DEFAULT_CLIP_SEC,
  DEFAULT_PAGE_SIZE,
  QUESTION_MAX,
  SOCKET_URL,
  WORKER_API_URL,
} from "./roomConstants";
import {
  clampQuestionCount,
  formatSeconds,
  getQuestionMax,
  normalizePlaylistItems,
  thumbnailFromId,
  videoUrlFromId,
} from "./roomUtils";
import { ensureFreshAuthToken } from "../../../shared/auth/token";
import {
  clearRoomPassword,
  clearStoredRoomId,
  clearStoredSessionClientId,
  clearStoredUsername,
  getOrCreateClientId,
  getRoomPassword,
  getStoredSessionClientId,
  getStoredRoomId,
  getStoredUsername,
  setRoomPassword,
  setStoredSessionClientId,
  setStoredQuestionCount,
  setStoredRoomId,
  setStoredUsername,
} from "./roomStorage";
import {
  apiFetchCollectionItems,
  apiCreateCollectionReadToken,
  apiFetchRoomById,
  apiFetchRooms,
  apiPreviewPlaylist,
  apiFetchYoutubePlaylistItems,
  type WorkerCollectionItem,
} from "./roomApi";
import { connectRoomSocket, disconnectRoomSocket } from "./roomSocket";
import { useRoomAuth } from "./useRoomAuth";
import { useRoomPlaylist } from "./useRoomPlaylist";
import { useRoomCollections } from "./useRoomCollections";

const mapCollectionItemsToPlaylist = (
  collectionId: string,
  items: WorkerCollectionItem[],
) =>
  items.flatMap((item, index) => {
    const startSec = Math.max(0, item.start_sec ?? 0);
    const endSec =
      typeof item.end_sec === "number"
        ? item.end_sec
        : startSec + DEFAULT_CLIP_SEC;
    const safeEnd = Math.max(startSec + 1, endSec);
    const videoId = item.source_id?.trim() ?? "";
    if (!videoId) return [];
    const durationValue =
      typeof item.duration_sec === "number" && item.duration_sec > 0
        ? formatSeconds(item.duration_sec)
        : formatSeconds(safeEnd - startSec);
    const rawTitle = item.title ?? item.answer_text ?? `歌曲 ${index + 1}`;
    const answerText = item.answer_text ?? rawTitle;
    return {
      title: rawTitle,
      answerText,
      url: videoUrlFromId(videoId),
      thumbnail: thumbnailFromId(videoId),
      uploader: item.channel_title ?? undefined,
      duration: durationValue,
      startSec,
      endSec: safeEnd,
      videoId,
      sourceId: collectionId,
      provider: "collection",
    };
  });

const extractVideoIdFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const vid = parsed.searchParams.get("v");
    if (vid) return vid;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.pop() || null;
  } catch {
    try {
      const parsed = new URL(`https://${url}`);
      const vid = parsed.searchParams.get("v");
      if (vid) return vid;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.pop() || null;
    } catch {
      const match =
        url.match(/[?&]v=([^&]+)/) ||
        url.match(/youtu\.be\/([^?&]+)/) ||
        url.match(/youtube\.com\/embed\/([^?&]+)/);
      return match?.[1] ?? null;
    }
  }
};

const formatAckError = (prefix: string, error?: string) => {
  const detail = error?.trim();
  return `${prefix}：${detail || "未知錯誤"}`;
};

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
  const [sessionClientId, setSessionClientId] = useState<string>(
    () => getStoredSessionClientId() ?? localClientId,
  );
  const [sessionClientIdLocked, setSessionClientIdLocked] = useState(() =>
    Boolean(getStoredSessionClientId()),
  );
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
  const [playlistSuggestions, setPlaylistSuggestions] = useState<
    PlaylistSuggestion[]
  >([]);
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
    authExpired,
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
    () =>
      sessionClientIdLocked
        ? sessionClientId
        : authClientId ?? localClientId,
    [authClientId, localClientId, sessionClientId, sessionClientIdLocked],
  );
  const lockSessionClientId = useCallback((nextClientId: string) => {
    setSessionClientId(nextClientId);
    setStoredSessionClientId(nextClientId);
    setSessionClientIdLocked(true);
  }, []);
  const resetSessionClientId = useCallback(() => {
    clearStoredSessionClientId();
    setSessionClientId(authClientId ?? localClientId);
    setSessionClientIdLocked(false);
  }, [authClientId, localClientId]);

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

  const fetchYoutubeSnapshot = useCallback(
    async (playlistId: string) => {
      if (!API_URL) {
        throw new Error("尚未設定播放清單 API 位置 (API_URL)");
      }
      if (!authToken) {
        throw new Error("請先登入後再使用私人播放清單");
      }
      const token = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!token) {
        throw new Error("登入已過期，需要重新授權 Google");
      }
      const run = async (token: string, allowRetry: boolean) => {
        const { ok, status, payload } = await apiFetchYoutubePlaylistItems(
          API_URL,
          token,
          playlistId,
        );
        if (ok) {
          const data = payload?.data;
          if (!data?.items || data.items.length === 0) {
            throw new Error("清單沒有可用影片");
          }
          const normalized = normalizePlaylistItems(
            data.items.map((item) => {
              const resolvedVideoId =
                item.videoId ?? extractVideoIdFromUrl(item.url);
              return {
                ...item,
                ...(resolvedVideoId ? { videoId: resolvedVideoId } : {}),
                sourceId: data.playlistId ?? playlistId,
                provider: "youtube",
              };
            }),
          );
          const title =
            youtubePlaylists.find((item) => item.id === playlistId)?.title ??
            null;
          return {
            items: normalized,
            title,
            totalCount: normalized.length,
            sourceId: data.playlistId ?? playlistId,
          };
        }
        if (status === 401 && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return await run(refreshed, false);
          }
        }
        const message = payload?.error ?? "讀取播放清單失敗";
        throw new Error(message);
      };

      return await run(token, true);
    },
    [authToken, refreshAuthToken, youtubePlaylists],
  );

  const fetchPublicPlaylistSnapshot = useCallback(
    async (url: string, playlistId: string) => {
      if (!API_URL) {
        throw new Error("尚未設定播放清單 API 位置 (API_URL)");
      }
      const { ok, payload } = await apiPreviewPlaylist(
        API_URL,
        url,
        playlistId,
      );
      if (!ok || !payload) {
        throw new Error("讀取播放清單失敗，請稍後重試");
      }
      if ("error" in payload) {
        throw new Error(payload.error || "讀取播放清單失敗，請稍後重試");
      }
      const data = payload;
      if (!data?.items || data.items.length === 0) {
        throw new Error(
          "清單沒有可用影片，可能為私人/受限或自動合輯不受支援。",
        );
      }
      const normalized = normalizePlaylistItems(
        data.items.map((item) => {
          const resolvedVideoId =
            item.videoId ?? extractVideoIdFromUrl(item.url);
          return {
            ...item,
            ...(resolvedVideoId ? { videoId: resolvedVideoId } : {}),
            sourceId: data.playlistId ?? playlistId,
            provider: "youtube",
          };
        }),
      );
      return {
        items: normalized,
        title: data.title ?? null,
        totalCount: normalized.length,
        sourceId: data.playlistId ?? playlistId,
      };
    },
    [],
  );

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

  const fetchCollectionSnapshot = useCallback(
    async (collectionId: string) => {
      if (!WORKER_API_URL) {
        throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
      }
      if (!collectionId) {
        throw new Error("請先選擇收藏庫");
      }
      const tokenToUse = authToken
        ? await ensureFreshAuthToken({ token: authToken, refreshAuthToken })
        : null;
      if (authToken && !tokenToUse) {
        throw new Error("登入已過期，請重新登入");
      }
      const run = async (token: string | null, allowRetry: boolean) => {
        const { ok, status, payload } = await apiFetchCollectionItems(
          WORKER_API_URL,
          token,
          collectionId,
        );
        if (ok) {
          const items = payload?.data?.items ?? [];
          if (items.length === 0) {
            throw new Error("收藏庫內沒有歌曲");
          }
          return normalizePlaylistItems(
            mapCollectionItemsToPlaylist(collectionId, items),
          );
        }
        if (status === 401 && allowRetry && token) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return await run(refreshed, false);
          }
        }
        throw new Error(payload?.error ?? "載入收藏庫失敗");
      };
      return await run(tokenToUse, Boolean(tokenToUse));
    },
      [authToken, refreshAuthToken],
    );

  const createCollectionReadToken = useCallback(
    async (collectionId: string) => {
      if (!WORKER_API_URL) {
        throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
      }
      if (!authToken) {
        throw new Error("請先登入後再推薦私人收藏庫");
      }
      const tokenToUse = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!tokenToUse) {
        throw new Error("登入已過期，請重新登入");
      }
      const run = async (token: string, allowRetry: boolean) => {
        const { ok, status, payload } = await apiCreateCollectionReadToken(
          WORKER_API_URL,
          token,
          collectionId,
        );
        if (ok && payload?.data?.token) return payload.data.token;
        if (status === 401 && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return await run(refreshed, false);
          }
        }
        throw new Error(payload?.error ?? "取得收藏庫讀取權杖失敗");
      };
      return await run(tokenToUse, true);
    },
    [authToken, refreshAuthToken],
  );

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
    if (!username || authLoading) return;
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
                lockSessionClientId(clientId);
                persistRoomId(state.room.id);
                setStatusText(`恢復房間：${state.room.name}`);
                setRouteRoomResolved(true);
              } else {
                if (ack?.error) {
                  setStatusText(formatAckError("恢復房間失敗", ack.error));
                }
                persistRoomId(null);
                resetSessionClientId();
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
        setPlaylistSuggestions([]);
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
        setPlaylistSuggestions([]);
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
        lockSessionClientId(clientId);
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
      onRoomUpdated: ({ room }) => {
        if (room.id !== currentRoomIdRef.current) return;
        setCurrentRoom((prev) => (prev ? { ...prev, ...room } : prev));
      },
      onKicked: ({ roomId, reason, bannedUntil }) => {
        if (roomId !== currentRoomIdRef.current) return;
        const suffix =
          typeof bannedUntil === "number"
            ? `，可重新加入時間：${new Date(bannedUntil).toLocaleTimeString()}`
            : "，已永久禁止加入";
        setStatusText(`${reason}${suffix}`);
        setCurrentRoom(null);
        setParticipants([]);
        setMessages([]);
        setGameState(null);
        setGamePlaylist([]);
        setIsGameView(false);
        setPlaylistViewItems([]);
        setPlaylistHasMore(false);
        setPlaylistLoadingMore(false);
        setPlaylistSuggestions([]);
        persistRoomId(null);
        resetSessionClientId();
      },
      onPlaylistSuggestionsUpdated: ({ roomId, suggestions }) => {
        if (roomId !== currentRoomIdRef.current) return;
        setPlaylistSuggestions(suggestions);
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
    authLoading,
    clientId,
    authToken,
    refreshAuthToken,
    fetchCompletePlaylist,
    fetchPlaylistPage,
    fetchRooms,
    inviteRoomId,
    isInviteMode,
    lockSessionClientId,
    persistRoomId,
    resetSessionClientId,
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
        lockSessionClientId(clientId);
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
        setStatusText(formatAckError("建立房間失敗", ack.error));
      }
    });
  }, [
    authToken,
    clientId,
    fetchPlaylistPage,
    getSocket,
    lastFetchedPlaylistId,
    lockSessionClientId,
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
          lockSessionClientId(clientId);
          persistRoomId(state.room.id);
          setJoinPasswordInput("");
          setStatusText(`已加入房間：${state.room.name}`);
        } else {
          setStatusText(formatAckError("加入房間失敗", ack.error));
        }
      },
    );
  }, [
    clientId,
    fetchCompletePlaylist,
    fetchPlaylistPage,
    getSocket,
    joinPasswordInput,
    lockSessionClientId,
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
        setPlaylistSuggestions([]);
        persistRoomId(null);
        resetSessionClientId();
        setStatusText("已離開房間");
        onLeft?.();
      } else {
        setStatusText(formatAckError("離開房間失敗", ack.error));
      }
    });
  }, [currentRoom, getSocket, persistRoomId, resetSessionClientId]);

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
        setStatusText(formatAckError("訊息送出失敗", ack.error));
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
          setStatusText(formatAckError("開始遊戲失敗", ack.error));
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
        setStatusText(formatAckError("提交答案失敗", ack.error));
      }
    });
  }, [currentRoom, gameState, getSocket]);

  const handleUpdateRoomSettings = useCallback(
    async (payload: {
      name?: string;
      visibility?: "public" | "private";
      password?: string | null;
      questionCount?: number;
      maxPlayers?: number | null;
    }) => {
      const s = getSocket();
      if (!s || !currentRoom) {
        setStatusText("尚未加入任何房間");
        return false;
      }
      return await new Promise<boolean>((resolve) => {
        s.emit(
          "updateRoomSettings",
          { roomId: currentRoom.id, ...payload },
          (ack: Ack<{ room: RoomSummary }>) => {
            if (!ack) {
              resolve(false);
              return;
            }
            if (!ack.ok) {
              setStatusText(formatAckError("更新房間設定失敗", ack.error));
              resolve(false);
              return;
            }
            setCurrentRoom((prev) =>
              prev ? { ...prev, ...ack.data.room } : prev,
            );
            if (payload.password !== undefined) {
              const trimmed = payload.password?.trim() ?? "";
              const nextPassword = trimmed ? trimmed : null;
              saveRoomPassword(currentRoom.id, nextPassword);
              setHostRoomPassword(nextPassword);
            }
            setStatusText("房間設定已更新");
            resolve(true);
          },
        );
      });
    },
    [currentRoom, getSocket, saveRoomPassword, setStatusText],
  );

  const handleKickPlayer = useCallback(
    (targetClientId: string, durationMs?: number | null) => {
      const s = getSocket();
      if (!s || !currentRoom) return;
      s.emit(
        "kickPlayer",
        { roomId: currentRoom.id, targetClientId, durationMs },
        (ack: Ack<null>) => {
          if (!ack) return;
          if (!ack.ok) {
            setStatusText(formatAckError("踢出失敗", ack.error));
          }
        },
      );
    },
    [currentRoom, getSocket],
  );

  const handleTransferHost = useCallback(
    (targetClientId: string) => {
      const s = getSocket();
      if (!s || !currentRoom) return;
      s.emit(
        "transferHost",
        { roomId: currentRoom.id, targetClientId },
        (ack: Ack<{ hostClientId: string }>) => {
          if (!ack) return;
          if (!ack.ok) {
            setStatusText(formatAckError("轉移房主失敗", ack.error));
          }
        },
      );
    },
    [currentRoom, getSocket],
  );

  const handleSuggestPlaylist = useCallback(
    async (
      type: "collection" | "playlist",
      value: string,
      options?: { useSnapshot?: boolean; sourceId?: string | null; title?: string | null },
    ) => {
      const s = getSocket();
      if (!s || !currentRoom) {
        const error = "尚未加入任何房間";
        setStatusText(error);
        return { ok: false, error };
      }
      if (gameState?.status === "playing") {
        const error = "遊戲進行中無法推薦";
        setStatusText(error);
        return { ok: false, error };
      }
        let snapshot:
          | { items: PlaylistItem[]; title?: string | null; totalCount?: number; sourceId?: string | null }
          | undefined;
        let readToken: string | null = null;
        if (options?.useSnapshot) {
          try {
            if (type === "collection") {
              const selectedCollection = collections.find(
                (item) => item.id === value,
              );
              const isPrivateCollection =
                selectedCollection?.visibility === "private";
              if (isPrivateCollection) {
                if (!authUser?.id) {
                  throw new Error("請先登入後再推薦私人收藏庫");
                }
                readToken = await createCollectionReadToken(value);
              }
              const items = await fetchCollectionSnapshot(value);
              snapshot = {
                items,
                title: options?.title ?? null,
                totalCount: items.length,
              sourceId: options?.sourceId ?? value,
            };
          } else {
            const playlistId = options?.sourceId;
            if (!playlistId) {
              throw new Error("請輸入有效的播放清單 URL");
            }
            const result = authToken
              ? await fetchYoutubeSnapshot(playlistId)
              : await fetchPublicPlaylistSnapshot(value, playlistId);
            snapshot = {
              items: result.items,
              title: result.title ?? options?.title ?? null,
              totalCount: result.totalCount,
              sourceId: result.sourceId ?? playlistId,
            };
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "推薦失敗";
          setStatusText(message);
          return { ok: false, error: message };
        }
      }
      return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        s.emit(
          "suggestPlaylist",
            {
              roomId: currentRoom.id,
              type,
              value,
              title: snapshot?.title ?? undefined,
              totalCount: snapshot?.totalCount,
              sourceId: snapshot?.sourceId ?? undefined,
              items: snapshot?.items,
              readToken: readToken ?? undefined,
            },
          (ack: Ack<null>) => {
            if (!ack) {
              resolve({ ok: false, error: "推薦失敗，請稍後再試" });
              return;
            }
            if (!ack.ok) {
              const message = formatAckError("推薦失敗", ack.error);
              setStatusText(message);
              resolve({ ok: false, error: message });
              return;
            }
            setStatusText("已送出推薦");
            resolve({ ok: true });
          },
        );
      });
    },
      [
        authToken,
        authUser,
        collections,
        currentRoom,
        fetchPublicPlaylistSnapshot,
        fetchCollectionSnapshot,
        fetchYoutubeSnapshot,
        createCollectionReadToken,
        gameState,
        getSocket,
        setStatusText,
      ],
    );

  const handleFetchPlaylistByUrl = useCallback(
    async (url: string) => {
      handleResetPlaylist();
      setPlaylistUrl(url);
      await handleFetchPlaylist({ url, force: true, lock: false });
    },
    [handleFetchPlaylist, handleResetPlaylist, setPlaylistUrl],
  );

  const handleChangePlaylist = useCallback(async () => {
    const s = getSocket();
    if (!s || !currentRoom) return;
    if (gameState?.status === "playing") {
      setStatusText("遊戲進行中無法切換歌單");
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

    s.emit(
      "changePlaylist",
      {
        roomId: currentRoom.id,
        playlist: {
          uploadId,
          id: lastFetchedPlaylistId,
          title: lastFetchedPlaylistTitle ?? undefined,
          totalCount: normalizedItems.length,
          items: firstChunk,
          isLast,
          pageSize: DEFAULT_PAGE_SIZE,
        },
      },
      async (ack: Ack<{ receivedCount: number; totalCount: number; ready: boolean }>) => {
        if (!ack) return;
        if (!ack.ok) {
          setStatusText(formatAckError("切換歌單失敗", ack.error));
          return;
        }
        if (remaining.length > 0) {
          for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
            const chunk = remaining.slice(i, i + CHUNK_SIZE);
            const isLastChunk = i + CHUNK_SIZE >= remaining.length;
            await new Promise<void>((resolve) => {
              s.emit(
                "uploadPlaylistChunk",
                {
                  roomId: currentRoom.id,
                  uploadId,
                  items: chunk,
                  isLast: isLastChunk,
                },
                () => resolve(),
              );
            });
          }
        }
        setStatusText("已切換歌單，等待房主開始遊戲");
      },
    );
  }, [
    currentRoom,
    gameState?.status,
    getSocket,
    lastFetchedPlaylistId,
    lastFetchedPlaylistTitle,
    playlistItems,
    setStatusText,
  ]);

  const handleApplySuggestionSnapshot = useCallback(
    async (suggestion: PlaylistSuggestion) => {
      const s = getSocket();
      if (!s || !currentRoom) return;
      if (gameState?.status === "playing") {
        setStatusText("遊戲進行中無法切換歌單");
        return;
      }
      const items = suggestion.items ?? [];
      if (items.length === 0) {
        setStatusText("推薦內容沒有可用歌曲");
        return;
      }
      const normalizedItems = normalizePlaylistItems(items);
      const uploadId =
        crypto.randomUUID?.() ??
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
      const firstChunk = normalizedItems.slice(0, CHUNK_SIZE);
      const remaining = normalizedItems.slice(CHUNK_SIZE);
      const isLast = remaining.length === 0;
      const sourceId =
        suggestion.sourceId ??
        (suggestion.type === "collection" ? suggestion.value : undefined);
      const title = suggestion.title ?? undefined;

        s.emit(
          "changePlaylist",
          {
            roomId: currentRoom.id,
            playlist: {
              uploadId,
              id: sourceId ?? undefined,
              title,
              totalCount: normalizedItems.length,
              items: firstChunk,
              isLast,
              pageSize: DEFAULT_PAGE_SIZE,
            },
          },
          async (ack: Ack<{ receivedCount: number; totalCount: number; ready: boolean }>) => {
            if (!ack) return;
            if (!ack.ok) {
              setStatusText(formatAckError("切換歌單失敗", ack.error));
              return;
            }
            applyPlaylistSource(
              normalizedItems,
              sourceId ?? uploadId,
              title ?? null,
            );
            if (remaining.length > 0) {
              for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
                const chunk = remaining.slice(i, i + CHUNK_SIZE);
                const isLastChunk = i + CHUNK_SIZE >= remaining.length;
              await new Promise<void>((resolve) => {
                s.emit(
                  "uploadPlaylistChunk",
                  {
                    roomId: currentRoom.id,
                    uploadId,
                    items: chunk,
                    isLast: isLastChunk,
                  },
                  () => resolve(),
                );
              });
            }
          }
          setStatusText("已切換歌單，等待房主開始遊戲");
        },
      );
    },
      [applyPlaylistSource, currentRoom, gameState?.status, getSocket, setStatusText],
    );

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
      authExpired,
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
      playlistSuggestions,
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
      handleUpdateRoomSettings,
      handleKickPlayer,
      handleTransferHost,
      handleSuggestPlaylist,
      handleApplySuggestionSnapshot,
      handleChangePlaylist,
      handleFetchPlaylistByUrl,
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
      authExpired,
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
      lastFetchedPlaylistTitle,
      playlistViewItems,
      playlistHasMore,
      playlistLoadingMore,
      playlistPageCursor,
      playlistPageSize,
      playlistProgress,
      playlistSuggestions,
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
      handleUpdateRoomSettings,
      handleKickPlayer,
      handleTransferHost,
      handleSuggestPlaylist,
      handleApplySuggestionSnapshot,
      handleChangePlaylist,
      handleFetchPlaylistByUrl,
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
