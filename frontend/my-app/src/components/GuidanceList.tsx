// Shared guidance list used by public and workspace resources pages.
// External links are explicit, open in a new tab, and identify the publisher.

import { UK_GUIDANCE } from "@/lib/guidance";

export default function GuidanceList() {
  return (
    <ul className="flex flex-col gap-4">
      {UK_GUIDANCE.map((entry) => (
        <li
          key={entry.url}
          className="rounded-lg border border-edge bg-card p-5 shadow-[0_1px_2px_rgba(23,59,112,0.06)]"
        >
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
          >
            {entry.title} <span aria-hidden>(opens in a new tab)</span>
          </a>
          <p className="mt-1 text-sm leading-6 text-muted">{entry.summary}</p>
          <p className="mt-2 text-xs text-muted">
            Publisher: {entry.publisher} · Country: {entry.country} · Reviewed for
            OpporCheck: {entry.reviewed}
          </p>
        </li>
      ))}
    </ul>
  );
}
