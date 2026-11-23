// Promise-to-Paper session helpers: document records, finding summaries,
// and display labels. Pure and dependency-free (type-only imports) so the
// report math stays unit-testable without any AI or UI framework.
//
// Labels and gate messages render in the UI language (default English).
// Every `id` string below is a WORKING DRAFT needing native-speaker
// review before it can be considered final. Never present them as final.

import type {
  ContractCategory,
  ContractDocumentText,
  ContractDocumentType,
  PromiseToPaperFinding,
} from "./contractTypes";
import {
  PrivacyGateError,
  approvalCovers,
  hashContent,
  type PrivacyApproval,
} from "./privacyGate";
import type { UiLanguage } from "./strings";

export type CompareDocSource = "pdf" | "pasted";

/** One document in a transient comparison session (never persisted). */
export interface CompareDocumentInput {
  id: string;
  fileName: string;
  documentType: ContractDocumentType;
  source: CompareDocSource;
  pages: string[];
  /** True when extraction input was trimmed to fit model limits. */
  wasTrimmed: boolean;
  /** 1-based numbers of PDF pages that failed extraction (empty when none). */
  failedPages?: number[];
}

/** Limitation line for a document with failed pages, or null when none failed. */
export function failedPagesLimitation(
  fileName: string,
  failedPages: number[] | undefined,
  language: UiLanguage = "en",
): string | null {
  if (!failedPages || failedPages.length === 0) {
    return null;
  }
  const list = [...failedPages].sort((a, b) => a - b).join(", ");
  if (language === "id") {
    // WORKING DRAFT — needs native-speaker review.
    return (
      `${fileName}: halaman ${list} tidak dapat ` +
      "diekstraksi dan dikecualikan dari perbandingan."
    );
  }
  const singular = failedPages.length === 1;
  return (
    `${fileName}: page${singular ? "" : "s"} ${list} could not ` +
    `be extracted and ${singular ? "was" : "were"} excluded from comparison.`
  );
}

export function toContractText(input: CompareDocumentInput): ContractDocumentText {
  return {
    documentId: input.id,
    documentType: input.documentType,
    fileName: input.fileName,
    pages: input.pages,
  };
}

/** Minimal shape for per-document extraction source tracking. */
export interface ExtractionRunState {
  status: "ready" | "extracting" | "extracted" | "error";
  inferenceSource: string | null;
  error: string | null;
}

/** Starts a run: clears any source left by an earlier run (no stale display). */
export function beginExtractionRun<T extends ExtractionRunState>(doc: T): T {
  return { ...doc, status: "extracting", inferenceSource: null, error: null };
}

/** Records a finished run with the verbatim SDK-reported source. */
export function completeExtractionRun<T extends ExtractionRunState>(
  doc: T,
  source: unknown,
): T {
  return {
    ...doc,
    status: "extracted",
    inferenceSource: typeof source === "string" ? source : "unknown",
  };
}

/** Records a failed run; the source stays null so nothing stale shows. */
export function failExtractionRun<T extends ExtractionRunState>(
  doc: T,
  message: string,
): T {
  return { ...doc, status: "error", inferenceSource: null, error: message };
}

/** Per-page privacy state, parallel to CompareDocumentInput.pages. */
export interface DocPrivacyState {
  approvals: Array<PrivacyApproval | null>;
  sanitized: string[];
  /** Hash of each page's source text at approval time (staleness check). */
  sourceHashes: string[];
}

export function emptyDocPrivacy(pageCount: number): DocPrivacyState {
  return {
    approvals: Array.from({ length: pageCount }, () => null),
    sanitized: [],
    sourceHashes: [],
  };
}

/**
 * Records one page approval. The approval must cover the sanitized text
 * and the source snapshot must match the page being approved.
 */
export function recordPageApproval(
  privacy: DocPrivacyState,
  pageCount: number,
  index: number,
  approval: PrivacyApproval,
  sanitizedText: string,
  sourceText: string,
  language: UiLanguage = "en",
): DocPrivacyState {
  if (index < 0 || index >= pageCount) {
    throw new PrivacyGateError(
      "malformed",
      language === "id"
        ? "Indeks halaman di luar jangkauan." // WORKING DRAFT
        : "Page index is out of range.",
    );
  }
  if (!approvalCovers(approval, sanitizedText)) {
    throw new PrivacyGateError(
      "mismatch",
      language === "id"
        ? "Persetujuan tidak cocok dengan teks yang dibersihkan." // WORKING DRAFT
        : "Approval does not match the cleaned text.",
    );
  }
  const approvals = [...privacy.approvals];
  while (approvals.length < pageCount) {
    approvals.push(null);
  }
  approvals[index] = approval;
  const sanitized = [...privacy.sanitized];
  sanitized[index] = sanitizedText;
  const sourceHashes = [...privacy.sourceHashes];
  sourceHashes[index] = hashContent(sourceText);
  return { approvals, sanitized, sourceHashes };
}

/** One page is live when its snapshot matches and its approval covers its sanitized text. */
export function isPageApproved(
  privacy: DocPrivacyState,
  pages: string[],
  index: number,
): boolean {
  const page = pages[index];
  if (page === undefined) {
    return false;
  }
  return (
    privacy.sourceHashes[index] === hashContent(page) &&
    index < privacy.sanitized.length &&
    approvalCovers(privacy.approvals[index] ?? null, privacy.sanitized[index] ?? "")
  );
}

/**
 * Pages whose approval is live: the page still matches its approval-time
 * snapshot AND the stored approval covers the stored sanitized text.
 */
export function approvedPageCount(
  privacy: DocPrivacyState,
  pages: string[],
): number {
  let count = 0;
  for (let index = 0; index < pages.length; index += 1) {
    if (isPageApproved(privacy, pages, index)) {
      count += 1;
    }
  }
  return count;
}

export function isDocPrivacyApproved(
  privacy: DocPrivacyState,
  pages: string[],
): boolean {
  return pages.length > 0 && approvedPageCount(privacy, pages) === pages.length;
}

/**
 * Returns the sanitized pages for AI input. Throws PrivacyGateError unless
 * every page carries an approval covering its exact current text.
 */
export function approvedPagesOrThrow(
  privacy: DocPrivacyState,
  pages: string[],
  fileName: string,
  language: UiLanguage = "en",
): string[] {
  if (!isDocPrivacyApproved(privacy, pages)) {
    throw new PrivacyGateError(
      "missing",
      language === "id"
        ? `Periksa Privasi belum lengkap untuk ${fileName}: setujui setiap halaman terlebih dahulu.` // WORKING DRAFT
        : `Privacy Check is incomplete for ${fileName}: approve every page first.`,
    );
  }
  return privacy.sanitized.slice(0, pages.length);
}

export interface FindingSummary {
  consistent: number;
  discrepancy: number;
  not_addressed: number;
  needs_clarification: number;
  total: number;
}

export function summarizeFindings(findings: PromiseToPaperFinding[]): FindingSummary {
  const summary: FindingSummary = {
    consistent: 0,
    discrepancy: 0,
    not_addressed: 0,
    needs_clarification: 0,
    total: findings.length,
  };
  for (const finding of findings) {
    if (finding.status === "consistent") {
      summary.consistent += 1;
    } else if (finding.status === "discrepancy") {
      summary.discrepancy += 1;
    } else if (finding.status === "not_addressed") {
      summary.not_addressed += 1;
    } else {
      summary.needs_clarification += 1;
    }
  }
  return summary;
}

/** Follow-up questions across findings, deduplicated, in first-seen order. */
export function collectQuestions(findings: PromiseToPaperFinding[]): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const finding of findings) {
    const question = finding.followUpQuestion.trim();
    if (question !== "" && !seen.has(question.toLowerCase())) {
      seen.add(question.toLowerCase());
      questions.push(question);
    }
  }
  return questions;
}

export const COMPARE_CATEGORY_LABELS: Record<ContractCategory, string> = {
  compensation: "Compensation",
  deductions: "Deductions",
  working_conditions: "Working conditions",
  employment_period: "Employment period",
  benefits: "Benefits",
  termination: "Termination",
  immigration: "Immigration & work authorization",
  responsibilities: "Responsibilities",
};

export const COMPARE_DOC_TYPE_LABELS: Record<ContractDocumentType, string> = {
  job_advertisement: "Job advertisement",
  recruiter_communication: "Recruiter communication",
  offer_letter: "Offer letter",
  employment_contract: "Employment contract",
  other: "Other document",
};

// Indonesian working-draft labels (need native-speaker review).
export const COMPARE_CATEGORY_LABELS_ID: Record<ContractCategory, string> = {
  compensation: "Kompensasi",
  deductions: "Potongan",
  working_conditions: "Kondisi kerja",
  employment_period: "Masa kerja",
  benefits: "Tunjangan",
  termination: "Pemutusan hubungan kerja",
  immigration: "Imigrasi & otorisasi kerja",
  responsibilities: "Tanggung jawab",
};

export const COMPARE_DOC_TYPE_LABELS_ID: Record<ContractDocumentType, string> = {
  job_advertisement: "Iklan lowongan",
  recruiter_communication: "Komunikasi perekrut",
  offer_letter: "Surat penawaran",
  employment_contract: "Kontrak kerja",
  other: "Dokumen lain",
};

export function getCompareCategoryLabels(
  language: UiLanguage,
): Record<ContractCategory, string> {
  return language === "id" ? COMPARE_CATEGORY_LABELS_ID : COMPARE_CATEGORY_LABELS;
}

export function getCompareDocTypeLabels(
  language: UiLanguage,
): Record<ContractDocumentType, string> {
  return language === "id" ? COMPARE_DOC_TYPE_LABELS_ID : COMPARE_DOC_TYPE_LABELS;
}

export type AnalysisGateMode = "on-device-only" | "prefer-on-device";

export interface AnalysisGate {
  allowed: boolean;
  /** Human-readable blocker; null when allowed. */
  reason: string | null;
}

/**
 * Pure consent/mode gate for analysis runs. On-device-only never permits
 * a cloud fallback; cloud-capable modes require explicit consent and a
 * prepared device is required before on-device-only runs.
 */
export function analysisGate(
  mode: AnalysisGateMode,
  options: { consent: boolean; deviceReady: boolean },
  language: UiLanguage = "en",
): AnalysisGate {
  if (mode === "prefer-on-device" && !options.consent) {
    return {
      allowed: false,
      reason:
        language === "id"
          ? "Persetujuan untuk pemrosesan cloud diperlukan untuk mode ini." // WORKING DRAFT
          : "Consent to cloud processing is required for this mode.",
    };
  }
  if (mode === "on-device-only" && !options.deviceReady) {
    return {
      allowed: false,
      reason:
        language === "id"
          ? "Siapkan analisis di perangkat terlebih dahulu — mode khusus di perangkat tidak pernah beralih ke cloud." // WORKING DRAFT
          : "Prepare on-device analysis first — on-device-only mode never falls back to cloud.",
    };
  }
  return { allowed: true, reason: null };
}
