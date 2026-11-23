// Hero product graphic: three connected interface-style cards showing a
// recruiter message, the highlighted contract term that differs from it,
// and the resulting clarification finding. Pure presentation — fictional
// sample data, no analysis runs here.
//
// Cards stack in reading order at every width, so the story survives
// narrow screens with no horizontal scrolling. Gradient timeline
// connectors with a shared "1" marker link the promise to the pinned
// contract term and the finding. Hovering, focusing, or pinning the
// highlight, connectors, and finding together; the pin button
// (aria-pressed) gives keyboard users the same persistent emphasis.
// Meaning is carried by text labels, not color or lines alone, and all
// emphasis transitions are plain CSS so prefers-reduced-motion degrades
// to instant state changes with nothing lost.

"use client";

import { useState } from "react";
import { Stagger, StaggerItem } from "@/components/motion";
import { StatusLabel } from "@/components/ui";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function Connector({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="flex justify-center py-1.5">
      <span className="relative flex h-7 w-0.5 justify-center rounded-full bg-gradient-to-b from-brand/60 via-edge to-evidence/60">
        <span
          className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-card transition-colors ${
            active ? "bg-brand" : "bg-muted/70"
          }`}
        />
      </span>
    </div>
  );
}

export default function HeroComposition() {
  const { language } = useLang();
  const t = getStrings(language);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const active = pinned || hover;

  return (
    <figure aria-label={t.landingExampleAria}>
      <Stagger className="flex flex-col">
        <StaggerItem>
          <div className="oc-glass flex gap-4 rounded-xl border border-edge p-5 text-left">
            <span aria-hidden className="font-serif text-5xl leading-none text-brand/30">
              &ldquo;
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-brand uppercase">
                {t.landingExamplePromiseLabel}
              </p>
              <p className="mt-1 text-xl leading-8 font-medium text-balance text-ink">
                {t.landingExampleClaim}
              </p>
            </div>
          </div>
        </StaggerItem>

        <Connector active={active} />

        <StaggerItem>
          <div
            className={`oc-glass rounded-xl border border-edge p-5 text-left transition-shadow ${
              active ? "oc-glass-active" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold tracking-wider text-evidence uppercase">
                {t.landingExampleContractHeading}
              </p>
              <span className="rounded-full border border-edge bg-card px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brand uppercase">
                {t.landingSampleBadge}
              </span>
            </div>
            {/* Same evidence-quote treatment as every quoted excerpt in
                the app: teal bar plus faint wash, no filled slab, so the
                card can never clash with its neighbors. */}
            <blockquote
              className={`mt-2 rounded-r-lg border-l-2 px-3 py-2 text-lg leading-8 transition-colors ${
                active
                  ? "border-evidence bg-evidence-soft/70"
                  : "border-evidence/70 bg-evidence-soft/40"
              }`}
            >
              &ldquo;{t.landingExampleQuote}&rdquo;{" "}
              <span
                title={t.landingPreviewAnnotation}
                aria-hidden
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand align-middle text-[11px] font-bold text-on-action"
              >
                1
              </span>
            </blockquote>
            <p className="mt-2 text-[13px] leading-5 text-muted">
              {t.landingExampleContractLabel}
            </p>
          </div>
        </StaggerItem>

        <Connector active={active} />

        <StaggerItem>
          <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
            className="oc-glass rounded-xl border border-edge p-5 text-left"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={t.landingExamplePinLabel}
                title={t.landingPreviewAnnotation}
                onClick={() => setPinned((value) => !value)}
                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-brand text-xs font-bold text-on-action transition-colors hover:bg-brand-strong"
              >
                <span aria-hidden>1</span>
              </button>
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                {t.landingExampleBadge}
              </p>
            </div>
            <div className="mt-3">
              <StatusLabel tone="warn">{t.landingExampleStatus}</StatusLabel>
            </div>
            <p className="mt-2 text-sm leading-6">{t.landingExampleDetail}</p>
          </div>
        </StaggerItem>
      </Stagger>
      <figcaption className="mt-4 text-center text-[13px] leading-5 text-muted">
        {t.landingExampleCaption}
      </figcaption>
    </figure>
  );
}
