"use client";

// Theme preference: light / dark / system (default). Persisted in
// localStorage; the blocking script in the root layout applies the saved
// class before first paint to avoid a theme flash. State lives in the
// browser (localStorage + media query) and is subscribed via
// useSyncExternalStore, so no data-loading effects are needed.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "oc-theme";
const CHANGE_EVENT = "oc-theme-change";

interface ThemeState {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeState>({
  choice: "system",
  resolved: "light",
  setChoice: () => {},
});

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveChoice(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") {
    return choice;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Combined snapshot so media changes also trigger a re-render. */
function snapshot(): string {
  const choice = readChoice();
  return `${choice}:${resolveChoice(choice)}`;
}

function serverSnapshot(): string {
  return "system:light";
}

function subscribe(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => callback();
  const onCustom = () => callback();
  media.addEventListener("change", onMedia);
  window.addEventListener(CHANGE_EVENT, onCustom);
  window.addEventListener("storage", onCustom);
  return () => {
    media.removeEventListener("change", onMedia);
    window.removeEventListener(CHANGE_EVENT, onCustom);
    window.removeEventListener("storage", onCustom);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snap = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [choice, resolved] = useMemo(() => {
    const [c, r] = snap.split(":");
    return [
      c === "light" || c === "dark" ? (c as ThemeChoice) : ("system" as ThemeChoice),
      r === "dark" ? ("dark" as ResolvedTheme) : ("light" as ResolvedTheme),
    ] as const;
  }, [snap]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: preference simply won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo<ThemeState>(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
