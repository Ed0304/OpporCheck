// Promise-to-Paper report: executive summary, documents, grouped
// findings with evidence, questions to ask, limitations, disclaimer.
//
// Status tones deliberately avoid red: ordinary discrepancies use amber,
// informational outcomes use blue/gray. All counts are computed locally,
// never generated. Report chrome follows the global website language
// preference; extracted claims and excerpts are the user's own documents
// and stay as written.

"use client";

import Disclaimer, { ContextualNotice } from "@/components/Disclaimer";
import { Reveal } from "@/components/motion";
import { EvidenceQuote, StatusLabel } from "@/components/ui";
import { getComparisonContextNotice } from "@/lib/disclaimer";
import { useLang } from "@/lib/lang";
import type {
  ContractDocumentType,
  EmploymentClaim,
  PromiseToPaperFinding,
} from "@/lib/contractTypes";
import {
  collectQuestions,
  countCitedExcerpts,
  summarizeFindings,
  getCompareCategoryLabels,
  getCompareDocTypeLabels,
  type CompareDocSource,
} from "@/lib/compareSession";
import {
  COMPARISON_STATUS_TONES,
  getComparisonStatusLabels,
  getUnverifiedPhrase,
} from "@/lib/reportLanguage";
import { format, getStrings } from "@/lib/strings";

export interface ReportDocument {
  id: string;
  fileName: string;
  documentType: ContractDocumentType;
  source: CompareDocSource;
  pageCount: number;
  wasTrimmed: boolean;
  termCount: number;
}

function toneForStatus(status: PromiseToPaperFinding["status"]) {
  return COMPARISON_STATUS_TONES[status];
}

function ClaimBlock({
  label,
  claim,
  source,
}: {
  label: string;
  claim: EmploymentClaim;
  source: CompareDocSource;
}) {
  const { language } = useLang();
  const t = getStrings(language);
  const docTypeLabels = getCompareDocTypeLabels(language);
  const ref = claim.documentReference;
  const location =
    source === "pdf" && ref.pageNumber !== undefined
      ? format(t.cmpPageRef, { n: String(ref.pageNumber) })
      : t.cmpPastedText;
  // Written employment terms read as document excerpts; spoken or
  // advertised promises stay neutral so the two are easy to tell apart.
  // Supporting documents (invoices, receipts) are written evidence too.
  const isWrittenTerms =
    ref.documentType === "employment_contract" ||
    ref.documentType === "offer_letter" ||
    ref.documentType === "other";
  return (
    <div
      className={`rounded-md border border-edge p-3 ${isWrittenTerms ? "bg-evidence-soft/40" : ""}`}
    >
      <p className="text-sm">
        <span className="font-semibold">{label}: </span>
        {claim.claim}
      </p>
      <EvidenceQuote>&ldquo;{claim.sourceExcerpt}&rdquo;</EvidenceQuote>
      <p className="mt-1 text-xs text-muted">
        {docTypeLabels[ref.documentType]} · {ref.fileName} · {location}
      </p>
    </div>
  );
}

function FindingCard({
  finding,
  sourceById,
}: {
  finding: PromiseToPaperFinding;
  sourceById: Map<string, CompareDocSource>;
}) {
  const { language } = useLang();
  const t = getStrings(language);
  const statusLabels = getComparisonStatusLabels(language);
  const categoryLabels = getCompareCategoryLabels(language);
  const slots: Array<{ label: string; claim: EmploymentClaim | undefined }> = [
    { label: t.crSlotRecruiter, claim: finding.recruiterStatement },
    { label: t.crSlotAdvertisement, claim: finding.advertisementClaim },
    { label: t.crSlotContract, claim: finding.contractClause },
    { label: t.crSlotSupporting, claim: finding.supportingEvidence },
  ];
  return (
    <li className="border-t border-edge pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{categoryLabels[finding.category]}</p>
        <StatusLabel tone={toneForStatus(finding.status)}>
          {statusLabels[finding.status]}
        </StatusLabel>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {slots.map(
          ({ label, claim }) =>
            claim && (
              <ClaimBlock
                key={label}
                label={label}
                claim={claim}
                source={sourceById.get(claim.documentReference.documentId) ?? "pasted"}
              />
            ),
        )}
      </div>
      <p className="mt-2 text-sm leading-6">{finding.explanation}</p>
      <p className="mt-2 text-sm leading-6">
        <span className="font-semibold">{t.commonFollowUpLabel} </span>
        {finding.followUpQuestion}
      </p>
    </li>
  );
}

export default function CompareReport({
  documents,
  findings,
  droppedCount,
  droppedIssues,
  limitations,
}: {
  documents: ReportDocument[];
  findings: PromiseToPaperFinding[];
  droppedCount: number;
  droppedIssues: string[];
  limitations: string[];
}) {
  const { language } = useLang();
  const t = getStrings(language);
  const docTypeLabels = getCompareDocTypeLabels(language);
  const summary = summarizeFindings(findings);
  const questions = collectQuestions(findings);
  const sourceById = new Map(documents.map((doc) => [doc.id, doc.source]));
  const groups = [
    { key: "consistent", title: t.crGroupConsistent },
    { key: "discrepancy", title: t.crGroupDiscrepancy },
    { key: "not_addressed", title: t.crGroupNotAddressed },
    { key: "needs_clarification", title: t.crGroupClarification },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
      <section aria-labelledby="oc-exec">
        <h3 id="oc-exec" className="font-semibold">
          {t.crExecSummary}
        </h3>
        <p className="mt-1 leading-7">
          {t.crComparedBefore} {documents.length}{" "}
          {documents.length === 1 ? t.crDocumentOne : t.crDocumentMany}: {summary.consistent}{" "}
          {summary.consistent === 1 ? t.crConsistentOne : t.crConsistentMany},{" "}
          {summary.discrepancy}{" "}
          {summary.discrepancy === 1 ? t.crDiscrepancyOne : t.crDiscrepancyMany},{" "}
          {summary.not_addressed}{" "}
          {summary.not_addressed === 1 ? t.crPromiseOne : t.crPromiseMany}{" "}
          {t.crNotAddressedTail} {summary.needs_clarification} {t.crNeedingTail}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">{t.crQuotesNote}</p>
      </section>
      </Reveal>

      <Reveal delay={0.05}>
      <section aria-labelledby="oc-docs">
        <h3 id="oc-docs" className="font-semibold">
          {t.crDocsIncluded}
        </h3>
        <ul className="mt-1 list-disc pl-5 text-sm leading-7">
          {documents.map((doc) => (
            <li key={doc.id}>
              {docTypeLabels[doc.documentType]} — {doc.fileName} (
              {doc.source === "pdf"
                ? `${doc.pageCount} ${doc.pageCount === 1 ? t.revOcrPageOne : t.revOcrPageMany}`
                : t.cmpPastedText}
              {doc.wasTrimmed ? t.crTrimmedSuffix : ""} · {doc.termCount}{" "}
              {doc.termCount === 1 ? t.cmpTermOne : t.cmpTermMany} {t.crExtractedTail}
              {" · "}
              {format(t.crCitedInFindings, {
                cited: String(countCitedExcerpts(findings, doc.id)),
                total: String(doc.termCount),
              })}
            </li>
          ))}
        </ul>
      </section>
      </Reveal>

      <Reveal delay={0.1}>
        <ContextualNotice>{getComparisonContextNotice(language)}</ContextualNotice>
      </Reveal>

      {findings.length === 0 ? (
        <Reveal delay={0.1}>
          <p className="text-sm leading-6">
            {t.crNoTerms} {getUnverifiedPhrase(language)}
          </p>
        </Reveal>
      ) : (
        groups.map(
          (group, groupIndex) =>
            summary[group.key] > 0 && (
              <Reveal key={group.key} delay={Math.min(groupIndex * 0.05, 0.15)}>
                <section aria-labelledby={`oc-${group.key}`}>
                  <h3 id={`oc-${group.key}`} className="font-semibold">
                    {group.title} ({summary[group.key]})
                  </h3>
                  <ul className="mt-2 flex flex-col gap-6">
                    {findings
                      .filter((finding) => finding.status === group.key)
                      .map((finding, index) => (
                        <FindingCard
                          key={`${finding.category}-${index}`}
                          finding={finding}
                          sourceById={sourceById}
                        />
                      ))}
                  </ul>
                </section>
              </Reveal>
            ),
        )
      )}

      {questions.length > 0 && (
        <Reveal delay={0.05}>
        <section aria-labelledby="oc-questions">
          <h3 id="oc-questions" className="font-semibold">
            {t.crQuestions}
          </h3>
          <ul className="mt-1 list-disc pl-5 text-sm leading-7">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
        </Reveal>
      )}

      <Reveal delay={0.05}>
      <section aria-labelledby="oc-limits">
        <h3 id="oc-limits" className="font-semibold">
          {t.crLimits}
        </h3>
        <ul className="mt-1 list-disc pl-5 text-sm leading-7">
          {limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {droppedCount > 0 && (
            <li>
              {format(t.crDropped, {
                count: String(droppedCount),
                resultWord: droppedCount === 1 ? t.evDroppedResultOne : t.evDroppedResultMany,
                verb: droppedCount === 1 ? t.evDroppedVerbOne : t.evDroppedVerbMany,
                pronoun: droppedCount === 1 ? t.evDroppedPronounOne : t.evDroppedPronounMany,
                verb2: droppedCount === 1 ? t.crIs : t.crAre,
              })}
              <details className="mt-1">
                <summary className="cursor-pointer text-[13px] font-medium text-brand">
                  {t.cmpDroppedDetails}
                </summary>
                <ul className="mt-1 list-disc pl-5 text-[13px] leading-6 text-muted">
                  {droppedIssues.map((issue, index) => (
                    <li key={`${index}-${issue.slice(0, 24)}`}>{issue}</li>
                  ))}
                </ul>
              </details>
            </li>
          )}
          <li>{t.crOnlyExcerpts}</li>
          <li>{t.crAmbiguous}</li>
          <li>{t.crMissingMeans}</li>
        </ul>
      </section>
      </Reveal>

      <Disclaimer />
    </div>
  );
}
