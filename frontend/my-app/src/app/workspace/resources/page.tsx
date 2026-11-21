// Workspace resources: curated guidance per destination, inside the workspace.

"use client";

import CorridorResources from "@/components/CorridorResources";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function WorkspaceResourcesPage() {
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.wsResourcesTitle}</h1>
        <p className="mt-1 leading-6 text-muted">{t.wsResourcesSubtitle}</p>
      </div>
      <CorridorResources />
    </div>
  );
}
