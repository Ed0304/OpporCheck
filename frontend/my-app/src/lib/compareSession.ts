// Promise-to-Paper session helpers: document records, finding summaries,
// and display labels. Pure and dependency-free (type-only imports) so the
// report math stays unit-testable without any AI or UI framework.

import type {
  ContractCategory,
  ContractDocumentText,
  ContractDocumentType,
  PromiseToPaperFinding,
} from "./contractTypes";

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
}

export function toContractText(input: CompareDocumentInput): ContractDocumentText {
  return {
    documentId: input.id,
    documentType: input.documentType,
    fileName: input.fileName,
    pages: input.pages,
  };
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
};

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
): AnalysisGate {
  if (mode === "prefer-on-device" && !options.consent) {
    return { allowed: false, reason: "Consent to cloud processing is required for this mode." };
  }
  if (mode === "on-device-only" && !options.deviceReady) {
    return {
      allowed: false,
      reason: "Prepare on-device analysis first — on-device-only mode never falls back to cloud.",
    };
  }
  return { allowed: true, reason: null };
}
