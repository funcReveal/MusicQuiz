import { useEffect } from "react";

import type { DbCollection, DbCollectionItem, EditableItem } from "../ui/lib/editTypes";
import { collectionsApi } from "./collectionsApi";

type UseCollectionLoaderParams = {
  authToken: string | null;
  ownerId: string | null;
  collectionId?: string | null;
  authUser: {
    display_name?: string | null;
    provider?: string | null;
    provider_user_id?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  displayUsername?: string | null;
  refreshAuthToken: () => Promise<string | null>;
  setCollections: (collections: DbCollection[]) => void;
  setCollectionsLoading: (value: boolean) => void;
  setCollectionsError: (value: string | null) => void;
  setActiveCollectionId: (value: string | null) => void;
  setCollectionTitle: (value: string) => void;
  buildEditableItemsFromDb: (items: DbCollectionItem[]) => EditableItem[];
  setPlaylistItems: (items: EditableItem[]) => void;
  setItemsLoading: (value: boolean) => void;
  setItemsError: (value: string | null) => void;
  setSelectedIndex: (value: number) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveStatus: (value: "idle" | "saving" | "saved" | "error") => void;
  setSaveError: (value: string | null) => void;
  dirtyCounterRef: React.MutableRefObject<number>;
};

const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

export const useCollectionLoader = ({
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
  setSelectedIndex,
  setHasUnsavedChanges,
  setSaveStatus,
  setSaveError,
  dirtyCounterRef,
}: UseCollectionLoaderParams) => {
  useEffect(() => {
    if (!ownerId || !authToken) return;
    let active = true;

    const run = async (token: string, allowRetry: boolean) => {
      const userRes = await fetch(`${WORKER_API_URL}/users`, {
        method: "POST",
        headers: collectionsApi.buildJsonHeaders(token),
        body: JSON.stringify({
          id: ownerId,
          display_name:
            authUser?.display_name && authUser.display_name !== "(未設定)"
              ? authUser.display_name
              : displayUsername && displayUsername !== "(未設定)"
                ? displayUsername
                : "Guest",
          provider: authUser?.provider ?? "google",
          provider_user_id: authUser?.provider_user_id ?? ownerId,
          email: authUser?.email ?? null,
          avatar_url: authUser?.avatar_url ?? null,
        }),
      });

      if (userRes.status === 401 && allowRetry) {
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          return run(refreshed, false);
        }
      }

      if (!userRes.ok) {
        const userPayload = await userRes.json().catch(() => null);
        throw new Error(userPayload?.error ?? "Failed to sync user");
      }

      let items: DbCollection[] = [];
      try {
        items = await collectionsApi.fetchCollections(token, ownerId);
      } catch (error) {
        if (String(error).includes("401") && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return run(refreshed, false);
          }
        }
        throw error;
      }
      if (!active) return;
      setCollections(items);
      if (collectionId) {
        const matched = items.find((item) => item.id === collectionId);
        setActiveCollectionId(collectionId);
        setCollectionTitle(matched?.title ?? "");
      } else {
        setCollectionTitle("");
      }
    };

    const ensureAndLoad = async () => {
      setCollectionsLoading(true);
      setCollectionsError(null);
      try {
        await run(authToken, true);
      } catch (error) {
        if (!active) return;
        setCollectionsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setCollectionsLoading(false);
      }
    };

    void ensureAndLoad();

    return () => {
      active = false;
    };
  }, [
    authToken,
    ownerId,
    collectionId,
    authUser?.display_name,
    authUser?.provider,
    authUser?.provider_user_id,
    authUser?.email,
    authUser?.avatar_url,
    displayUsername,
    refreshAuthToken,
    setCollections,
    setCollectionsLoading,
    setCollectionsError,
    setActiveCollectionId,
    setCollectionTitle,
  ]);

  useEffect(() => {
    if (!collectionId || !authToken) return;
    let active = true;

    const run = async (token: string, allowRetry: boolean) => {
      let items: DbCollectionItem[] = [];
      try {
        items = await collectionsApi.fetchCollectionItems(token, collectionId);
      } catch (error) {
        if (String(error).includes("401") && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return run(refreshed, false);
          }
        }
        throw error;
      }
      const enriched = buildEditableItemsFromDb(items);
      if (!active) return;
      setPlaylistItems(enriched);
      setItemsError(null);
      setSelectedIndex(0);
      setHasUnsavedChanges(false);
      dirtyCounterRef.current = 0;
      setSaveStatus("idle");
      setSaveError(null);
    };

    const ensureAndLoad = async () => {
      setItemsLoading(true);
      setItemsError(null);
      try {
        await run(authToken, true);
      } catch (error) {
        if (!active) return;
        setItemsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setItemsLoading(false);
      }
    };

    void ensureAndLoad();

    return () => {
      active = false;
    };
  }, [
    authToken,
    collectionId,
    buildEditableItemsFromDb,
    refreshAuthToken,
    setItemsLoading,
    setItemsError,
    setPlaylistItems,
    setSelectedIndex,
    setHasUnsavedChanges,
    setSaveStatus,
    setSaveError,
    dirtyCounterRef,
  ]);
};
