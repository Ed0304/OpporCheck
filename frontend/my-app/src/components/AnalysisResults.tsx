// Redesigned analysis report (Blueprint §7). Order: opportunity summary,
// extracted details, potential concerns, missing information, recommended
// next action. Concerns pair the model's quoted evidence with short static
// guidance; confidence is shown as information, never as proof of fraud.
//
// Report chrome follows the global website language preference. Model
// output data (occupation, concerns, evidence quotes) is the user's own
// data and stays as returned; only the surrounding glue is localized.

"use client";

import { ContextualNotice } from "@/components/Disclaimer";
import { Reveal } from "@/components/motion";
import { EvidenceQuote } from "@/components/ui";
import {
  DEFAULT_CORRIDOR_CODE,
  resolveCorridorCode,
  type CorridorCode,
} from "@/lib/corridors";
import { getAnalysisContextNotice } from "@/lib/disclaimer";
import { useLang } from "@/lib/lang";
import type { AnalysisConcern, OpportunityReport } from "@/lib/opportunityAnalyzer";
import { getMissingInfoLabel } from "@/lib/reportLanguage";
import { getStrings, type UiStrings } from "@/lib/strings";

function isSpecified(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "not specified" && normalized !== "unknown";
}

// Static plain-language guidance matched by concern keywords. This is
// general guidance text, not a finding about any specific employer. The
// regexes stay English (they match model output); the guidance strings
// come from the dictionary in the UI language.
const CONCERN_GUIDANCE: Array<{ match: RegExp; key: keyof UiStrings }> = [
  { match: /fee|payment|pay.*upfront|deposit|transfer/i, key: "anGuideFee" },
  { match: /cash in hand|no payslip|without.*contract/i, key: "anGuideCash" },
  { match: /whatsapp|telegram|social media|personal.*(email|phone)/i, key: "anGuideMessaging" },
  { match: /passport|document.*(keep|hold|retain)|visa.*(keep|hold)/i, key: "anGuidePassport" },
  { match: /urgent|immediately|act (now|fast)|limited.*(slot|place)/i, key: "anGuideUrgency" },
  {
    match: /guarantee|sure.*visa|visa.*guarantee|no.*(experience|interview)/i,
    key: "anGuideGuarantee",
  },
];

function guidanceFor(
  t: UiStrings,
  concern: AnalysisConcern,
  corridorCode: CorridorCode,
): string {
  const haystack = `${concern.concern} ${concern.evidence}`;
  const hit = CONCERN_GUIDANCE.find((entry) => entry.match.test(haystack));
  if (!hit) {
    return t.anGuideGeneric;
  }
  // The fee-ban sentence states United Kingdom rules; other destinations
  // get the generic wording so no country's rules are misattributed.
  if (hit.key === "anGuideFee" && corridorCode !== "GB") {
    return t.anGuideFeeGeneric;
  }
  return t[hit.key];
}

function buildSummary(t: UiStrings, report: OpportunityReport): string {
  const role = isSpecified(report.occupation) ? report.occupation : t.anSumFallbackRole;
  const employer = isSpecified(report.employer) ? ` ${t.anSumWith} ${report.employer}` : "";
  const country = isSpecified(report.destination_country)
    ? ` ${t.anSumIn} ${report.destination_country}`
    : "";
  const pay = isSpecified(report.salary) ? ` ${t.anSumPayStated} ${report.salary}.` : ` ${t.anSumNoPay}`;
  const type = isSpecified(report.employment_type)
    ? ` ${t.anSumEmpType} ${report.employment_type}.`
    : "";
  return `${role}${employer}${country}.${pay}${type}`;
}

function nextAction(t: UiStrings, report: OpportunityReport): string {
  const concerns = report.concerns ?? [];
  const missing = report.missing_information ?? [];
  if (concerns.length > 0) {
    return t.anNextConcerns;
  }
  if (missing.length > 0) {
    return t.anNextMissing;
  }
  return t.anNextClear;
}

function ConfidenceNote({ value }: { value: string }) {
  const { language } = useLang();
  const t = getStrings(language);
  const normalized = value.trim().toLowerCase();
  const label =
    normalized === "high" || normalized === "medium" || normalized === "low"
      ? normalized
      : "unspecified";
  const hint =
    label === "high"
      ? t.anConfHighHint
      : label === "medium"
        ? t.anConfMediumHint
        : label === "low"
          ? t.anConfLowHint
          : "";
  const labelText =
    label === "high"
      ? t.anConfHigh
      : label === "medium"
        ? t.anConfMedium
        : label === "low"
          ? t.anConfLow
          : t.anConfUnspecified;
  return (
    <span className="text-sm text-muted">
      {t.anConfidence} <strong className="font-semibold text-ink">{labelText}</strong>
      {hint}
    </span>
  );
}

export default function AnalysisResults({
  report,
  destinationCode,
}: {
  report: OpportunityReport;
  destinationCode?: string | null;
}) {
  const { language } = useLang();
  const t = getStrings(language);
  const missing = report.missing_information ?? [];
  const concerns = report.concerns ?? [];
  const corridorCode =
    (destinationCode != null
      ? resolveCorridorCode(destinationCode)
      : resolveCorridorCode(report.destination_country)) ?? DEFAULT_CORRIDOR_CODE;
  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section aria-labelledby="oc-summary">
          <h3 id="oc-summary" className="font-semibold">
            {t.anSummary}
          </h3>
          <p className="mt-1 leading-7">{buildSummary(t, report)}</p>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
      <section aria-labelledby="oc-details">
        <h3 id="oc-details" className="font-semibold">
          {t.anDetails}
        </h3>
        <dl className="mt-1 divide-y divide-edge text-sm">
          {[
            [t.anOccupation, report.occupation],
            [t.anEmployer, report.employer],
            [t.anSalary, report.salary],
            [t.anCountry, report.destination_country],
            [t.anEmpType, report.employment_type],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      </Reveal>

      <Reveal delay={0.1}>
      <section aria-labelledby="oc-concerns">
        <h3 id="oc-concerns" className="font-semibold">
          {t.anConcerns}
        </h3>
        {concerns.length > 0 ? (
          <ul className="mt-2 divide-y divide-edge">
            {concerns.map((item, index) => (
              <li key={`${item.concern}-${index}`} className="py-4">
                <p className="font-semibold">{item.concern}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {guidanceFor(t, item, corridorCode)}
                </p>
                <EvidenceQuote>&ldquo;{item.evidence}&rdquo;</EvidenceQuote>
                <p className="mt-2">
                  <ConfidenceNote value={item.confidence} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">{t.anNoConcerns}</p>
        )}
      </section>
      </Reveal>

      <Reveal delay={0.15}>
      <section aria-labelledby="oc-missing">
        <h3 id="oc-missing" className="font-semibold">
          {getMissingInfoLabel(language)}
        </h3>
        {missing.length > 0 ? (
          <ul className="mt-1 list-disc pl-5 text-sm leading-7">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">{t.anNoneReported}</p>
        )}
        <p className="mt-1 text-sm text-muted">{t.commonMissingMeansUnverified}</p>
      </section>
      </Reveal>

      <Reveal delay={0.2}>
        <section aria-labelledby="oc-next" className="rounded-md bg-brand-soft p-4">
          <h3 id="oc-next" className="font-semibold">
            {t.anNext}
          </h3>
          <p className="mt-1 text-sm leading-6">{nextAction(t, report)}</p>
        </section>
      </Reveal>

      <Reveal delay={0.25}>
        <ContextualNotice>{getAnalysisContextNotice(language)}</ContextualNotice>
      </Reveal>
    </div>
  );
}
