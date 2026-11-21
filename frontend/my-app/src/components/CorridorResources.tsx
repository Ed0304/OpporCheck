// Destination-aware resources section: corridor selector plus the curated
// guidance list for the chosen destination. Profiles without link-outs yet
// say so instead of showing another country's links. Section text follows
// the global website language preference (see the header selector).
//
// The optional coverage strip (public page only) summarizes destination
// coverage from the same corridor data before visitors browse links;
// its chips select the same destination state as the dropdown.

"use client";

import { useState } from "react";
import GuidanceList from "@/components/GuidanceList";
import { EmptyState } from "@/components/ui";
import {
  CORRIDORS,
  DEFAULT_CORRIDOR_CODE,
  GUIDANCE_BY_PROFILE,
  type CorridorCode,
} from "@/lib/corridors";
import { useLang } from "@/lib/lang";
import { format, getStrings } from "@/lib/strings";

export default function CorridorResources({
  showCoverageStrip = false,
}: {
  showCoverageStrip?: boolean;
}) {
  const [code, setCode] = useState<CorridorCode>(DEFAULT_CORRIDOR_CODE);
  const { language } = useLang();
  const t = getStrings(language);
  const profile = CORRIDORS[code];
  const entries = GUIDANCE_BY_PROFILE[code];
  const profiles = Object.values(CORRIDORS);
  const verifiedCount = profiles.filter((entry) => entry.status === "sources_verified").length;
  return (
    <div className="flex flex-col gap-4">
      {showCoverageStrip && (
        <section
          aria-label={t.resourcesCoverageTitle}
          className="oc-shadow-card rounded-xl border border-edge bg-card p-5"
        >
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-evidence"
            >
              <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {t.resourcesCoverageTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {format(t.resourcesCoverageSummary, {
              verified: String(verifiedCount),
              partial: String(profiles.length - verifiedCount),
              total: String(profiles.length),
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profiles.map((entry) => {
              const selected = entry.code === code;
              const verified = entry.status === "sources_verified";
              return (
                <button
                  key={entry.code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCode(entry.code)}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                    selected
                      ? "border-brand bg-brand-soft font-semibold"
                      : "border-edge bg-card hover:bg-brand-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      verified ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
                    }`}
                  />
                  {entry.displayName}
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5 text-muted">
            <span>{t.resourcesCoverageHint}</span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              {t.statusSourcesVerified}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
              {t.statusPartial}
            </span>
          </p>
        </section>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t.destinationLabel}</span>
          <select
            value={code}
            onChange={(event) => setCode(event.target.value as CorridorCode)}
            className="h-10 rounded-md border border-edge bg-card px-3 text-sm"
          >
            {Object.values(CORRIDORS).map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-sm text-muted" role="status">
          {profile.status === "sources_verified"
            ? t.statusSourcesVerified
            : t.statusPartial}
          {profile.lastReviewed ? ` · ${t.sourcesVerifiedOn} ${profile.lastReviewed}` : ""}
        </p>
      </div>
      {entries.length > 0 ? (
        <GuidanceList entries={entries} />
      ) : (
        <EmptyState
          title={format(t.noLinksTitle, { name: profile.displayName })}
          description={format(t.noLinksDescription, { name: profile.displayName })}
        />
      )}
    </div>
  );
}
