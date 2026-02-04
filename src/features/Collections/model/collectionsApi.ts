const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

const buildAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const buildJsonHeaders = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

export const collectionsApi = {
  buildAuthHeaders,
  buildJsonHeaders,
  async fetchCollections(token: string, ownerId: string) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(
      `${WORKER_API_URL}/collections?owner_id=${encodeURIComponent(ownerId)}`,
      { headers: buildAuthHeaders(token) },
    );
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error ?? "Failed to load collections");
    }
    const payload = await res.json().catch(() => null);
    const data = payload?.data ?? payload?.items ?? payload;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },
  async fetchCollectionItems(token: string, collectionId: string) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(
      `${WORKER_API_URL}/collections/${collectionId}/items?pageSize=200`,
      { headers: buildAuthHeaders(token) },
    );
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error ?? "Failed to load items");
    }
    const payload = await res.json().catch(() => null);
    const data = payload?.data ?? payload?.items ?? payload;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },
  async createCollection(
    token: string,
    payload: { owner_id: string; title: string; description?: string | null; visibility?: string },
  ) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(`${WORKER_API_URL}/collections`, {
      method: "POST",
      headers: buildJsonHeaders(token),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error ?? "Failed to create collection");
    }
    return json?.data ?? null;
  },
  async updateCollection(
    token: string,
    collectionId: string,
    payload: { title?: string },
  ) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(`${WORKER_API_URL}/collections/${collectionId}`, {
      method: "PATCH",
      headers: buildJsonHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error ?? "Failed to update collection");
    }
    return null;
  },
  async insertCollectionItems(
    token: string,
    collectionId: string,
    items: Array<Record<string, unknown>>,
  ) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(
      `${WORKER_API_URL}/collections/${collectionId}/items`,
      {
        method: "POST",
        headers: buildJsonHeaders(token),
        body: JSON.stringify({ items }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error ?? "Failed to insert items");
    }
    return null;
  },
  async updateCollectionItem(
    token: string,
    itemId: string,
    payload: Record<string, unknown>,
  ) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(`${WORKER_API_URL}/collection-items/${itemId}`, {
      method: "PATCH",
      headers: buildJsonHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error ?? "Failed to update items");
    }
    return null;
  },
  async deleteCollectionItem(token: string, itemId: string) {
    if (!WORKER_API_URL) {
      throw new Error("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
    }
    const res = await fetch(`${WORKER_API_URL}/collection-items/${itemId}`, {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error ?? "Failed to delete items");
    }
    return null;
  },
};
