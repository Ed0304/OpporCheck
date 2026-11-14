// Redesigned analysis report (Blueprint §7). Order: opportunity summary,
// extracted details, potential concerns, missing information, recommended
// next action. Concerns pair the model's quoted evidence with short static
// guidance; confidence is shown as information, never as proof of fraud.

import type { AnalysisConcern, OpportunityReport } from "@/lib/opportunityAnalyzer";

function isSpecified(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "not specified" && normalized !== "unknown";
}

// Static plain-language guidance matched by concern keywords. This is
// general guidance text, not a finding about any specific employer.
const CONCERN_GUIDANCE: Array<{ match: RegExp; guidance: string }> = [
  {
    match: /fee|payment|pay.*upfront|deposit|transfer/i,
    guidance:
      "Legitimate UK employers and agencies do not ask workers to pay for the job itself. Any requested payment deserves written justification before you send anything.",
  },
  {
    match: /cash in hand|no payslip|without.*contract/i,
    guidance:
      "Pay without payslips or a written contract makes it hard to prove your hours, rate, or employment rights later.",
  },
  {
    match: /whatsapp|telegram|social media|personal.*(email|phone)/i,
    guidance:
      "Recruitment through personal messaging alone is common in scams. Check whether the same employer can be reached through verifiable official channels.",
  },
  {
    match: /passport|document.*(keep|hold|retain)|visa.*(keep|hold)/i,
    guidance:
      "No employer should keep your passport or identity documents. You have the right to hold your own documents at all times.",
  },
  {
    match: /urgent|immediately|act (now|fast)|limited.*(slot|place)/i,
    guidance:
      "Pressure to decide fast is a classic persuasion tactic. Genuine offers allow time to read terms and ask questions.",
  },
  {
    match: /guarantee|sure.*visa|visa.*guarantee|no.*(experience|interview)/i,
    guidance:
      "Guaranteed visas or jobs with no checks at all are unrealistic. Official routes always involve eligibility checks.",
  },
];

const GENERIC_GUIDANCE =
  "This detail is unusual enough to question. Ask for it in writing and compare the answer against official guidance.";

function guidanceFor(concern: AnalysisConcern): string {
  const haystack = `${concern.concern} ${concern.evidence}`;
  const hit = CONCERN_GUIDANCE.find((entry) => entry.match.test(haystack));
  return hit ? hit.guidance : GENERIC_GUIDANCE;
}

function buildSummary(report: OpportunityReport): string {
  const role = isSpecified(report.occupation) ? report.occupation : "An opportunity";
  const employer = isSpecified(report.employer) ? ` with ${report.employer}` : "";
  const country = isSpecified(report.destination_country)
    ? ` in ${report.destination_country}`
    : "";
  const pay = isSpecified(report.salary) ? ` Pay stated: ${report.salary}.` : " No pay stated.";
  const type = isSpecified(report.employment_type)
    ? ` Employment type: ${report.employment_type}.`
    : "";
  return `${role}${employer}${country}.${pay}${type}`;
}

function nextAction(report: OpportunityReport): string {
  const concerns = report.concerns ?? [];
  const missing = report.missing_information ?? [];
  if (concerns.length > 0) {
    return (
      "Ask the employer for written answers about each concern above — especially any " +
      "fees, documents, or pressure to decide quickly — and check the answers against " +
      "official guidance before paying anything or signing."
    );
  }
  if (missing.length > 0) {
    return (
      "Request the missing details in writing before proceeding. A genuine employer " +
      "can name itself, describe the contract, and explain any visa route clearly."
    );
  }
  return (
    "No warning signs found in the text itself. Still verify pay, hours, visa route, " +
    "and contract terms against official sources before committing."
  );
}

function ConfidenceNote({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase();
  const label =
    normalized === "high" || normalized === "medium" || normalized === "low"
      ? normalized
      : "unspecified";
  const hint =
    label === "high"
      ? " — the wording clearly shows this"
      : label === "medium"
        ? " — likely, but wording is ambiguous"
        : label === "low"
          ? " — only a weak signal, treat as a question"
          : "";
  return (
    <span className="text-sm text-muted">
      Confidence: <strong className="font-semibold text-ink">{label}</strong>
      {hint}
    </span>
  );
}

export default function AnalysisResults({ report }: { report: OpportunityReport }) {
  const missing = report.missing_information ?? [];
  const concerns = report.concerns ?? [];
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="oc-summary">
        <h3 id="oc-summary" className="font-semibold">
          Opportunity summary
        </h3>
        <p className="mt-1 leading-7">{buildSummary(report)}</p>
      </section>

      <section aria-labelledby="oc-details">
        <h3 id="oc-details" className="font-semibold">
          Employment details
        </h3>
        <dl className="mt-1 divide-y divide-edge text-sm">
          {[
            ["Occupation", report.occupation],
            ["Employer", report.employer],
            ["Salary", report.salary],
            ["Destination country", report.destination_country],
            ["Employment type", report.employment_type],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="oc-concerns">
        <h3 id="oc-concerns" className="font-semibold">
          Potential concerns
        </h3>
        {concerns.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-3">
            {concerns.map((item, index) => (
              <li
                key={`${item.concern}-${index}`}
                className="rounded-md border border-edge bg-card p-4"
              >
                <p className="font-semibold">{item.concern}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{guidanceFor(item)}</p>
                <blockquote className="mt-2 border-l-2 border-edge pl-3 text-sm italic leading-6">
                  &ldquo;{item.evidence}&rdquo;
                </blockquote>
                <p className="mt-2">
                  <ConfidenceNote value={item.confidence} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">
            No concerns flagged in this posting. That means nothing suspicious was found in
            the text — not that the offer is verified.
          </p>
        )}
      </section>

      <section aria-labelledby="oc-missing">
        <h3 id="oc-missing" className="font-semibold">
          Missing information
        </h3>
        {missing.length > 0 ? (
          <ul className="mt-1 list-disc pl-5 text-sm leading-7">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">None reported.</p>
        )}
        <p className="mt-1 text-sm text-muted">
          Missing information means unverified — not false.
        </p>
      </section>

      <section aria-labelledby="oc-next" className="rounded-md bg-brand-soft p-4">
        <h3 id="oc-next" className="font-semibold">
          Recommended next action
        </h3>
        <p className="mt-1 text-sm leading-6">{nextAction(report)}</p>
      </section>
    </div>
  );
}
