// Privacy Check approval gate: content-bound approvals and enforcement.
//
// An approval binds ONE exact sanitized text via a content hash: analysis
// and saving both re-verify the live text against the stored hash, so any
// edit, append, or swap invalidates the approval and forces a fresh
// Privacy Check. The hash is change-detection binding against accidents
// and stale state — not a tamper-proof token against the page owner, who
// owns both the data and the browser. That honesty is load-bearing: the
// real security boundaries are the call-site guards (every AI and save
// entry point asserts approval), the unchanged Firestore ownership rules,
// and the backend's inability to analyze or persist (no credentials).
//
// Dependency-free and pure so every transition is unit-testable.

import { DETECTOR_VERSION } from "./privacyDetection";

export type PrivacyGateState =
  | "NOT_STARTED"
  | "SCANNING"
  | "REVIEW_REQUIRED"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "INVALIDATED";

export interface PrivacyApproval {
  version: 1;
  detectorVersion: string;
  /** FNV-1a hash (hex) of the exact approved sanitized text. */
  textHash: string;
  textLength: number;
  redactedCount: number;
  replacedCount: number;
  retainedCount: number;
  approvedAt: string;
}

export type GateRejection = "missing" | "stale" | "mismatch" | "malformed";

export class PrivacyGateError extends Error {
  readonly code: GateRejection;

  constructor(code: GateRejection, message: string) {
    super(message);
    this.name = "PrivacyGateError";
    this.code = code;
  }
}

/** FNV-1a 32-bit hash, hex-encoded. Fast, deterministic, dependency-free. */
export function hashContent(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function createApproval(input: {
  sanitizedText: string;
  redactedCount: number;
  replacedCount: number;
  retainedCount: number;
  detectorVersion?: string;
}): PrivacyApproval {
  return {
    version: 1,
    detectorVersion: input.detectorVersion ?? DETECTOR_VERSION,
    textHash: hashContent(input.sanitizedText),
    textLength: input.sanitizedText.length,
    redactedCount: input.redactedCount,
    replacedCount: input.replacedCount,
    retainedCount: input.retainedCount,
    approvedAt: new Date().toISOString(),
  };
}

function isWellFormed(approval: PrivacyApproval): boolean {
  return (
    approval.version === 1 &&
    typeof approval.textHash === "string" &&
    approval.textHash.length > 0 &&
    typeof approval.textLength === "number" &&
    approval.detectorVersion === DETECTOR_VERSION
  );
}

/** True only when the approval is well-formed and bound to this exact text. */
export function approvalCovers(
  approval: PrivacyApproval | null | undefined,
  candidateText: string,
): boolean {
  if (!approval || !isWellFormed(approval)) {
    return false;
  }
  return (
    approval.textLength === candidateText.length &&
    approval.textHash === hashContent(candidateText)
  );
}

/**
 * Enforcement entry point for every AI call site. Throws PrivacyGateError
 * unless a well-formed approval covers the exact candidate text.
 */
export function assertAnalysisAllowed(
  approval: PrivacyApproval | null | undefined,
  candidateText: string,
): void {
  if (!approval) {
    throw new PrivacyGateError(
      "missing",
      "Privacy Check approval is required before analysis.",
    );
  }
  if (!isWellFormed(approval)) {
    throw new PrivacyGateError("malformed", "Privacy Check approval is invalid.");
  }
  if (!approvalCovers(approval, candidateText)) {
    throw new PrivacyGateError(
      "stale",
      "The text changed since Privacy Check approval. Run Privacy Check again.",
    );
  }
}

export interface AnalysisSnapshot {
  /** Hash of the exact text the report was generated from. */
  textHash: string;
}

export type SaveResolution =
  | { ok: true; postingText: string }
  | { ok: false; code: GateRejection; reason: string };

/**
 * Save requires BOTH a valid approval for the current text AND a report
 * generated from that same text. The persisted posting is always the
 * approved sanitized text — originals can never flow here, because the
 * only way to obtain approval is to approve sanitized output.
 */
export function resolveSavePayload(input: {
  currentText: string;
  approval: PrivacyApproval | null | undefined;
  analysis: AnalysisSnapshot | null;
}): SaveResolution {
  if (!input.approval) {
    return {
      ok: false,
      code: "missing",
      reason: "Approve the privacy-checked text before saving.",
    };
  }
  if (!approvalCovers(input.approval, input.currentText)) {
    return {
      ok: false,
      code: "stale",
      reason: "The text changed since approval. Re-check privacy before saving.",
    };
  }
  if (!input.analysis || input.analysis.textHash !== input.approval.textHash) {
    return {
      ok: false,
      code: "mismatch",
      reason: "The analysis does not match the current text. Re-analyze before saving.",
    };
  }
  return { ok: true, postingText: input.currentText };
}

export interface GateViewInput {
  hasSource: boolean;
  scanning: boolean;
  /** Null until a scan has produced a review state. */
  review: { allReviewed: boolean } | null;
  approval: PrivacyApproval | null | undefined;
  currentText: string;
}

/** Derives the display/enforcement state from review + approval facts. */
export function computeGateState(input: GateViewInput): PrivacyGateState {
  if (input.approval) {
    return approvalCovers(input.approval, input.currentText) ? "APPROVED" : "INVALIDATED";
  }
  if (!input.hasSource) {
    return "NOT_STARTED";
  }
  if (input.scanning || !input.review) {
    return input.scanning ? "SCANNING" : "NOT_STARTED";
  }
  return input.review.allReviewed ? "READY_FOR_APPROVAL" : "REVIEW_REQUIRED";
}

/**
 * Honest label for one SDK-reported inference source. Only the two
 * documented SDK values ("on_device" | "in_cloud", see @firebase/ai
 * InferenceSource) produce a positive claim; anything else — undefined,
 * "unknown", future values — renders as unavailable, never guessed.
 */
export function describeActualSource(source: unknown): {
  label: string;
  known: boolean;
} {
  if (source === "on_device") {
    return { label: "Processed on-device.", known: true };
  }
  if (source === "in_cloud") {
    return { label: "Processed in the cloud.", known: true };
  }
  return { label: "Processing location unavailable.", known: false };
}

export type InferenceDisclosureMode =
  | "prefer-on-device"
  | "on-device-only"
  | "only-in-cloud";

export interface InferenceDisclosure {
  /** Short destination label, e.g. "On-device when available, cloud fallback". */
  destination: string;
  allowsCloudFallback: boolean;
  /** Plain-language processing note shown before approval. */
  processingNote: string;
}

/**
 * Honest per-mode disclosure. Modes that allow cloud fallback are never
 * described as on-device-only.
 */
export function describeInference(mode: InferenceDisclosureMode): InferenceDisclosure {
  if (mode === "on-device-only") {
    return {
      destination: "On-device only",
      allowsCloudFallback: false,
      processingNote:
        "Analysis runs on this device only and the text never leaves the browser. " +
        "If on-device analysis is unavailable, the run stops instead of falling back.",
    };
  }
  if (mode === "only-in-cloud") {
    return {
      destination: "Cloud processing",
      allowsCloudFallback: true,
      processingNote:
        "Analysis always runs in the cloud: the approved text is transmitted " +
        "outside this device to the configured cloud model.",
    };
  }
  return {
    destination: "On-device when available, cloud fallback",
    allowsCloudFallback: true,
    processingNote:
      "Analysis tries on-device first; when unavailable, the approved text is " +
      "sent to the cloud model. Only the approved sanitized text is ever sent.",
  };
}
