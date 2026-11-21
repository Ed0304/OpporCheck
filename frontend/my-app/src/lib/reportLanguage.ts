// Report language: the exact user-facing status labels and phrases the
// product uses. Centralized so terminology stays consistent and so unit
// tests can assert that no finding label ever carries a fraud verdict.
// Dependency-free (type-only imports).
//
// The English maps below are canonical and asserted verbatim by
// productTrust.test.ts. The Indonesian maps are WORKING DRAFTS needing
// native-speaker review — never present them as final. UI code reads
// labels through the get*(language) getters; tones never vary by language.

import type { ComparisonStatus } from "./contractTypes";
import type { FindingAssessment } from "./investigations";
import type { UiLanguage } from "./strings";

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

/** Indonesian working-draft assessment labels (need native-speaker review). */
export const ASSESSMENT_LABELS_ID: Record<FindingAssessment, string> = {
  supported: "Didukung oleh kutipan yang diambil",
  conflicting: "Bertentangan dengan kutipan yang diambil",
  "insufficient-evidence": "Bukti tidak cukup",
};

/** Indonesian working-draft comparison status labels (need native-speaker review). */
export const COMPARISON_STATUS_LABELS_ID: Record<ComparisonStatus, string> = {
  consistent: "Konsisten",
  discrepancy: "Perbedaan teridentifikasi",
  not_addressed: "Tidak dibahas dalam dokumen yang diberikan",
  needs_clarification: "Perlu klarifikasi",
};

/** Indonesian working draft of the missing-information label. */
export const MISSING_INFO_LABEL_ID = "Informasi tidak diberikan";

/** Indonesian working draft of the unverified-outcome phrase. */
export const UNVERIFIED_PHRASE_ID = "Tidak dapat dipastikan dari informasi yang tersedia.";

export function getAssessmentLabels(language: UiLanguage): Record<FindingAssessment, string> {
  return language === "id" ? ASSESSMENT_LABELS_ID : ASSESSMENT_LABELS;
}

export function getComparisonStatusLabels(
  language: UiLanguage,
): Record<ComparisonStatus, string> {
  return language === "id" ? COMPARISON_STATUS_LABELS_ID : COMPARISON_STATUS_LABELS;
}

export function getMissingInfoLabel(language: UiLanguage): string {
  return language === "id" ? MISSING_INFO_LABEL_ID : MISSING_INFO_LABEL;
}

export function getUnverifiedPhrase(language: UiLanguage): string {
  return language === "id" ? UNVERIFIED_PHRASE_ID : UNVERIFIED_PHRASE;
}

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
