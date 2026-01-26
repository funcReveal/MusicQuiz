import { useContext } from "react";

import { RoomContext } from "./RoomContext";

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return ctx;
};
