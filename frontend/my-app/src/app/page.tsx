import type { Metadata } from "next";
import LandingContent from "@/components/LandingContent";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "OpporCheck — Understand the opportunity before you commit",
};

export default function LandingPage() {
  return (
    <PublicShell>
      <LandingContent />
    </PublicShell>
  );
}
