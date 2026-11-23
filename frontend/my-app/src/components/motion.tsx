// Shared Evidence Desk motion primitives (Motion for React).
//
// One restrained vocabulary for the whole app: short fades with small
// positional shifts, consistent durations, and no layout-shifting or
// continuous effects. Reduced motion is honored globally through
// MotionProvider (MotionConfig reducedMotion="user"), which disables
// transform/layout animation for users who prefer reduced motion while
// keeping content instantly readable. These primitives never gate
// content on animation completing and never imply success ahead of
// confirmed application state.

"use client";

import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

/** Restrained ease-out curve shared by every transition. */
export const OC_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Consistent durations (seconds): press/hover, panels, drawers. */
export const OC_DURATION = { fast: 0.15, base: 0.22, panel: 0.28 } as const;

/**
 * App-wide motion boundary. Mount once in the root layout; every
 * Motion component below it inherits the reduced-motion behavior.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
    >
      {children}
    </MotionConfig>
  );
}

/**
 * Scroll-aware entrance for static page sections. Content below the
 * fold fades up once when it scrolls into view; content already
 * visible plays once on mount. Opacity-only under reduced motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: OC_DURATION.panel, ease: OC_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Mount entrance for conditionally rendered content (results panels,
 * reports). Renders nothing animated on the way out unless placed
 * inside AnimatePresence, where it also fades out on removal.
 */
export function Enter({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: OC_DURATION.panel, ease: OC_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Connected transition between mutually exclusive panels (input tabs,
 * privacy states, empty vs. report). Exactly one child is visible;
 * keyed changes crossfade with a small positional shift.
 */
export function Crossfade({
  panelKey,
  children,
  className,
}: {
  panelKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={panelKey}
        className={className}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Deliberate sequential reveal for short lists (findings, terms,
 * report sections). Stagger is small (60ms) so supporting evidence
 * stays quick to scan; items remain in the DOM in order.
 */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        shown: {
          opacity: 1,
          y: 0,
          transition: { duration: OC_DURATION.base, ease: OC_EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Sliding indicator for tabs and navigation. Render inside the active
 * item (positioned absolute inset) so selection visibly travels
 * between options instead of snapping. Disabled under reduced motion.
 */
export function ActivePill({
  pillId,
  className,
}: {
  pillId: string;
  className?: string;
}) {
  return (
    <motion.span
      aria-hidden
      layoutId={pillId}
      transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
      className={`absolute inset-0 rounded-md ${className ?? "bg-brand-soft"}`}
    />
  );
}

/**
 * Pointer spotlight wrapper: tracks the cursor as --oc-spot-x/--oc-spot-y
 * percentages so the .oc-spotlight glow follows it over decorative
 * panels. The glow itself renders only for fine pointers on
 * hover-capable devices (see globals.css); touch, keyboard, and
 * reduced-motion users are unaffected. Never intercepts clicks.
 */
/**
 * Truthful progress bar: width always reflects a real measured value
 * (device-model download, upload fraction) passed by the caller.
 * Animates smoothly between reported values; null renders full width
 * for indeterminate-but-active work, matching prior behavior.
 */
export function ProgressBar({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  const percent = value === null ? 100 : Math.round(value * 100);
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-soft"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : percent}
      aria-label={label}
    >
      <motion.div
        className="h-1.5 rounded-full bg-brand"
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
      />
    </div>
  );
}
