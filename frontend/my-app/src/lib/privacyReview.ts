// Privacy Check review engine: decisions, manual spans, sanitized output.
//
// Dependency-free and pure: given the source text plus detector output,
// it tracks one decision per detection (redact / replace / retain),
// supports user-added manual spans, and computes the sanitized text by
// splicing replacements from the end backwards so offsets never shift.
// The source text is never mutated; the sanitized text is a separate
// representation built only from explicit decisions.

import type { PrivacyDetection } from "./privacyDetection";

export type ReviewDecision = "undecided" | "redact" | "replace" | "retain";

export interface ReviewedDetection {
  detection: PrivacyDetection;
  decision: ReviewDecision;
  /** Custom text used when decision is "replace". */
  replacement: string;
  /** True once the user explicitly confirmed this item (or bulk-confirmed). */
  reviewed: boolean;
}

export interface ManualSpan {
  id: string;
  start: number;
  end: number;
  excerpt: string;
  /** Null means redact with the default placeholder. */
  replacement: string | null;
}

export interface PrivacyReviewState {
  sourceText: string;
  items: ReviewedDetection[];
  manual: ManualSpan[];
}

let manualCounter = 0;

/** Suggested starting point: redact high/medium, retain low. Never applied silently. */
export function suggestDecision(detection: PrivacyDetection): "redact" | "retain" {
  return detection.confidence === "low" ? "retain" : "redact";
}

export function startReview(
  sourceText: string,
  detections: PrivacyDetection[],
): PrivacyReviewState {
  manualCounter = 0;
  return {
    sourceText,
    items: detections.map((detection) => ({
      detection,
      decision: "undecided",
      replacement: "",
      reviewed: false,
    })),
    manual: [],
  };
}

export function setDecision(
  state: PrivacyReviewState,
  id: string,
  decision: ReviewDecision,
  replacement = "",
): PrivacyReviewState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.detection.id === id
        ? {
            ...item,
            decision,
            replacement: decision === "replace" ? replacement : "",
            reviewed: decision !== "undecided",
          }
        : item,
    ),
  };
}

/** Returns one item to its suggested default, unreviewed. */
export function resetDecision(state: PrivacyReviewState, id: string): PrivacyReviewState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.detection.id === id
        ? { ...item, decision: "undecided", replacement: "", reviewed: false }
        : item,
    ),
  };
}

/** Explicit bulk action: confirms every item at its suggested decision. */
export function confirmAllSuggestions(state: PrivacyReviewState): PrivacyReviewState {
  return {
    ...state,
    items: state.items.map((item) => ({
      ...item,
      decision: suggestDecision(item.detection),
      replacement: "",
      reviewed: true,
    })),
  };
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type AddSpanResult =
  | { ok: true; state: PrivacyReviewState }
  | { ok: false; error: string };

/**
 * Adds a user-selected span. Rejected when empty, out of bounds, or
 * overlapping any existing item or manual span (overlaps would make the
 * sanitized output ambiguous).
 */
export function addManualSpan(
  state: PrivacyReviewState,
  start: number,
  end: number,
  replacement: string | null = null,
): AddSpanResult {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > state.sourceText.length) {
    return { ok: false, error: "Selection is outside the text." };
  }
  if (to - from < 1) {
    return { ok: false, error: "Select at least one character to redact." };
  }
  if (to - from > 2000) {
    return { ok: false, error: "Selections are limited to 2000 characters." };
  }
  const blocked =
    state.items.some((item) =>
      rangesOverlap(from, to, item.detection.start, item.detection.end),
    ) ||
    state.manual.some((span) => rangesOverlap(from, to, span.start, span.end));
  if (blocked) {
    return { ok: false, error: "Selection overlaps an existing item." };
  }
  manualCounter += 1;
  return {
    ok: true,
    state: {
      ...state,
      manual: [
        ...state.manual,
        {
          id: `manual-${manualCounter}`,
          start: from,
          end: to,
          excerpt: state.sourceText.slice(from, to),
          replacement,
        },
      ],
    },
  };
}

export function removeManualSpan(
  state: PrivacyReviewState,
  id: string,
): PrivacyReviewState {
  return { ...state, manual: state.manual.filter((span) => span.id !== id) };
}

/** True when every detected item has an explicit decision. Manual spans are explicit by construction. */
export function allReviewed(state: PrivacyReviewState): boolean {
  return state.items.every((item) => item.reviewed && item.decision !== "undecided");
}

export interface SanitizedResult {
  text: string;
  redacted: number;
  replaced: number;
  retained: number;
}

/**
 * Builds the sanitized text from explicit decisions only. Undecided and
 * retained items keep their original text. Splices from the end backwards
 * so earlier offsets stay valid.
 */
export function buildSanitized(state: PrivacyReviewState): SanitizedResult {
  const edits: Array<{ start: number; end: number; text: string; kind: "redact" | "replace" }> = [];
  for (const item of state.items) {
    if (item.decision === "redact") {
      edits.push({
        start: item.detection.start,
        end: item.detection.end,
        text: item.detection.placeholder,
        kind: "redact",
      });
    } else if (item.decision === "replace") {
      edits.push({
        start: item.detection.start,
        end: item.detection.end,
        text: item.replacement,
        kind: "replace",
      });
    }
  }
  for (const span of state.manual) {
    edits.push({
      start: span.start,
      end: span.end,
      text: span.replacement ?? "[REDACTED]",
      kind: span.replacement === null ? "redact" : "replace",
    });
  }
  edits.sort((a, b) => b.start - a.start);
  let text = state.sourceText;
  let redacted = 0;
  let replaced = 0;
  for (const edit of edits) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    if (edit.kind === "redact") {
      redacted += 1;
    } else {
      replaced += 1;
    }
  }
  const retained = state.items.filter((item) => item.decision !== "redact" && item.decision !== "replace").length;
  return { text, redacted, replaced, retained };
}
