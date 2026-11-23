// Promise-to-Paper prompt builders: pure string assembly for extraction
// and comparison prompts. Dependency-free (type-only imports) so the
// exact model input stays unit-testable without Firebase AI Logic.
//
// Extraction input embeds [Page N] markers so the model can cite pages;
// every citation is still verified by search before display. Long inputs
// are truncated with an explicit marker, and the UI discloses the limit.
//
// Prompts stay English; an optional UI language adds one rule asking for
// free-text fields (claim, explanation, followUpQuestion) in that language.
// Schemas, category/status enums, and verbatim excerpts never change, so
// attribution validation is unaffected by the output language.

import type {
  ContractCategory,
  ContractDocumentText,
  ContractDocumentType,
  EmploymentClaim,
} from "./contractTypes";
import type { UiLanguage } from "./strings";

/** Max document characters sent for extraction (UI discloses trimming). */
export const EXTRACTION_MAX_CHARS = 12000;

/** Max terms included in one comparison prompt. */
export const COMPARISON_MAX_TERMS = 40;

/** Max excerpt characters included per term in a comparison prompt. */
export const COMPARISON_EXCERPT_CHARS = 800;

export const DOCUMENT_TYPE_LABELS: Record<ContractDocumentType, string> = {
  job_advertisement: "Job advertisement",
  recruiter_communication: "Recruiter communication",
  offer_letter: "Offer letter",
  employment_contract: "Employment contract",
  other: "Other document",
};

export const CATEGORY_GUIDE: Record<ContractCategory, string> = {
  compensation:
    "compensation: base salary, currency, payment frequency, overtime compensation, bonuses, allowances.",
  deductions:
    "deductions: accommodation costs, utilities, transportation, insurance, recruitment-related charges, other stated deductions.",
  working_conditions:
    "working_conditions: daily and weekly hours, overtime arrangements, rest days, shift arrangements.",
  employment_period:
    "employment_period: start date, contract duration, renewal conditions, probation.",
  benefits: "benefits: accommodation, transportation, leave, insurance, other benefits.",
  termination:
    "termination: notice periods, early termination conditions, penalties or compensation clauses.",
  immigration:
    "immigration: visa or permit references, sponsorship claims, work authorization conditions.",
  responsibilities:
    "responsibilities: job title, duties, workplace location, reporting arrangements.",
  other:
    "other: miscellaneous related terms that fit none of the above (invoice totals, payment references, receipt details, dates).",
};

const CATEGORY_NAMES = Object.keys(CATEGORY_GUIDE) as ContractCategory[];

function truncateWithMarker(text: string, limit: number): { text: string; trimmed: boolean } {
  if (text.length <= limit) {
    return { text, trimmed: false };
  }
  return { text: `${text.slice(0, limit).trimEnd()}\n[trimmed: remaining text not analyzed]`, trimmed: true };
}

export function formatDocumentPages(doc: ContractDocumentText): string {
  return doc.pages
    .map((page, index) => `[Page ${index + 1}]\n${page.trim()}`)
    .join("\n\n");
}

/** Output-language rule for extraction, or "" when English (byte-identical prompt). */
function extractionLanguageRule(language: UiLanguage): string {
  if (language !== "id") {
    return "";
  }
  return (
    "- Write the claim of every term in Bahasa Indonesia. " +
    "Copy every sourceExcerpt VERBATIM from the document text below; never translate quotations.\n"
  );
}

/** Output-language rule for comparison, or "" when English (byte-identical prompt). */
function comparisonLanguageRule(language: UiLanguage): string {
  if (language !== "id") {
    return "";
  }
  return (
    "- Write every claim, explanation, and followUpQuestion in Bahasa Indonesia. " +
    "Copy every sourceExcerpt VERBATIM from the excerpts below; never translate quotations. " +
    "Keep category and status values exactly as specified.\n"
  );
}

export function buildExtractionPrompt(
  doc: ContractDocumentText,
  language: UiLanguage = "en",
): string {
  const { text, trimmed } = truncateWithMarker(formatDocumentPages(doc), EXTRACTION_MAX_CHARS);
  const categories = CATEGORY_NAMES.map((name) => `- ${CATEGORY_GUIDE[name]}`).join("\n");
  // Miscellaneous uploads (invoices, receipts) extract leniently: forcing
  // their terse lines into employment categories backfires into false
  // terms, so anything without a clear match files under "other".
  const otherDocRule =
    doc.documentType === "other"
      ? "- This is a miscellaneous supporting document (invoice, receipt, or similar): extract related terms leniently, " +
        'file anything that fits none of the employment categories under "other", ' +
        "and never force a term into an employment category it does not clearly match.\n"
      : "";
  return (
    `You extract structured employment terms from the ${DOCUMENT_TYPE_LABELS[doc.documentType].toLowerCase()} below. ` +
    "Output JSON only.\n" +
    "Rules:\n" +
    extractionLanguageRule(language) +
    "- For each employment term found, output its category, a short neutral claim, and the sourceExcerpt copied VERBATIM from the document text below. Never paraphrase or invent quotations.\n" +
    "- Use only these categories:\n" +
    `${categories}\n` +
    otherDocRule +
    "- If a category has no stated term, list it under missing_categories. Never invent a value for a missing term.\n" +
    "- Do not judge whether any clause is legal, illegal, fair, or unfair. Describe only what the document states.\n" +
    "- Do not label any employer, recruiter, or offer legitimate or fraudulent.\n" +
    `- Output shape: {"terms": [{"category": "...", "claim": "...", "sourceExcerpt": "..."}], "missing_categories": ["..."]}.\n\n` +
    `Document (${doc.fileName}${trimmed ? ", trimmed to fit" : ""}):\n${text}`
  );
}

export interface ComparisonInput {
  documentId: string;
  documentType: ContractDocumentType;
  fileName: string;
  terms: EmploymentClaim[];
}

function formatComparisonTerm(
  term: EmploymentClaim,
  ownerLabel: string,
  docLabel: string,
): string {
  const excerpt =
    term.sourceExcerpt.length > COMPARISON_EXCERPT_CHARS
      ? `${term.sourceExcerpt.slice(0, COMPARISON_EXCERPT_CHARS).trimEnd()} [trimmed]`
      : term.sourceExcerpt;
  return (
    `- [${term.category}] (${docLabel} · ${ownerLabel}): ` +
    `${term.claim} | Excerpt: "${excerpt}"`
  );
}

export function buildPromiseComparisonPrompt(
  inputs: ComparisonInput[],
  language: UiLanguage = "en",
): string {
  const lines: string[] = [];
  const header = inputs
    .map(
      (input, index) =>
        `- Document ${index + 1}: ${DOCUMENT_TYPE_LABELS[input.documentType]} "${input.fileName}"`,
    )
    .join("\n");
  inputs.forEach((input, inputIndex) => {
    const owner = `${DOCUMENT_TYPE_LABELS[input.documentType]} "${input.fileName}"`;
    const docLabel = `Document ${inputIndex + 1}`;
    for (const term of input.terms) {
      if (lines.length >= COMPARISON_MAX_TERMS) {
        break;
      }
      lines.push(formatComparisonTerm(term, owner, docLabel));
    }
  });
  return (
    "You compare employment terms across the documents below. For each term that can be judged, " +
    "output one finding as JSON. Output a JSON array only.\n" +
    "Rules:\n" +
    comparisonLanguageRule(language) +
    "- Every sourceExcerpt MUST be copied verbatim from the excerpts below. Never paraphrase, shorten, or invent quotations.\n" +
    '- Copy every sourceExcerpt ONLY from an "Excerpt: ..." portion below, never from the claim text beside it, which may be written in another language and can never attribute.\n' +
    "- In every finding, cite documents ONLY as 'Document 1', 'Document 2', etc. (the labels in the document list). Never use file names or raw codes, and never invent an id.\n" +
    "- Omit slots that do not apply; never emit a slot with an empty claim or excerpt.\n" +
    "- Status 'consistent': the documents agree on the term.\n" +
    "- Status 'discrepancy': the documents state different terms. Example: recruiter says accommodation is free, " +
    'the contract deducts an accommodation fee — category deductions, status discrepancy.\n' +
    "- Status 'not_addressed': a promise-side term (advertisement or recruiter message) has no counterpart in the written documents. " +
    "Missing terms are unverified, never false; do not infer fraud from silence.\n" +
    "- Status 'needs_clarification': the wording is ambiguous, or the excerpts lack enough information to judge. " +
    "Say a human reviewer should examine the comparison.\n" +
    "- Differently worded clauses may still agree: compare actual meaning, and distinguish numerical differences (amounts, dates, hours) from semantic differences.\n" +
    "- A general page or a missing clause NEVER proves anything about a specific employer. Do not label any employer, recruiter, or offer legitimate, fraudulent, or compliant.\n" +
    "- Do not judge whether any clause is legal or illegal.\n" +
    "- Every explanation MUST state the comparison's limitation in one sentence.\n" +
    "- Skip terms no excerpt addresses rather than guessing.\n" +
    "- Shape per finding: {\"category\": \"...\", \"recruiterStatement\"?: {\"documentId\": \"...\", \"claim\": \"...\", \"sourceExcerpt\": \"...\"}, " +
    '"advertisementClaim\"?: {...}, "contractClause"?: {...}, "supportingEvidence"?: {...}, ' +
    '"status": "...", "explanation": "...", "followUpQuestion": "..."}. ' +
    "Use recruiterStatement only for recruiter communications, advertisementClaim only for job advertisements, " +
    "contractClause only for offer letters and employment contracts. An offer letter is a written document: " +
    "never file it under recruiterStatement or advertisementClaim. " +
    "Use supportingEvidence only for 'Other document' uploads such as invoices and receipts; " +
    "it adds context alongside promise and written terms.\n" +
    '- Terms filed under category "other" come from miscellaneous supporting documents: compare them leniently, ' +
    "prefer 'needs_clarification' over 'discrepancy' when wording is terse or amounts lack context, " +
    "and never treat a missing counterpart alone as a discrepancy.\n\n" +
    `Documents:\n${header}\n\n` +
    `Extracted terms:\n${lines.join("\n")}`
  );
}
