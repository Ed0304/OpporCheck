import type { Metadata } from "next";
import CorridorResources from "@/components/CorridorResources";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "Employment guidance — OpporCheck",
};

export default function ResourcesPage() {
  return (
    <PublicShell>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Employment guidance</h1>
        <p className="mt-3 leading-7 text-muted">
          Curated official guidance for overseas employment. Destinations appear
          with verified links only — more are added as their sources are verified.
        </p>
      </div>
      <div className="mt-6">
        <CorridorResources />
      </div>
    </PublicShell>
  );
}
