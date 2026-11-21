"use client";

import { useSyncExternalStore } from "react";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Dependency-free reduced-motion signal for JS-driven motion
 * (e.g. scroll behavior). Defaults to reduced motion server-side
 * so the first render never animates ahead of user preference.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}
