import type { Metadata } from "next";
import PublicResourcesContent from "@/components/PublicResourcesContent";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "Employment guidance — OpporCheck",
};

export default function ResourcesPage() {
  return (
    <PublicShell>
      <PublicResourcesContent />
    </PublicShell>
  );
}
