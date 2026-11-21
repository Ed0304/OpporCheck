// Public resources page copy. Client component so the heading follows
// the UI language preference; the server page keeps its metadata export
// and renders this.

"use client";

import CorridorResources from "@/components/CorridorResources";
import { Enter } from "@/components/motion";
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
      </Enter>
      <div className="mt-6">
        <CorridorResources />
      </div>
    </>
  );
}
