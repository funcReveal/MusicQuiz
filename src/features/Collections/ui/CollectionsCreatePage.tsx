import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Box, Button } from "@mui/material";
import { useRoom } from "../../Room/model/useRoom";

const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

type DbCollection = {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  visibility?: string;
};

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

const extractVideoId = (url: string | undefined | null) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    const id = parsed.searchParams.get("v");
    if (id) return id;
    const path = parsed.pathname.split("/").filter(Boolean);
    if (path[0] === "shorts" && path[1]) return path[1];
    if (path[0] === "embed" && path[1]) return path[1];
    return null;
  } catch {
    return null;
  }
};

const createServerId = () =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

const buildJsonHeaders = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const CollectionsCreatePage = () => {
  const navigate = useNavigate();
  const {
    authToken,
    authUser,
    playlistUrl,
    playlistItems,
    lastFetchedPlaylistTitle,
    playlistError,
    playlistLoading,
    handleFetchPlaylist,
    setPlaylistUrl,
    authLoading,
    refreshAuthToken,
  } = useRoom();

  const [collectionTitle, setCollectionTitle] = useState("");
  const [collectionTitleTouched, setCollectionTitleTouched] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const ownerId = authUser?.id ?? null;
  const hasPlaylistItems = playlistItems.length > 0;
  const playlistCountLabel = `共 ${playlistItems.length} 首`;

  useEffect(() => {
    if (!lastFetchedPlaylistTitle) return;
    if (collectionTitleTouched) return;
    if (collectionTitle.trim()) return;
    setCollectionTitle(lastFetchedPlaylistTitle);
  }, [collectionTitle, collectionTitleTouched, lastFetchedPlaylistTitle]);

  const collectionPreview = useMemo(() => {
    if (!hasPlaylistItems) return null;
    const first = playlistItems[0];
    return {
      title: collectionTitle || lastFetchedPlaylistTitle || "未命名收藏庫",
      subtitle: first?.title ?? "",
      count: playlistItems.length,
    };
  }, [collectionTitle, hasPlaylistItems, lastFetchedPlaylistTitle, playlistItems]);

  const handleCreateCollection = async () => {
    if (!WORKER_API_URL) {
      setCreateError("尚未設定收藏庫 API 位置 (WORKER_API_URL)");
      return;
    }
    if (!authToken || !ownerId) {
      setCreateError("請先登入後再建立收藏庫");
      return;
    }
    if (!collectionTitle.trim()) {
      setCreateError("請輸入收藏庫名稱");
      return;
    }
    if (!hasPlaylistItems) {
      setCreateError("請先匯入播放清單");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    const create = async (token: string, allowRetry: boolean) => {
      const res = await fetch(`${WORKER_API_URL}/collections`, {
        method: "POST",
        headers: buildJsonHeaders(token),
        body: JSON.stringify({
          owner_id: ownerId,
          title: collectionTitle.trim(),
          description: null,
          visibility,
        }),
      });

      if (res.status === 401 && allowRetry) {
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          return create(refreshed, false);
        }
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to create collection");
      }
      return payload?.data as DbCollection;
    };

    try {
      const created = await create(authToken, true);
      if (!created?.id) {
        throw new Error("Missing collection id");
      }

      const insertItems = playlistItems.map((item, idx) => {
        const durationSec =
          parseDurationToSeconds(item.duration) ?? DEFAULT_DURATION_SEC;
        const safeDuration = Math.max(1, durationSec);
        const endSec = Math.min(DEFAULT_DURATION_SEC, safeDuration);
        return {
          id: createServerId(),
          sort: idx,
          video_id: extractVideoId(item.url),
          title: item.title || item.answerText || "Untitled",
          channel_title: item.uploader ?? null,
          start_sec: 0,
          end_sec: Math.max(1, endSec),
          answer_text: item.answerText || item.title || "Untitled",
          ...(durationSec ? { duration_sec: durationSec } : {}),
        };
      });

      const insert = async (token: string, allowRetry: boolean) => {
        const res = await fetch(
          `${WORKER_API_URL}/collections/${created.id}/items`,
          {
            method: "POST",
            headers: buildJsonHeaders(token),
            body: JSON.stringify({ items: insertItems }),
          },
        );
        if (res.status === 401 && allowRetry) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return insert(refreshed, false);
          }
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to insert items");
        }
        return null;
      };

      await insert(authToken, true);
      navigate(`/collections/${created.id}/edit`, { replace: true });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Box className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6">
      <Box className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950/80 to-black p-6 text-slate-100">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_60%)]" />
        </div>

        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
            建立收藏庫
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">
            從播放清單建立收藏庫
          </div>
          <div className="mt-2 text-sm text-slate-400">
            先貼上播放清單連結，自動帶入名稱，再設定公開或私密。
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-700 px-3 py-1">
              1 貼上播放清單
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1">
              2 調整名稱
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1">
              3 設定公開
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1">
              4 建立收藏庫
            </span>
          </div>

          {!authToken && !authLoading && (
            <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              請先使用 Google 登入後再建立收藏庫。
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-400">播放清單連結</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    placeholder="貼上 YouTube 播放清單連結"
                    className="min-w-[240px] flex-1 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                  />
                  <Button
                    variant="contained"
                    onClick={handleFetchPlaylist}
                    disabled={playlistLoading}
                  >
                    {playlistLoading ? "取得中..." : "取得播放清單"}
                  </Button>
                </div>
                {playlistError && (
                  <div className="mt-2 text-sm text-rose-300">
                    {playlistError}
                  </div>
                )}
                {hasPlaylistItems && (
                  <div className="mt-2 text-xs text-slate-400">
                    {playlistCountLabel}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-400">收藏庫名稱</div>
                <input
                  value={collectionTitle}
                  onChange={(e) => {
                    setCollectionTitle(e.target.value);
                    setCollectionTitleTouched(true);
                  }}
                  placeholder="輸入收藏庫名稱"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                />
                <div className="mt-2 text-[11px] text-slate-500">
                  會優先使用播放清單名稱，仍可自行修改。
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-400">公開設定</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility("private")}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      visibility === "private"
                        ? "border-amber-400/60 bg-amber-400/10 text-amber-100"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    私密（預設）
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      visibility === "public"
                        ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    公開
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  私密收藏庫僅自己可見，公開收藏庫會出現在房間可選清單。
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-xs text-slate-400">建立預覽</div>
              {collectionPreview ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <div className="text-base font-semibold text-slate-100">
                      {collectionPreview.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      首曲：{collectionPreview.subtitle || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {collectionPreview.count} 首歌曲
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                    完成後會自動導向編輯頁，可以調整答案、剪輯時間與排序。
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
                  尚未匯入播放清單
                </div>
              )}
            </div>
          </div>

          {createError && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
              {createError}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outlined" onClick={() => navigate("/collections")}>
              返回收藏庫
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateCollection}
              disabled={isCreating || authLoading || !authToken}
            >
              {isCreating ? "建立中..." : "建立收藏庫"}
            </Button>
          </div>
        </div>
      </Box>
    </Box>
  );
};

export default CollectionsCreatePage;
