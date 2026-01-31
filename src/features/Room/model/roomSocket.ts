import { io } from "socket.io-client";

import type {
  ChatMessage,
  ClientSocket,
  GameState,
  PlaylistState,
  RoomParticipant,
  RoomState,
  RoomSummary,
} from "./types";

type RoomSocketHandlers = {
  onConnect?: (socket: ClientSocket) => void;
  onDisconnect?: () => void;
  onRoomsUpdated?: (rooms: RoomSummary[]) => void;
  onJoinedRoom?: (state: RoomState) => void;
  onParticipantsUpdated?: (payload: {
    roomId: string;
    participants: RoomParticipant[];
    hostClientId: string;
  }) => void;
  onUserLeft?: (payload: { roomId: string; clientId: string }) => void;
  onPlaylistProgress?: (payload: {
    roomId: string;
    receivedCount: number;
    totalCount: number;
    ready: boolean;
  }) => void;
  onPlaylistUpdated?: (payload: { roomId: string; playlist: PlaylistState }) => void;
  onMessageAdded?: (payload: { roomId: string; message: ChatMessage }) => void;
  onGameStarted?: (payload: {
    roomId: string;
    gameState: GameState;
    serverNow: number;
  }) => void;
  onGameUpdated?: (payload: {
    roomId: string;
    gameState: GameState;
    serverNow: number;
  }) => void;
};

type RoomSocketAuth =
  | { clientId: string; token?: string }
  | { clientId: string; token: string };

export const connectRoomSocket = (
  socketUrl: string,
  auth: RoomSocketAuth,
  handlers: RoomSocketHandlers,
) => {
  const socket = io(socketUrl, {
    transports: ["websocket"],
    auth,
  });

  socket.on("connect", () => handlers.onConnect?.(socket));
  socket.on("disconnect", () => handlers.onDisconnect?.());
  socket.on("roomsUpdated", (rooms) => handlers.onRoomsUpdated?.(rooms));
  socket.on("joinedRoom", (state) => handlers.onJoinedRoom?.(state));
  socket.on("participantsUpdated", (payload) =>
    handlers.onParticipantsUpdated?.(payload),
  );
  socket.on("userLeft", (payload) => handlers.onUserLeft?.(payload));
  socket.on("playlistProgress", (payload) =>
    handlers.onPlaylistProgress?.(payload),
  );
  socket.on("playlistUpdated", (payload) =>
    handlers.onPlaylistUpdated?.(payload),
  );
  socket.on("messageAdded", (payload) =>
    handlers.onMessageAdded?.(payload),
  );
  socket.on("gameStarted", (payload) => handlers.onGameStarted?.(payload));
  socket.on("gameUpdated", (payload) => handlers.onGameUpdated?.(payload));

  return socket;
};

export const disconnectRoomSocket = (socket: ClientSocket | null) => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
};
