import type { PlaylistItem } from "./types";
import {
  DEFAULT_CLIP_SEC,
  QUESTION_MAX,
  QUESTION_MIN,
  WORKER_API_URL,
} from "./roomConstants";

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

export const videoUrlFromId = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

export const thumbnailFromId = (videoId: string) =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

export const normalizePlaylistItems = (items: PlaylistItem[]) =>
  items.map((item) => {
    const startSec = item.startSec ?? 0;
    const endSec =
      item.endSec !== undefined && item.endSec !== null
        ? item.endSec
        : startSec + DEFAULT_CLIP_SEC;
    const answerText = item.answerText ?? item.title;
    return {
      ...item,
      startSec,
      endSec: Math.max(startSec + 1, endSec),
      answerText,
    };
  });

export const buildWorkerUrl = (path: string) => {
  if (!WORKER_API_URL) return null;
  const base = WORKER_API_URL.endsWith("/")
    ? WORKER_API_URL
    : `${WORKER_API_URL}/`;
  return new URL(path.replace(/^\/+/, ""), base);
};

export const getQuestionMax = (playlistCount: number) =>
  playlistCount > 0 ? Math.min(QUESTION_MAX, playlistCount) : QUESTION_MAX;

export const clampQuestionCount = (value: number, maxValue: number) =>
  Math.min(maxValue, Math.max(QUESTION_MIN, value));
