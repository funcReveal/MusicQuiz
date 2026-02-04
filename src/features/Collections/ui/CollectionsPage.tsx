import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from "@mui/material";
import { useRoom } from "../../Room/model/useRoom";
import { hasRefreshFlag } from "../../Room/model/roomStorage";

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
  create: "建立收藏庫",
  emptyTitle: "尚未建立收藏庫",
  emptyBody: "點擊 + 建立第一個收藏庫",
  loading: "載入中...",
  error: "載入失敗",
  open: "開啟",
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(() => !hasRefreshFlag());
  const ownerId = authUser?.id ?? null;
  const showSkeleton = loading && collections.length === 0;

  useEffect(() => {
    if (!hasRefreshFlag()) {
      setAuthResolved(true);
      return;
    }
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
        await run(authToken, true);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "登入已過期，請重新登入");
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
          請先使用 Google 登入後再查看收藏庫。
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
          {loading && (
            <Typography
              variant="caption"
              className="text-[var(--mc-text-muted)]"
            >
              {TEXT.loading}
            </Typography>
          )}
          {error && (
            <Typography variant="body2" className="text-rose-300">
              {error}
            </Typography>
          )}

          <Box className="grid auto-rows-[1fr] gap-3 sm:grid-cols-2">
            <Card
              variant="outlined"
              sx={{
                backgroundColor: "var(--mc-bg)",
                borderColor: "var(--mc-border)",
              }}
              className="h-full min-h-[140px] border-2 border-dashed"
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

            {collections.map((collection) => (
              <Card
                key={collection.id}
                variant="outlined"
                sx={{
                  backgroundColor:
                    "color-mix(in srgb, var(--mc-surface-strong) 88%, black)",
                  borderColor: "var(--mc-border)",
                }}
                className="h-full min-h-[140px]"
              >
                <CardActionArea
                  onClick={() => navigate(`/collections/${collection.id}/edit`)}
                  className="h-full"
                >
                  <CardContent>
                    <Typography
                      variant="caption"
                      className="text-[var(--mc-text-muted)]"
                    >
                      {TEXT.open}
                    </Typography>
                    <Typography
                      variant="h6"
                      className="mt-1 text-[var(--mc-text)]"
                    >
                      {collection.title || collection.id}
                    </Typography>
                    {collection.description && (
                      <Typography
                        variant="body2"
                        className="mt-2 text-[var(--mc-text-muted)]"
                      >
                        {collection.description}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default CollectionsPage;
