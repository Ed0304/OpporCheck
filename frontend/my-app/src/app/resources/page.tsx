import type { Metadata } from "next";
import PublicShell from "@/components/PublicShell";
import GuidanceList from "@/components/GuidanceList";

export const metadata: Metadata = {
  title: "Employment guidance — OpporCheck",
};

export default function ResourcesPage() {
  return (
    <PublicShell>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Employment guidance</h1>
        <p className="mt-3 leading-7 text-muted">
          Curated official guidance for overseas employment. Coverage currently focuses on
          seasonal agricultural work in the United Kingdom — more countries will be added only
          when their sources are verified.
        </p>
      </div>
      <div className="mt-6 max-w-3xl">
        <GuidanceList />
      </div>
    </PublicShell>
  );
}
