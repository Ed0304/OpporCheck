// Product notices: the full canonical disclaimer plus a shared
// contextual-notice box. Wording lives in lib/disclaimer.ts; this file
// only renders it.

"use client";

import { getFullDisclaimerParagraphs } from "@/lib/disclaimer";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export function ContextualNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-brand-soft p-4 text-sm leading-6" role="note">
      {children}
    </p>
  );
}

export default function Disclaimer() {
  const { language } = useLang();
  const t = getStrings(language);
  const paragraphs = getFullDisclaimerParagraphs(language);
  return (
    <section aria-label={t.disclaimerSectionAria} className="rounded-md bg-brand-soft p-4">
      <h3 className="font-semibold">{t.disclaimerHeading}</h3>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 32)} className="mt-1 text-sm leading-6">
          {paragraph}
        </p>
      ))}
    </section>
  );
}
