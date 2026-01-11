import { Socket } from "socket.io-client";

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PlaylistItem {
  title: string;
  url: string;
  uploader?: string;
  duration?: string;
  thumbnail?: string;
}

export interface PlaylistState {
  id?: string;
  title?: string;
  uploadId?: string;
  items: PlaylistItem[];
  totalCount: number;
  receivedCount: number;
  ready: boolean;
  pageSize: number;
}

export interface GameChoice {
  title: string;
  index: number;
}

export interface GameState {
  status: "playing" | "ended";
  phase: "guess" | "reveal";
  currentIndex: number;
  startedAt: number;
  revealEndsAt: number;
  guessDurationMs: number;
  revealDurationMs: number;
  choices: GameChoice[];
  answerTitle?: string;
  showVideo: boolean;
  trackOrder: number[];
  trackCursor: number;
  lockedClientIds?: string[];
  lockedOrder?: string[];
}

export interface RoomParticipant {
  clientId: string;
  username: string;
  socketId?: string;
  joinedAt: number;
  isOnline: boolean;
  lastSeen: number;
  score: number;
  combo: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  playerCount: number;
  createdAt: number;
  hasPassword: boolean;
  playlistCount: number;
  gameSettings?: {
    questionCount: number;
  };
}

export interface RoomState {
  room: RoomSummary & {
    hostClientId: string;
    playlist: PlaylistState;
  };
  participants: RoomParticipant[];
  messages: ChatMessage[];
  gameState?: GameState | null;
  serverNow: number;
}

// Client -> Server
export interface ClientToServerEvents {
  createRoom: (
    payload: {
      roomName: string;
      username: string;
      password?: string;
      gameSettings?: { questionCount: number };
      playlist: {
        uploadId: string;
        id?: string;
        title?: string;
        totalCount: number;
        items?: PlaylistItem[];
        isLast?: boolean;
        pageSize?: number;
      };
    },
    callback?: (ack: Ack<RoomState>) => void
  ) => void;
  joinRoom: (
    payload: { roomId: string; username: string; password?: string },
    callback?: (ack: Ack<RoomState>) => void
  ) => void;
  resumeSession: (
    payload: { roomId: string; username: string },
    callback?: (ack: Ack<RoomState>) => void
  ) => void;
  leaveRoom: (
    payload: { roomId: string },
    callback?: (ack: Ack<null>) => void
  ) => void;
  sendMessage: (
    payload: { content: string },
    callback?: (ack: Ack<ChatMessage>) => void
  ) => void;
  listRooms: (callback?: (ack: Ack<RoomSummary[]>) => void) => void;
  uploadPlaylistChunk: (
    payload: {
      roomId: string;
      uploadId: string;
      items: PlaylistItem[];
      isLast?: boolean;
    },
    callback?: (ack: Ack<{ receivedCount: number; totalCount: number }>) => void
  ) => void;
  getPlaylistPage: (
    payload: { roomId: string; page: number; pageSize?: number },
    callback?: (ack: Ack<{
      items: PlaylistItem[];
      totalCount: number;
      page: number;
      pageSize: number;
      ready: boolean;
    }>) => void
  ) => void;
  startGame: (
    payload: { roomId: string },
    callback?: (ack: Ack<{ gameState: GameState; serverNow: number }>) => void
  ) => void;
  submitAnswer: (
    payload: { roomId: string; choiceIndex: number },
    callback?: (ack: Ack<null>) => void
  ) => void;
}

// Server -> Client
export interface ServerToClientEvents {
  roomsUpdated: (rooms: RoomSummary[]) => void;
  joinedRoom: (state: RoomState) => void;
  participantsUpdated: (payload: {
    roomId: string;
    participants: RoomParticipant[];
    hostClientId: string;
  }) => void;
  playlistProgress: (payload: {
    roomId: string;
    receivedCount: number;
    totalCount: number;
    ready: boolean;
  }) => void;
  playlistUpdated: (payload: { roomId: string; playlist: PlaylistState }) => void;
  userLeft: (payload: { roomId: string; clientId: string }) => void;
  messageAdded: (payload: { roomId: string; message: ChatMessage }) => void;
  gameStarted: (payload: { roomId: string; gameState: GameState; serverNow: number }) => void;
  gameUpdated: (payload: { roomId: string; gameState: GameState; serverNow: number }) => void;
}

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
