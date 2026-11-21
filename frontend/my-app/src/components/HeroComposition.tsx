// Hero product composition: a fictional Evidence Desk arrangement showing
// a recruiter promise, the matching written term in an example document,
// and the resulting clarification finding. Pure presentation — no
// analysis runs here and all content is illustrative sample data.
//
// Reading order tells the story: promise bar, then document beside the
// finding. Pin "1" on the written term matches pin "1" on the finding,
// and a dashed connector spans the gap between them. Hovering,
// focusing, or pinning the finding emphasizes the clause, the
// connector, and the document together; the pin button (aria-pressed)
// gives keyboard users the same persistent emphasis. Entrance uses the
// shared Stagger primitives; emphasis transitions are plain CSS so
// prefers-reduced-motion (nuked globally in globals.css) degrades to
// instant state changes with nothing lost.

"use client";

import { useState } from "react";
import { DocSheet } from "@/components/atelier";
import { Stagger, StaggerItem } from "@/components/motion";
import { StatusLabel } from "@/components/ui";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function HeroComposition() {
  const { language } = useLang();
  const t = getStrings(language);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const active = pinned || hover;

  return (
    <figure aria-label={t.landingExampleAria}>
      <Stagger>
        <StaggerItem>
          <div className="oc-shadow-card flex gap-4 rounded-xl border border-edge bg-card p-5 text-left">
            <span aria-hidden className="font-serif text-5xl leading-none text-brand/30">
              &ldquo;
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-brand uppercase">
                {t.landingExamplePromiseLabel}
              </p>
              <p className="mt-1 text-lg leading-7 font-medium text-balance text-ink">
                {t.landingExampleClaim}
              </p>
            </div>
          </div>
        </StaggerItem>

        <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-12">
          <StaggerItem className="min-w-0 lg:col-span-7">
            <DocSheet
              selected={active}
              className="h-full transition-colors"
              eyebrow={
                <span className="inline-flex rounded-full bg-navy px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-canvas uppercase">
                  {t.landingSampleBadge}
                </span>
              }
              title={t.landingExampleDocTitle}
              meta={t.landingExampleSource}
            >
              <div className="space-y-4 text-sm leading-6">
                <div>
                  <p className="oc-tnum text-xs font-bold text-muted">&sect; 1</p>
                  <p className="mt-1">{t.landingExamplePara1}</p>
                </div>
                <div>
                  <p className="oc-tnum text-xs font-bold text-muted">
                    &sect; 2
                    <span className="ml-2 rounded border border-edge bg-canvas px-1.5 py-0.5 align-middle text-[11px] font-semibold tracking-wide text-muted uppercase">
                      {t.landingPreviewTerm}
                    </span>
                  </p>
                  <p className="mt-1">
                    <mark
                      className={`rounded px-1 py-0.5 transition-colors ${
                        active
                          ? "bg-amber-200 ring-1 ring-amber-500/60 dark:bg-amber-700/60"
                          : "bg-amber-200/60 ring-1 ring-amber-500/25 dark:bg-amber-800/40"
                      }`}
                    >
                      {t.landingExampleQuote}
                    </mark>{" "}
                    <span
                      title={t.landingPreviewAnnotation}
                      aria-hidden
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand align-middle text-[11px] font-bold text-on-action"
                    >
                      1
                    </span>
                  </p>
                </div>
                <div>
                  <p className="oc-tnum text-xs font-bold text-muted">&sect; 3</p>
                  <p className="mt-1">{t.landingExamplePara3}</p>
                </div>
              </div>
            </DocSheet>
          </StaggerItem>

          <StaggerItem className="min-w-0 lg:col-span-5">
            <div
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onFocus={() => setHover(true)}
              onBlur={() => setHover(false)}
              className="oc-shadow-card relative h-full rounded-xl border border-edge bg-card p-5"
            >
              <span
                aria-hidden
                className={`absolute -top-6 left-10 h-6 border-l-2 transition-colors lg:hidden ${
                  active ? "border-solid border-brand" : "border-dashed border-edge"
                }`}
              />
              <span
                aria-hidden
                className={`absolute top-12 -left-6 hidden w-6 border-t-2 transition-colors lg:block ${
                  active ? "border-solid border-brand" : "border-dashed border-edge"
                }`}
              />
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
              <p className="mt-3 text-[13px] leading-5 text-muted">{t.landingExampleSource}</p>
            </div>
          </StaggerItem>
        </div>
      </Stagger>
      <figcaption className="mt-4 text-center text-[13px] leading-5 text-muted">
        {t.landingExampleCaption}
      </figcaption>
    </figure>
  );
}
