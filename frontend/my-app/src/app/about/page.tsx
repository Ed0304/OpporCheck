import type { Metadata } from "next";
import AboutContent from "@/components/AboutContent";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "About — OpporCheck",
};

export default function AboutPage() {
  return (
    <PublicShell>
      <AboutContent />
    </PublicShell>
  );
}
