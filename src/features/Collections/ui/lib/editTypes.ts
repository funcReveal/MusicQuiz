import type { PlaylistItem } from "../../../Room/model/types";

export type EditableItem = PlaylistItem & {
  localId: string;
  dbId?: string;
  startSec: number;
  endSec: number;
  answerText: string;
};

export type DbCollection = {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  visibility?: string;
};

export type DbCollectionItem = {
  id: string;
  collection_id: string;
  sort: number;
  video_id: string | null;
  title?: string | null;
  channel_title?: string | null;
  duration_sec?: number | null;
  start_sec: number;
  end_sec: number | null;
  answer_text: string;
};
