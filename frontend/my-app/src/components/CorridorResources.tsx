// Destination-aware resources section: corridor selector plus the curated
// guidance list for the chosen destination. Profiles without link-outs yet
// say so instead of showing another country's links. The resource-language
// filter is local section state: it never changes navigation, page titles,
// or any other surface.

"use client";

import { useState } from "react";
import GuidanceList from "@/components/GuidanceList";
import ResourceLanguageFilter from "@/components/ResourceLanguageFilter";
import { EmptyState } from "@/components/ui";
import {
  CORRIDORS,
  DEFAULT_CORRIDOR_CODE,
  GUIDANCE_BY_PROFILE,
  type CorridorCode,
} from "@/lib/corridors";
import { format, getStrings, type UiLanguage } from "@/lib/strings";

export default function CorridorResources() {
  const [code, setCode] = useState<CorridorCode>(DEFAULT_CORRIDOR_CODE);
  const [language, setLanguage] = useState<UiLanguage>("en");
  const t = getStrings(language);
  const profile = CORRIDORS[code];
  const entries = GUIDANCE_BY_PROFILE[code];
  return (
    <div className="flex flex-col gap-4">
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
        <ResourceLanguageFilter value={language} onChange={setLanguage} />
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
