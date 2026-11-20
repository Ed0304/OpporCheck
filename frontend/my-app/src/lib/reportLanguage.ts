// Report language: the exact user-facing status labels and phrases the
// product uses. Centralized so terminology stays consistent and so unit
// tests can assert that no finding label ever carries a fraud verdict.
// Dependency-free (type-only imports).

import type { ComparisonStatus } from "./contractTypes";
import type { FindingAssessment } from "./investigations";

/** Evidence-investigation assessment labels (official-source findings). */
export const ASSESSMENT_LABELS: Record<FindingAssessment, string> = {
  supported: "Supported by the retrieved excerpt",
  conflicting: "Conflicting with the retrieved excerpt",
  "insufficient-evidence": "Insufficient evidence",
};

export type AssessmentTone = "ok" | "warn" | "info";

/**
 * Assessment tones. Ordinary conflicting evidence uses amber, never red:
 * a conflict is information, not an emergency or proof of misconduct.
 */
export const ASSESSMENT_TONES: Record<FindingAssessment, AssessmentTone> = {
  supported: "ok",
  conflicting: "warn",
  "insufficient-evidence": "info",
};

/** Promise-to-Paper comparison status labels. */
export const COMPARISON_STATUS_LABELS: Record<ComparisonStatus, string> = {
  consistent: "Consistent",
  discrepancy: "Discrepancy identified",
  not_addressed: "Not addressed in the supplied documents",
  needs_clarification: "Needs clarification",
};

export const COMPARISON_STATUS_TONES: Record<ComparisonStatus, AssessmentTone> = {
  consistent: "ok",
  discrepancy: "warn",
  not_addressed: "info",
  needs_clarification: "warn",
};

/** Preferred section label for gaps in the source material. */
export const MISSING_INFO_LABEL = "Information not provided";

/** Preferred phrase when the available material settles nothing. */
export const UNVERIFIED_PHRASE = "Unable to establish from available information.";

/**
 * Fraud-verdict and guarantee phrases that must never appear in
 * user-facing labels. Used by unit tests (case-insensitive match).
 */
export const DISALLOWED_LABEL_PHRASES: readonly string[] = [
  "confirmed scam",
  "fraudulent employer",
  "scam detected",
  "100% safe",
  "verified legitimate",
  "guaranteed legal",
  "safe to sign",
  "fraud verdict",
  "definitely legitimate",
  "definitely fraudulent",
];
