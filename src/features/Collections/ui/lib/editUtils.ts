export const DEFAULT_DURATION_SEC = 30;

export const parseDurationToSeconds = (duration?: string): number | null => {
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

export const formatSeconds = (value: number) => {
  const clamped = Math.max(0, Math.floor(value));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) {
    return parts[0] * 60;
  }
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

export const createLocalId = () =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

export const createServerId = () => createLocalId();

export const videoUrlFromId = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

export const thumbnailFromId = (videoId: string) =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

export const extractVideoId = (url: string | undefined | null) => {
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

export const getPlaylistItemKey = (item: { url?: string; title?: string }) => {
  const videoId = extractVideoId(item.url ?? "");
  if (videoId) return `yt:${videoId}`;
  if (item.url) return `url:${item.url}`;
  return item.title ? `title:${item.title}` : "";
};
