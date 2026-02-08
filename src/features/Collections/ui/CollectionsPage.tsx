import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import { useRoom } from "../../Room/model/useRoom";
import { ensureFreshAuthToken } from "../../../shared/auth/token";
import { collectionsApi } from "../model/collectionsApi";
import { thumbnailFromId } from "./lib/editUtils";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";

const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

type DbCollection = {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  visibility?: "private" | "public";
};

const TEXT = {
  title: "我的收藏庫",
  create: "建立新收藏庫",
  emptyTitle: "沒有收藏庫",
  emptyBody: "先建立一個收藏庫開始編輯。",
  loading: "載入中...",
  error: "載入失敗",
  open: "開啟",
  deleteConfirm: "確定要刪除這個收藏庫嗎？這會永久移除資料。",
  deleteError: "刪除失敗",
  unknownError: "發生未知錯誤",
  loginHint: "請先使用 Google 登入後再查看收藏庫。",
  public: "公開",
  private: "私人",
  publicConfirm: "切換為公開後，任何人都能瀏覽此收藏庫。確定要公開嗎？",
};

const SKELETON_COUNT = 6;
const skeletonBase =
  "relative overflow-hidden rounded-md bg-gradient-to-r from-slate-900/60 via-slate-800/70 to-slate-900/60 animate-pulse";

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`${skeletonBase} ${className}`} />
);

const SkeletonCircle = ({ className = "" }: { className?: string }) => (
  <div className={`${skeletonBase} rounded-full ${className}`} />
);

const CollectionsSkeleton = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
      <div
        key={`collection-skeleton-${index}`}
        className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 p-4 space-y-3"
      >
        <SkeletonBlock className="h-3 w-14" />
        <SkeletonBlock className="h-5 w-2/3" />
        <SkeletonBlock className="h-3 w-4/5" />
        <div className="flex items-center gap-2 pt-1">
          <SkeletonCircle className="h-7 w-7" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
      </div>
    ))}
  </div>
);

const CollectionsPage = () => {
  const navigate = useNavigate();
  const {
    authToken,
    authUser,
    displayUsername,
    authLoading,
    refreshAuthToken,
  } = useRoom();
  const [collections, setCollections] = useState<DbCollection[]>([]);
  const [collectionThumbs, setCollectionThumbs] = useState<
    Record<string, string>
  >({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<
    string | null
  >(null);
  const [confirmPublicOpen, setConfirmPublicOpen] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<{
    id: string;
    visibility: "private" | "public";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(() => !authLoading);
  const ownerId = authUser?.id ?? null;
  const showSkeleton = loading && collections.length === 0;

  useEffect(() => {
    if (!authLoading) {
      setAuthResolved(true);
    }
  }, [authLoading]);

  useEffect(() => {
    if (!WORKER_API_URL || !ownerId || !authToken) return;
    let active = true;

    const run = async (token: string, allowRetry: boolean) => {
      const userRes = await fetch(`${WORKER_API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: ownerId,
          display_name: displayUsername || "Guest",
          provider: authUser?.provider ?? "google",
          provider_user_id: authUser?.provider_user_id ?? ownerId,
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
        throw new Error(userPayload?.error ?? TEXT.error);
      }

      const res = await fetch(
        `${WORKER_API_URL}/collections?owner_id=${encodeURIComponent(
          ownerId,
        )}&pageSize=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.status === 401 && allowRetry) {
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          return run(refreshed, false);
        }
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? TEXT.error);
      }

      const items = (payload?.data?.items ?? []) as DbCollection[];
      if (!active) return;
      setCollections(items);
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await ensureFreshAuthToken({
          token: authToken,
          refreshAuthToken,
        });
        if (!token) {
          throw new Error("Unauthorized");
        }
        await run(token, true);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : TEXT.unknownError);
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
    refreshAuthToken,
    authUser?.provider,
    authUser?.provider_user_id,
    displayUsername,
    ownerId,
  ]);

  useEffect(() => {
    if (!WORKER_API_URL || !authToken || collections.length === 0) return;
    let active = true;
    const loadThumbs = async () => {
      const token = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!token) return;
      const entries = await Promise.all(
        collections.map(async (collection) => {
          try {
            const res = await fetch(
              `${WORKER_API_URL}/collections/${collection.id}/items/all`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) return [collection.id, ""] as const;
            const payload = await res.json().catch(() => null);
            const items = payload?.data?.items ?? payload?.items ?? [];
            const first = Array.isArray(items) ? items[0] : null;
            const sourceId = first?.source_id ?? "";
            return [
              collection.id,
              sourceId ? thumbnailFromId(sourceId) : "",
            ] as const;
          } catch {
            return [collection.id, ""] as const;
          }
        }),
      );
      if (!active) return;
      setCollectionThumbs((prev) => {
        const next = { ...prev };
        entries.forEach(([id, url]) => {
          if (url) next[id] = url;
        });
        return next;
      });
    };
    loadThumbs();
    return () => {
      active = false;
    };
  }, [authToken, collections, refreshAuthToken]);

  const handleDeleteCollection = async (id: string) => {
    if (!WORKER_API_URL || !authToken) return;
    if (!window.confirm(TEXT.deleteConfirm)) return;
    setDeletingId(id);
    try {
      const token = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!token) throw new Error("Unauthorized");
      const res = await fetch(`${WORKER_API_URL}/collections/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? TEXT.deleteError);
      }
      setCollections((prev) => prev.filter((item) => item.id !== id));
      setCollectionThumbs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  const applyVisibilityChange = async (
    id: string,
    visibility: "private" | "public",
  ) => {
    if (!WORKER_API_URL || !authToken) return;
    setVisibilityUpdatingId(id);
    try {
      const token = await ensureFreshAuthToken({
        token: authToken,
        refreshAuthToken,
      });
      if (!token) throw new Error("Unauthorized");
      await collectionsApi.updateCollection(token, id, { visibility });
      setCollections((prev) =>
        prev.map((item) => (item.id === id ? { ...item, visibility } : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : TEXT.unknownError);
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  if (!authResolved) {
    return (
      <Box className="w-full md:w-full lg:w-3/5 mx-auto space-y-4">
        <Box className="flex items-center justify-between gap-3">
          <Typography
            variant="h6"
            className="text-[var(--mc-text)] font-semibold"
          >
            {TEXT.title}
          </Typography>
        </Box>
        <CollectionsSkeleton />
      </Box>
    );
  }

  if (!authToken) {
    return (
      <Box className="w-full md:w-full lg:w-3/5 mx-auto space-y-4">
        <Box className="rounded-lg border border-amber-400/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          {TEXT.loginHint}
        </Box>
      </Box>
    );
  }

  return (
    <Box className="w-full md:w-full lg:w-3/5 mx-auto space-y-4">
      <Box className="flex items-center justify-between gap-3">
        <Typography
          variant="h6"
          className="text-[var(--mc-text)] font-semibold"
        >
          {TEXT.title}
        </Typography>
      </Box>

      {showSkeleton ? (
        <CollectionsSkeleton />
      ) : (
        <>
          {error && (
            <Typography variant="body2" className="text-rose-300">
              {error}
            </Typography>
          )}

          <Box className="grid auto-rows-[1fr] gap-3 sm:grid-cols-2">
            <Card
              sx={{
                backgroundColor: "var(--mc-bg)",
                borderColor: "var(--mc-border)",
              }}
              className="h-full min-h-[180px] border-2 border-dashed"
            >
              <CardActionArea
                onClick={() => navigate("/collections/new")}
                className="h-full"
              >
                <CardContent className="flex h-full flex-col items-center justify-center text-center">
                  <Typography variant="h4" className="text-[var(--mc-text)]">
                    +
                  </Typography>
                  <Typography
                    variant="body2"
                    className="text-[var(--mc-text-muted)]"
                  >
                    {TEXT.create}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            {collections.map((collection) => {
              const thumb = collectionThumbs[collection.id] ?? "";
              return (
                <Card
                  key={collection.id}
                  variant="outlined"
                  sx={{
                    backgroundColor:
                      "color-mix(in srgb, var(--mc-surface-strong) 88%, black)",
                    borderColor: "var(--mc-border)",
                  }}
                  className="group relative h-full min-h-[180px] overflow-hidden"
                >
                  {thumb && (
                    <Box
                      className="absolute inset-0 bg-cover bg-center opacity-70 transition-opacity duration-300 group-hover:opacity-85"
                      style={{ backgroundImage: `url(${thumb})` }}
                    />
                  )}
                  <Box className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
                  <CardActionArea
                    onClick={() =>
                      navigate(`/collections/${collection.id}/edit`)
                    }
                    className="relative z-10 h-full"
                  >
                    <CardContent className="flex h-full flex-col justify-between">
                      <Box className="flex items-center justify-between">
                        <Typography
                          variant="caption"
                          className="text-[var(--mc-text-muted)]"
                        >
                          {TEXT.open}
                        </Typography>
                        <Box
                          className="flex items-center gap-1"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/30 px-2 py-0.5">
                            <Tooltip
                              title={
                                collection.visibility === "public"
                                  ? "公開中"
                                  : "私人"
                              }
                            >
                              <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                                {collection.visibility === "public" ? (
                                  <PublicOutlined fontSize="inherit" />
                                ) : (
                                  <LockOutlined fontSize="inherit" />
                                )}
                                {collection.visibility === "public"
                                  ? "公開"
                                  : "私人"}
                              </span>
                            </Tooltip>
                            <Switch
                              size="small"
                              checked={collection.visibility === "public"}
                              disabled={visibilityUpdatingId === collection.id}
                              onChange={(_, checked) =>
                                checked
                                  ? (setPendingVisibility({
                                      id: collection.id,
                                      visibility: "public",
                                    }),
                                    setConfirmPublicOpen(true))
                                  : applyVisibilityChange(
                                      collection.id,
                                      "private",
                                    )
                              }
                              sx={{
                                "& .MuiSwitch-thumb": {
                                  backgroundColor: "white",
                                },
                                "& .MuiSwitch-track": {
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  opacity: 1,
                                },
                                "& .Mui-checked + .MuiSwitch-track": {
                                  backgroundColor: "rgba(56,189,248,0.6)",
                                  opacity: 1,
                                },
                              }}
                            />
                          </div>
                          <IconButton
                            size="small"
                            disabled={deletingId === collection.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteCollection(collection.id);
                            }}
                            className="text-white/70 hover:text-white"
                            aria-label="delete"
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="h6" className="mt-1 text-white">
                          {collection.title || collection.id}
                        </Typography>
                        {collection.description && (
                          <Typography
                            variant="body2"
                            className="mt-2 text-white/70"
                          >
                            {collection.description}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
          <ConfirmDialog
            open={confirmPublicOpen}
            title="設為公開？"
            description={TEXT.publicConfirm}
            confirmLabel="設為公開"
            onConfirm={() => {
              if (pendingVisibility) {
                applyVisibilityChange(
                  pendingVisibility.id,
                  pendingVisibility.visibility,
                );
              }
              setPendingVisibility(null);
              setConfirmPublicOpen(false);
            }}
            onCancel={() => {
              setPendingVisibility(null);
              setConfirmPublicOpen(false);
            }}
          />
        </>
      )}
    </Box>
  );
};

export default CollectionsPage;
