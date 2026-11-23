// Custom cursor layer: a small accent core with a soft translucent
// ring that follows the pointer. Mounted once in the root layout so it
// works across route changes, public pages, the workspace, and the
// Model Playground.
//
// Behavior: appears on the first pointer movement (no click needed),
// follows with a short lerp for a smooth but responsive feel, expands
// over interactive elements, and dips briefly on press. The native
// cursor stays visible everywhere — the ring is a complement, never a
// replacement — and the layer is pointer-events-none so it can never
// block clicks, selection, menus, dialogs, or form controls. Pointer
// coordinates never leave the browser (no tracking).
//
// Mounts only for fine pointers without a reduced-motion preference;
// touch, keyboard-only, and reduced-motion users get the native
// pointer. A single shared pointermove listener plus one animation
// frame drives both elements.

"use client";

import { useEffect, useRef } from "react";

/** Selectors that count as interactive for the ring expansion. */
const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], input, select, textarea, label, summary, [data-cursor='hover']";

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
    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let frame = 0;
    let visible = false;

    const show = () => {
      if (!visible) {
        visible = true;
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }
    };
    const hide = () => {
      visible = false;
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };
    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      show();
      const target = event.target as HTMLElement | null;
      const interactive =
        target?.closest?.(INTERACTIVE_SELECTOR) != null;
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
    const loop = () => {
      ringX += (targetX - ringX) * 0.35;
      ringY += (targetY - ringY) * 0.35;
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div aria-hidden className="oc-cursor">
      <div ref={ringRef} className="oc-cursor-ring" />
      <div ref={dotRef} className="oc-cursor-dot" />
    </div>
  );
}
