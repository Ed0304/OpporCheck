// Shared spot illustrations: one restrained stroke vocabulary for the
// whole product (1.8px rounded strokes, token colors). Glyphs explain
// actions and workflow steps; DeskArt is a larger layered-documents
// motif for auth and hero panels. All decorative (aria-hidden) —
// adjacent text always carries the meaning, so nothing here needs alt
// text or translation.

"use client";

import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function Glyph({
  children,
  size = 20,
  className = "",
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Review one opportunity: document under a magnifier. */
export function SpotDocLens({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <rect x="4" y="3" width="11" height="14" rx="2" />
      <path d="M7 7.5h5M7 10.5h5" />
      <circle cx="16.5" cy="16.5" r="3.2" />
      <path d="M18.8 18.8 21 21" />
    </Glyph>
  );
}

/** Promise-to-Paper: two documents side by side. */
export function SpotCompare({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <rect x="3" y="5" width="8" height="14" rx="2" />
      <rect x="13" y="5" width="8" height="14" rx="2" />
      <path d="M6 9h2M6 12h2M16 9h2M16 12h2" />
    </Glyph>
  );
}

/** Guidance and resources: open book. */
export function SpotBook({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <path d="M12 6C10 4.5 7 4 4 4v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2Z" />
      <path d="M12 6v12" />
    </Glyph>
  );
}

/** Share / upload: tray with an incoming arrow. */
export function SpotUpload({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v4.5A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V15" />
    </Glyph>
  );
}

/** Pasted text input: penciled lines. */
export function SpotText({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <path d="M4 6h16M4 10.5h16M4 15h9M4 19.5h6" />
    </Glyph>
  );
}

/** PDF document input. */
export function SpotPdf({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <path d="M6 3.5h8L19 8.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M13.5 3.5V9H19" />
    </Glyph>
  );
}

/** Image document input. */
export function SpotImage({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17.5 10 12.5l3.5 3.5 3-3 3 3.5" />
    </Glyph>
  );
}

/** Checklist item: box with a check. */
export function SpotCheck({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Glyph>
  );
}

/** Privacy and on-device processing: shield. */
export function SpotShield({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <path d="M12 3.5 5.5 6v6c0 4.5 2.8 7.8 6.5 9.5 3.7-1.7 6.5-5 6.5-9.5V6L12 3.5Z" />
      <path d="m9.3 11.8 2 2 3.4-3.8" />
    </Glyph>
  );
}

/** Neutral information bullet. */
export function SpotInfo({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </Glyph>
  );
}

/** Exclusion bullet for "what this is not" lists. */
export function SpotSlash({ size, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.2 6.2l11.6 11.6" />
    </Glyph>
  );
}

/**
 * Evidence Desk motif: layered paper sheets with a highlighted clause
 * under review. For auth side panels and page heroes.
 */
export function DeskArt({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 140"
      fill="none"
      className={className}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="62"
        y="14"
        width="100"
        height="106"
        rx="8"
        transform="rotate(5 112 67)"
        className="fill-brand-soft stroke-edge"
        strokeWidth="1.5"
      />
      <rect
        x="38"
        y="22"
        width="100"
        height="106"
        rx="8"
        className="fill-paper stroke-paper-edge"
        strokeWidth="1.5"
      />
      <rect x="50" y="40" width="76" height="6" rx="3" className="fill-edge" />
      <rect x="50" y="52" width="76" height="6" rx="3" className="fill-edge" />
      <rect x="50" y="64" width="58" height="9" rx="4.5" className="fill-evidence opacity-30" />
      <rect x="50" y="80" width="76" height="6" rx="3" className="fill-edge" />
      <rect x="50" y="92" width="48" height="6" rx="3" className="fill-edge" />
      <rect x="50" y="106" width="30" height="5" rx="2.5" className="fill-brand opacity-60" />
      <circle cx="148" cy="102" r="17" className="fill-card stroke-evidence" strokeWidth="2" />
      <path d="M160.5 114.5 171 125" className="stroke-evidence" strokeWidth="2.5" />
    </svg>
  );
}

/**
 * Auth side panel: desk motif plus the product promise, reusing public
 * copy. Hidden below lg so small screens stay focused on the form.
 */
export function AuthArt() {
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <div className="oc-glass hidden rounded-xl border border-edge p-8 lg:block">
      <DeskArt className="h-auto w-full" />
      <p className="mt-6 text-xl leading-8 font-semibold tracking-tight text-balance text-navy">
        {t.landingTitle}
      </p>
      <p className="mt-2 leading-7 text-muted">{t.footerTagline}</p>
    </div>
  );
}
