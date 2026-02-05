import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@mui/material";
import { useRoom } from "../../Room/model/useRoom";
import type { DbCollection, EditableItem } from "./lib/editTypes";
import {
  buildEditableItems,
  buildEditableItemsFromDb,
} from "./lib/editMappers";
import { useCollectionEditor } from "../model/useCollectionEditor";
import { useCollectionLoader } from "../model/useCollectionLoader";
import CollectionPopover from "./components/CollectionPopover";
import ClipEditorPanel from "./components/ClipEditorPanel";
import AnswerPanel from "./components/AnswerPanel";
import EditHeader from "./components/EditHeader";
import PlaylistListPanel from "./components/PlaylistListPanel";
import PlaylistPopover from "./components/PlaylistPopover";
import PlayerPanel from "./components/PlayerPanel";
import StatusRow from "./components/StatusRow";
import {
  DEFAULT_DURATION_SEC,
  createLocalId,
  createServerId,
  extractVideoId,
  formatSeconds,
  getPlaylistItemKey,
  parseDurationToSeconds,
  parseTimeInput,
  thumbnailFromId,
} from "./lib/editUtils";

type YTPlayer = YT.Player;
type YTPlayerEvent = YT.PlayerEvent;
type YTPlayerStateEvent = YT.OnStateChangeEvent;

const TEXT = {
  notSet: "(未設定)",
  createTitle: "建立收藏庫",
  backRooms: "返回收藏庫",
  collectionName: "收藏庫名稱",
  collectionNamePlaceholder: "例如：我的 K-POP 收藏",
  playlistLabel: "YouTube 播放清單",
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

const START_TIME_LABEL = "開始時間 (mm:ss)";
const END_TIME_LABEL = "結束時間 (mm:ss)";
const ANSWER_MAX_LENGTH = 80;
const PLAY_LABEL = "播放";
const PAUSE_LABEL = "暫停";
const VOLUME_LABEL = "音量";
const DUPLICATE_SONG_ERROR = "曲目已存在";
const CLIP_DURATION_LABEL = "播放時長";
const SAVE_LABEL = "儲存";
const SAVING_LABEL = "儲存中";
const SAVE_ERROR_LABEL = "儲存失敗";
const SAVED_LABEL = "已儲存";
const LOADING_LABEL = "載入中";
const UNSAVED_PROMPT = "尚未儲存，確定要離開嗎？";
const COLLECTION_SELECT_LABEL = "收藏庫清單";
const NEW_COLLECTION_LABEL = "建立新收藏庫";
const EDIT_VOLUME_STORAGE_KEY = "mq_edit_volume";
const LEGACY_VOLUME_STORAGE_KEY = "mq_volume";
const EDIT_AUTOPLAY_STORAGE_KEY = "mq_edit_autoplay";
const EDIT_LOOP_STORAGE_KEY = "mq_edit_loop";

const EditPage = () => {
  const navigate = useNavigate();
  const { collectionId } = useParams<{ collectionId?: string }>();

  const {
    authToken,
    authUser,
    displayUsername,
    refreshAuthToken,
    playlistUrl,
    playlistItems: fetchedPlaylistItems,
    lastFetchedPlaylistTitle,
    playlistError,
    playlistLoading,
    handleFetchPlaylist,
    handleResetPlaylist,
    setPlaylistUrl,
    authLoading,
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
  const baselineSnapshotRef = useRef<string>("");
  const baselineReadyRef = useRef(false);
  const dirtyCounterRef = useRef(0);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const [collectionTitle, setCollectionTitle] = useState("");
  const [collectionTitleTouched, setCollectionTitleTouched] = useState(false);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [playlistPanelOpen, setPlaylistPanelOpen] = useState(false);
  const [collectionAnchor, setCollectionAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [playlistAnchor, setPlaylistAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [playlistItems, setPlaylistItems] = useState<EditableItem[]>([]);
  // const [playlistLoading, setPlaylistLoading] = useState(false);
  // const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistAddError, setPlaylistAddError] = useState<string | null>(null);
  const [pendingPlaylistImport, setPendingPlaylistImport] = useState(false);
  const [singleTrackUrl, setSingleTrackUrl] = useState("");
  const [singleTrackTitle, setSingleTrackTitle] = useState("");
  const [singleTrackDuration, setSingleTrackDuration] = useState("");
  const [singleTrackAnswer, setSingleTrackAnswer] = useState("");
  const [singleTrackUploader, setSingleTrackUploader] = useState("");
  const [singleTrackError, setSingleTrackError] = useState<string | null>(null);
  const [singleTrackLoading, setSingleTrackLoading] = useState(false);
  const lastResolvedUrlRef = useRef<string | null>(null);
  const [singleTrackOpen, setSingleTrackOpen] = useState(false);
  const [duplicateIndex, setDuplicateIndex] = useState<number | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(
    null,
  );
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const highlightTimerRef = useRef<number | null>(null);
  const lastUrlRef = useRef<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const pendingSelectedIndexRef = useRef<number | null>(null);
  const selectedIndexRef = useRef(0);
  const reorderRef = useRef(false);
  const reorderSelectedIdRef = useRef<string | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastSelectedVideoIdRef = useRef<string | null>(null);
  const [startSec, setStartSec] = useState(0);
  const [startTimeInput, setStartTimeInput] = useState(formatSeconds(0));
  const [endSec, setEndSec] = useState(DEFAULT_DURATION_SEC);
  const [endTimeInput, setEndTimeInput] = useState(
    formatSeconds(DEFAULT_DURATION_SEC),
  );
  const [answerText, setAnswerText] = useState("");
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentVideoItemIdRef = useRef<string | null>(null);
  const playRequestedRef = useRef(false);
  const shouldSeekToStartRef = useRef(false);
  const selectedStartRef = useRef(0);
  const pendingAutoStartRef = useRef<number | null>(null);
  const autoPlaySeekedRef = useRef(false);
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
  const [autoPlayOnSwitch, setAutoPlayOnSwitch] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem(EDIT_AUTOPLAY_STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
    return false;
  });
  const [loopEnabled, setLoopEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(EDIT_LOOP_STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
    return true;
  });
  const autoPlayRef = useRef(false);
  useEffect(() => {
    autoPlayRef.current = autoPlayOnSwitch;
  }, [autoPlayOnSwitch]);
  const [ytReady, setYtReady] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  const markDirty = useCallback(() => {
    dirtyCounterRef.current += 1;
    setHasUnsavedChanges(true);
    setSaveStatus((prev) => (prev !== "idle" ? "idle" : prev));
    setSaveError((prev) => (prev ? null : prev));
  }, []);

  const buildSnapshot = useCallback(
    (
      items: EditableItem[],
      title: string,
      deletes: string[],
    ): string => {
      const payload = {
        title: title.trim(),
        items: items.map((item, idx) => ({
          key: item.dbId ?? item.localId,
          sort: idx,
          videoId: extractVideoId(item.url) ?? item.url ?? "",
          title: item.title ?? "",
          uploader: item.uploader ?? "",
          duration: item.duration ?? "",
          startSec: Math.floor(item.startSec ?? 0),
          endSec: Math.floor(item.endSec ?? 0),
          answerText: item.answerText ?? "",
        })),
        deletes: [...deletes].sort(),
      };
      return JSON.stringify(payload);
    },
    [extractVideoId],
  );

  const showAutoSaveNotice = (type: "success" | "error", message: string) => {
    setAutoSaveNotice({ type, message });
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      setAutoSaveNotice(null);
    }, 2500);
  };

  const ownerId = authUser?.id ?? null;
  const resetBaseline = useCallback(() => {
    baselineSnapshotRef.current = buildSnapshot(
      playlistItems,
      collectionTitle,
      pendingDeleteIds,
    );
    baselineReadyRef.current = true;
  }, [buildSnapshot, collectionTitle, pendingDeleteIds, playlistItems]);
  const handleSavedBaseline = useCallback(() => {
    window.setTimeout(() => {
      resetBaseline();
    }, 0);
  }, [resetBaseline]);
  useCollectionLoader({
    authToken,
    ownerId,
    collectionId,
    authUser,
    displayUsername,
    refreshAuthToken,
    setCollections,
    setCollectionsLoading,
    setCollectionsError,
    setActiveCollectionId,
    setCollectionTitle,
    buildEditableItemsFromDb,
    setPlaylistItems,
    setItemsLoading,
    setItemsError,
    setHasUnsavedChanges,
    setSaveStatus,
    setSaveError,
    dirtyCounterRef,
  });

  const { handleSaveCollection } = useCollectionEditor({
    authToken,
    ownerId,
    collectionTitle,
    activeCollectionId,
    playlistItems,
    pendingDeleteIds,
    createServerId,
    parseDurationToSeconds,
    extractVideoId,
    setCollections,
    setActiveCollectionId,
    setPendingDeleteIds,
    setPlaylistItems,
    setSaveStatus,
    setSaveError,
    showAutoSaveNotice,
    setHasUnsavedChanges,
    dirtyCounterRef,
    saveInFlightRef,
    navigateToEdit: (id) =>
      navigate(`/collections/${id}/edit`, { replace: true }),
    markDirty,
    refreshAuthToken,
    onSaved: handleSavedBaseline,
  });
  const isReadOnly = !authToken;
  useEffect(() => {
    if (collectionId) {
      setActiveCollectionId(collectionId);
    } else {
      setActiveCollectionId(null);
      setCollectionTitle("");
    }
    baselineReadyRef.current = false;
    baselineSnapshotRef.current = "";
    setPlaylistItems([]);
    setPendingDeleteIds([]);
    setSelectedItemId(null);
    pendingSelectedIndexRef.current = 0;
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
    setSaveError(null);
    setAutoSaveNotice(null);
    dirtyCounterRef.current = 0;
  }, [collectionId]);

  useEffect(() => {
    if (itemsLoading || itemsError) return;
    if (!baselineReadyRef.current) {
      resetBaseline();
    }
  }, [itemsLoading, itemsError, resetBaseline]);

  useEffect(() => {
    if (!baselineReadyRef.current) return;
    const snapshot = buildSnapshot(
      playlistItems,
      collectionTitle,
      pendingDeleteIds,
    );
    const isDirty = snapshot !== baselineSnapshotRef.current;
    if (isDirty !== hasUnsavedChanges) {
      setHasUnsavedChanges(isDirty);
    }
    if (!isDirty) {
      dirtyCounterRef.current = 0;
    }
  }, [
    playlistItems,
    collectionTitle,
    pendingDeleteIds,
    buildSnapshot,
    hasUnsavedChanges,
  ]);

  useEffect(() => {
    if (!lastFetchedPlaylistTitle) return;
    if (collectionTitleTouched) return;
    if (collectionTitle.trim()) return;
    setCollectionTitle(lastFetchedPlaylistTitle);
  }, [collectionTitle, collectionTitleTouched, lastFetchedPlaylistTitle]);

  useEffect(() => {
    if (isTitleEditing) return;
    setTitleDraft(collectionTitle);
  }, [collectionTitle, isTitleEditing]);

  useEffect(() => {
    if (!playlistItems.length) {
      setSelectedItemId(null);
      pendingSelectedIndexRef.current = null;
      return;
    }
    if (pendingSelectedIndexRef.current !== null) {
      const idx = pendingSelectedIndexRef.current;
      pendingSelectedIndexRef.current = null;
      const item = playlistItems[idx];
      selectedStartRef.current = item?.startSec ?? 0;
      pendingAutoStartRef.current = selectedStartRef.current;
      shouldSeekToStartRef.current = true;
      setSelectedItemId(item ? item.localId : playlistItems[0].localId);
      autoPlaySeekedRef.current = false;
      return;
    }
    if (!selectedItemId) {
      selectedStartRef.current = playlistItems[0]?.startSec ?? 0;
      pendingAutoStartRef.current = selectedStartRef.current;
      shouldSeekToStartRef.current = true;
      setSelectedItemId(playlistItems[0].localId);
      autoPlaySeekedRef.current = false;
      return;
    }
    const exists = playlistItems.some(
      (item) => item.localId === selectedItemId,
    );
    if (!exists) {
      selectedStartRef.current = playlistItems[0]?.startSec ?? 0;
      pendingAutoStartRef.current = selectedStartRef.current;
      shouldSeekToStartRef.current = true;
      setSelectedItemId(playlistItems[0].localId);
      autoPlaySeekedRef.current = false;
    }
  }, [playlistItems, selectedItemId]);

  const selectedIndex = useMemo(() => {
    if (!playlistItems.length) return 0;
    if (!selectedItemId) return 0;
    const idx = playlistItems.findIndex(
      (item) => item.localId === selectedItemId,
    );
    return idx >= 0 ? idx : 0;
  }, [playlistItems, selectedItemId]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  const selectedItem = playlistItems[selectedIndex] ?? null;
  const durationSec = useMemo(() => {
    return (
      parseDurationToSeconds(selectedItem?.duration) ?? DEFAULT_DURATION_SEC
    );
  }, [selectedItem?.duration]);
  const maxSec = Math.max(1, durationSec);
  const canEditSingleMeta = singleTrackUrl.trim().length > 0;
  const isDuplicate = duplicateIndex !== null;
  const collectionCount = collections.length;
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
  const selectedClipDurationSec = selectedItem
    ? Math.max(0, selectedItem.endSec - selectedItem.startSec)
    : 0;

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
    markDirty,
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

  const syncDurationFromPlayer = useCallback(
    (durationSec: number, targetId?: string | null) => {
      if (!Number.isFinite(durationSec) || durationSec <= 0) return;
      const cap = Math.max(1, Math.floor(durationSec));
      const activeId = targetId ?? currentVideoItemIdRef.current;
      let didUpdate = false;
      setPlaylistItems((prev) =>
        prev.map((item) => {
          if (!activeId || item.localId !== activeId) return item;
          let nextEnd = item.endSec;
          if (!Number.isFinite(nextEnd) || nextEnd > cap) {
            nextEnd = cap;
          }
          if (nextEnd <= item.startSec) {
            nextEnd = Math.min(cap, item.startSec + 1);
          }
          const prevDurationSec = parseDurationToSeconds(item.duration) ?? null;
          const shouldUpdateDuration =
            prevDurationSec === null || Math.abs(cap - prevDurationSec) >= 2;
          const nextDuration = shouldUpdateDuration
            ? formatSeconds(cap)
            : item.duration;
          if (item.endSec !== nextEnd) {
            didUpdate = true;
          }
          if (shouldUpdateDuration && item.duration !== nextDuration) {
            didUpdate = true;
          }
          return shouldUpdateDuration
            ? { ...item, duration: nextDuration, endSec: nextEnd }
            : { ...item, endSec: nextEnd };
        }),
      );
      if (didUpdate) {
        markDirty();
      }
    },
    [markDirty],
  );

  useEffect(() => {
    if (!ytReady) return;
    if (reorderRef.current && selectedVideoId && playerRef.current) {
      const currentId = playerRef.current.getVideoData?.().video_id;
      if (currentId && currentId === selectedVideoId) {
        reorderRef.current = false;
        return;
      }
    }
    if (!selectedVideoId || !playerContainerRef.current) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      setIsPlaying(false);
      return;
    }

    playRequestedRef.current = autoPlayRef.current;
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    setIsPlayerReady(false);
    setIsPlaying(false);

    const yt = window.YT;
    if (!yt?.Player) return;
    const player = new yt.Player(playerContainerRef.current, {
      videoId: selectedVideoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        playsinline: 1,
        start: Math.floor(selectedStartRef.current),
      },
      events: {
        onReady: (event: YTPlayerEvent) => {
          setIsPlayerReady(true);
          event.target.setVolume?.(volume);
          const initialStart = Math.floor(selectedStartRef.current);
          if (autoPlayRef.current) {
            playRequestedRef.current = true;
            event.target.loadVideoById?.({
              videoId: selectedVideoId,
              startSeconds: initialStart,
            });
            const pendingStart = pendingAutoStartRef.current;
            if (pendingStart !== null && Number.isFinite(pendingStart)) {
              window.setTimeout(() => {
                event.target.seekTo?.(pendingStart, true);
              }, 0);
              pendingAutoStartRef.current = null;
            }
            setIsPlaying(true);
          } else {
            playRequestedRef.current = false;
            event.target.cueVideoById?.({
              videoId: selectedVideoId,
              startSeconds: initialStart,
            });
            event.target.pauseVideo?.();
            setIsPlaying(false);
          }
          const boundItemId = currentVideoItemIdRef.current;
          let attempts = 0;
          const trySync = () => {
            const duration = event.target.getDuration?.();
            if (duration && duration > 0) {
              syncDurationFromPlayer(duration, boundItemId);
              return;
            }
            attempts += 1;
            if (attempts < 5) {
              window.setTimeout(trySync, 300);
            }
          };
          trySync();
        },
        onStateChange: (event: YTPlayerStateEvent) => {
          const state = window.YT?.PlayerState;
          if (!state) return;
          if (event.data === state.PLAYING) {
            if (!playRequestedRef.current) {
              event.target.pauseVideo?.();
              setIsPlaying(false);
              return;
            }
            if (autoPlayRef.current && !autoPlaySeekedRef.current) {
              const targetStart = selectedStartRef.current;
              const current = event.target.getCurrentTime?.();
              if (
                typeof current === "number" &&
                targetStart > 0 &&
                current < targetStart - 0.2
              ) {
                event.target.seekTo?.(targetStart, true);
                autoPlaySeekedRef.current = true;
              }
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
    lastSelectedVideoIdRef.current = selectedVideoId;

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [ytReady, selectedVideoId, syncDurationFromPlayer]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    if (autoPlayOnSwitch) return;
    playerRef.current.seekTo?.(startSec, true);
    setCurrentTimeSec(startSec);
  }, [startSec, isPlayerReady, selectedVideoId, autoPlayOnSwitch]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    playerRef.current.setVolume?.(volume);
  }, [volume, isPlayerReady]);

  useEffect(() => {
    if (!autoPlayOnSwitch) return;
    if (!isPlayerReady || !playerRef.current) return;
    playRequestedRef.current = true;
    if (shouldSeekToStartRef.current) {
      shouldSeekToStartRef.current = false;
      playerRef.current.seekTo?.(selectedStartRef.current, true);
      setCurrentTimeSec(selectedStartRef.current);
    }
    if (pendingAutoStartRef.current !== null) {
      const pendingStart = pendingAutoStartRef.current;
      pendingAutoStartRef.current = null;
      playerRef.current.seekTo?.(pendingStart, true);
      setCurrentTimeSec(pendingStart);
    }
    if (!isPlaying) {
      playerRef.current.playVideo?.();
      setIsPlaying(true);
    }
  }, [autoPlayOnSwitch, isPlayerReady, selectedVideoId]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const current = player.getCurrentTime();
      setCurrentTimeSec(current);
      if (current >= effectiveEnd - 0.2) {
        if (loopEnabled) {
          player.seekTo?.(startSec, true);
          if (isPlaying) {
            player.playVideo?.();
          } else {
            player.pauseVideo?.();
          }
        } else {
          player.seekTo?.(effectiveEnd, true);
          player.pauseVideo?.();
          setIsPlaying(false);
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [
    isPlayerReady,
    startSec,
    effectiveEnd,
    isPlaying,
    selectedVideoId,
    loopEnabled,
  ]);

  useEffect(() => {
    if (!selectedItem) {
      lastSelectedIdRef.current = null;
      return;
    }
    currentVideoItemIdRef.current = selectedItem.localId;
    const nextId = selectedItem.localId;
    if (lastSelectedIdRef.current === nextId) return;
    if (reorderRef.current && reorderSelectedIdRef.current === nextId) {
      reorderRef.current = false;
      return;
    }
    lastSelectedIdRef.current = nextId;
    reorderRef.current = false;
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
    shouldSeekToStartRef.current = true;
    selectedStartRef.current = nextStart;
  }, [selectedItemId, maxSec]);

  useEffect(() => {
    if (!selectedItem) return;
    const nextStart = Math.min(selectedItem.startSec, maxSec);
    const nextEnd = Math.min(
      Math.max(selectedItem.endSec, nextStart + 1),
      maxSec,
    );
    if (nextStart !== startSec) {
      setStartSec(nextStart);
      setStartTimeInput(formatSeconds(nextStart));
    }
    if (nextEnd !== endSec) {
      setEndSec(nextEnd);
      setEndTimeInput(formatSeconds(nextEnd));
    }
  }, [selectedItem?.startSec, selectedItem?.endSec, maxSec, startSec, endSec]);

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
    setSaveStatus("idle");
    const target = playlistItems[nextIndex];
    selectedStartRef.current = target?.startSec ?? 0;
    pendingAutoStartRef.current = selectedStartRef.current;
    shouldSeekToStartRef.current = true;
    setSelectedItemId(target ? target.localId : null);
    autoPlaySeekedRef.current = false;
  };

  const handleImportPlaylist = () => {
    if (playlistLoading) return;
    setPlaylistAddError(null);
    setPendingPlaylistImport(true);
    handleFetchPlaylist();
  };

  const applyPlaylistTitle = () => {
    if (!lastFetchedPlaylistTitle) return;
    setCollectionTitle(lastFetchedPlaylistTitle);
    setCollectionTitleTouched(true);
    markDirty();
  };

  const handleAddSingleTrack = () => {
    setSingleTrackError(null);
    const url = singleTrackUrl.trim();
    const title = singleTrackTitle.trim();
    if (!url && !title) {
      setSingleTrackError("請輸入 YouTube 連結或歌曲名稱");
      return;
    }
    const candidateKey = getPlaylistItemKey({ url, title });
    if (candidateKey) {
      const existingKeys = new Set(
        playlistItems.map((item) => getPlaylistItemKey(item)).filter(Boolean),
      );
      if (existingKeys.has(candidateKey)) {
        setSingleTrackError(DUPLICATE_SONG_ERROR);
        return;
      }
    }

    const durationSec =
      parseDurationToSeconds(singleTrackDuration) ?? DEFAULT_DURATION_SEC;
    const safeDuration = Math.max(1, durationSec);
    const videoId = extractVideoId(url);
    const thumbnail = videoId ? thumbnailFromId(videoId) : undefined;
    const resolvedTitle = title || url;
    const newItem: EditableItem = {
      localId: createLocalId(),
      title: resolvedTitle,
      url: url || "",
      thumbnail,
      uploader: singleTrackUploader.trim(),
      duration: formatSeconds(safeDuration),
      startSec: 0,
      endSec: Math.max(1, Math.min(DEFAULT_DURATION_SEC, safeDuration)),
      answerText: singleTrackAnswer.trim() || resolvedTitle,
    };

    setPlaylistItems((prev) => {
      const insertIndex = prev.length;
      const next = [...prev, newItem];
      setSelectedItemId(newItem.localId);
      setPendingScrollIndex(insertIndex);
      return next;
    });
    markDirty();
    setSingleTrackUrl("");
    setSingleTrackTitle("");
    setSingleTrackDuration("");
    setSingleTrackAnswer("");
    setSingleTrackUploader("");
    setSingleTrackOpen(false);
    setDuplicateIndex(null);
  };

  const fetchOEmbedMeta = async (url: string) => {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      url,
    )}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error("無法解析影片資訊，請確認連結是否正確或可公開瀏覽");
    }
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return data;
  };

  const handleSingleTrackResolve = useCallback(async () => {
    const url = singleTrackUrl.trim();
    if (!url) {
      setSingleTrackError("請先貼上 YouTube 影片連結");
      return;
    }
    if (singleTrackLoading) return;
    if (lastResolvedUrlRef.current === url) return;
    setSingleTrackLoading(true);
    setSingleTrackError(null);
    try {
      const meta = await fetchOEmbedMeta(url);
      if (meta.title) {
        setSingleTrackTitle(meta.title);
      }
      if (meta.author_name) {
        setSingleTrackUploader(meta.author_name);
      }
      if (!singleTrackAnswer && meta.title) {
        setSingleTrackAnswer(meta.title);
      }
    } catch (error) {
      setSingleTrackError(
        error instanceof Error ? error.message : "解析失敗，請稍後再試",
      );
    } finally {
      lastResolvedUrlRef.current = url;
      setSingleTrackLoading(false);
    }
  }, [singleTrackAnswer, singleTrackLoading, singleTrackUrl]);

  useEffect(() => {
    const url = singleTrackUrl.trim();
    if (!url) return;
    if (!/youtu\.be|youtube\.com/.test(url)) return;
    void handleSingleTrackResolve();
  }, [handleSingleTrackResolve, singleTrackUrl]);

  useEffect(() => {
    const url = singleTrackUrl.trim();
    if (url === lastUrlRef.current) return;
    lastUrlRef.current = url;
    if (!url) {
      setDuplicateIndex(null);
      setSingleTrackError(null);
      return;
    }
    setSingleTrackTitle("");
    setSingleTrackAnswer("");
    setSingleTrackUploader("");
    setSingleTrackError(null);
    const key = getPlaylistItemKey({ url });
    if (!key) {
      setDuplicateIndex(null);
      return;
    }
    const matchIndex = playlistItems.findIndex(
      (item) => getPlaylistItemKey(item) === key,
    );
    setDuplicateIndex(matchIndex >= 0 ? matchIndex : null);
  }, [playlistItems, singleTrackUrl]);

  const scrollListToIndex = useCallback(
    (index: number) => {
      const container = listContainerRef.current;
      const target = playlistItems[index];
      if (!container || !target) return;
      const node = itemRefs.current.get(target.localId);
      if (!node) return;
      const top = node.offsetTop - container.offsetTop;
      const nextScroll = Math.max(
        0,
        top - container.clientHeight / 2 + node.clientHeight / 2,
      );
      container.scrollTo({ top: nextScroll, behavior: "smooth" });
    },
    [playlistItems],
  );

  useEffect(() => {
    if (pendingScrollIndex === null) return;
    scrollListToIndex(pendingScrollIndex);
    setHighlightIndex(pendingScrollIndex);
    setPendingScrollIndex(null);
  }, [pendingScrollIndex, scrollListToIndex]);

  useEffect(() => {
    if (duplicateIndex === null) return;
    scrollListToIndex(duplicateIndex);
    setHighlightIndex(duplicateIndex);
  }, [duplicateIndex, scrollListToIndex]);

  useEffect(() => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    if (highlightIndex === null) return;
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightIndex(null);
    }, 1400);
  }, [highlightIndex]);

  const handleStartChange = (value: number) => {
    const next = Math.min(Math.max(0, value), maxSec);
    const nextEnd = next > endSec ? next : endSec;
    setStartSec(next);
    selectedStartRef.current = next;
    pendingAutoStartRef.current = next;
    setEndSec(nextEnd);
    setStartTimeInput(formatSeconds(next));
    setEndTimeInput(formatSeconds(nextEnd));
    setCurrentTimeSec(next);
    updateSelectedItem({ startSec: next, endSec: nextEnd });
    if (isPlayerReady && playerRef.current) {
      playRequestedRef.current = true;
      shouldSeekToStartRef.current = false;
      playerRef.current.seekTo?.(next, true);
      playerRef.current.playVideo?.();
      setIsPlaying(true);
    }
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

  const handleRangeChange = (value: number[], activeThumb: number) => {
    const [rawStart, rawEnd] = value;
    const nextStart = Math.min(Math.max(0, rawStart), maxSec);
    const nextEnd = Math.min(Math.max(0, rawEnd), maxSec);
    setStartSec(nextStart);
    selectedStartRef.current = nextStart;
    pendingAutoStartRef.current = nextStart;
    setEndSec(nextEnd);
    setStartTimeInput(formatSeconds(nextStart));
    setEndTimeInput(formatSeconds(nextEnd));
    if (activeThumb === 0) {
      setCurrentTimeSec(nextStart);
      if (isPlayerReady && playerRef.current) {
        playRequestedRef.current = true;
        shouldSeekToStartRef.current = false;
        playerRef.current.seekTo?.(nextStart, true);
        playerRef.current.playVideo?.();
        setIsPlaying(true);
      }
      selectedStartRef.current = nextStart;
      pendingAutoStartRef.current = nextStart;
    } else {
      setCurrentTimeSec((prev) => Math.min(Math.max(prev, nextStart), nextEnd));
      if (isPlayerReady && playerRef.current) {
        const previewStart = Math.max(nextStart, nextEnd - 3);
        playRequestedRef.current = true;
        shouldSeekToStartRef.current = false;
        playerRef.current.seekTo?.(previewStart, true);
        playerRef.current.playVideo?.();
        setIsPlaying(true);
      }
    }
    updateSelectedItem({ startSec: nextStart, endSec: nextEnd });
  };

  const handleRangeCommit = (value: number[], activeThumb: number) => {
    if (activeThumb !== 0) return;
    const [rawStart, rawEnd] = value;
    const nextStart = Math.min(Math.max(0, rawStart), maxSec);
    const nextEnd = Math.min(Math.max(0, rawEnd), maxSec);
    setStartSec(nextStart);
    setEndSec(nextEnd);
    setStartTimeInput(formatSeconds(nextStart));
    setEndTimeInput(formatSeconds(nextEnd));
    setCurrentTimeSec(nextStart);
    updateSelectedItem({ startSec: nextStart, endSec: nextEnd });
  };

  const handleStartThumbPress = () => {
    if (!isPlayerReady || !playerRef.current) return;
    playRequestedRef.current = true;
    shouldSeekToStartRef.current = false;
    playerRef.current.seekTo?.(startSec, true);
    playerRef.current.playVideo?.();
    setIsPlaying(true);
  };

  const handleEndThumbPress = () => {
    if (!isPlayerReady || !playerRef.current) return;
    const previewStart = Math.max(startSec, endSec - 3);
    playRequestedRef.current = true;
    shouldSeekToStartRef.current = false;
    playerRef.current.seekTo?.(previewStart, true);
    playerRef.current.playVideo?.();
    setIsPlaying(true);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    reorderRef.current = true;
    reorderSelectedIdRef.current = lastSelectedIdRef.current;
    let didMove = false;
    setPlaylistItems((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex > prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      didMove = true;
      return next;
    });

    if (didMove) {
      markDirty();
    }
  };

  const removeItem = (index: number) => {
    markDirty();
    const removedId = playlistItems[index]?.localId ?? null;
    setPlaylistItems((prev) => {
      const target = prev[index];
      if (target?.dbId) {
        setPendingDeleteIds((ids) =>
          ids.includes(target.dbId!) ? ids : [...ids, target.dbId!],
        );
      }
      return prev.filter((_item, idx) => idx !== index);
    });
    if (removedId && removedId === selectedItemId) {
      const next =
        playlistItems[index + 1]?.localId ??
        playlistItems[index - 1]?.localId ??
        null;
      setSelectedItemId(next);
    }
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
      if (shouldSeekToStartRef.current) {
        shouldSeekToStartRef.current = false;
        player.seekTo?.(selectedStartRef.current, true);
      }
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

  const handleAutoPlayToggle = (value: boolean) => {
    setAutoPlayOnSwitch(value);
    autoPlayRef.current = value;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDIT_AUTOPLAY_STORAGE_KEY, value ? "1" : "0");
    }
  };

  const handleLoopToggle = (value: boolean) => {
    setLoopEnabled(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDIT_LOOP_STORAGE_KEY, value ? "1" : "0");
    }
  };

  const handleProgressChange = (value: number) => {
    const clamped = Math.min(effectiveEnd, Math.max(startSec, value));
    setCurrentTimeSec(clamped);
    if (playerRef.current) {
      shouldSeekToStartRef.current = false;
      playerRef.current.seekTo?.(clamped, true);
      if (!isPlaying) {
        playerRef.current.pauseVideo?.();
      }
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col w-95/100 space-y-4">
        <div className="text-xs text-[var(--mc-text-muted)]">載入中...</div>
        <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 p-4 text-sm text-[var(--mc-text-muted)]">
          正在確認登入狀態
        </div>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-5 text-sm text-[var(--mc-text)]">
          請先使用 Google 登入後再編輯收藏庫。
        </div>
        <div className="text-sm text-[var(--mc-text-muted)]">
          目前為訪客模式，無法使用收藏庫功能。
        </div>
        <div>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/collections", { replace: true })}
          >
            {TEXT.backRooms}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-3 overflow-x-hidden min-h-0">
      {/* <div className="w-full md:w-full lg:w-3/5 mx-auto space-y-4"> */}
      <EditHeader
        title={collectionTitle}
        titleDraft={titleDraft}
        isTitleEditing={isTitleEditing}
        onTitleDraftChange={(value) => setTitleDraft(value)}
        onTitleSave={() => {
          const nextTitle = titleDraft.trim();
          if (nextTitle) {
            setCollectionTitle(nextTitle);
            if (!collectionTitleTouched) {
              setCollectionTitleTouched(true);
            }
            markDirty();
          }
          setIsTitleEditing(false);
        }}
        onTitleCancel={() => {
          setTitleDraft(collectionTitle);
          setIsTitleEditing(false);
        }}
        onStartEdit={() => {
          setTitleDraft(collectionTitle);
          setIsTitleEditing(true);
        }}
        showApplyPlaylistTitle={
          !!lastFetchedPlaylistTitle &&
          lastFetchedPlaylistTitle !== collectionTitle.trim()
        }
        onApplyPlaylistTitle={applyPlaylistTitle}
        onBack={() => {
          if (!confirmLeave()) return;
          navigate("/collections", { replace: true });
        }}
        onSave={() => handleSaveCollection("manual")}
        isSaving={saveStatus === "saving"}
        isReadOnly={isReadOnly}
        saveLabel={SAVE_LABEL}
        savingLabel={SAVING_LABEL}
        savedLabel={SAVED_LABEL}
        saveErrorLabel={SAVE_ERROR_LABEL}
        saveStatus={saveStatus}
        saveError={saveError}
        autoSaveNotice={autoSaveNotice}
        hasUnsavedChanges={hasUnsavedChanges}
        collectionCount={collectionCount}
        onCollectionButtonClick={(event) => {
          setCollectionAnchor(event.currentTarget);
          setCollectionMenuOpen((prev) => !prev);
        }}
        onPlaylistButtonClick={(event) => {
          setPlaylistAnchor(event.currentTarget);
          setPlaylistPanelOpen((prev) => !prev);
        }}
        collectionMenuOpen={collectionMenuOpen}
        playlistMenuOpen={playlistPanelOpen}
      />
      <CollectionPopover
        open={collectionMenuOpen}
        anchorEl={collectionAnchor}
        onClose={() => setCollectionMenuOpen(false)}
        label={COLLECTION_SELECT_LABEL}
        newLabel={NEW_COLLECTION_LABEL}
        collections={collections}
        activeCollectionId={activeCollectionId}
        onCreateNew={() => {
          if (!confirmLeave()) return;
          setCollectionMenuOpen(false);
          navigate("/collections/new");
        }}
        onSelect={(id) => {
          if (!confirmLeave()) return;
          setCollectionMenuOpen(false);
          navigate(`/collections/${id}/edit`);
          setActiveCollectionId(id);
          const selected = collections.find((item) => item.id === id);
          setCollectionTitle(selected?.title ?? "");
          setPlaylistItems([]);
          setPlaylistAddError(null);
          setPendingDeleteIds([]);
          setSelectedItemId(null);
          pendingSelectedIndexRef.current = 0;
          setHasUnsavedChanges(false);
          setSaveStatus("idle");
          setSaveError(null);
          dirtyCounterRef.current = 0;
        }}
      />
      <PlaylistPopover
        open={playlistPanelOpen}
        anchorEl={playlistAnchor}
        onClose={() => setPlaylistPanelOpen(false)}
        label={TEXT.playlistLabel}
        playlistUrl={playlistUrl}
        onChangeUrl={(value) => {
          setPlaylistUrl(value);
          if (playlistAddError) setPlaylistAddError(null);
        }}
        onImport={handleImportPlaylist}
        playlistLoading={playlistLoading}
        playlistError={playlistError}
        playlistAddError={playlistAddError}
      />
      <div
        className={`rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-1 shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)] overflow-hidden min-h-0 ${
          isReadOnly ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <StatusRow
          collectionsLoading={collectionsLoading}
          itemsLoading={itemsLoading}
          collectionsError={collectionsError}
          itemsError={itemsError}
          loadingLabel={LOADING_LABEL}
        />
        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="order-2 lg:order-2 min-w-0">
            {playlistItems.length > 0 && (
              <PlaylistListPanel
                items={playlistItems}
                selectedIndex={selectedIndex}
                onSelect={handleSelectIndex}
                onRemove={removeItem}
                onMove={moveItem}
                onReorder={moveItem}
                listRef={listContainerRef}
                registerItemRef={(node, id) => {
                  if (!node) {
                    itemRefs.current.delete(id);
                    return;
                  }
                  itemRefs.current.set(id, node);
                }}
                highlightIndex={highlightIndex}
                clipDurationLabel={CLIP_DURATION_LABEL}
                formatSeconds={formatSeconds}
                onAddSingleToggle={() => setSingleTrackOpen(true)}
                singleTrackOpen={singleTrackOpen}
                singleTrackUrl={singleTrackUrl}
                singleTrackTitle={singleTrackTitle}
                singleTrackAnswer={singleTrackAnswer}
                singleTrackError={singleTrackError}
                singleTrackLoading={singleTrackLoading}
                isDuplicate={isDuplicate}
                canEditSingleMeta={canEditSingleMeta}
                onSingleTrackUrlChange={(value) => setSingleTrackUrl(value)}
                onSingleTrackTitleChange={(value) => setSingleTrackTitle(value)}
                onSingleTrackAnswerChange={(value) =>
                  setSingleTrackAnswer(value)
                }
                onSingleTrackCancel={() => {
                  setSingleTrackOpen(false);
                  setSingleTrackError(null);
                }}
                onAddSingle={handleAddSingleTrack}
              />
            )}
          </div>
          <div className="order-1 lg:order-1 min-w-0 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
              <PlayerPanel
                selectedVideoId={selectedVideoId}
                selectedTitle={selectedItem?.title ?? TEXT.selectSong}
                selectedUploader={selectedItem?.uploader ?? ""}
                selectedDuration={selectedItem?.duration}
                selectedClipDurationLabel={CLIP_DURATION_LABEL}
                selectedClipDurationSec={formatSeconds(selectedClipDurationSec)}
                clipCurrentSec={formatSeconds(clipCurrentSec)}
                clipDurationSec={formatSeconds(clipDurationSec)}
                clipProgressPercent={clipProgressPercent}
                startSec={startSec}
                effectiveEnd={effectiveEnd}
                currentTimeSec={currentTimeSec}
                onProgressChange={handleProgressChange}
                onTogglePlayback={togglePlayback}
                isPlayerReady={isPlayerReady}
                isPlaying={isPlaying}
                onVolumeChange={handleVolumeChange}
                volume={volume}
                autoPlayOnSwitch={autoPlayOnSwitch}
                onAutoPlayChange={handleAutoPlayToggle}
                autoPlayLabel="切換自動播放"
                loopEnabled={loopEnabled}
                onLoopChange={handleLoopToggle}
                loopLabel="循環播放"
                playLabel={PLAY_LABEL}
                pauseLabel={PAUSE_LABEL}
                volumeLabel={VOLUME_LABEL}
                noSelectionLabel={TEXT.noSelection}
                playerContainerRef={playerContainerRef}
                thumbnail={selectedItem?.thumbnail}
              />
              <AnswerPanel
                title={TEXT.answer}
                value={answerText}
                placeholder={TEXT.answerPlaceholder}
                disabled={!selectedItem}
                hint="用於遊戲作答的答案"
                primaryActionLabel="套用標題"
                onPrimaryAction={() => {
                  if (!selectedItem?.title) return;
                  setAnswerText(selectedItem.title);
                  updateSelectedItem({
                    answerText: selectedItem.title,
                  });
                }}
                secondaryActionLabel="清空"
                onSecondaryAction={() => {
                  setAnswerText("");
                  updateSelectedItem({ answerText: "" });
                }}
                maxLength={ANSWER_MAX_LENGTH}
                onChange={(value) => {
                  setAnswerText(value);
                  updateSelectedItem({ answerText: value });
                }}
              />
            </div>
            <ClipEditorPanel
              title={TEXT.editTime}
              startLabel={TEXT.start}
              endLabel={TEXT.end}
              startTimeLabel={START_TIME_LABEL}
              endTimeLabel={END_TIME_LABEL}
              startSec={startSec}
              endSec={endSec}
              maxSec={maxSec}
              onRangeChange={handleRangeChange}
              onRangeCommit={handleRangeCommit}
              onStartThumbPress={handleStartThumbPress}
              onEndThumbPress={handleEndThumbPress}
              formatSeconds={formatSeconds}
              startTimeInput={startTimeInput}
              endTimeInput={endTimeInput}
              onStartInputChange={(value) => setStartTimeInput(value)}
              onEndInputChange={(value) => setEndTimeInput(value)}
              onStartBlur={() => {
                const parsed = parseTimeInput(startTimeInput);
                if (parsed === null) {
                  setStartTimeInput(formatSeconds(startSec));
                  return;
                }
                if (parsed === startSec) {
                  setStartTimeInput(formatSeconds(startSec));
                  return;
                }
                handleStartChange(parsed);
              }}
              onEndBlur={() => {
                const parsed = parseTimeInput(endTimeInput);
                if (parsed === null) {
                  setEndTimeInput(formatSeconds(endSec));
                  return;
                }
                if (parsed === endSec) {
                  setEndTimeInput(formatSeconds(endSec));
                  return;
                }
                handleEndChange(parsed);
              }}
              onStartKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onEndKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
        </div>
      </div>
      {autoSaveNotice && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-3 py-2 text-xs text-white shadow ${
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
