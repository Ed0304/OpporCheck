import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "@/components/PublicShell";

export const metadata: Metadata = {
  title: "How it works — OpporCheck",
};

const STEPS = [
  {
    n: "1",
    title: "Share the opportunity",
    text: "Paste the job description or upload the offer as a PDF. OpporCheck reads the text and keeps it in your private workspace.",
  },
  {
    n: "2",
    title: "Review the analysis",
    text: "You get an opportunity summary, extracted employment details, potential concerns with quoted evidence, a missing-information checklist, and a recommended next action.",
  },
  {
    n: "3",
    title: "Investigate with sources",
    text: "Save the review as an investigation and compare its claims against curated official guidance, with each finding labelled as supported, conflicting, or insufficient evidence.",
  },
  {
    n: "4",
    title: "Decide with evidence",
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
      <ol className="mt-8 flex max-w-3xl flex-col">
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-px bg-edge"
              />
            )}
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-card text-sm font-bold text-brand"
            >
              {step.n}
            </span>
            <div className="pt-1.5">
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action hover:bg-brand-strong"
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
