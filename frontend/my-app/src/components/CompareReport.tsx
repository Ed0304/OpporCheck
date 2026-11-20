// Promise-to-Paper report: executive summary, documents, grouped
// findings with evidence, questions to ask, limitations, disclaimer.
//
// Status tones deliberately avoid red: ordinary discrepancies use amber,
// informational outcomes use blue/gray. All counts are computed locally,
// never generated.

import Disclaimer, { ContextualNotice } from "@/components/Disclaimer";
import { StatusLabel } from "@/components/ui";
import { COMPARISON_CONTEXT_NOTICE } from "@/lib/disclaimer";
import type {
  ContractDocumentType,
  EmploymentClaim,
  PromiseToPaperFinding,
} from "@/lib/contractTypes";
import {
  collectQuestions,
  summarizeFindings,
  COMPARE_CATEGORY_LABELS,
  COMPARE_DOC_TYPE_LABELS,
  type CompareDocSource,
} from "@/lib/compareSession";
import {
  COMPARISON_STATUS_LABELS,
  COMPARISON_STATUS_TONES,
  UNVERIFIED_PHRASE,
} from "@/lib/reportLanguage";

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
  const ref = claim.documentReference;
  const location =
    source === "pdf" && ref.pageNumber !== undefined
      ? `p. ${ref.pageNumber}`
      : "pasted text";
  return (
    <div className="rounded-md border border-edge p-3">
      <p className="text-sm">
        <span className="font-semibold">{label}: </span>
        {claim.claim}
      </p>
      <blockquote className="mt-1 border-l-2 border-edge pl-3 text-sm italic leading-6">
        &ldquo;{claim.sourceExcerpt}&rdquo;
      </blockquote>
      <p className="mt-1 text-xs text-muted">
        {COMPARE_DOC_TYPE_LABELS[ref.documentType]} · {ref.fileName} · {location}
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
  const slots: Array<{ label: string; claim: EmploymentClaim | undefined }> = [
    { label: "Recruiter statement", claim: finding.recruiterStatement },
    { label: "Advertisement", claim: finding.advertisementClaim },
    { label: "Written clause", claim: finding.contractClause },
  ];
  return (
    <li className="rounded-md border border-edge p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{COMPARE_CATEGORY_LABELS[finding.category]}</p>
        <StatusLabel tone={toneForStatus(finding.status)}>
          {COMPARISON_STATUS_LABELS[finding.status]}
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
        <span className="font-semibold">Follow-up question: </span>
        {finding.followUpQuestion}
      </p>
    </li>
  );
}

export default function CompareReport({
  documents,
  findings,
  droppedCount,
  limitations,
}: {
  documents: ReportDocument[];
  findings: PromiseToPaperFinding[];
  droppedCount: number;
  limitations: string[];
}) {
  const summary = summarizeFindings(findings);
  const questions = collectQuestions(findings);
  const sourceById = new Map(documents.map((doc) => [doc.id, doc.source]));
  const groups = [
    { key: "consistent", title: "Consistent terms" },
    { key: "discrepancy", title: "Discrepancies" },
    { key: "not_addressed", title: "Promises not addressed" },
    { key: "needs_clarification", title: "Terms requiring clarification" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="oc-exec">
        <h3 id="oc-exec" className="font-semibold">
          Executive summary
        </h3>
        <p className="mt-1 leading-7">
          Compared {documents.length} document{documents.length === 1 ? "" : "s"}:{" "}
          {summary.consistent} consistent term{summary.consistent === 1 ? "" : "s"},{" "}
          {summary.discrepancy} {summary.discrepancy === 1 ? "discrepancy" : "discrepancies"},{" "}
          {summary.not_addressed} {summary.not_addressed === 1 ? "promise" : "promises"} not
          addressed, {summary.needs_clarification} needing clarification.
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Quotes are copied from your documents; each status is an AI-generated
          interpretation of those quotes, not a verdict on any employer or offer.
        </p>
      </section>

      <section aria-labelledby="oc-docs">
        <h3 id="oc-docs" className="font-semibold">
          Documents included
        </h3>
        <ul className="mt-1 list-disc pl-5 text-sm leading-7">
          {documents.map((doc) => (
            <li key={doc.id}>
              {COMPARE_DOC_TYPE_LABELS[doc.documentType]} — {doc.fileName} (
              {doc.source === "pdf" ? `${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}` : "pasted text"}
              {doc.wasTrimmed ? ", trimmed to fit" : ""} · {doc.termCount} term
              {doc.termCount === 1 ? "" : "s"} extracted)
            </li>
          ))}
        </ul>
      </section>

      <ContextualNotice>{COMPARISON_CONTEXT_NOTICE}</ContextualNotice>

      {findings.length === 0 ? (
        <p className="text-sm leading-6">
          No terms could be compared across these documents — the extracted terms did not
          overlap, or every comparison result failed validation and was dropped.{" "}
          {UNVERIFIED_PHRASE}
        </p>
      ) : (
        groups.map(
          (group) =>
            summary[group.key] > 0 && (
              <section key={group.key} aria-labelledby={`oc-${group.key}`}>
                <h3 id={`oc-${group.key}`} className="font-semibold">
                  {group.title} ({summary[group.key]})
                </h3>
                <ul className="mt-2 flex flex-col gap-3">
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
            ),
        )
      )}

      {questions.length > 0 && (
        <section aria-labelledby="oc-questions">
          <h3 id="oc-questions" className="font-semibold">
            Questions to ask before signing
          </h3>
          <ul className="mt-1 list-disc pl-5 text-sm leading-7">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="oc-limits">
        <h3 id="oc-limits" className="font-semibold">
          Limitations
        </h3>
        <ul className="mt-1 list-disc pl-5 text-sm leading-7">
          {limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {droppedCount > 0 && (
            <li>
              {droppedCount} comparison result{droppedCount === 1 ? " was" : "s were"}{" "}
              dropped because {droppedCount === 1 ? "it" : "they"} failed validation
              (unverifiable quote or document) and {droppedCount === 1 ? "is" : "are"} not
              shown.
            </li>
          )}
          <li>Only the analyzed excerpts were compared, not entire documents.</li>
          <li>
            Ambiguous wording needs a human reviewer — statuses reflect the model&apos;s
            reading of short quotes, not legal analysis.
          </li>
          <li>Missing information means unverified — not false, and not proof of fraud.</li>
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
