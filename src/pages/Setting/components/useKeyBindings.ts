import { useEffect, useState } from "react";

export type KeyBindings = Record<number, string>;

const STORAGE_KEY = "mq_keybindings";
const DEFAULT_BINDINGS: KeyBindings = { 0: "Q", 1: "W", 2: "A", 3: "S" };

const readBindings = (): KeyBindings => {
  if (typeof window === "undefined") return DEFAULT_BINDINGS;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as KeyBindings;
  } catch {
    /* ignore parse errors */
  }
  return DEFAULT_BINDINGS;
};

const useKeyBindings = () => {
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(readBindings);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(keyBindings),
      );
    } catch {
      /* ignore */
    }
  }, [keyBindings]);

  return { keyBindings, setKeyBindings } as const;
};

export { useKeyBindings };
