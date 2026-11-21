import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { EvidenceQuote, StatusLabel } from "@/components/ui";
import { CONCISE_NOTICE } from "@/lib/disclaimer";

export const metadata: Metadata = {
  title: "OpporCheck — Understand the opportunity before you commit",
};

const WORKFLOW = [
  {
    n: "01",
    title: "Share the opportunity",
    text: "Paste the job description or upload the offer document. Your text stays in your own investigation.",
  },
  {
    n: "02",
    title: "Get a structured review",
    text: "OpporCheck extracts the role, employer, pay, country, and employment type, then flags concerns, missing details, and questions worth asking.",
  },
  {
    n: "03",
    title: "Check official guidance",
    text: "Compare claims against curated official sources and keep everything in one investigation report.",
  },
];

const CAPABILITIES = [
  {
    title: "Clear employment summaries",
    text: "Role, employer, salary, destination country, and contract type pulled into one readable overview.",
  },
  {
    title: "Concerns with evidence",
    text: "Each potential concern quotes the original wording and says how confident the finding is.",
  },
  {
    title: "Missing-information checklist",
    text: "See what the posting doesn't say — employer identity, fees, contract terms, visa details.",
  },
  {
    title: "Private by design",
    text: "Your investigations belong to your account. Analysis can run on your device when supported, with cloud fallback.",
  },
];

export default function LandingPage() {
  return (
    <PublicShell>
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy">
            Understand the opportunity before you commit.
          </h1>
          <p className="mt-3 text-lg leading-8 text-muted">
            OpporCheck helps you understand what was promised, what appears in your written
            employment agreement, what remains unclear, and what you should verify before
            signing.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action hover:bg-brand-strong"
            >
              Get started
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex h-11 items-center rounded-md border border-edge bg-card px-6 text-base font-medium hover:bg-brand-soft"
            >
              How it works
            </Link>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted" role="note">
            {CONCISE_NOTICE}
          </p>
        </div>

        <figure
          aria-label="Illustrative example of an OpporCheck finding"
          className="rounded-lg border border-edge bg-card p-5 shadow-[0_1px_2px_rgba(23,59,112,0.06)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="rounded border border-edge px-2 py-0.5 text-xs font-semibold text-evidence">
              Example finding
            </p>
            <StatusLabel tone="ok">Supported</StatusLabel>
          </div>
          <p className="mt-3 font-semibold">Overtime is paid monthly at 1.5× the hourly rate.</p>
          <EvidenceQuote>
            &ldquo;Overtime hours shall be compensated at one hundred fifty percent of the
            basic hourly wage.&rdquo;
          </EvidenceQuote>
          <p className="mt-2 text-xs text-muted">Source: Example employment terms · p. 2</p>
          <figcaption className="mt-3 border-t border-edge pt-3 text-xs text-muted">
            Illustrative example — not a real investigation.
          </figcaption>
        </figure>
      </div>

      <section aria-labelledby="what-is" className="mt-12">
        <h2 id="what-is" className="text-2xl font-semibold">
          What is OpporCheck?
        </h2>
        <p className="mt-2 max-w-3xl leading-7 text-muted">
          OpporCheck is an investigation workspace for overseas employment. Instead of reading a
          posting and guessing, you get a structured review: what the offer actually says, what
          is missing, which parts deserve a second look, and which official guidance applies.
          It helps you ask better questions — it does not verify employers or approve offers.
        </p>
      </section>

      <section aria-labelledby="workflow" className="mt-10">
        <h2 id="workflow" className="text-2xl font-semibold">
          How the investigation workflow works
        </h2>
        <ol className="mt-4 grid gap-6 md:grid-cols-3">
          {WORKFLOW.map((item) => (
            <li key={item.title} className="border-t-2 border-edge pt-4">
              <p aria-hidden="true" className="text-2xl font-bold text-brand">
                {item.n}
              </p>
              <h3 className="mt-1 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="capabilities" className="mt-10">
        <h2 id="capabilities" className="text-2xl font-semibold">
          Key capabilities
        </h2>
        <dl className="mt-4 grid gap-x-10 md:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="border-t border-edge py-4">
              <dt className="font-semibold">{item.title}</dt>
              <dd className="mt-1 text-sm leading-6 text-muted">{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="transparency" className="mt-10">
        <h2 id="transparency" className="text-2xl font-semibold">
          Transparency and limitations
        </h2>
        <div className="mt-4 max-w-3xl leading-7 text-muted">
          <p>
            OpporCheck works only from the text you provide and the official sources it links
            to. It cannot confirm that an employer is genuine, check registration numbers, or
            see information outside the posting.
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>A flagged concern is a reason to ask questions, not proof of fraud.</li>
            <li>Missing information means unverified, not false.</li>
            <li>Always confirm visa, pay, and contract details with official sources and, where needed, qualified advisers.</li>
          </ul>
        </div>
      </section>
    </PublicShell>
  );
}
