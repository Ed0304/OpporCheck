// Workspace resources: curated guidance per destination, inside the workspace.

"use client";

import CorridorResources from "@/components/CorridorResources";
import { PageHeader } from "@/components/ui";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function WorkspaceResourcesPage() {
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.wsSidebarAria}
        title={t.wsResourcesTitle}
        description={t.wsResourcesSubtitle}
      />
      <CorridorResources />
    </div>
  );
}
