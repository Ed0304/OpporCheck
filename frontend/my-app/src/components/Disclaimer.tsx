// Product notices: the full canonical disclaimer plus a shared
// contextual-notice box. Wording lives in lib/disclaimer.ts; this file
// only renders it.

import { FULL_DISCLAIMER_PARAGRAPHS } from "@/lib/disclaimer";

export function ContextualNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-brand-soft p-4 text-sm leading-6" role="note">
      {children}
    </p>
  );
}

export default function Disclaimer() {
  return (
    <section aria-label="About OpporCheck findings" className="rounded-md bg-brand-soft p-4">
      <h3 className="font-semibold">What OpporCheck is — and isn&apos;t</h3>
      {FULL_DISCLAIMER_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph.slice(0, 32)} className="mt-1 text-sm leading-6">
          {paragraph}
        </p>
      ))}
    </section>
  );
}
