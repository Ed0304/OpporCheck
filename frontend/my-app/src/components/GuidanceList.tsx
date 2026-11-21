// Shared guidance list used by public and workspace resources pages.
// External links are explicit, open in a new tab, and identify the publisher.
//
// Entry titles and summaries stay in their publisher's language (they
// describe third-party official pages); only the surrounding list chrome
// is localized. URLs, publishers, and verification status never change.

"use client";

import { UK_GUIDANCE, type GuidanceEntry } from "@/lib/guidance";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function GuidanceList({ entries }: { entries?: GuidanceEntry[] }) {
  const { language } = useLang();
  const t = getStrings(language);
  const list = entries ?? UK_GUIDANCE;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {list.map((entry) => (
        <li
          key={entry.url}
          className="rounded-lg border border-edge bg-card p-5 shadow-[0_1px_2px_rgba(23,59,112,0.06)]"
        >
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-evidence underline decoration-evidence/40 underline-offset-2 hover:decoration-evidence"
          >
            {entry.title} <span aria-hidden>{t.commonOpenInNewTab}</span>
          </a>
          <p className="mt-1 text-sm leading-6 text-muted">{entry.summary}</p>
          <p className="mt-2 text-xs text-muted">
            {t.guidancePublisher} {entry.publisher} · {t.guidanceCountry} {entry.country} ·{" "}
            {t.guidanceReviewed} {entry.reviewed}
          </p>
        </li>
      ))}
    </ul>
  );
}
