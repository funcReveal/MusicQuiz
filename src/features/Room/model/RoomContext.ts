import { createContext } from "react";

import type {
  ChatMessage,
  GameState,
  PlaylistItem,
  PlaylistSuggestion,
  RoomParticipant,
  RoomState,
  RoomSummary,
} from "./types";

export type AuthUser = {
  id: string;
  email?: string | null;
  provider?: string;
  provider_user_id?: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export type YoutubePlaylist = {
  id: string;
  title: string;
  itemCount: number;
  thumbnail?: string;
};

export interface RoomContextValue {
  authToken: string | null;
  authUser: AuthUser | null;
  authLoading: boolean;
  refreshAuthToken: () => Promise<string | null>;
  loginWithGoogle: () => void;
  logout: () => void;
  needsNicknameConfirm: boolean;
  nicknameDraft: string;
  setNicknameDraft: (value: string) => void;
  confirmNickname: () => void;
  isProfileEditorOpen: boolean;
  openProfileEditor: () => void;
  closeProfileEditor: () => void;
  youtubePlaylists: YoutubePlaylist[];
  youtubePlaylistsLoading: boolean;
  youtubePlaylistsError: string | null;
  fetchYoutubePlaylists: () => Promise<void>;
  importYoutubePlaylist: (playlistId: string) => Promise<void>;
  collections: Array<{
    id: string;
    title: string;
    description?: string | null;
    visibility?: "private" | "public";
  }>;
  collectionsLoading: boolean;
  collectionsError: string | null;
  selectedCollectionId: string | null;
  collectionItemsLoading: boolean;
  collectionItemsError: string | null;
  fetchCollections: (scope?: "owner" | "public") => Promise<void>;
  selectCollection: (collectionId: string | null) => void;
  loadCollectionItems: (collectionId: string) => Promise<void>;
  usernameInput: string;
  setUsernameInput: (value: string) => void;
  username: string | null;
  displayUsername: string;
  clientId: string;
  isConnected: boolean;
  rooms: RoomSummary[];
  roomNameInput: string;
  setRoomNameInput: (value: string) => void;
  roomPasswordInput: string;
  setRoomPasswordInput: (value: string) => void;
  joinPasswordInput: string;
  setJoinPasswordInput: (value: string) => void;
  currentRoom: RoomState["room"] | null;
  currentRoomId: string | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  messageInput: string;
  setMessageInput: (value: string) => void;
  statusText: string | null;
  setStatusText: (value: string | null) => void;
  playlistUrl: string;
  setPlaylistUrl: (value: string) => void;
  playlistItems: PlaylistItem[];
  playlistError: string | null;
  playlistLoading: boolean;
  playlistStage: "input" | "preview";
  playlistLocked: boolean;
  lastFetchedPlaylistId: string | null;
  lastFetchedPlaylistTitle: string | null;
  playlistViewItems: PlaylistItem[];
  playlistHasMore: boolean;
  playlistLoadingMore: boolean;
  playlistPageCursor: number;
  playlistPageSize: number;
  playlistProgress: { received: number; total: number; ready: boolean };
  playlistSuggestions: PlaylistSuggestion[];
  questionCount: number;
  questionMin: number;
  questionMax: number;
  questionStep: number;
  questionMaxLimit: number;
  inviteRoomId: string | null;
  inviteNotFound: boolean;
  isInviteMode: boolean;
  gameState: GameState | null;
  gamePlaylist: PlaylistItem[];
  isGameView: boolean;
  setIsGameView: (value: boolean) => void;
  routeRoomResolved: boolean;
  hostRoomPassword: string | null;
  serverOffsetMs: number;
  setInviteRoomId: (value: string | null) => void;
  setRouteRoomId: (value: string | null) => void;
  handleSetUsername: () => void;
  handleCreateRoom: () => Promise<void>;
  handleJoinRoom: (roomId: string, hasPassword: boolean) => void;
  handleLeaveRoom: (onLeft?: () => void) => void;
  handleSendMessage: () => void;
  handleStartGame: () => void;
  handleSubmitChoice: (choiceIndex: number) => void;
  handleUpdateRoomSettings: (payload: {
    name?: string;
    visibility?: "public" | "private";
    password?: string | null;
    questionCount?: number;
    maxPlayers?: number | null;
  }) => Promise<boolean>;
  handleKickPlayer: (targetClientId: string, durationMs?: number | null) => void;
  handleTransferHost: (targetClientId: string) => void;
  handleSuggestPlaylist: (type: "collection" | "playlist", value: string) => void;
  handleChangePlaylist: () => Promise<void>;
  handleFetchPlaylistByUrl: (url: string) => Promise<void>;
  handleFetchPlaylist: (options?: {
    url?: string;
    force?: boolean;
    lock?: boolean;
  }) => Promise<void>;
  handleResetPlaylist: () => void;
  loadMorePlaylist: () => void;
  updateQuestionCount: (value: number) => void;
  syncServerOffset: (serverNow: number) => void;
  fetchRooms: () => Promise<void>;
  fetchRoomById: (roomId: string) => Promise<RoomSummary | null>;
  resetCreateState: () => void;
}

export const RoomContext = createContext<RoomContextValue | null>(null);
