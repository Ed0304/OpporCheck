// Shared guidance list used by public and workspace resources pages.
// External links are explicit, open in a new tab, and identify the publisher.
//
// Entry titles and summaries stay in their publisher's language (they
// describe third-party official pages); only the surrounding list chrome
// is localized. URLs, publishers, and verification status never change.

"use client";

import { motion } from "motion/react";
import { CorridorFlag } from "@/components/flags";
import { OC_DURATION, OC_EASE } from "@/components/motion";
import { resolveCorridorCode } from "@/lib/corridors";
import { SpotBook } from "@/components/spot";
import { UK_GUIDANCE, type GuidanceEntry } from "@/lib/guidance";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function EntryFlag({ country }: { country: string }) {
  const code = resolveCorridorCode(country);
  return code ? <CorridorFlag code={code} className="h-3 w-4" /> : null;
}

export default function GuidanceList({ entries }: { entries?: GuidanceEntry[] }) {
  const { language } = useLang();
  const t = getStrings(language);
  const list = entries ?? UK_GUIDANCE;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {list.map((entry, index) => (
        <motion.li
          key={entry.url}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-32px" }}
          transition={{
            duration: OC_DURATION.base,
            ease: OC_EASE,
            delay: Math.min((index % 4) * 0.05, 0.15),
          }}
          whileHover={{ y: -2 }}
          className="overflow-hidden rounded-xl border border-paper-edge bg-paper shadow-[0_2px_10px_var(--oc-paper-shadow)] transition-colors duration-150 ease-out hover:border-evidence/40"
        >
          <div aria-hidden="true" className="oc-page-edge h-1.5 w-full" />
          <div className="p-5">
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="mt-0.5 shrink-0 text-evidence">
              <SpotBook size={17} />
            </span>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-evidence underline decoration-evidence/40 underline-offset-2 transition-colors duration-150 ease-out hover:decoration-evidence"
            >
              {entry.title} <span aria-hidden>{t.commonOpenInNewTab}</span>
            </a>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">{entry.summary}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <EntryFlag country={entry.country} />
            <span>
              {t.guidancePublisher} {entry.publisher} · {t.guidanceCountry} {entry.country} ·{" "}
              {t.guidanceReviewed} {entry.reviewed}
            </span>
          </p>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}
