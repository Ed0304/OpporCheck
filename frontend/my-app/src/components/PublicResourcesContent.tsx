// Public resources page copy. Client component so the heading follows
// the UI language preference; the server page keeps its metadata export
// and renders this.

"use client";

import Link from "next/link";
import CorridorResources from "@/components/CorridorResources";
import { ContextualNotice } from "@/components/Disclaimer";
import { Enter, Reveal } from "@/components/motion";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function PublicResourcesContent() {
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <>
      <Enter className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t.resourcesTitle}</h1>
        <p className="mt-3 leading-7 text-muted">{t.resourcesSubtitle}</p>
        <div className="mt-4">
          <ContextualNotice>{t.resourcesCoverageDisclaimer}</ContextualNotice>
        </div>
      </Enter>
      <div className="mt-6">
        <CorridorResources showCoverageStrip />
      </div>
      <Reveal className="mt-10 max-w-3xl">
        <p className="leading-7">
          {t.resourcesClosing}{" "}
          <Link
            href="/register"
            className="font-medium text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:decoration-brand"
          >
            {t.landingGetStarted}
          </Link>
        </p>
      </Reveal>
    </>
  );
}
