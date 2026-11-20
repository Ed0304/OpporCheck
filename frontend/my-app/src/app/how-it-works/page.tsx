import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "How it works — OpporCheck",
};

const STEPS = [
  {
    title: "1. Share the opportunity",
    text: "Paste the job description or upload the offer as a PDF. OpporCheck reads the text and keeps it in your private workspace.",
  },
  {
    title: "2. Review the analysis",
    text: "You get an opportunity summary, extracted employment details, potential concerns with quoted evidence, a missing-information checklist, and a recommended next action.",
  },
  {
    title: "3. Investigate with sources",
    text: "Save the review as an investigation and compare its claims against curated official guidance, with each finding labelled as supported, conflicting, or insufficient evidence.",
  },
  {
    title: "4. Decide with evidence",
    text: "Bring the report — facts, gaps, concerns, and follow-up questions — to your decision or your adviser.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy">How it works</h1>
        <p className="mt-3 leading-7 text-muted">
          Four steps from a raw posting to an evidence-backed investigation report.
        </p>
      </div>
      <ol className="mt-6 grid gap-4 md:grid-cols-2">
        {STEPS.map((step) => (
          <li key={step.title}>
            <Card title={step.title}>
              <p className="text-sm leading-6 text-muted">{step.text}</p>
            </Card>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-white hover:bg-brand-strong"
        >
          Get started
        </Link>
        <Link
          href="/resources"
          className="inline-flex h-11 items-center rounded-md border border-edge bg-card px-6 text-base font-medium hover:bg-brand-soft"
        >
          Browse guidance
        </Link>
      </div>
    </PublicShell>
  );
}
