import { Socket } from "socket.io-client";

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RoomParticipant {
  socketId: string;
  username: string;
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
}

export interface RoomState {
  room: RoomSummary;
  participants: RoomParticipant[];
  messages: ChatMessage[];
}

// Client -> Server
export interface ClientToServerEvents {
  createRoom: (
    payload: { roomName: string; username: string },
    callback?: (ack: Ack<RoomState>) => void
  ) => void;
  joinRoom: (
    payload: { roomId: string; username: string },
    callback?: (ack: Ack<RoomState>) => void
  ) => void;
  leaveRoom: (
    payload: { roomId: string },
    callback?: (ack: Ack<null>) => void
  ) => void;
  sendMessage: (
    payload: { roomId: string; content: string },
    callback?: (ack: Ack<ChatMessage>) => void
  ) => void;
  listRooms: (callback?: (ack: Ack<RoomSummary[]>) => void) => void;
}

// Server -> Client
export interface ServerToClientEvents {
  roomsUpdated: (rooms: RoomSummary[]) => void;
  joinedRoom: (state: RoomState) => void;
  userJoined: (payload: {
    roomId: string;
    participant: RoomParticipant;
  }) => void;
  userLeft: (payload: { roomId: string; socketId: string }) => void;
  messageAdded: (payload: { roomId: string; message: ChatMessage }) => void;
}

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface PlaylistItem {
  title: string;
  url: string;
  uploader?: string;
  duration?: string;
}
