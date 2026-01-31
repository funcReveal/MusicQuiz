import type { AuthUser, YoutubePlaylist } from "./RoomContext";
import type { PlaylistItem, RoomSummary } from "./types";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  payload: T | null;
};

export type AuthErrorDetail =
  | {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    }
  | {
      ok?: boolean;
      data?: AuthUser | null;
      error?: string;
    };

export type AuthPayload = {
  ok?: boolean;
  token?: string;
  user?: AuthUser | null;
  error?: string;
  detail?: AuthErrorDetail;
};

export type RoomListPayload = {
  rooms?: RoomSummary[];
  error?: string;
};

export type RoomByIdPayload = {
  room?: RoomSummary;
  error?: string;
};

export type YoutubePlaylistsPayload = {
  ok?: boolean;
  data?: YoutubePlaylist[];
  error?: string;
};

export type YoutubePlaylistItemsPayload = {
  ok?: boolean;
  data?: {
    playlistId: string;
    items: PlaylistItem[];
  };
  error?: string;
};

export type PlaylistPreviewPayload =
  | {
      playlistId: string;
      title?: string;
      items: PlaylistItem[];
      expectedCount: number | null;
      skippedCount: number;
    }
  | {
      error: string;
    };

export type WorkerCollection = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  visibility: string;
  version: number;
  use_count: number;
  counts_last_use_id: number;
  use_count_updated: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export type WorkerCollectionItem = {
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
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export type WorkerListPayload<TItem> = {
  ok?: boolean;
  data?: {
    items: TItem[];
    page: number;
    pageSize: number;
  };
  error?: string;
};

export type WorkerUpsertUserBody = {
  id: string;
  email?: string | null;
  provider?: string;
  provider_user_id?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expires_at?: number | null;
};

const fetchJson = async <T>(
  url: string,
  options?: RequestInit,
): Promise<ApiResult<T>> => {
  const res = await fetch(url, options);
  const payload = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, payload };
};

export const apiRefreshAuthToken = (apiUrl: string) =>
  fetchJson<AuthPayload>(`${apiUrl}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

export const apiFetchRooms = (apiUrl: string) =>
  fetchJson<RoomListPayload>(`${apiUrl}/api/rooms`);

export const apiFetchRoomById = (apiUrl: string, roomId: string) =>
  fetchJson<RoomByIdPayload>(`${apiUrl}/api/rooms/${roomId}`);

export const apiFetchYoutubePlaylists = (apiUrl: string, token: string) =>
  fetchJson<YoutubePlaylistsPayload>(`${apiUrl}/api/youtube/playlists`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const apiFetchYoutubePlaylistItems = (
  apiUrl: string,
  token: string,
  playlistId: string,
  startIndex?: number,
  pageSize?: number,
) => {
  const url = new URL(`${apiUrl}/api/youtube/playlist-items`);
  url.searchParams.set("playlistId", playlistId);
  if (startIndex !== undefined) {
    url.searchParams.set("startIndex", String(startIndex));
  }
  if (pageSize !== undefined) {
    url.searchParams.set("pageSize", String(pageSize));
  }
  return fetchJson<YoutubePlaylistItemsPayload>(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const apiAuthGoogle = (
  apiUrl: string,
  code: string,
  redirectUri: string,
) =>
  fetchJson<AuthPayload>(`${apiUrl}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code, redirectUri }),
  });

export const apiLogout = (apiUrl: string) =>
  fetchJson<{ ok?: boolean; error?: string }>(`${apiUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

export const apiPreviewPlaylist = (
  apiUrl: string,
  url: string,
  playlistId?: string,
) =>
  fetchJson<PlaylistPreviewPayload>(`${apiUrl}/api/playlists/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, playlistId }),
  });

export const apiUpsertWorkerUser = (
  workerUrl: string,
  token: string,
  body: WorkerUpsertUserBody,
) =>
  fetchJson<{ ok?: boolean; data?: AuthUser; error?: string }>(
    `${workerUrl}/users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );

export const apiFetchCollections = (
  workerUrl: string,
  token: string,
  ownerId?: string,
  pageSize?: number,
) => {
  const url = new URL(`${workerUrl}/collections`);
  if (ownerId) {
    url.searchParams.set("owner_id", ownerId);
  }
  if (pageSize !== undefined) {
    url.searchParams.set("pageSize", String(pageSize));
  }
  return fetchJson<WorkerListPayload<WorkerCollection>>(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const apiFetchCollectionItems = (
  workerUrl: string,
  token: string,
  collectionId: string,
  pageSize: number,
) => {
  const url = new URL(`${workerUrl}/collections/${collectionId}/items`);
  url.searchParams.set("pageSize", String(pageSize));
  return fetchJson<WorkerListPayload<WorkerCollectionItem>>(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
};
