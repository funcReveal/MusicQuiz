import type { PlaylistItem } from "../../../Room/model/types";
import type { DbCollectionItem, EditableItem } from "./editTypes";
import {
  DEFAULT_DURATION_SEC,
  createLocalId,
  formatSeconds,
  parseDurationToSeconds,
  thumbnailFromId,
  videoUrlFromId,
} from "./editUtils";

export const buildEditableItems = (items: PlaylistItem[]): EditableItem[] => {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems.map((item) => {
    const durationSec =
      parseDurationToSeconds(item.duration) ?? DEFAULT_DURATION_SEC;
    const end = Math.min(durationSec, DEFAULT_DURATION_SEC);
    return {
      ...item,
      localId: createLocalId(),
      startSec: 0,
      endSec: Math.max(1, end),
      answerText: item.title ?? "",
    };
  });
};

export const buildEditableItemsFromDb = (
  items: DbCollectionItem[],
): EditableItem[] => {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems.map((item) => {
    const videoId = item.video_id ?? "";
    const startSec = item.start_sec ?? 0;
    const rawDuration =
      item.duration_sec && item.duration_sec > 0 ? item.duration_sec : null;
    const maxDuration =
      rawDuration ?? Math.max(1, startSec + DEFAULT_DURATION_SEC);
    const endFromDb =
      item.end_sec === null || item.end_sec === undefined
        ? Math.max(1, startSec + DEFAULT_DURATION_SEC)
        : Math.max(1, item.end_sec);
    const endSec = Math.min(Math.max(endFromDb, startSec + 1), maxDuration);
    return {
      localId: createLocalId(),
      dbId: item.id,
      title: item.title ?? item.answer_text ?? videoId,
      url: videoId ? videoUrlFromId(videoId) : "",
      thumbnail: videoId ? thumbnailFromId(videoId) : undefined,
      uploader: item.channel_title ?? "",
      duration: rawDuration ? formatSeconds(rawDuration) : undefined,
      startSec,
      endSec,
      answerText: item.answer_text ?? "",
    };
  });
};
