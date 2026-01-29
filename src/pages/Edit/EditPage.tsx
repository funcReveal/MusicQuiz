import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Box, Button, Slider } from "@mui/material";
import { useRoom } from "../../features/Room/useRoom";
import type { PlaylistItem } from "../../features/Room/types";
import CollectionSelect from "./components/CollectionSelect";

const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const TEXT = {
  notSet: "(未設定)",
  createTitle: "建立收藏庫",
  backRooms: "返回房間",
  collectionName: "收藏庫名稱",
  collectionNamePlaceholder: "例如：我的 K-POP 收藏",
  playlistLabel: "YouTube 播放清單",
  playlistPlaceholder: "https://www.youtube.com/playlist?list=...",
  loadPlaylist: "載入清單",
  loading: "載入中...",
  playlistErrorInvalid: "請貼上有效的 YouTube 播放清單網址",
  playlistErrorApi: "尚未設定 API 位置 (API_URL)",
  playlistErrorLoad: "讀取播放清單失敗，請稍後重試",
  playlistErrorEmpty: "清單沒有可用影片，請確認播放清單是否公開",
  playlistErrorGeneric: "讀取播放清單時發生錯誤",
  playlistCount: "清單歌曲：",
  songsUnit: " 首",
  noThumb: "無縮圖",
  noSelection: "尚未選擇歌曲",
  selectSong: "請先選擇歌曲",
  editTime: "剪輯時間",
  start: "開始",
  end: "結束",
  startSec: "開始秒數",
  endSec: "結束秒數",
  answer: "答案",
  answerPlaceholder: "輸入歌曲答案",
  listTodo: "收藏庫列表（待實作）",
};

type EditableItem = PlaylistItem & {
  localId: string;
  dbId?: string;
  startSec: number;
  endSec: number;
  answerText: string;
};

type DbCollection = {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  visibility?: string;
};

type DbCollectionItem = {
  id: string;
  collection_id: string;
  sort: number;
  video_id: string | null;
  duration_sec?: number | null;
  start_sec: number;
  end_sec: number | null;
  answer_text: string;
};

const ADD_PLAYLIST_LABEL = "新增清單";
const ADD_ITEM_LABEL = "新增";
const START_TIME_LABEL = "開始時間 (mm:ss)";
const END_TIME_LABEL = "結束時間 (mm:ss)";
const PLAY_LABEL = "播放";
const PAUSE_LABEL = "暫停";
const VOLUME_LABEL = "音量";
const TOTAL_DURATION_LABEL = "總時長";
const DUPLICATE_SONG_ERROR = "曲目已存在";
const CLIP_DURATION_LABEL = "播放時長";
const SAVE_LABEL = "儲存";
const SAVING_LABEL = "儲存中";
const SAVE_ERROR_LABEL = "儲存失敗";
const SAVED_LABEL = "已儲存";
const LOADING_LABEL = "載入中";
const AUTO_SAVE_SUCCESS_LABEL = "自動保存成功";
const AUTO_SAVE_ERROR_LABEL = "自動保存失敗";
const UNSAVED_PROMPT = "尚未儲存，確定要離開嗎？";
const COLLECTION_COUNT_LABEL = "收藏庫數量";
const COLLECTION_SELECT_LABEL = "收藏庫清單";
const NEW_COLLECTION_LABEL = "建立新收藏庫";
const EDIT_VOLUME_STORAGE_KEY = "mq_edit_volume";
const LEGACY_VOLUME_STORAGE_KEY = "mq_volume";

const DEFAULT_DURATION_SEC = 30;

const parseDurationToSeconds = (duration?: string): number | null => {
  if (!duration) return null;
  const parts = duration.split(":").map((part) => Number(part));
  if (parts.some((value) => Number.isNaN(value))) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
};

const formatSeconds = (value: number) => {
  const clamped = Math.max(0, Math.floor(value));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const createLocalId = () =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

const createServerId = () => createLocalId();

const videoUrlFromId = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

const thumbnailFromId = (videoId: string) =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

const buildEditableItems = (items: PlaylistItem[]): EditableItem[] =>
  items.map((item) => {
    const durationSec =
      parseDurationToSeconds(item.duration) ?? DEFAULT_DURATION_SEC;
    const end = Math.min(durationSec, DEFAULT_DURATION_SEC);
    return {
      ...item,
      localId: createLocalId(),
      startSec: 0,
      endSec: Math.max(1, end),
      answerText: item.title ?? "",
    };
  });

const buildEditableItemsFromDb = (items: DbCollectionItem[]): EditableItem[] =>
  items.map((item) => {
    const videoId = item.video_id ?? "";
    const startSec = item.start_sec ?? 0;
    const rawDuration =
      item.duration_sec && item.duration_sec > 0 ? item.duration_sec : null;
    const maxDuration =
      rawDuration ?? Math.max(1, startSec + DEFAULT_DURATION_SEC);
    const endFromDb =
      item.end_sec === null || item.end_sec === undefined
        ? Math.max(1, startSec + DEFAULT_DURATION_SEC)
        : Math.max(1, item.end_sec);
    const endSec = Math.min(Math.max(endFromDb, startSec + 1), maxDuration);
    return {
      localId: createLocalId(),
      dbId: item.id,
      title: item.answer_text ?? videoId,
      url: videoId ? videoUrlFromId(videoId) : "",
      thumbnail: videoId ? thumbnailFromId(videoId) : undefined,
      uploader: "",
      duration: rawDuration ? formatSeconds(rawDuration) : undefined,
      startSec,
      endSec,
      answerText: item.answer_text ?? "",
    };
  });

const extractVideoId = (url: string | undefined | null) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id || null;
    }
    const id = parsed.searchParams.get("v");
    return id || null;
  } catch {
    return null;
  }
};

const getPlaylistItemKey = (item: { url?: string; title?: string }) => {
  const videoId = extractVideoId(item.url ?? "");
  if (videoId) return `yt:${videoId}`;
  if (item.url) return `url:${item.url}`;
  return item.title ? `title:${item.title}` : "";
};

const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) {
    return parts[0] * 60;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
};

const EditPage = () => {
  const navigate = useNavigate();
  const { collectionId } = useParams<{ collectionId?: string }>();

  const {
    authToken,
    authUser,
    displayUsername,
    clientId,
    username,
    playlistUrl,
    playlistItems: fetchedPlaylistItems,
    playlistError,
    playlistLoading,
    handleFetchPlaylist,
    handleResetPlaylist,
    setPlaylistUrl,
  } = useRoom();

  const [collections, setCollections] = useState<DbCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    null,
  );
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveNotice, setAutoSaveNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const dirtyCounterRef = useRef(0);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const [collectionTitle, setCollectionTitle] = useState("");
  const [playlistItems, setPlaylistItems] = useState<EditableItem[]>([]);
  // const [playlistLoading, setPlaylistLoading] = useState(false);
  // const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistAddError, setPlaylistAddError] = useState<string | null>(null);
  const [pendingPlaylistImport, setPendingPlaylistImport] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [startTimeInput, setStartTimeInput] = useState(formatSeconds(0));
  const [endSec, setEndSec] = useState(DEFAULT_DURATION_SEC);
  const [endTimeInput, setEndTimeInput] = useState(
    formatSeconds(DEFAULT_DURATION_SEC),
  );
  const [answerText, setAnswerText] = useState("");
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const playRequestedRef = useRef(false);
  const hasResetPlaylistRef = useRef(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 50;
    const stored =
      window.localStorage.getItem(EDIT_VOLUME_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_VOLUME_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (!Number.isFinite(parsed)) return 50;
    return Math.min(100, Math.max(0, parsed));
  });
  const [ytReady, setYtReady] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const ownerId = authUser?.id ?? null;
  const isReadOnly = !authToken;
  const workerAuthHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken],
  );

  if (!authToken) {
    return (
      <div className="flex flex-col w-95/100 space-y-4">
        <div className="rounded-lg border border-amber-400/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          請先使用 Google 登入後再編輯收藏庫。
        </div>
        <div className="text-sm text-slate-300">
          目前為訪客模式，無法使用收藏庫功能。
        </div>
        <div>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/rooms", { replace: true })}
          >
            {TEXT.backRooms}
          </Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (collectionId) {
      setActiveCollectionId(collectionId);
    } else {
      setActiveCollectionId(null);
      setCollectionTitle("");
    }
    setPlaylistItems([]);
    setPendingDeleteIds([]);
    setSelectedIndex(0);
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
    setSaveError(null);
    setAutoSaveNotice(null);
    dirtyCounterRef.current = 0;
  }, [collectionId]);

  const selectedItem = playlistItems[selectedIndex] ?? null;
  const durationSec = useMemo(() => {
    return (
      parseDurationToSeconds(selectedItem?.duration) ?? DEFAULT_DURATION_SEC
    );
  }, [selectedItem?.duration]);
  const maxSec = Math.max(1, durationSec);
  const hasItems = playlistItems.length > 0;
  const collectionCount = collections.length;
  const playlistActionLabel = hasItems ? ADD_PLAYLIST_LABEL : TEXT.loadPlaylist;
  const selectedVideoId = extractVideoId(selectedItem?.url);
  const effectiveEnd = Math.max(endSec, startSec + 1);
  const clipDurationSec = Math.max(1, effectiveEnd - startSec);
  const clipCurrentSec = Math.min(
    Math.max(currentTimeSec - startSec, 0),
    clipDurationSec,
  );
  const clipProgressPercent = Math.min(
    100,
    Math.max(0, (clipCurrentSec / clipDurationSec) * 100),
  );
  const totalDurationSec = useMemo(() => {
    return playlistItems.reduce((sum, item) => {
      const clip = Math.max(0, item.endSec - item.startSec);
      return sum + clip;
    }, 0);
  }, [playlistItems]);
  const selectedClipDurationSec = selectedItem
    ? Math.max(0, selectedItem.endSec - selectedItem.startSec)
    : 0;

  const markDirty = () => {
    dirtyCounterRef.current += 1;
    setHasUnsavedChanges(true);
    if (saveStatus !== "idle") {
      setSaveStatus("idle");
    }
    if (saveError) {
      setSaveError(null);
    }
  };

  const showAutoSaveNotice = (type: "success" | "error", message: string) => {
    setAutoSaveNotice({ type, message });
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      setAutoSaveNotice(null);
    }, 2500);
  };

  const confirmLeave = () => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(UNSAVED_PROMPT);
  };

  useEffect(() => {
    if (hasResetPlaylistRef.current) return;
    hasResetPlaylistRef.current = true;
    handleResetPlaylist();
  }, [handleResetPlaylist]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!WORKER_API_URL || !ownerId || !authToken) return;
    let active = true;

    const ensureAndLoad = async () => {
      setCollectionsLoading(true);
      setCollectionsError(null);
      try {
        await fetch(`${WORKER_API_URL}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...workerAuthHeaders },
          body: JSON.stringify({
            id: ownerId,
            display_name:
              authUser?.display_name && authUser.display_name !== TEXT.notSet
                ? authUser.display_name
                : displayUsername && displayUsername !== TEXT.notSet
                  ? displayUsername
                  : "Guest",
            provider: authUser?.provider ?? "google",
            provider_user_id: authUser?.provider_user_id ?? ownerId,
            email: authUser?.email ?? null,
            avatar_url: authUser?.avatar_url ?? null,
          }),
        });

        const res = await fetch(
          `${WORKER_API_URL}/collections?owner_id=${encodeURIComponent(
            ownerId,
          )}&pageSize=50`,
          { headers: { ...workerAuthHeaders } },
        );
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load collections");
        }
        const items = (payload?.data?.items ?? []) as DbCollection[];
        if (!active) return;
        setCollections(items);
        if (collectionId) {
          const matched = items.find((item) => item.id === collectionId);
          setActiveCollectionId(collectionId);
          setCollectionTitle(matched?.title ?? "");
        } else {
          setCollectionTitle("");
        }
      } catch (error) {
        if (!active) return;
        setCollectionsError(
          error instanceof Error ? error.message : "Failed to load collections",
        );
      } finally {
        if (active) setCollectionsLoading(false);
      }
    };

    ensureAndLoad();
    return () => {
      active = false;
    };
  }, [
    WORKER_API_URL,
    ownerId,
    authToken,
    displayUsername,
    authUser?.display_name,
    authUser?.provider,
    authUser?.provider_user_id,
    authUser?.email,
    authUser?.avatar_url,
    workerAuthHeaders,
    collectionId,
  ]);

  useEffect(() => {
    if (!WORKER_API_URL || !activeCollectionId || !authToken) return;
    let active = true;

    const loadItems = async () => {
      setItemsLoading(true);
      setItemsError(null);
      try {
        const res = await fetch(
          `${WORKER_API_URL}/collections/${activeCollectionId}/items?pageSize=200`,
          { headers: { ...workerAuthHeaders } },
        );
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load items");
        }
        const items = (payload?.data?.items ?? []) as DbCollectionItem[];
        if (!active) return;
        const baseItems = buildEditableItemsFromDb(items);
        setPlaylistItems(baseItems);
        setPlaylistAddError(null);
        setPendingDeleteIds([]);
        setSelectedIndex(0);
        setHasUnsavedChanges(false);
        setSaveStatus("idle");
        setSaveError(null);
        dirtyCounterRef.current = 0;
      } catch (error) {
        if (!active) return;
        setItemsError(
          error instanceof Error ? error.message : "Failed to load items",
        );
      } finally {
        if (active) setItemsLoading(false);
      }
    };

    loadItems();
    return () => {
      active = false;
    };
  }, [WORKER_API_URL, activeCollectionId, authToken, workerAuthHeaders]);

  useEffect(() => {
    if (!pendingPlaylistImport) return;
    if (playlistLoading) return;
    if (playlistError) {
      setPendingPlaylistImport(false);
      return;
    }
    if (fetchedPlaylistItems.length === 0) return;

    const incoming = buildEditableItems(fetchedPlaylistItems);
    let duplicateCount = 0;
    let addedCount = 0;

    setPlaylistItems((prev) => {
      const existingKeys = new Set(
        prev.map((item) => getPlaylistItemKey(item)).filter(Boolean),
      );
      const next = [...prev];
      incoming.forEach((item) => {
        const key = getPlaylistItemKey(item);
        if (key && existingKeys.has(key)) {
          duplicateCount += 1;
          return;
        }
        if (key) existingKeys.add(key);
        next.push(item);
        addedCount += 1;
      });
      return next;
    });
    if (addedCount > 0) {
      markDirty();
    }

    if (duplicateCount > 0) {
      setPlaylistAddError(DUPLICATE_SONG_ERROR);
    }

    setPendingPlaylistImport(false);
    handleResetPlaylist();
  }, [
    pendingPlaylistImport,
    playlistLoading,
    playlistError,
    fetchedPlaylistItems,
    handleResetPlaylist,
  ]);

  useEffect(() => {
    if (window.YT?.Player) {
      setYtReady(true);
      return;
    }
    const existing = document.querySelector(
      "script[data-yt-iframe-api]",
    ) as HTMLScriptElement | null;
    if (existing) {
      if (window.YT?.Player) {
        setYtReady(true);
      } else {
        window.onYouTubeIframeAPIReady = () => setYtReady(true);
      }
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.dataset.ytIframeApi = "true";
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
    document.body.appendChild(tag);
  }, []);

  useEffect(() => {
    if (!ytReady) return;
    if (!selectedVideoId || !playerContainerRef.current) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      setIsPlaying(false);
      return;
    }

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    setIsPlayerReady(false);
    setIsPlaying(false);

    const player = new window.YT.Player(playerContainerRef.current, {
      videoId: selectedVideoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        playsinline: 1,
        start: Math.floor(startSec),
        disablekb: 1,
        modestbranding: 1,
      },
      events: {
        onReady: (event: any) => {
          setIsPlayerReady(true);
          event.target.setVolume?.(volume);
          if (playRequestedRef.current) {
            event.target.playVideo?.();
            setIsPlaying(true);
          } else {
            event.target.pauseVideo?.();
            setIsPlaying(false);
          }
          let attempts = 0;
          const trySync = () => {
            const duration = event.target.getDuration?.();
            if (duration && duration > 0) {
              syncDurationFromPlayer(duration);
              return;
            }
            attempts += 1;
            if (attempts < 5) {
              window.setTimeout(trySync, 300);
            }
          };
          trySync();
        },
        onStateChange: (event: any) => {
          const state = window.YT?.PlayerState;
          if (!state) return;
          if (event.data === state.PLAYING) {
            if (!playRequestedRef.current) {
              event.target.pauseVideo?.();
              setIsPlaying(false);
              return;
            }
            setIsPlaying(true);
          } else if (
            event.data === state.PAUSED ||
            event.data === state.ENDED
          ) {
            setIsPlaying(false);
          }
        },
      },
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [ytReady, selectedVideoId]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    playerRef.current.seekTo?.(startSec, true);
    setCurrentTimeSec(startSec);
  }, [startSec, isPlayerReady, selectedVideoId]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    playerRef.current.setVolume?.(volume);
  }, [volume, isPlayerReady]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const current = player.getCurrentTime();
      setCurrentTimeSec(current);
      if (current >= effectiveEnd - 0.2) {
        player.seekTo?.(startSec, true);
        if (isPlaying) {
          player.playVideo?.();
        } else {
          player.pauseVideo?.();
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPlayerReady, startSec, effectiveEnd, isPlaying, selectedVideoId]);

  useEffect(() => {
    if (!selectedItem) return;
    const nextStart = Math.min(selectedItem.startSec, maxSec);
    const nextEnd = Math.min(
      Math.max(selectedItem.endSec, nextStart + 1),
      maxSec,
    );
    setStartSec(nextStart);
    setEndSec(nextEnd);
    setStartTimeInput(formatSeconds(nextStart));
    setEndTimeInput(formatSeconds(nextEnd));
    setAnswerText(selectedItem.answerText);
    setCurrentTimeSec(nextStart);
  }, [
    selectedItem?.localId,
    selectedItem?.startSec,
    selectedItem?.endSec,
    selectedItem?.answerText,
  ]);

  const updateSelectedItem = (updates: Partial<EditableItem>) => {
    setPlaylistItems((prev) =>
      prev.map((item, idx) =>
        idx === selectedIndex ? { ...item, ...updates } : item,
      ),
    );
    markDirty();
  };

  const handleSelectIndex = (nextIndex: number) => {
    if (nextIndex === selectedIndex) return;
    if (hasUnsavedChanges) {
      void handleSaveCollection("auto");
    }
    setSelectedIndex(nextIndex);
  };

  const handleImportPlaylist = () => {
    if (playlistLoading) return;
    setPlaylistAddError(null);
    setPendingPlaylistImport(true);
    handleFetchPlaylist();
  };

  const handleStartChange = (value: number) => {
    const next = Math.min(Math.max(0, value), maxSec);
    const nextEnd = next > endSec ? next : endSec;
    setStartSec(next);
    setEndSec(nextEnd);
    setStartTimeInput(formatSeconds(next));
    setEndTimeInput(formatSeconds(nextEnd));
    setCurrentTimeSec(next);
    updateSelectedItem({ startSec: next, endSec: nextEnd });
  };

  const handleEndChange = (value: number) => {
    const next = Math.min(Math.max(0, value), maxSec);
    const nextStart = next < startSec ? next : startSec;
    setEndSec(next);
    if (next < startSec) {
      setStartSec(nextStart);
      setStartTimeInput(formatSeconds(nextStart));
    }
    setEndTimeInput(formatSeconds(next));
    setCurrentTimeSec((prev) => Math.min(Math.max(prev, nextStart), next));
    updateSelectedItem({ startSec: nextStart, endSec: next });
  };

  const handleRangeChange = (_: Event, value: number | number[]) => {
    if (!Array.isArray(value)) return;
    const [rawStart, rawEnd] = value;
    const clampedStart = Math.min(Math.max(0, rawStart), maxSec);
    const clampedEnd = Math.min(Math.max(0, rawEnd), maxSec);
    const nextStart = Math.min(clampedStart, clampedEnd);
    const nextEnd = Math.max(clampedStart, clampedEnd);
    setStartSec(nextStart);
    setEndSec(nextEnd);
    setStartTimeInput(formatSeconds(nextStart));
    setEndTimeInput(formatSeconds(nextEnd));
    setCurrentTimeSec(nextStart);
    updateSelectedItem({ startSec: nextStart, endSec: nextEnd });
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    let didMove = false;
    setPlaylistItems((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      didMove = true;
      return next;
    });

    setSelectedIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) {
        return prev - 1;
      }
      if (fromIndex > toIndex && prev >= toIndex && prev < fromIndex) {
        return prev + 1;
      }
      return prev;
    });
    if (didMove) {
      markDirty();
    }
  };

  const removeItem = (index: number) => {
    markDirty();
    setPlaylistItems((prev) => {
      const target = prev[index];
      if (target?.dbId) {
        setPendingDeleteIds((ids) =>
          ids.includes(target.dbId!) ? ids : [...ids, target.dbId!],
        );
      }
      return prev.filter((_item, idx) => idx !== index);
    });
    setSelectedIndex((prev) => {
      if (prev === index) return Math.max(0, prev - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player) return;
    const state = player.getPlayerState?.();
    const playingState = window.YT?.PlayerState?.PLAYING;
    if (playingState !== undefined && state === playingState) {
      player.pauseVideo?.();
      setIsPlaying(false);
      playRequestedRef.current = false;
    } else {
      playRequestedRef.current = true;
      player.playVideo?.();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setVolume(clamped);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDIT_VOLUME_STORAGE_KEY, String(clamped));
    }
  };

  const syncDurationFromPlayer = (durationSec: number) => {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    const cap = Math.max(1, Math.floor(durationSec));
    let didUpdate = false;
    setPlaylistItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== selectedIndex) return item;
        let nextEnd = item.endSec;
        if (!Number.isFinite(nextEnd) || nextEnd > cap) {
          nextEnd = cap;
        }
        if (nextEnd <= item.startSec) {
          nextEnd = Math.min(cap, item.startSec + 1);
        }
        const nextDuration = formatSeconds(cap);
        if (item.duration !== nextDuration || item.endSec !== nextEnd) {
          didUpdate = true;
        }
        return { ...item, duration: nextDuration, endSec: nextEnd };
      }),
    );
    if (didUpdate) {
      markDirty();
    }
  };

  const handleProgressChange = (value: number) => {
    const clamped = Math.min(effectiveEnd, Math.max(startSec, value));
    setCurrentTimeSec(clamped);
    if (playerRef.current) {
      playerRef.current.seekTo?.(clamped, true);
      if (!isPlaying) {
        playerRef.current.pauseVideo?.();
      }
    }
  };

  const nudgeStart = (delta: number) => {
    handleStartChange(startSec + delta);
  };

  const nudgeEnd = (delta: number) => {
    handleEndChange(endSec + delta);
  };

  const syncItemsToDb = async (collectionId: string) => {
    if (!WORKER_API_URL || !authToken) return;
    const jsonHeaders = {
      "Content-Type": "application/json",
      ...workerAuthHeaders,
    };
    const updatePayloads = playlistItems.map((item, idx) => ({
      localId: item.localId,
      id: item.dbId,
      sort: idx,
      video_id: extractVideoId(item.url),
      start_sec: item.startSec,
      end_sec: item.endSec,
      answer_text: item.answerText || item.title || "Untitled",
      duration_sec: (() => {
        const parsed = parseDurationToSeconds(item.duration ?? "");
        return parsed && parsed > 0 ? parsed : undefined;
      })(),
    }));

    const toUpdate = updatePayloads.filter((item) => item.id);
    const toInsert = updatePayloads.filter((item) => !item.id);

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((item) =>
          fetch(`${WORKER_API_URL}/collection-items/${item.id}`, {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({
              sort: item.sort,
              video_id: item.video_id ?? null,
              start_sec: item.start_sec,
              end_sec: item.end_sec,
              answer_text: item.answer_text,
              ...(item.duration_sec !== undefined
                ? { duration_sec: item.duration_sec }
                : {}),
            }),
          }),
        ),
      );
    }

    if (toInsert.length > 0) {
      const insertItems = toInsert.map((item) => ({
        id: createServerId(),
        sort: item.sort,
        video_id: item.video_id ?? null,
        start_sec: item.start_sec,
        end_sec: item.end_sec,
        answer_text: item.answer_text,
        ...(item.duration_sec !== undefined
          ? { duration_sec: item.duration_sec }
          : {}),
      }));
      const res = await fetch(
        `${WORKER_API_URL}/collections/${collectionId}/items`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ items: insertItems }),
        },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to insert items");
      }
      const idMap = new Map<string, string>();
      toInsert.forEach((item, idx) => {
        idMap.set(item.localId, insertItems[idx].id);
      });
      setPlaylistItems((prev) =>
        prev.map((item) =>
          item.dbId ? item : { ...item, dbId: idMap.get(item.localId) },
        ),
      );
    }

    if (pendingDeleteIds.length > 0) {
      await Promise.all(
        pendingDeleteIds.map((id) =>
          fetch(`${WORKER_API_URL}/collection-items/${id}`, {
            method: "DELETE",
            headers: { ...workerAuthHeaders },
          }),
        ),
      );
      setPendingDeleteIds([]);
    }
  };

  const handleSaveCollection = async (mode: "manual" | "auto" = "manual") => {
    if (saveInFlightRef.current) return;
    if (!WORKER_API_URL || !authToken || !ownerId) {
      if (mode === "auto") {
        showAutoSaveNotice("error", AUTO_SAVE_ERROR_LABEL);
      } else {
        setSaveStatus("error");
        setSaveError("請先登入後再儲存");
      }
      return;
    }
    if (!collectionTitle.trim()) {
      if (mode === "auto") {
        showAutoSaveNotice("error", "請先輸入收藏庫名稱");
      } else {
        setSaveStatus("error");
        setSaveError("title is required");
      }
      return;
    }

    const dirtySnapshot = dirtyCounterRef.current;
    saveInFlightRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);

    try {
      let collectionId = activeCollectionId;
      let createdCollection: DbCollection | null = null;
      if (!collectionId) {
        const res = await fetch(`${WORKER_API_URL}/collections`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...workerAuthHeaders },
          body: JSON.stringify({
            owner_id: ownerId,
            title: collectionTitle.trim(),
            description: null,
            visibility: "private",
          }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to create collection");
        }
        const created = payload?.data as DbCollection | undefined;
        if (!created?.id) {
          throw new Error("Missing collection id");
        }
        collectionId = created.id;
        createdCollection = created;
      } else {
        await fetch(`${WORKER_API_URL}/collections/${collectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...workerAuthHeaders },
          body: JSON.stringify({ title: collectionTitle.trim() }),
        });
        setCollections((prev) =>
          prev.map((item) =>
            item.id === collectionId
              ? { ...item, title: collectionTitle.trim() }
              : item,
          ),
        );
      }

      if (collectionId) {
        await syncItemsToDb(collectionId);
      }
      if (createdCollection) {
        setActiveCollectionId(createdCollection.id);
        setCollections((prev) => [createdCollection, ...prev]);
        navigate(`/collection/edit/${createdCollection.id}`, { replace: true });
      }

      const noNewChanges = dirtyCounterRef.current === dirtySnapshot;
      if (noNewChanges) {
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
        dirtyCounterRef.current = 0;
        if (mode === "auto") {
          showAutoSaveNotice("success", AUTO_SAVE_SUCCESS_LABEL);
        }
      } else {
        setSaveStatus("idle");
      }
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Failed to save");
      if (mode === "auto") {
        showAutoSaveNotice("error", AUTO_SAVE_ERROR_LABEL);
      }
    } finally {
      saveInFlightRef.current = false;
    }
  };

  return (
    <div className="flex flex-col w-95/100 space-y-4">
      {/* <div className="w-full md:w-full lg:w-3/5 mx-auto space-y-4"> */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-slate-100 font-semibold">
          {TEXT.createTitle}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              if (!confirmLeave()) return;
              navigate("/rooms", { replace: true });
            }}
          >
            {TEXT.backRooms}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveCollection}
            disabled={saveStatus === "saving" || isReadOnly}
          >
            {saveStatus === "saving" ? SAVING_LABEL : SAVE_LABEL}
          </Button>
        </div>
      </div>
      <div className={isReadOnly ? "pointer-events-none opacity-60" : ""}>
        {collectionsLoading && (
          <div className="text-xs text-slate-400">{LOADING_LABEL}</div>
        )}
        {itemsLoading && (
          <div className="text-xs text-slate-400">{LOADING_LABEL}</div>
        )}
        {collectionsError && (
          <div className="text-sm text-rose-300">{collectionsError}</div>
        )}
        {itemsError && (
          <div className="text-sm text-rose-300">{itemsError}</div>
        )}
        {saveError && (
          <div className="text-sm text-rose-300">
            {SAVE_ERROR_LABEL}: {saveError}
          </div>
        )}
        {saveStatus === "saved" && (
          <div className="text-xs text-emerald-300">{SAVED_LABEL}</div>
        )}
        {collectionCount > 0 && (
          <div className="text-xs text-slate-400">
            {COLLECTION_COUNT_LABEL}: {collectionCount}
          </div>
        )}
        <Box display={"flex"} gap={5}>
          <Box flexGrow={1}>
            {collectionCount > 0 && (
              <CollectionSelect
                label={COLLECTION_SELECT_LABEL}
                newLabel={NEW_COLLECTION_LABEL}
                value={activeCollectionId ?? ""}
                collections={collections}
                onChange={(nextId) => {
                  if (!confirmLeave()) return;
                  if (nextId) {
                    navigate(`/collection/edit/${nextId}`);
                  } else {
                    navigate("/collection/edit");
                  }
                  setActiveCollectionId(nextId || null);
                  const selected = collections.find(
                    (item) => item.id === nextId,
                  );
                  setCollectionTitle(nextId ? (selected?.title ?? "") : "");
                  setPlaylistItems([]);
                  setPlaylistAddError(null);
                  setPendingDeleteIds([]);
                  setSelectedIndex(0);
                  setHasUnsavedChanges(false);
                  setSaveStatus("idle");
                  setSaveError(null);
                  dirtyCounterRef.current = 0;
                }}
              />
            )}
            <label className="text-xs text-slate-300">
              {TEXT.collectionName}
            </label>
            <input
              value={collectionTitle}
              onChange={(e) => {
                setCollectionTitle(e.target.value);
                markDirty();
              }}
              placeholder={TEXT.collectionNamePlaceholder}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <label className="text-xs text-slate-300">
              {TEXT.playlistLabel}
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 space-y-4">
                <input
                  value={playlistUrl}
                  onChange={(e) => {
                    setPlaylistUrl(e.target.value);
                    if (playlistAddError) setPlaylistAddError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const canFetch = !!username && !playlistLoading;
                    if (canFetch) {
                      handleImportPlaylist();
                    }
                  }}
                  placeholder={TEXT.playlistPlaceholder}
                  className="w-full flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleImportPlaylist}
                  disabled={playlistLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-60"
                >
                  {playlistLoading ? TEXT.loading : playlistActionLabel}
                </button>
                <div className="grid gap-3">
                  {playlistError && (
                    <div className="text-sm text-rose-300">{playlistError}</div>
                  )}
                  {playlistAddError && (
                    <div className="text-sm text-rose-300">
                      {playlistAddError}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {playlistItems.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-slate-300">
                  {TEXT.playlistCount}
                  {playlistItems.length}
                  {TEXT.songsUnit}
                </div>
                <div className="text-xs text-slate-400">
                  {TOTAL_DURATION_LABEL}: {formatSeconds(totalDurationSec)}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {playlistItems.map((item, idx) => {
                    const isActive = idx === selectedIndex;
                    return (
                      <div
                        key={item.localId}
                        onClick={() => handleSelectIndex(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectIndex(idx);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`flex-shrink-0 w-28 rounded-lg border text-left transition-colors ${
                          isActive
                            ? "border-sky-400 bg-slate-900"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                        }`}
                      >
                        <div className="relative h-16 w-full overflow-hidden rounded-t-lg bg-slate-900">
                          <span className="absolute left-1 top-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-200">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(idx);
                            }}
                            className="absolute right-1 top-1 rounded bg-slate-950/80 px-1 text-[10px] text-slate-200 hover:bg-rose-500/80"
                            aria-label="Delete"
                          >
                            X
                          </button>
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-slate-500">
                              {TEXT.noThumb}
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1">
                          <div className="text-[11px] text-slate-200 truncate">
                            <span className="mr-1 text-[10px] text-slate-400">
                              #{idx + 1}
                            </span>
                            {item.title}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {item.duration ?? "--:--"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {CLIP_DURATION_LABEL}{" "}
                            {formatSeconds(
                              Math.max(0, item.endSec - item.startSec),
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-2 pb-2 text-[10px] text-slate-300">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveItem(idx, idx - 1);
                            }}
                            disabled={idx === 0}
                            className="rounded px-1.5 py-0.5 hover:bg-slate-800 disabled:opacity-40"
                          >
                            上移
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveItem(idx, idx + 1);
                            }}
                            disabled={idx === playlistItems.length - 1}
                            className="rounded px-1.5 py-0.5 hover:bg-slate-800 disabled:opacity-40"
                          >
                            下移
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleImportPlaylist}
                    disabled={playlistLoading}
                    className="flex-shrink-0 w-28 rounded-lg border-2 border-dashed border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 py-6">
                      <span className="text-xl">+</span>
                      <span className="text-[11px]">{ADD_ITEM_LABEL}</span>
                    </div>
                  </button>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="relative aspect-video w-full max-w-xl mx-auto overflow-hidden rounded-lg bg-slate-900">
                    {selectedVideoId ? (
                      <>
                        <div
                          ref={playerContainerRef}
                          className="h-full w-full"
                        />
                        <div
                          className="absolute inset-0 z-10"
                          aria-hidden="true"
                        />
                      </>
                    ) : selectedItem?.thumbnail ? (
                      <img
                        src={selectedItem.thumbnail}
                        alt={selectedItem.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-500">
                        {TEXT.noSelection}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-slate-100">
                    {selectedItem?.title ?? TEXT.selectSong}
                  </div>
                  <div className="text-xs text-slate-400">
                    {selectedItem?.uploader ?? ""}
                    {selectedItem?.duration
                      ? ` · ${selectedItem.duration}`
                      : ""}
                  </div>
                  <div className="text-xs text-slate-400">
                    {CLIP_DURATION_LABEL}:{" "}
                    {formatSeconds(selectedClipDurationSec)}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{formatSeconds(clipCurrentSec)}</span>
                      <span>{formatSeconds(clipDurationSec)}</span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${clipProgressPercent}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={Math.floor(startSec)}
                      max={Math.floor(effectiveEnd)}
                      step={1}
                      value={Math.floor(currentTimeSec)}
                      onChange={(e) =>
                        handleProgressChange(Number(e.target.value))
                      }
                      className="mt-2 w-full accent-sky-400"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <button
                      type="button"
                      onClick={togglePlayback}
                      disabled={!isPlayerReady}
                      className="rounded-md border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-400 disabled:opacity-50"
                    >
                      {isPlaying ? PAUSE_LABEL : PLAY_LABEL}
                    </button>
                    <div className="flex items-center gap-2">
                      <span>{VOLUME_LABEL}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={volume}
                        onChange={(e) =>
                          handleVolumeChange(Number(e.target.value))
                        }
                        className="w-28 accent-sky-400"
                      />
                      <span className="w-6 text-right">{volume}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 space-y-4">
                  <div className="text-sm text-slate-200 font-medium">
                    {TEXT.editTime}
                  </div>
                  <div className="space-y-2">
                    <Slider
                      value={[startSec, endSec]}
                      min={0}
                      max={maxSec}
                      onChange={handleRangeChange}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => formatSeconds(value)}
                      disableSwap
                      sx={{
                        color: "rgb(56 189 248)",
                        "& .MuiSlider-thumb": {
                          border: "2px solid rgb(15 23 42)",
                        },
                      }}
                    />
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {TEXT.start} {formatSeconds(startSec)}
                      </span>
                      <span>
                        {TEXT.end} {formatSeconds(endSec)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-300 w-24">
                        {START_TIME_LABEL}
                      </label>
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={startTimeInput}
                          placeholder="mm:ss"
                          onChange={(e) => setStartTimeInput(e.target.value)}
                          onBlur={() => {
                            const parsed = parseTimeInput(startTimeInput);
                            if (parsed === null) {
                              setStartTimeInput(formatSeconds(startSec));
                              return;
                            }
                            handleStartChange(parsed);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeStart(1)}
                            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                            aria-label="Nudge start forward"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeStart(-1)}
                            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                            aria-label="Nudge start backward"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-300 w-24">
                        {END_TIME_LABEL}
                      </label>
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={endTimeInput}
                          placeholder="mm:ss"
                          onChange={(e) => setEndTimeInput(e.target.value)}
                          onBlur={() => {
                            const parsed = parseTimeInput(endTimeInput);
                            if (parsed === null) {
                              setEndTimeInput(formatSeconds(endSec));
                              return;
                            }
                            handleEndChange(parsed);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeEnd(1)}
                            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                            aria-label="Nudge end forward"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeEnd(-1)}
                            className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200 hover:border-slate-400"
                            aria-label="Nudge end backward"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">
                      {TEXT.answer}
                    </label>
                    <input
                      value={answerText}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAnswerText(value);
                        updateSelectedItem({ answerText: value });
                      }}
                      placeholder={TEXT.answerPlaceholder}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </Box>
        </Box>
      </div>
      {autoSaveNotice && (
        <div
          className={`fixed bottom-4 left-4 z-50 rounded-md px-3 py-2 text-xs text-white shadow ${
            autoSaveNotice.type === "success"
              ? "bg-emerald-500/90"
              : "bg-rose-500/90"
          }`}
        >
          {autoSaveNotice.message}
        </div>
      )}
    </div>
    // </div>
  );
};

export default EditPage;
