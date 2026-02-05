import { STORAGE_KEYS } from "./roomConstants";

const roomPasswordKey = (roomId: string) =>
  `${STORAGE_KEYS.roomPasswordPrefix}${roomId}`;

const profileConfirmedKey = (userId: string) =>
  `${STORAGE_KEYS.profileConfirmedPrefix}${userId}`;

export const getStoredUsername = () => localStorage.getItem(STORAGE_KEYS.username);

export const setStoredUsername = (name: string) =>
  localStorage.setItem(STORAGE_KEYS.username, name);

export const clearStoredUsername = () =>
  localStorage.removeItem(STORAGE_KEYS.username);

export const getStoredRoomId = () => localStorage.getItem(STORAGE_KEYS.roomId);

export const setStoredRoomId = (roomId: string) =>
  localStorage.setItem(STORAGE_KEYS.roomId, roomId);

export const clearStoredRoomId = () =>
  localStorage.removeItem(STORAGE_KEYS.roomId);

export const getStoredQuestionCount = () => {
  const saved = Number(localStorage.getItem(STORAGE_KEYS.questionCount));
  return Number.isFinite(saved) ? saved : null;
};

export const setStoredQuestionCount = (value: number) =>
  localStorage.setItem(STORAGE_KEYS.questionCount, String(value));

export const getOrCreateClientId = () => {
  const existing = localStorage.getItem(STORAGE_KEYS.clientId);
  if (existing) return existing;
  const generated =
    crypto.randomUUID?.() ??
    `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  localStorage.setItem(STORAGE_KEYS.clientId, generated);
  return generated;
};


export const getRoomPassword = (roomId: string) =>
  localStorage.getItem(roomPasswordKey(roomId));

export const setRoomPassword = (roomId: string, password: string) =>
  localStorage.setItem(roomPasswordKey(roomId), password);

export const clearRoomPassword = (roomId: string) =>
  localStorage.removeItem(roomPasswordKey(roomId));

export const isProfileConfirmed = (userId: string) =>
  localStorage.getItem(profileConfirmedKey(userId)) === "1";

export const setProfileConfirmed = (userId: string) =>
  localStorage.setItem(profileConfirmedKey(userId), "1");
