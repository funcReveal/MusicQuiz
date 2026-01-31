export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL;

export const DEFAULT_PAGE_SIZE = 50;
export const CHUNK_SIZE = 200;
export const DEFAULT_CLIP_SEC = 30;

export const QUESTION_MIN = 5;
export const QUESTION_MAX = 100;
export const QUESTION_STEP = 5;

export const STORAGE_KEYS = {
  clientId: "mq_clientId",
  username: "mq_username",
  roomId: "mq_roomId",
  questionCount: "mq_questionCount",
  roomPasswordPrefix: "mq_roomPassword:",
  hasRefresh: "mq_hasRefresh",
  profileConfirmedPrefix: "mq_profileConfirmed:",
} as const;
