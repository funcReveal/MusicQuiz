import { useCallback, useState } from "react";

import type { PlaylistItem } from "./types";
import { apiFetchCollectionItems, apiFetchCollections } from "./roomApi";
import {
  formatSeconds,
  normalizePlaylistItems,
  thumbnailFromId,
  videoUrlFromId,
} from "./roomUtils";
import { DEFAULT_CLIP_SEC, DEFAULT_PAGE_SIZE } from "./roomConstants";

type UseRoomCollectionsOptions = {
  workerUrl?: string;
  authToken: string | null;
  ownerId?: string | null;
  refreshAuthToken: () => Promise<string | null>;
  setStatusText: (value: string | null) => void;
  onPlaylistLoaded: (items: PlaylistItem[], sourceId: string) => void;
  onPlaylistReset: () => void;
};

export type UseRoomCollectionsResult = {
  collections: Array<{ id: string; title: string; description?: string | null }>;
  collectionsLoading: boolean;
  collectionsError: string | null;
  selectedCollectionId: string | null;
  collectionItemsLoading: boolean;
  collectionItemsError: string | null;
  selectCollection: (collectionId: string | null) => void;
  fetchCollections: () => Promise<void>;
  loadCollectionItems: (collectionId: string) => Promise<void>;
  resetCollectionsState: () => void;
  resetCollectionSelection: () => void;
  clearCollectionsError: () => void;
};

export const useRoomCollections = ({
  workerUrl,
  authToken,
  ownerId,
  refreshAuthToken,
  setStatusText,
  onPlaylistLoaded,
  onPlaylistReset,
}: UseRoomCollectionsOptions): UseRoomCollectionsResult => {
  const [collections, setCollections] = useState<
    Array<{ id: string; title: string; description?: string | null }>
  >([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    null,
  );
  const [collectionItemsLoading, setCollectionItemsLoading] = useState(false);
  const [collectionItemsError, setCollectionItemsError] = useState<string | null>(
    null,
  );

  const selectCollection = useCallback((collectionId: string | null) => {
    setSelectedCollectionId(collectionId);
    setCollectionItemsError(null);
  }, []);

  const fetchCollections = useCallback(async () => {
    if (!workerUrl) {
      setCollectionsError("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
      return;
    }
    if (!authToken) {
      setCollectionsError("請先登入後再使用收藏庫");
      return;
    }
    if (!ownerId) {
      setCollectionsError("尚未取得使用者資訊");
      return;
    }
    setCollectionsLoading(true);
    setCollectionsError(null);
    try {
      const run = async (token: string, allowRetry: boolean) => {
        const { ok, status, payload } = await apiFetchCollections(
          workerUrl,
          token,
          ownerId,
          DEFAULT_PAGE_SIZE,
        );
        if (ok) {
          const items = payload?.data?.items ?? [];
          setCollections(items);
          if (items.length === 0) {
            setCollectionsError("尚未建立收藏庫");
          }
          return;
        }
        if (status === 401 && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            await run(refreshed, false);
            return;
          }
        }
        throw new Error(payload?.error ?? "載入收藏庫失敗");
      };

      await run(authToken, true);
    } catch (error) {
      setCollectionsError(
        error instanceof Error ? error.message : "載入收藏庫失敗",
      );
    } finally {
      setCollectionsLoading(false);
    }
  }, [authToken, ownerId, refreshAuthToken, workerUrl]);

  const loadCollectionItems = useCallback(
    async (collectionId: string) => {
      if (!workerUrl) {
        setCollectionItemsError("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
        return;
      }
      if (!authToken) {
        setCollectionItemsError("請先登入後再使用收藏庫");
        return;
      }
      if (!collectionId) {
        setCollectionItemsError("請先選擇收藏庫");
        return;
      }
      setCollectionItemsLoading(true);
      setCollectionItemsError(null);
      onPlaylistReset();
      setSelectedCollectionId(collectionId);
      try {
        const run = async (token: string, allowRetry: boolean) => {
          const { ok, status, payload } = await apiFetchCollectionItems(
            workerUrl,
            token,
            collectionId,
            DEFAULT_PAGE_SIZE,
          );
          if (ok) {
            const items = payload?.data?.items ?? [];
            if (items.length === 0) {
              throw new Error("收藏庫內沒有歌曲");
            }
            const mapped = items.map((item, index) => {
              const startSec = Math.max(0, item.start_sec ?? 0);
              const endSec =
                typeof item.end_sec === "number"
                  ? item.end_sec
                  : startSec + DEFAULT_CLIP_SEC;
              const safeEnd = Math.max(startSec + 1, endSec);
              const videoId = item.video_id ?? "";
              const durationValue =
                typeof item.duration_sec === "number" && item.duration_sec > 0
                  ? formatSeconds(item.duration_sec)
                  : formatSeconds(safeEnd - startSec);
              const rawTitle =
                item.title ?? item.answer_text ?? `歌曲 ${index + 1}`;
              const answerText = item.answer_text ?? rawTitle;
              return {
                title: rawTitle,
                answerText,
                url: videoId ? videoUrlFromId(videoId) : "",
                thumbnail: videoId ? thumbnailFromId(videoId) : undefined,
                uploader: item.channel_title ?? undefined,
                duration: durationValue,
                startSec,
                endSec: safeEnd,
              };
            });
            const normalizedItems = normalizePlaylistItems(mapped);
            onPlaylistLoaded(normalizedItems, collectionId);
            setStatusText(`已載入收藏庫，共 ${normalizedItems.length} 首`);
            return;
          }
          if (status === 401 && allowRetry) {
            const refreshed = await refreshAuthToken();
            if (refreshed) {
              await run(refreshed, false);
              return;
            }
          }
          throw new Error(payload?.error ?? "載入收藏庫失敗");
        };

        await run(authToken, true);
      } catch (error) {
        setCollectionItemsError(
          error instanceof Error ? error.message : "載入收藏庫失敗",
        );
        onPlaylistReset();
      } finally {
        setCollectionItemsLoading(false);
      }
    },
    [
      authToken,
      onPlaylistLoaded,
      onPlaylistReset,
      refreshAuthToken,
      setStatusText,
      workerUrl,
    ],
  );

  const resetCollectionsState = useCallback(() => {
    setCollections([]);
    setCollectionsLoading(false);
    setCollectionsError(null);
    setSelectedCollectionId(null);
    setCollectionItemsLoading(false);
    setCollectionItemsError(null);
  }, []);

  const resetCollectionSelection = useCallback(() => {
    setSelectedCollectionId(null);
    setCollectionItemsLoading(false);
    setCollectionItemsError(null);
  }, []);

  const clearCollectionsError = useCallback(() => {
    setCollectionsError(null);
  }, []);

  return {
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
  };
};
