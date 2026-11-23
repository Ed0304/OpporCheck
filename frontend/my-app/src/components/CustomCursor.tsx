// Custom cursor layer: a small accent core with a soft translucent ring
// that tracks the pointer. Mounted once in the root layout so it works
// across route changes, public pages, the workspace, and the Model
// Playground.
//
// Tracking model (deliberately easing-free): both elements are
// positioned synchronously inside the pointermove handler from the same
// clientX/clientY viewport coordinates, so the dot and ring are
// concentric by construction — at rest, mid-motion, and mid-click —
// with zero frames of lag and no asymptotic trail. Interactive and
// pressed feedback rides the independent CSS `scale` property, which
// never disturbs centering.
//
// Native cursor discipline: the system arrow is hidden inside the site
// ONLY after the first pointer movement proves the custom cursor is
// mounted and functioning (via the oc-has-cursor document class), and
// restored when the pointer leaves the site or the component
// unmounts. Over text-entry elements the native I-beam/text pointer is
// restored and the dot hides so the insertion caret stays unobscured.
// Touch, keyboard-only, reduced-motion, and mount-failure cases keep
// the native pointer untouched. Coordinates never leave the browser.

"use client";

import { useEffect, useRef } from "react";

/** Selectors that count as interactive for the ring expansion. */
const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], input, select, textarea, label, summary, [data-cursor='hover']";

/** Text-entry elements where the native text pointer is restored. */
const TEXT_ENTRY_SELECTOR =
  "input:not([type]), input[type='text'], input[type='email'], " +
  "input[type='password'], input[type='search'], input[type='url'], " +
  "input[type='number'], input[type='tel'], textarea, [contenteditable='true']";

const ACTIVE_CLASS = "oc-has-cursor";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!window.matchMedia("(pointer: fine)").matches) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) {
      return;
    }
    let active = false;

    const show = () => {
      if (!active) {
        active = true;
        document.documentElement.classList.add(ACTIVE_CLASS);
        ring.style.opacity = "1";
      }
    };
    const hide = () => {
      active = false;
      document.documentElement.classList.remove(ACTIVE_CLASS);
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };
    // Single shared pointermove listener: positions both elements from
    // one coordinate source in the same synchronous handler.
    const onMove = (event: PointerEvent) => {
      const transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      dot.style.transform = transform;
      ring.style.transform = transform;
      show();
      const target = event.target as HTMLElement | null;
      const editing = target?.closest?.(TEXT_ENTRY_SELECTOR) != null;
      // The dot hides over text entry so it can never cover the caret;
      // the hollow ring stays as a position cue.
      dot.style.opacity = editing ? "0" : "1";
      const interactive =
        !editing && target?.closest?.(INTERACTIVE_SELECTOR) != null;
      ring.dataset.active = interactive ? "true" : "false";
    };
    const onDown = () => {
      ring.dataset.pressed = "true";
    };
    const onUp = () => {
      ring.dataset.pressed = "false";
    };
    const onLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        hide();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove(ACTIVE_CLASS);
    };
  }, []);

  return (
    <div aria-hidden className="oc-cursor">
      <div ref={ringRef} className="oc-cursor-ring" />
      <div ref={dotRef} className="oc-cursor-dot" />
    </div>
  );
}
