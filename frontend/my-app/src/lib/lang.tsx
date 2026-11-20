// UI language preference: English / Bahasa Indonesia. Persisted in
// localStorage like the theme choice; state is subscribed via
// useSyncExternalStore so no data-loading effects are needed.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { UiLanguage } from "./strings";

const STORAGE_KEY = "oc-lang";
const CHANGE_EVENT = "oc-lang-change";

interface LangState {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
}

const LangContext = createContext<LangState>({
  language: "en",
  setLanguage: () => {},
});

function readLanguage(): UiLanguage {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "id" ? "id" : "en";
  } catch {
    return "en";
  }
}

function subscribe(callback: () => void): () => void {
  const onCustom = () => callback();
  window.addEventListener(CHANGE_EVENT, onCustom);
  window.addEventListener("storage", onCustom);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onCustom);
    window.removeEventListener("storage", onCustom);
  };
}

function snapshot(): UiLanguage {
  return readLanguage();
}

function serverSnapshot(): UiLanguage {
  return "en";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const setLanguage = useCallback((next: UiLanguage) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: preference simply won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo<LangState>(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  return useContext(LangContext);
}
