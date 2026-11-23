// Custom cursor layer: a static accent arrow that replaces the system
// arrow inside the site. Mounted once in the root layout so it works
// across route changes, public pages, the workspace, and the Model
// Playground.
//
// Tracking model (deliberately animation-free): the arrow is
// positioned synchronously inside the pointermove handler from the
// viewport coordinates, with its tip exactly on the pointer. There is
// no easing, trailing, scaling, or press motion — nothing that can
// leave a visible gap or stray from the real pointer. Interactive
// feedback is a color shift only, which cannot disturb position.
//
// Native cursor discipline: the system arrow is hidden inside the site
// ONLY after the first pointer movement proves the custom cursor is
// mounted and functioning (via the oc-has-cursor document class), and
// restored when the pointer leaves the site or the component
// unmounts. Over text-entry elements the custom arrow hides entirely
// and the native I-beam/text pointer returns, so the insertion caret
// stays unobscured and editing feels normal. Touch, keyboard-only,
// reduced-motion, and mount-failure cases keep the native pointer
// untouched. Coordinates never leave the browser.

"use client";

import { useEffect, useRef } from "react";

/** Selectors that count as interactive for the accent shift. */
const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], input, select, textarea, label, summary, [data-cursor='hover']";

/** Text-entry elements where the native text pointer is restored. */
const TEXT_ENTRY_SELECTOR =
  "input:not([type]), input[type='text'], input[type='email'], " +
  "input[type='password'], input[type='search'], input[type='url'], " +
  "input[type='number'], input[type='tel'], textarea, [contenteditable='true']";

const ACTIVE_CLASS = "oc-has-cursor";

export default function CustomCursor() {
  const arrowRef = useRef<HTMLDivElement>(null);

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
    const arrow = arrowRef.current;
    if (!arrow) {
      return;
    }
    let active = false;

    const show = () => {
      if (!active) {
        active = true;
        document.documentElement.classList.add(ACTIVE_CLASS);
      }
    };
    const hide = () => {
      active = false;
      document.documentElement.classList.remove(ACTIVE_CLASS);
      arrow.style.opacity = "0";
      arrow.dataset.active = "false";
    };
    // Single shared pointermove listener: the arrow tip lands exactly
    // on the pointer in the same synchronous handler, every time.
    const onMove = (event: PointerEvent) => {
      arrow.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      show();
      const target = event.target as HTMLElement | null;
      const editing = target?.closest?.(TEXT_ENTRY_SELECTOR) != null;
      arrow.style.opacity = editing ? "0" : "1";
      const interactive =
        !editing && target?.closest?.(INTERACTIVE_SELECTOR) != null;
      arrow.dataset.active = interactive ? "true" : "false";
    };
    const onLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        hide();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove(ACTIVE_CLASS);
    };
  }, []);

  return (
    <div aria-hidden className="oc-cursor">
      <div ref={arrowRef} className="oc-cursor-arrow">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M6.5 3.5 18.8 12.2 12.1 13.4 9.6 20.6Z"
            fill="currentColor"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
