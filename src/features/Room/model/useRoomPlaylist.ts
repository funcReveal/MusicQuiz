import { useCallback, useEffect, useMemo, useState } from "react";

import type { PlaylistItem } from "./types";
import type { YoutubePlaylist } from "./RoomContext";
import {
  apiFetchYoutubePlaylistItems,
  apiFetchYoutubePlaylists,
  apiPreviewPlaylist,
} from "./roomApi";
import {
  clampQuestionCount,
  getQuestionMax,
  normalizePlaylistItems,
} from "./roomUtils";
import { QUESTION_STEP } from "./roomConstants";
import { getStoredQuestionCount } from "./roomStorage";

type UseRoomPlaylistOptions = {
  apiUrl: string;
  authToken: string | null;
  refreshAuthToken: () => Promise<string | null>;
  setStatusText: (value: string | null) => void;
  onResetCollection: () => void;
};

export type UseRoomPlaylistResult = {
  playlistUrl: string;
  setPlaylistUrl: (value: string) => void;
  playlistItems: PlaylistItem[];
  setPlaylistItems: (items: PlaylistItem[]) => void;
  playlistError: string | null;
  playlistLoading: boolean;
  playlistStage: "input" | "preview";
  playlistLocked: boolean;
  lastFetchedPlaylistId: string | null;
  lastFetchedPlaylistTitle: string | null;
  questionCount: number;
  questionMin: number;
  questionMaxLimit: number;
  questionStep: number;
  updateQuestionCount: (value: number) => number;
  handleFetchPlaylist: () => Promise<void>;
  handleResetPlaylist: () => void;
  youtubePlaylists: YoutubePlaylist[];
  youtubePlaylistsLoading: boolean;
  youtubePlaylistsError: string | null;
  fetchYoutubePlaylists: () => Promise<void>;
  importYoutubePlaylist: (playlistId: string) => Promise<void>;
  applyPlaylistSource: (items: PlaylistItem[], sourceId: string) => void;
  clearPlaylistError: () => void;
  resetPlaylistState: () => void;
  resetYoutubePlaylists: () => void;
};

const QUESTION_MIN = 5;

export const useRoomPlaylist = ({
  apiUrl,
  authToken,
  refreshAuthToken,
  setStatusText,
  onResetCollection,
}: UseRoomPlaylistOptions): UseRoomPlaylistResult => {
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
  >(null);
  const [lastFetchedPlaylistTitle, setLastFetchedPlaylistTitle] = useState<
    string | null
  >(null);
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const saved = getStoredQuestionCount();
    const initial =
      typeof saved === "number" && Number.isFinite(saved) ? saved : 10;
    return clampQuestionCount(initial, getQuestionMax(0));
  });

  const [youtubePlaylists, setYoutubePlaylists] = useState<YoutubePlaylist[]>(
    [],
  );
  const [youtubePlaylistsLoading, setYoutubePlaylistsLoading] = useState(false);
  const [youtubePlaylistsError, setYoutubePlaylistsError] = useState<
    string | null
  >(null);

  const questionMaxLimit = useMemo(
    () => getQuestionMax(playlistItems.length),
    [playlistItems.length],
  );

  const updateQuestionCount = (value: number) => {
    const clamped = clampQuestionCount(value, questionMaxLimit);
    setQuestionCount(clamped);
    return clamped;
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

  const fetchYoutubePlaylists = useCallback(async () => {
    if (!apiUrl || !authToken) {
      setYoutubePlaylistsError("請先登入後再使用播放清單");
      return;
    }
    setYoutubePlaylistsLoading(true);
    setYoutubePlaylistsError(null);
    try {
      const run = async (token: string, allowRetry: boolean) => {
        const { ok, status, payload } = await apiFetchYoutubePlaylists(
          apiUrl,
          token,
        );
        if (ok) {
          setYoutubePlaylists(payload?.data ?? []);
          return;
        }
        if (status === 401 && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            await run(refreshed, false);
            return;
          }
        }
        const message = payload?.error ?? "載入播放清單失敗";
        const normalized = String(message).toLowerCase();
        if (
          normalized.includes("insufficient authentication scopes") ||
          normalized.includes("insufficientpermissions")
        ) {
          throw new Error("需要重新授權 Google");
        }
        if (normalized.includes("channel not found")) {
          throw new Error("尚未建立 YouTube 頻道或沒有播放清單");
        }
        if (String(message).includes("Missing refresh token")) {
          throw new Error("需要重新授權 Google");
        }
        if (status === 401) {
          throw new Error("登入已過期，需要重新授權 Google");
        }
        throw new Error(message);
      };

      await run(authToken, true);
    } catch (error) {
      setYoutubePlaylistsError(
        error instanceof Error ? error.message : "載入播放清單失敗",
      );
    } finally {
      setYoutubePlaylistsLoading(false);
    }
  }, [apiUrl, authToken, refreshAuthToken]);

  const importYoutubePlaylist = useCallback(
    async (playlistId: string) => {
      if (!apiUrl || !authToken) {
        setPlaylistError("請先登入後再使用播放清單");
        return;
      }
      setPlaylistLoading(true);
      setPlaylistError(null);
      try {
        const run = async (token: string, allowRetry: boolean) => {
          const { ok, status, payload } = await apiFetchYoutubePlaylistItems(
            apiUrl,
            token,
            playlistId,
          );
          if (ok) {
            const data = payload?.data;
            if (!data?.items || data.items.length === 0) {
              throw new Error("清單沒有可用影片");
            }
            const normalizedItems = normalizePlaylistItems(data.items);
            setPlaylistItems(normalizedItems);
            setPlaylistStage("preview");
            setPlaylistLocked(true);
            setLastFetchedPlaylistId(data.playlistId ?? playlistId);
            const playlistTitle =
              youtubePlaylists.find((item) => item.id === playlistId)?.title ??
              null;
            setLastFetchedPlaylistTitle(playlistTitle);
            setStatusText(`已載入播放清單，共 ${normalizedItems.length} 首`);
            return;
          }
          if (status === 401 && allowRetry) {
            const refreshed = await refreshAuthToken();
            if (refreshed) {
              await run(refreshed, false);
              return;
            }
          }
          const message = payload?.error ?? "讀取播放清單失敗";
          const normalized = String(message).toLowerCase();
          if (
            normalized.includes("insufficient authentication scopes") ||
            normalized.includes("insufficientpermissions")
          ) {
            throw new Error("需要重新授權 Google");
          }
          if (normalized.includes("channel not found")) {
            throw new Error("尚未建立 YouTube 頻道或沒有播放清單");
          }
          if (status === 401) {
            throw new Error("登入已過期，需要重新授權 Google");
          }
          throw new Error(message);
        };

        await run(authToken, true);
      } catch (error) {
        setPlaylistError(
          error instanceof Error ? error.message : "讀取播放清單時發生錯誤",
        );
        setPlaylistItems([]);
        setPlaylistStage("input");
        setPlaylistLocked(false);
        setLastFetchedPlaylistId(null);
        setLastFetchedPlaylistTitle(null);
      } finally {
        setPlaylistLoading(false);
      }
    },
    [apiUrl, authToken, refreshAuthToken, setStatusText, youtubePlaylists],
  );

  const handleFetchPlaylist = useCallback(async () => {
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

    if (!apiUrl) {
      setPlaylistError("尚未設定播放清單 API 位置 (API_URL)");
      return;
    }

    setPlaylistLoading(true);

    try {
      const { ok, payload } = await apiPreviewPlaylist(
        apiUrl,
        playlistUrl,
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

      const normalizedItems = normalizePlaylistItems(data.items);
      setPlaylistItems(normalizedItems);
      setPlaylistStage("preview");
      setPlaylistLocked(true);
      setLastFetchedPlaylistId(data.playlistId ?? playlistId);
      setLastFetchedPlaylistTitle(data.title ?? null);

      if (
        data.expectedCount !== null &&
        data.expectedCount !== data.items.length
      ) {
        setStatusText(
          `已載入播放清單，共 ${normalizedItems.length} 首（已略過私人或無法存取的影片）`,
        );
      } else {
        setStatusText(`已載入播放清單，共 ${normalizedItems.length} 首`);
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
      setLastFetchedPlaylistTitle(null);
    } finally {
      setPlaylistLoading(false);
    }
  }, [
    apiUrl,
    lastFetchedPlaylistId,
    playlistLocked,
    playlistUrl,
    setStatusText,
  ]);

  const handleResetPlaylist = useCallback(() => {
    setPlaylistUrl("");
    setPlaylistItems([]);
    setPlaylistError(null);
    setPlaylistLoading(false);
    setPlaylistStage("input");
    setPlaylistLocked(false);
    setLastFetchedPlaylistId(null);
    setLastFetchedPlaylistTitle(null);
    onResetCollection();
    setStatusText("已重置來源，請重新選擇");
  }, [onResetCollection, setStatusText]);

  const applyPlaylistSource = (items: PlaylistItem[], sourceId: string) => {
    setPlaylistItems(items);
    setPlaylistStage("preview");
    setPlaylistLocked(true);
    setLastFetchedPlaylistId(sourceId);
  };

  const clearPlaylistError = () => {
    setPlaylistError(null);
  };

  const resetPlaylistState = useCallback(() => {
    setPlaylistUrl("");
    setPlaylistItems([]);
    setPlaylistError(null);
    setPlaylistLoading(false);
    setPlaylistStage("input");
    setPlaylistLocked(false);
    setLastFetchedPlaylistId(null);
    setLastFetchedPlaylistTitle(null);
  }, []);

  const resetYoutubePlaylists = useCallback(() => {
    setYoutubePlaylists([]);
    setYoutubePlaylistsError(null);
    setYoutubePlaylistsLoading(false);
  }, []);

  useEffect(() => {
    if (playlistItems.length === 0) return;
    const maxValue = getQuestionMax(playlistItems.length);
    if (questionCount > maxValue) {
      setQuestionCount(maxValue);
    }
  }, [playlistItems.length, questionCount]);

  return {
    playlistUrl,
    setPlaylistUrl,
    playlistItems,
    setPlaylistItems,
    playlistError,
    playlistLoading,
    playlistStage,
    playlistLocked,
    lastFetchedPlaylistId,
    lastFetchedPlaylistTitle,
    questionCount,
    questionMin: QUESTION_MIN,
    questionMaxLimit,
    questionStep: QUESTION_STEP,
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
  };
};
