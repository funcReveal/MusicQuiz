import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";

import { useRoom } from "../../Room/model/useRoom";

const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

type DbCollection = {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  visibility?: string;
};

const TEXT = {
  title: "收藏庫",
  create: "創建收藏庫",
  emptyTitle: "尚無收藏庫",
  emptyBody: "點擊上方按鈕或 + 建立新的收藏庫",
  loading: "載入中...",
  error: "載入失敗",
  open: "開啟",
};

const CollectionsPage = () => {
  const navigate = useNavigate();
  const { authToken, authUser, displayUsername } = useRoom();
  const [collections, setCollections] = useState<DbCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerId = authUser?.id ?? null;

  useEffect(() => {
    if (!WORKER_API_URL || !ownerId || !authToken) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetch(`${WORKER_API_URL}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            id: ownerId,
            display_name:
              displayUsername && displayUsername !== "(未設定)"
                ? displayUsername
                : "Guest",
            provider: authUser?.provider ?? "google",
            provider_user_id: authUser?.provider_user_id ?? ownerId,
          }),
        });

        const res = await fetch(
          `${WORKER_API_URL}/collections?owner_id=${encodeURIComponent(
            ownerId
          )}&pageSize=50`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? TEXT.error);
        }
        const items = (payload?.data?.items ?? []) as DbCollection[];
        if (!active) return;
        setCollections(items);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : TEXT.error);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [
    authToken,
    authUser?.provider,
    authUser?.provider_user_id,
    displayUsername,
    ownerId,
  ]);

  if (!authToken) {
    return (
      <div className="w-full md:w-full lg:w-3/5 mx-auto space-y-4">
        <div className="rounded-lg border border-amber-400/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          請先登入後再使用收藏庫功能。
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-full lg:w-3/5 mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-slate-100 font-semibold">{TEXT.title}</h2>
        <Button
          variant="contained"
          size="small"
          onClick={() => navigate("/collection/edit")}
        >
          {TEXT.create}
        </Button>
      </div>

      {loading && <div className="text-xs text-slate-400">{TEXT.loading}</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}

      {collections.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 text-center space-y-2">
          <div className="text-base text-slate-100 font-medium">
            {TEXT.emptyTitle}
          </div>
          <div className="text-sm text-slate-400">{TEXT.emptyBody}</div>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate("/collection/edit")}
          >
            {TEXT.create}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/collection/edit")}
            className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            <div className="text-2xl">+</div>
            <div className="text-sm">{TEXT.create}</div>
          </button>

          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => navigate(`/collection/edit/${collection.id}`)}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-slate-600"
            >
              <div className="text-sm text-slate-300">{TEXT.open}</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                {collection.title || collection.id}
              </div>
              {collection.description && (
                <div className="mt-2 text-xs text-slate-400">
                  {collection.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionsPage;
