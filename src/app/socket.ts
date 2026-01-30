import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});
