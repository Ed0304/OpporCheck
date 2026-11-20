// Workspace resources: curated guidance per destination, inside the workspace.

import CorridorResources from "@/components/CorridorResources";

export default function WorkspaceResourcesPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
        <p className="mt-1 leading-6 text-muted">
          Official guidance worth checking against any opportunity. Choose a
          destination to see its verified links.
        </p>
      </div>
      <CorridorResources />
    </div>
  );
}
