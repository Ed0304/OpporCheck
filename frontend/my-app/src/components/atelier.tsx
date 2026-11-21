// Document Atelier presentational components: DocSheet (paper surface
// with page-edge detail and metadata slots) and DocStack (layered
// sheets that gently separate on hover/focus). Decorative rotation
// applies only to non-reading back layers; the front reading surface
// is never rotated or distorted. Transform motion is disabled under
// prefers-reduced-motion via MotionProvider; no fake counts,
// no state claims — visual treatment only.

"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { OC_DURATION, OC_EASE } from "@/components/motion";

export function DocSheet({
  eyebrow,
  title,
  meta,
  actions,
  children,
  selected = false,
  className = "",
}: {
  eyebrow?: ReactNode;
  title?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  className?: string;
}) {
  return (
    <motion.article
      aria-label={title}
      aria-current={selected ? "true" : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      whileFocus={{ y: -2 }}
      transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
      className={`overflow-hidden rounded-lg border bg-paper ${
        selected
          ? "border-evidence shadow-[0_4px_16px_var(--oc-paper-shadow)] ring-1 ring-evidence/40"
          : "border-paper-edge shadow-[0_2px_10px_var(--oc-paper-shadow)]"
      } ${className}`}
    >
      <div aria-hidden className="oc-page-edge h-1.5 w-full" />
      <div className="p-5">
        {(eyebrow || title || actions) && (
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              {eyebrow && (
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {eyebrow}
                </p>
              )}
              {title && <h2 className="mt-0.5 text-lg font-semibold">{title}</h2>}
              {meta && <div className="mt-1 text-sm text-muted">{meta}</div>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </div>
    </motion.article>
  );
}

export function DocStack({
  label,
  children,
  layers = 2,
  className = "",
}: {
  label: string;
  children: ReactNode;
  layers?: 1 | 2;
  className?: string;
}) {
  return (
    <motion.div
      role="group"
      aria-label={label}
      tabIndex={0}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: OC_DURATION.panel, ease: OC_EASE }}
      className={`oc-doc-stack relative rounded-lg p-2.5 ${className}`}
    >
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          aria-hidden
          data-layer={i + 1}
          className="oc-doc-stack-layer pointer-events-none absolute inset-2.5 rounded-lg border border-paper-edge bg-paper"
        />
      ))}
      <div className="relative">{children}</div>
    </motion.div>
  );
}
