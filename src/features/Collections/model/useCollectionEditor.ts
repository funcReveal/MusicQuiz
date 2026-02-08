import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { DbCollection, EditableItem } from "../ui/lib/editTypes";
import { collectionsApi } from "./collectionsApi";
import { ensureFreshAuthToken } from "../../../shared/auth/token";

const resolveItemSource = (
  item: EditableItem,
  extractVideoId: (url?: string | null) => string | null,
) => {
  const videoId = extractVideoId(item.url);
  if (videoId) {
    return { provider: "youtube", source_id: videoId };
  }
  if (item.sourceProvider && item.sourceId) {
    return { provider: item.sourceProvider, source_id: item.sourceId };
  }
  if (item.sourceProvider) {
    const fallback =
      item.sourceId ?? item.url ?? item.dbId ?? item.localId ?? "";
    return {
      provider: item.sourceProvider,
      source_id: fallback || item.localId,
    };
  }
  if (item.url) {
    return { provider: "manual", source_id: item.url };
  }
  if (item.dbId) {
    return { provider: "manual", source_id: item.dbId };
  }
  return { provider: "manual", source_id: item.localId };
};

type UseCollectionEditorParams = {
  authToken: string | null;
  ownerId: string | null;
  collectionTitle: string;
  collectionVisibility: "private" | "public";
  activeCollectionId: string | null;
  playlistItems: EditableItem[];
  pendingDeleteIds: string[];
  createServerId: () => string;
  parseDurationToSeconds: (duration?: string) => number | null;
  extractVideoId: (url?: string | null) => string | null;
  setCollections: Dispatch<SetStateAction<DbCollection[]>>;
  setActiveCollectionId: (id: string | null) => void;
  setPendingDeleteIds: (ids: string[]) => void;
  setPlaylistItems: (updater: (prev: EditableItem[]) => EditableItem[]) => void;
  setSaveStatus: (value: "idle" | "saving" | "saved" | "error") => void;
  setSaveError: (value: string | null) => void;
  showAutoSaveNotice: (type: "success" | "error", message: string) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  dirtyCounterRef: React.MutableRefObject<number>;
  saveInFlightRef: React.MutableRefObject<boolean>;
  navigateToEdit: (id: string) => void;
  markDirty: () => void;
  refreshAuthToken: () => Promise<string | null>;
  onSaved?: () => void;
};

export const useCollectionEditor = ({
  authToken,
  ownerId,
  collectionTitle,
  collectionVisibility,
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
  navigateToEdit,
  refreshAuthToken,
  onSaved,
}: UseCollectionEditorParams) => {
  const isAuthError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Unauthorized") || message.includes("401");
  };
  const syncItemsToDb = useCallback(
    async (collectionId: string, token: string) => {
      const updatePayloads = playlistItems.map((item, idx) => {
        const source = resolveItemSource(item, extractVideoId);
        return {
          localId: item.localId,
          id: item.dbId,
          sort: idx,
          provider: source.provider,
          source_id: source.source_id,
          title: item.title || item.answerText || "Untitled",
          channel_title: item.uploader ?? null,
          start_sec: item.startSec,
          end_sec: item.endSec,
          answer_text: item.answerText || item.title || "Untitled",
          duration_sec: (() => {
            const parsed = parseDurationToSeconds(item.duration ?? "");
            return parsed && parsed > 0 ? parsed : undefined;
          })(),
        };
      });

      const toUpdate = updatePayloads.filter((item) => item.id);
      const toInsert = updatePayloads.filter((item) => !item.id);

      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map(async (item) => {
            await collectionsApi.updateCollectionItem(token, item.id!, {
              sort: item.sort,
              provider: item.provider,
              source_id: item.source_id,
              title: item.title,
              channel_title: item.channel_title,
              start_sec: item.start_sec,
              end_sec: item.end_sec,
              answer_text: item.answer_text,
              ...(item.duration_sec !== undefined
                ? { duration_sec: item.duration_sec }
                : {}),
            });
            return null;
          }),
        );
      }

      if (toInsert.length > 0) {
        const insertItems = toInsert.map((item) => ({
          id: createServerId(),
          sort: item.sort,
          provider: item.provider,
          source_id: item.source_id,
          title: item.title,
          channel_title: item.channel_title,
          start_sec: item.start_sec,
          end_sec: item.end_sec,
          answer_text: item.answer_text,
          ...(item.duration_sec !== undefined
            ? { duration_sec: item.duration_sec }
            : {}),
        }));
        await collectionsApi.insertCollectionItems(
          token,
          collectionId,
          insertItems,
        );
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
          pendingDeleteIds.map(async (id) => {
            await collectionsApi.deleteCollectionItem(token, id);
            return null;
          }),
        );
        setPendingDeleteIds([]);
      }
    },
    [
      createServerId,
      extractVideoId,
      parseDurationToSeconds,
      pendingDeleteIds,
      playlistItems,
      setPendingDeleteIds,
      setPlaylistItems,
    ],
  );

  const handleSaveCollection = useCallback(
    async (mode: "manual" | "auto" = "manual") => {
      if (saveInFlightRef.current) return;
      if (!authToken || !ownerId) {
        if (mode === "auto") {
          showAutoSaveNotice("error", "自動保存失敗");
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
        const token = await ensureFreshAuthToken({
          token: authToken,
          refreshAuthToken,
        });
        if (!token) {
          throw new Error("Unauthorized");
        }
        let collectionId = activeCollectionId;
        const run = async (
          token: string,
          allowRetry: boolean,
        ): Promise<DbCollection | null> => {
          let created: DbCollection | null = null;
          if (!collectionId) {
            try {
              created = await collectionsApi.createCollection(token, {
                owner_id: ownerId,
                title: collectionTitle.trim(),
                description: null,
                visibility: collectionVisibility,
              });
            } catch (error) {
              if (allowRetry && isAuthError(error)) {
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                  return run(refreshed, false);
                }
              }
              throw error;
            }
            if (!created?.id) {
              throw new Error("Missing collection id");
            }
            collectionId = created.id;
          } else {
            try {
              await collectionsApi.updateCollection(token, collectionId, {
                title: collectionTitle.trim(),
                visibility: collectionVisibility,
              });
            } catch (error) {
              if (allowRetry && isAuthError(error)) {
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                  return run(refreshed, false);
                }
              }
              throw error;
            }
            setCollections((prev) =>
              prev.map((item) =>
                item.id === collectionId
                  ? {
                      ...item,
                      title: collectionTitle.trim(),
                      visibility: collectionVisibility,
                    }
                  : item,
              ),
            );
          }

          if (collectionId) {
            try {
              await syncItemsToDb(collectionId, token);
            } catch (error) {
              if (allowRetry && isAuthError(error)) {
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                  return run(refreshed, false);
                }
              }
              throw error;
            }
          }
          return created;
        };

        const createdCollection = await run(token, true);
        if (createdCollection) {
          setActiveCollectionId(createdCollection.id);
          setCollections((prev) => [createdCollection, ...prev]);
          navigateToEdit(createdCollection.id);
        }

        const noNewChanges = dirtyCounterRef.current === dirtySnapshot;
        if (noNewChanges) {
          setHasUnsavedChanges(false);
          dirtyCounterRef.current = 0;
          onSaved?.();
          if (mode === "auto") {
            setSaveStatus("idle");
            showAutoSaveNotice("success", "自動保存成功");
          } else {
            setSaveStatus("saved");
          }
        } else {
          setSaveStatus("idle");
        }
      } catch (error) {
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : String(error));
        if (mode === "auto") {
          showAutoSaveNotice("error", "自動保存失敗");
        }
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [
      activeCollectionId,
      authToken,
      collectionTitle,
      dirtyCounterRef,
      refreshAuthToken,
      navigateToEdit,
      ownerId,
      setActiveCollectionId,
      setCollections,
      setHasUnsavedChanges,
      setSaveError,
      setSaveStatus,
      showAutoSaveNotice,
      syncItemsToDb,
      saveInFlightRef,
      onSaved,
    ],
  );

  return { handleSaveCollection, syncItemsToDb };
};
