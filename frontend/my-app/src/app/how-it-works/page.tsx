import type { Metadata } from "next";
import HowItWorksContent from "@/components/HowItWorksContent";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "How it works — OpporCheck",
};

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <HowItWorksContent />
    </PublicShell>
  );
}
