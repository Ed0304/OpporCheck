// About page copy. Client component so it can follow the UI language
// preference; the server page keeps its metadata export and renders this.

"use client";

import Disclaimer from "@/components/Disclaimer";
import { Enter } from "@/components/motion";
import { DocSheet } from "@/components/atelier";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function AboutContent() {
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <Enter className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-navy">{t.aboutTitle}</h1>
      <div className="mt-4 flex flex-col gap-4 leading-7 text-muted">
        <p>{t.aboutP1}</p>
        <p>{t.aboutP2}</p>
        <h2 className="text-xl font-semibold text-ink">{t.aboutNotTitle}</h2>
        <ul className="list-disc pl-5">
          <li>{t.aboutNot1}</li>
          <li>{t.aboutNot2}</li>
          <li>{t.aboutNot3}</li>
        </ul>
        <h2 className="text-xl font-semibold text-ink">{t.aboutHowTitle}</h2>
        <p>{t.aboutHowText}</p>
        <h2 className="text-xl font-semibold text-ink">{t.footerNoticeHeading}</h2>
        <DocSheet>
          <Disclaimer />
        </DocSheet>
      </div>
    </Enter>
  );
}
