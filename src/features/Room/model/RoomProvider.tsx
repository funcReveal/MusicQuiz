import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

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
import {
  RoomContext,
  type RoomContextValue,
  type RoomCreateSourceMode,
} from "./RoomContext";
import {
  API_URL,
  CHUNK_SIZE,
  DEFAULT_CLIP_SEC,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PLAY_DURATION_SEC,
  DEFAULT_START_OFFSET_SEC,
  PLAYER_MAX,
  PLAYER_MIN,
  QUESTION_MAX,
  QUESTION_MIN,
  SOCKET_URL,
  WORKER_API_URL,
} from "./roomConstants";
import {
  clampPlayDurationSec,
  clampQuestionCount,
  clampStartOffsetSec,
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

const ANSWER_SUBMIT_GUARD_MS = 120;

const mapCollectionItemsToPlaylist = (
  collectionId: string,
  items: WorkerCollectionItem[],
) =>
  items.flatMap((item, index) => {
    const startSec = Math.max(0, item.start_sec ?? 0);
    const explicitEndSec =
      typeof item.end_sec === "number" && item.end_sec > startSec
        ? item.end_sec
        : null;
    const hasExplicitEndSec = explicitEndSec !== null;
    const hasExplicitStartSec = startSec > 0;
    const safeEnd = Math.max(
      startSec + 1,
      explicitEndSec ?? startSec + DEFAULT_CLIP_SEC,
    );
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
      hasExplicitStartSec,
      hasExplicitEndSec,
      collectionClipStartSec: startSec,
      collectionClipEndSec: explicitEndSec ?? undefined,
      collectionHasExplicitStartSec: hasExplicitStartSec,
      collectionHasExplicitEndSec: hasExplicitEndSec,
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

const normalizeQuestionCount = (value: number | undefined, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};

type RoomGameSettings = NonNullable<RoomSummary["gameSettings"]>;

const mergeGameSettings = (
  current: RoomSummary["gameSettings"] | undefined,
  incoming: Partial<RoomGameSettings> | undefined,
): RoomGameSettings => {
  const fallbackQuestionCount = normalizeQuestionCount(
    current?.questionCount,
    QUESTION_MIN,
  );
  return {
    questionCount: normalizeQuestionCount(
      incoming?.questionCount,
      fallbackQuestionCount,
    ),
    playDurationSec: clampPlayDurationSec(
      incoming?.playDurationSec ??
        current?.playDurationSec ??
        DEFAULT_PLAY_DURATION_SEC,
    ),
    startOffsetSec: clampStartOffsetSec(
      incoming?.startOffsetSec ??
        current?.startOffsetSec ??
        DEFAULT_START_OFFSET_SEC,
    ),
    allowCollectionClipTiming:
      incoming?.allowCollectionClipTiming ??
      current?.allowCollectionClipTiming ??
      true,
  };
};

const applyGameSettingsPatch = (
  room: RoomState["room"],
  patch: Partial<RoomGameSettings>,
): RoomState["room"] => ({
  ...room,
  gameSettings: mergeGameSettings(room.gameSettings, {
    ...room.gameSettings,
    ...patch,
  }),
});

const buildUploadPlaylistItems = (
  sourceItems: PlaylistItem[],
  options: {
    playDurationSec: number;
    startOffsetSec: number;
    allowCollectionClipTiming: boolean;
  },
): PlaylistItem[] => {
  const roomPlayDurationSec = clampPlayDurationSec(options.playDurationSec);
  const roomStartOffsetSec = clampStartOffsetSec(options.startOffsetSec);
  return normalizePlaylistItems(sourceItems).map((item) => {
    const itemStartSec = Math.max(0, item.startSec ?? 0);
    const rawHasExplicitEndSec =
      typeof item.hasExplicitEndSec === "boolean"
        ? item.hasExplicitEndSec
        : typeof item.endSec === "number" && item.endSec > itemStartSec;
    const rawHasExplicitStartSec =
      typeof item.hasExplicitStartSec === "boolean"
        ? item.hasExplicitStartSec
        : itemStartSec > 0 || rawHasExplicitEndSec;
    const collectionClipStartSec = Math.max(
      0,
      item.collectionClipStartSec ?? itemStartSec,
    );
    const inferredTrackClip = item.timingSource === "track_clip";
    const collectionHasExplicitStartSec =
      typeof item.collectionHasExplicitStartSec === "boolean"
        ? item.collectionHasExplicitStartSec
        : inferredTrackClip
          ? rawHasExplicitStartSec
          : false;
    const collectionHasExplicitEndSec =
      typeof item.collectionHasExplicitEndSec === "boolean"
        ? item.collectionHasExplicitEndSec
        : inferredTrackClip
          ? rawHasExplicitEndSec
          : false;
    const collectionClipEndSec =
      typeof item.collectionClipEndSec === "number" &&
      item.collectionClipEndSec > collectionClipStartSec
        ? item.collectionClipEndSec
        : collectionHasExplicitEndSec &&
            typeof item.endSec === "number" &&
            item.endSec > collectionClipStartSec
          ? item.endSec
          : undefined;
    const isCollectionItem = item.provider === "collection";
    const useTrackClip =
      options.allowCollectionClipTiming &&
      isCollectionItem &&
      (collectionHasExplicitStartSec || collectionHasExplicitEndSec);
    const startSec = useTrackClip ? collectionClipStartSec : roomStartOffsetSec;
    const fallbackEndSec = startSec + roomPlayDurationSec;
    const itemEndSec =
      useTrackClip && collectionHasExplicitEndSec && collectionClipEndSec
        ? collectionClipEndSec
        : fallbackEndSec;
    const endSec = Math.max(startSec + 1, useTrackClip ? itemEndSec : fallbackEndSec);
    return {
      ...item,
      startSec,
      endSec,
      hasExplicitStartSec: useTrackClip ? collectionHasExplicitStartSec : false,
      hasExplicitEndSec: useTrackClip ? collectionHasExplicitEndSec : false,
      collectionClipStartSec,
      collectionClipEndSec,
      collectionHasExplicitStartSec,
      collectionHasExplicitEndSec,
      timingSource: useTrackClip
        ? ("track_clip" as const)
        : ("room_settings" as const),
    };
  });
};

const mergeRoomSummaryIntoCurrentRoom = (
  current: RoomState["room"],
  summary: RoomSummary,
): RoomState["room"] => ({
  ...current,
  ...summary,
  gameSettings: mergeGameSettings(current.gameSettings, summary.gameSettings),
});

export const RoomProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { pathname } = useLocation();
  const shouldConnectSocket =
    pathname.startsWith("/rooms") || pathname.startsWith("/invited");
  const socketSuspendedRef = useRef(false);

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
  const [roomVisibilityInput, setRoomVisibilityInput] = useState<
    "public" | "private"
  >("public");
  const [roomCreateSourceMode, setRoomCreateSourceMode] =
    useState<RoomCreateSourceMode>("link");
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [roomMaxPlayersInput, setRoomMaxPlayersInput] = useState("");
  const [playDurationSec, setPlayDurationSec] = useState(
    DEFAULT_PLAY_DURATION_SEC,
  );
  const [startOffsetSec, setStartOffsetSec] = useState(
    DEFAULT_START_OFFSET_SEC,
  );
  const [allowCollectionClipTiming, setAllowCollectionClipTiming] =
    useState(true);
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
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
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
  const createRoomInFlightRef = useRef(false);
  const pendingAnswerSubmitRef = useRef<{
    roomId: string;
    trackKey: string;
    choiceIndex: number;
  } | null>(null);
  const answerSubmitTimerRef = useRef<number | null>(null);
  const lastAnswerSubmitAtRef = useRef(0);
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

  const handleUpdatePlayDurationSec = useCallback((value: number) => {
    const clamped = clampPlayDurationSec(value);
    setPlayDurationSec(clamped);
    return clamped;
  }, []);

  const handleUpdateStartOffsetSec = useCallback((value: number) => {
    const clamped = clampStartOffsetSec(value);
    setStartOffsetSec(clamped);
    return clamped;
  }, []);

  const handleUpdateAllowCollectionClipTiming = useCallback((value: boolean) => {
    setAllowCollectionClipTiming(Boolean(value));
    return Boolean(value);
  }, []);

  const {
    collections,
    collectionsLoading,
    collectionsError,
    collectionScope,
    collectionsLastFetchedAt,
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
                  resolve(normalizePlaylistItems(aggregated));
                }
              } else {
                resolve(normalizePlaylistItems(aggregated));
              }
            },
          );
        };

        loadPage(1);
      }),
    [getSocket, playlistPageSize],
  );

  const syncRoomPlaylistTiming = useCallback(
    async (
      room: RoomState["room"],
      gameSettingsOverride?: Partial<RoomGameSettings>,
    ) => {
      const s = getSocket();
      if (!s) return false;
      const sourceItems = await fetchCompletePlaylist(room.id);
      if (sourceItems.length === 0) return false;
      const gameSettings = mergeGameSettings(
        room.gameSettings,
        gameSettingsOverride,
      );
      const uploadItems = buildUploadPlaylistItems(sourceItems, {
        playDurationSec: gameSettings.playDurationSec ?? DEFAULT_PLAY_DURATION_SEC,
        startOffsetSec: gameSettings.startOffsetSec ?? DEFAULT_START_OFFSET_SEC,
        allowCollectionClipTiming: gameSettings.allowCollectionClipTiming ?? true,
      });
      if (uploadItems.length === 0) return false;

      const uploadId =
        crypto.randomUUID?.() ??
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
      const firstChunk = uploadItems.slice(0, CHUNK_SIZE);
      const remaining = uploadItems.slice(CHUNK_SIZE);
      const isLast = remaining.length === 0;

      const changePlaylistOk = await new Promise<boolean>((resolve) => {
        s.emit(
          "changePlaylist",
          {
            roomId: room.id,
            playlist: {
              uploadId,
              id: room.playlist.id,
              title: room.playlist.title,
              totalCount: uploadItems.length,
              items: firstChunk,
              isLast,
              pageSize: room.playlist.pageSize || DEFAULT_PAGE_SIZE,
            },
          },
          (ack: Ack<{ receivedCount: number; totalCount: number; ready: boolean }>) => {
            resolve(Boolean(ack?.ok));
          },
        );
      });
      if (!changePlaylistOk) {
        setStatusText("同步歌曲時間設定失敗");
        return false;
      }

      if (remaining.length > 0) {
        for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
          const chunk = remaining.slice(i, i + CHUNK_SIZE);
          const isLastChunk = i + CHUNK_SIZE >= remaining.length;
          const chunkOk = await new Promise<boolean>((resolve) => {
            s.emit(
              "uploadPlaylistChunk",
              {
                roomId: room.id,
                uploadId,
                items: chunk,
                isLast: isLastChunk,
              },
              (ack: Ack<{ receivedCount: number; totalCount: number }>) => {
                resolve(Boolean(ack?.ok));
              },
            );
          });
          if (!chunkOk) {
            setStatusText("同步歌曲時間設定失敗");
            return false;
          }
        }
      }
      return true;
    },
    [fetchCompletePlaylist, getSocket, setStatusText],
  );

  useEffect(() => {
    if (!username || authLoading) return;
    if (!shouldConnectSocket) {
      socketSuspendedRef.current = true;
      setIsConnected(false);
      setRouteRoomResolved(true);
      return;
    }
    let cancelled = false;
    const init = async () => {
      socketSuspendedRef.current = false;
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
                setCurrentRoom(applyGameSettingsPatch(state.room, {}));
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
        if (socketSuspendedRef.current) {
          setIsConnected(false);
          setRouteRoomResolved(true);
          return;
        }
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
        setCurrentRoom(applyGameSettingsPatch(state.room, {}));
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
      onGameUpdated: ({ roomId, gameState }) => {
        if (roomId !== currentRoomIdRef.current) return;
        setGameState(gameState);
        if (gameState?.status === "playing") {
          setIsGameView(true);
        }
      },
      onRoomUpdated: ({ room }) => {
        if (room.id !== currentRoomIdRef.current) return;
        setCurrentRoom((prev) =>
          prev ? mergeRoomSummaryIntoCurrentRoom(prev, room) : prev,
        );
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
      socketSuspendedRef.current = true;
      disconnectRoomSocket(socketRef.current);
      socketRef.current = null;
    };
  }, [
    username,
    authLoading,
    shouldConnectSocket,
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
    if (createRoomInFlightRef.current) {
      setStatusText("房間建立中，請稍候");
      return;
    }
    createRoomInFlightRef.current = true;
    setIsCreatingRoom(true);
    const releaseCreateRoomLock = () => {
      createRoomInFlightRef.current = false;
      setIsCreatingRoom(false);
    };
    if (authToken) {
      const token = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!token) {
        setStatusText("登入已過期，請重新登入");
        releaseCreateRoomLock();
        return;
      }
    }
    const trimmed = roomNameInput.trim();
    const trimmedPassword = roomPasswordInput.trim();
    const trimmedMaxPlayers = roomMaxPlayersInput.trim();
    if (!trimmed) {
      setStatusText("請輸入房間名稱");
      releaseCreateRoomLock();
      return;
    }
    if (playlistItems.length === 0 || !lastFetchedPlaylistId) {
      setStatusText("請先載入播放清單");
      releaseCreateRoomLock();
      return;
    }
    if (trimmedMaxPlayers && !/^\d+$/.test(trimmedMaxPlayers)) {
      setStatusText("人數限制格式錯誤，請輸入正整數");
      releaseCreateRoomLock();
      return;
    }
    const desiredMaxPlayers = trimmedMaxPlayers
      ? Number(trimmedMaxPlayers)
      : null;
    if (
      desiredMaxPlayers !== null &&
      (desiredMaxPlayers < PLAYER_MIN || desiredMaxPlayers > PLAYER_MAX)
    ) {
      setStatusText(`人數限制需介於 ${PLAYER_MIN} 到 ${PLAYER_MAX} 人`);
      releaseCreateRoomLock();
      return;
    }
    const desiredVisibility = roomVisibilityInput;
    const desiredPassword = trimmedPassword || null;
    const nextQuestionCount = clampQuestionCount(
      questionCount,
      getQuestionMax(playlistItems.length),
    );
    const nextPlayDurationSec = clampPlayDurationSec(playDurationSec);
    const nextStartOffsetSec = clampStartOffsetSec(startOffsetSec);
    const nextAllowCollectionClipTiming = Boolean(allowCollectionClipTiming);
    const shouldSyncRoomSettings =
      desiredVisibility !== "public" ||
      desiredPassword !== null ||
      desiredMaxPlayers !== null ||
      nextPlayDurationSec !== DEFAULT_PLAY_DURATION_SEC ||
      nextStartOffsetSec !== DEFAULT_START_OFFSET_SEC ||
      !nextAllowCollectionClipTiming;

    const uploadId =
      crypto.randomUUID?.() ??
      `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
    const uploadItems = buildUploadPlaylistItems(playlistItems, {
      playDurationSec: nextPlayDurationSec,
      startOffsetSec: nextStartOffsetSec,
      allowCollectionClipTiming: nextAllowCollectionClipTiming,
    });
    const firstChunk = uploadItems.slice(0, CHUNK_SIZE);
    const remaining = uploadItems.slice(CHUNK_SIZE);
    const isLast = remaining.length === 0;

    const payload = {
      roomName: trimmed,
      username,
      password: desiredPassword ?? undefined,
      visibility: desiredVisibility,
      maxPlayers: desiredMaxPlayers,
      gameSettings: {
        questionCount: nextQuestionCount,
        playDurationSec: nextPlayDurationSec,
        startOffsetSec: nextStartOffsetSec,
        allowCollectionClipTiming: nextAllowCollectionClipTiming,
      },
      playlist: {
        uploadId,
        id: lastFetchedPlaylistId,
        totalCount: uploadItems.length,
        items: firstChunk,
        isLast,
        pageSize: DEFAULT_PAGE_SIZE,
      },
    };

    let createResolved = false;
    let createFinalized = false;
    const finalizeCreate = () => {
      if (createFinalized) return;
      createFinalized = true;
      releaseCreateRoomLock();
    };

    const submitCreateRoom = (attempt: 0 | 1) => {
      const timeoutMs = attempt === 0 ? 4_000 : 12_000;
      const ackTimeout = window.setTimeout(() => {
        if (createResolved || !createRoomInFlightRef.current) return;
        if (attempt === 0) {
          setStatusText("建立房間逾時，正在同步既有房間…");
          submitCreateRoom(1);
          return;
        }
        setStatusText("建立房間逾時，請稍後重試");
        finalizeCreate();
      }, timeoutMs);

      s.emit("createRoom", payload, async (ack: Ack<RoomState>) => {
        window.clearTimeout(ackTimeout);
        if (createResolved) return;
        if (!ack) {
          if (attempt === 0) {
            setStatusText("建立房間回應遺失，正在同步既有房間…");
            submitCreateRoom(1);
            return;
          }
          setStatusText("建立房間失敗：伺服器無回應");
          finalizeCreate();
          return;
        }
        if (!ack.ok) {
          setStatusText(formatAckError("建立房間失敗", ack.error));
          finalizeCreate();
          return;
        }

        createResolved = true;
        const state = ack.data;
        syncServerOffset(state.serverNow);
        setCurrentRoom(
          applyGameSettingsPatch(state.room, {
            questionCount: nextQuestionCount,
            playDurationSec: nextPlayDurationSec,
            startOffsetSec: nextStartOffsetSec,
            allowCollectionClipTiming: nextAllowCollectionClipTiming,
          }),
        );
        setParticipants(state.participants);
        setMessages(state.messages);
        persistRoomId(state.room.id);
        lockSessionClientId(clientId);
        let accessSettingsWarning: string | null = null;
        if (shouldSyncRoomSettings) {
          await new Promise<void>((resolve) => {
            s.emit(
              "updateRoomSettings",
              {
                roomId: state.room.id,
                visibility: desiredVisibility,
                password: desiredPassword,
                questionCount: nextQuestionCount,
                playDurationSec: nextPlayDurationSec,
                startOffsetSec: nextStartOffsetSec,
                allowCollectionClipTiming: nextAllowCollectionClipTiming,
                maxPlayers: desiredMaxPlayers,
              },
              (settingsAck: Ack<{ room: RoomSummary }>) => {
                if (!settingsAck) {
                  accessSettingsWarning = "房間權限同步逾時";
                  resolve();
                  return;
                }
                if (!settingsAck.ok) {
                  accessSettingsWarning = formatAckError(
                    "房間權限同步失敗",
                    settingsAck.error,
                  );
                  resolve();
                  return;
                }
                setCurrentRoom((prev) =>
                  prev
                    ? applyGameSettingsPatch(
                        mergeRoomSummaryIntoCurrentRoom(
                          prev,
                          settingsAck.data.room,
                        ),
                        {
                          playDurationSec: nextPlayDurationSec,
                          startOffsetSec: nextStartOffsetSec,
                          allowCollectionClipTiming:
                            nextAllowCollectionClipTiming,
                        },
                      )
                    : prev,
                );
                resolve();
              },
            );
          });
        }
        saveRoomPassword(state.room.id, desiredPassword);
        setHostRoomPassword(desiredPassword);
        setRoomNameInput("");
        setRoomMaxPlayersInput("");
        setStatusText(
          accessSettingsWarning
            ? `${accessSettingsWarning}（房間已建立：${state.room.name}）`
            : `已建立房間：${state.room.name}`,
        );
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
        finalizeCreate();
      });
    };

    submitCreateRoom(0);
  }, [
    allowCollectionClipTiming,
    authToken,
    clientId,
    fetchPlaylistPage,
    getSocket,
    lastFetchedPlaylistId,
    lockSessionClientId,
    playlistItems,
    playDurationSec,
    questionCount,
    refreshAuthToken,
    roomMaxPlayersInput,
    roomNameInput,
    roomVisibilityInput,
    roomPasswordInput,
    saveRoomPassword,
    startOffsetSec,
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
          setCurrentRoom(applyGameSettingsPatch(state.room, {}));
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
    const guessDurationMs =
      clampPlayDurationSec(
        currentRoom.gameSettings?.playDurationSec ?? DEFAULT_PLAY_DURATION_SEC,
      ) * 1000;

    s.emit(
      "startGame",
      { roomId: currentRoom.id, guessDurationMs },
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
    if (!currentRoom || !gameState) return;
    if (gameState.phase !== "guess") return;
    const trackKey = `${gameState.startedAt}:${gameState.currentIndex}`;
    const previousPending = pendingAnswerSubmitRef.current;
    if (
      previousPending &&
      (previousPending.roomId !== currentRoom.id ||
        previousPending.trackKey !== trackKey)
    ) {
      if (answerSubmitTimerRef.current !== null) {
        window.clearTimeout(answerSubmitTimerRef.current);
        answerSubmitTimerRef.current = null;
      }
      pendingAnswerSubmitRef.current = null;
    }
    if (
      pendingAnswerSubmitRef.current?.roomId === currentRoom.id &&
      pendingAnswerSubmitRef.current.trackKey === trackKey &&
      pendingAnswerSubmitRef.current.choiceIndex === choiceIndex
    ) {
      return;
    }
    pendingAnswerSubmitRef.current = {
      roomId: currentRoom.id,
      trackKey,
      choiceIndex,
    };

    const flushSubmit = () => {
      const pending = pendingAnswerSubmitRef.current;
      if (!pending) return;
      pendingAnswerSubmitRef.current = null;
      const socket = getSocket();
      if (!socket) return;
      lastAnswerSubmitAtRef.current = Date.now();
      socket.emit(
        "submitAnswer",
        { roomId: pending.roomId, choiceIndex: pending.choiceIndex },
        (ack) => {
          if (!ack || ack.ok) return;
          if (ack.error === "Not in guess phase") return;
          setStatusText(formatAckError("提交答案失敗", ack.error));
        },
      );
    };

    const elapsed = Date.now() - lastAnswerSubmitAtRef.current;
    if (elapsed >= ANSWER_SUBMIT_GUARD_MS && answerSubmitTimerRef.current === null) {
      flushSubmit();
      return;
    }
    if (answerSubmitTimerRef.current !== null) {
      window.clearTimeout(answerSubmitTimerRef.current);
      answerSubmitTimerRef.current = null;
    }
    const delay = Math.max(40, ANSWER_SUBMIT_GUARD_MS - elapsed);
    answerSubmitTimerRef.current = window.setTimeout(() => {
      answerSubmitTimerRef.current = null;
      flushSubmit();
    }, delay);
  }, [currentRoom, gameState, getSocket]);

  useEffect(() => {
    if (!gameState || gameState.phase !== "guess" || !currentRoom) {
      if (answerSubmitTimerRef.current !== null) {
        window.clearTimeout(answerSubmitTimerRef.current);
        answerSubmitTimerRef.current = null;
      }
      pendingAnswerSubmitRef.current = null;
      return;
    }
    const trackKey = `${gameState.startedAt}:${gameState.currentIndex}`;
    const pending = pendingAnswerSubmitRef.current;
    if (!pending) return;
    if (pending.roomId === currentRoom.id && pending.trackKey === trackKey) return;
    if (answerSubmitTimerRef.current !== null) {
      window.clearTimeout(answerSubmitTimerRef.current);
      answerSubmitTimerRef.current = null;
    }
    pendingAnswerSubmitRef.current = null;
  }, [currentRoom, gameState]);

  useEffect(
    () => () => {
      if (answerSubmitTimerRef.current !== null) {
        window.clearTimeout(answerSubmitTimerRef.current);
        answerSubmitTimerRef.current = null;
      }
      pendingAnswerSubmitRef.current = null;
    },
    [],
  );

  const handleUpdateRoomSettings = useCallback(
    async (payload: {
      name?: string;
      visibility?: "public" | "private";
      password?: string | null;
      questionCount?: number;
      playDurationSec?: number;
      startOffsetSec?: number;
      allowCollectionClipTiming?: boolean;
      maxPlayers?: number | null;
    }) => {
      const s = getSocket();
      if (!s || !currentRoom) {
        setStatusText("尚未加入任何房間");
        return false;
      }
      const normalizedPayload = {
        ...payload,
        ...(typeof payload.playDurationSec === "number"
          ? { playDurationSec: clampPlayDurationSec(payload.playDurationSec) }
          : {}),
        ...(typeof payload.startOffsetSec === "number"
          ? { startOffsetSec: clampStartOffsetSec(payload.startOffsetSec) }
          : {}),
        ...(typeof payload.allowCollectionClipTiming === "boolean"
          ? { allowCollectionClipTiming: payload.allowCollectionClipTiming }
          : {}),
      };
      return await new Promise<boolean>((resolve) => {
        s.emit(
          "updateRoomSettings",
          { roomId: currentRoom.id, ...normalizedPayload },
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
            const gameSettingsPatch = {
              ...(typeof normalizedPayload.playDurationSec === "number"
                ? { playDurationSec: normalizedPayload.playDurationSec }
                : {}),
              ...(typeof normalizedPayload.startOffsetSec === "number"
                ? { startOffsetSec: normalizedPayload.startOffsetSec }
                : {}),
              ...(typeof normalizedPayload.allowCollectionClipTiming === "boolean"
                ? {
                    allowCollectionClipTiming:
                      normalizedPayload.allowCollectionClipTiming,
                  }
                : {}),
            } satisfies Partial<RoomGameSettings>;
            const mergedRoom = mergeRoomSummaryIntoCurrentRoom(
              currentRoom,
              ack.data.room,
            );
            const patchedRoom = applyGameSettingsPatch(mergedRoom, gameSettingsPatch);
            setCurrentRoom((prev) =>
              prev
                ? applyGameSettingsPatch(
                    mergeRoomSummaryIntoCurrentRoom(prev, ack.data.room),
                    gameSettingsPatch,
                  )
                : prev,
            );
            if (normalizedPayload.password !== undefined) {
              const trimmed = normalizedPayload.password?.trim() ?? "";
              const nextPassword = trimmed ? trimmed : null;
              saveRoomPassword(currentRoom.id, nextPassword);
              setHostRoomPassword(nextPassword);
            }
            const shouldSyncTiming =
              typeof normalizedPayload.playDurationSec === "number" ||
              typeof normalizedPayload.startOffsetSec === "number" ||
              typeof normalizedPayload.allowCollectionClipTiming === "boolean";
            if (!shouldSyncTiming) {
              setStatusText("房間設定已更新");
              resolve(true);
              return;
            }
            void (async () => {
              const synced = await syncRoomPlaylistTiming(
                patchedRoom,
                gameSettingsPatch,
              );
              setStatusText(
                synced
                  ? "房間設定已更新（歌曲時間已同步）"
                  : "房間設定已更新，但歌曲時間同步失敗",
              );
              resolve(true);
            })();
          },
        );
      });
    },
    [
      currentRoom,
      getSocket,
      saveRoomPassword,
      setStatusText,
      syncRoomPlaylistTiming,
    ],
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
              title: snapshot?.title ?? options?.title ?? undefined,
              totalCount: snapshot?.totalCount,
              sourceId: snapshot?.sourceId ?? options?.sourceId ?? undefined,
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
    const roomPlayDurationSec = clampPlayDurationSec(
      currentRoom.gameSettings?.playDurationSec ?? DEFAULT_PLAY_DURATION_SEC,
    );
    const roomStartOffsetSec = clampStartOffsetSec(
      currentRoom.gameSettings?.startOffsetSec ?? DEFAULT_START_OFFSET_SEC,
    );
    const roomAllowCollectionClipTiming =
      currentRoom.gameSettings?.allowCollectionClipTiming ?? true;
    const uploadItems = buildUploadPlaylistItems(playlistItems, {
      playDurationSec: roomPlayDurationSec,
      startOffsetSec: roomStartOffsetSec,
      allowCollectionClipTiming: roomAllowCollectionClipTiming,
    });
    const firstChunk = uploadItems.slice(0, CHUNK_SIZE);
    const remaining = uploadItems.slice(CHUNK_SIZE);
    const isLast = remaining.length === 0;

    s.emit(
      "changePlaylist",
      {
        roomId: currentRoom.id,
        playlist: {
          uploadId,
          id: lastFetchedPlaylistId,
          title: lastFetchedPlaylistTitle ?? undefined,
          totalCount: uploadItems.length,
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
      const roomPlayDurationSec = clampPlayDurationSec(
        currentRoom.gameSettings?.playDurationSec ?? DEFAULT_PLAY_DURATION_SEC,
      );
      const roomStartOffsetSec = clampStartOffsetSec(
        currentRoom.gameSettings?.startOffsetSec ?? DEFAULT_START_OFFSET_SEC,
      );
      const roomAllowCollectionClipTiming =
        currentRoom.gameSettings?.allowCollectionClipTiming ?? true;
      const uploadItems = buildUploadPlaylistItems(items, {
        playDurationSec: roomPlayDurationSec,
        startOffsetSec: roomStartOffsetSec,
        allowCollectionClipTiming: roomAllowCollectionClipTiming,
      });
      const uploadId =
        crypto.randomUUID?.() ??
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
      const firstChunk = uploadItems.slice(0, CHUNK_SIZE);
      const remaining = uploadItems.slice(CHUNK_SIZE);
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
              totalCount: uploadItems.length,
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
              uploadItems,
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
    setRoomVisibilityInput("public");
    setRoomCreateSourceMode("link");
    setRoomPasswordInput("");
    setRoomMaxPlayersInput("");
    setPlayDurationSec(DEFAULT_PLAY_DURATION_SEC);
    setStartOffsetSec(DEFAULT_START_OFFSET_SEC);
    setAllowCollectionClipTiming(true);
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
    if (!currentRoom) return;
    if (playlistViewItems.length === 0) return;
    const needsBackfill =
      currentRoom.gameSettings?.playDurationSec === undefined ||
      currentRoom.gameSettings?.startOffsetSec === undefined ||
      currentRoom.gameSettings?.allowCollectionClipTiming === undefined;
    if (!needsBackfill) return;
    const firstRoomSettingsItem = playlistViewItems.find(
      (item) => item.timingSource === "room_settings",
    );
    if (!firstRoomSettingsItem) return;
    const inferredStartOffsetSec = clampStartOffsetSec(
      firstRoomSettingsItem.startSec ?? DEFAULT_START_OFFSET_SEC,
    );
    const inferredPlayDurationSec = clampPlayDurationSec(
      typeof firstRoomSettingsItem.endSec === "number" &&
        firstRoomSettingsItem.endSec > inferredStartOffsetSec
        ? firstRoomSettingsItem.endSec - inferredStartOffsetSec
        : currentRoom.gameSettings?.playDurationSec ?? DEFAULT_PLAY_DURATION_SEC,
    );
    const inferredAllowCollectionClipTiming = playlistViewItems.some(
      (item) => item.timingSource === "track_clip",
    );
    setCurrentRoom((prev) => {
      if (!prev || prev.id !== currentRoom.id) return prev;
      const mergedSettings = mergeGameSettings(prev.gameSettings, {
        playDurationSec: inferredPlayDurationSec,
        startOffsetSec: inferredStartOffsetSec,
        allowCollectionClipTiming: inferredAllowCollectionClipTiming,
      });
      if (
        prev.gameSettings?.playDurationSec === mergedSettings.playDurationSec &&
        prev.gameSettings?.startOffsetSec === mergedSettings.startOffsetSec &&
        prev.gameSettings?.allowCollectionClipTiming ===
          mergedSettings.allowCollectionClipTiming
      ) {
        return prev;
      }
      return {
        ...prev,
        gameSettings: mergedSettings,
      };
    });
  }, [currentRoom, playlistViewItems]);

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
      collectionScope,
      collectionsLastFetchedAt,
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
      roomVisibilityInput,
      setRoomVisibilityInput,
      roomCreateSourceMode,
      setRoomCreateSourceMode,
      roomPasswordInput,
      setRoomPasswordInput,
      roomMaxPlayersInput,
      setRoomMaxPlayersInput,
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
      playDurationSec,
      startOffsetSec,
      allowCollectionClipTiming,
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
      isCreatingRoom,
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
      updatePlayDurationSec: handleUpdatePlayDurationSec,
      updateStartOffsetSec: handleUpdateStartOffsetSec,
      updateAllowCollectionClipTiming: handleUpdateAllowCollectionClipTiming,
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
      collectionScope,
      collectionsLastFetchedAt,
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
      roomVisibilityInput,
      roomCreateSourceMode,
      roomPasswordInput,
      roomMaxPlayersInput,
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
      playDurationSec,
      startOffsetSec,
      allowCollectionClipTiming,
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
      isCreatingRoom,
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
      handleUpdatePlayDurationSec,
      handleUpdateStartOffsetSec,
      handleUpdateAllowCollectionClipTiming,
      fetchRooms,
      fetchRoomById,
      resetCreateState,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
