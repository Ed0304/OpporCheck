// Workspace resources: the same curated guidance, inside the workspace.

import GuidanceList from "@/components/GuidanceList";

export default function WorkspaceResourcesPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
        <p className="mt-1 leading-6 text-muted">
          Official guidance worth checking against any opportunity. Coverage currently
          focuses on seasonal agricultural work in the United Kingdom.
        </p>
      </div>
      <GuidanceList />
    </div>
  );
}
