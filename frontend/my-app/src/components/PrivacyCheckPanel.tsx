// Privacy Check panel: reusable review-and-approve experience (Phase 1.5).
//
// One mount handles one source text end to end: automatic detection,
// per-item redact/replace/retain decisions, manual spans, sanitized
// preview, inference disclosure, and explicit approval. Parents remount
// (via key) for each new check. Nothing is submitted automatically:
// approval is delivered through onApproved for the parent to adopt.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, StatusLabel } from "@/components/ui";
import {
  CATEGORY_TITLES,
  lineNumberOf,
  detectSensitiveInfo,
  type PrivacyCategory,
  type PrivacyConfidence,
} from "@/lib/privacyDetection";
import {
  addManualSpan,
  allReviewed,
  buildSanitized,
  confirmAllSuggestions,
  removeManualSpan,
  resetDecision,
  setDecision,
  startReview,
  type PrivacyReviewState,
  type ReviewedDetection,
  type ReviewDecision,
} from "@/lib/privacyReview";
import {
  createApproval,
  describeInference,
  type InferenceDisclosureMode,
  type PrivacyApproval,
} from "@/lib/privacyGate";

export interface PrivacyCheckPanelProps {
  sourceText: string;
  disclosureMode: InferenceDisclosureMode;
  onApproved: (approval: PrivacyApproval, sanitizedText: string) => void;
  onCancel?: () => void;
  onProgress?: (reviewed: number, total: number) => void;
}

function confidenceTone(confidence: PrivacyConfidence): "warn" | "info" | "idle" {
  if (confidence === "high") {
    return "warn";
  }
  if (confidence === "medium") {
    return "info";
  }
  return "idle";
}

function DetectionRow({
  sourceText,
  item,
  onDecide,
  onReset,
}: {
  sourceText: string;
  item: ReviewedDetection;
  onDecide: (decision: ReviewDecision, replacement: string) => void;
  onReset: () => void;
}) {
  const [replaceText, setReplaceText] = useState("");
  const detection = item.detection;
  return (
    <li className="rounded-md border border-edge p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {detection.label} · line {lineNumberOf(sourceText, detection.start)}
        </p>
        <StatusLabel tone={confidenceTone(detection.confidence)}>
          {detection.confidence === "high"
            ? "Likely sensitive"
            : detection.confidence === "medium"
              ? "Possibly sensitive"
              : "Needs judgment"}
        </StatusLabel>
      </div>
      <p className="mt-1 break-words font-mono text-sm">
        &ldquo;{detection.excerpt}&rdquo;
      </p>
      <p className="mt-1 text-xs text-muted">{detection.reason}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant={item.decision === "redact" ? "primary" : "secondary"}
          onClick={() => onDecide("redact", "")}
        >
          Redact
        </Button>
        <Button
          variant={item.decision === "replace" ? "primary" : "secondary"}
          onClick={() => onDecide("replace", replaceText.trim())}
          disabled={item.decision === "replace" && replaceText.trim().length === 0}
        >
          Replace
        </Button>
        <Button
          variant={item.decision === "retain" ? "primary" : "secondary"}
          onClick={() => onDecide("retain", "")}
        >
          Keep
        </Button>
        {item.reviewed && (
          <Button variant="ghost" onClick={onReset}>
            Undo choice
          </Button>
        )}
      </div>
      {(item.decision === "replace" || replaceText !== "") && (
        <input
          type="text"
          value={replaceText}
          onChange={(event) => setReplaceText(event.target.value)}
          onBlur={() => {
            if (replaceText.trim().length > 0) {
              onDecide("replace", replaceText.trim());
            }
          }}
          placeholder={`Replacement text (suggestion: ${detection.placeholder})`}
          maxLength={200}
          aria-label={`Replacement for ${detection.label}`}
          className="mt-2 h-9 w-full rounded-md border border-edge bg-card px-3 text-sm"
        />
      )}
    </li>
  );
}

export default function PrivacyCheckPanel({
  sourceText,
  disclosureMode,
  onApproved,
  onCancel,
  onProgress,
}: PrivacyCheckPanelProps) {
  const [review, setReview] = useState<PrivacyReviewState>(() =>
    startReview(sourceText, detectSensitiveInfo(sourceText).detections),
  );
  useEffect(() => {
    onProgress?.(
      review.items.filter((item) => item.reviewed).length,
      review.items.length,
    );
  }, [review.items, onProgress]);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualReplacement, setManualReplacement] = useState("");
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);

  const sanitized = useMemo(() => buildSanitized(review), [review]);
  const ready = allReviewed(review);
  const disclosure = describeInference(disclosureMode);

  const grouped = useMemo(() => {
    const groups = new Map<PrivacyCategory, ReviewedDetection[]>();
    for (const item of review.items) {
      const list = groups.get(item.detection.category) ?? [];
      list.push(item);
      groups.set(item.detection.category, list);
    }
    return [...groups.entries()];
  }, [review.items]);

  const handleManual = (replacing: boolean) => {
    const area = sourceRef.current;
    if (!area) {
      return;
    }
    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? 0;
    const replacement =
      replacing && manualReplacement.trim().length > 0 ? manualReplacement.trim() : null;
    if (replacing && replacement === null) {
      setManualError("Type replacement text first, or choose Redact selection.");
      return;
    }
    const result = addManualSpan(review, start, end, replacement);
    if (!result.ok) {
      setManualError(result.error);
      return;
    }
    setManualError(null);
    setManualReplacement("");
    setReview(result.state);
  };

  const handleApprove = () => {
    if (!ready) {
      return;
    }
    onApproved(
      createApproval({
        sanitizedText: sanitized.text,
        redactedCount: sanitized.redacted,
        replacedCount: sanitized.replaced,
        retainedCount: sanitized.retained,
      }),
      sanitized.text,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm leading-6 text-muted">
        Employment documents often mix personal details in with the evidence you
        need analyzed. This check highlights text that looks like personal
        information so you can redact or replace it before analysis. Your
        original text stays unchanged until you approve the cleaned version.
      </p>

      {review.items.length === 0 ? (
        <p className="text-sm leading-6" role="status">
          No potential sensitive information was found. You can still redact
          anything manually below, or approve to continue.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm" role="status">
            {review.items.filter((item) => item.reviewed).length} of {review.items.length}{" "}
            items reviewed.
          </p>
          <Button variant="ghost" onClick={() => setReview(confirmAllSuggestions(review))}>
            Confirm all suggestions
          </Button>
        </div>
      )}

      {grouped.map(([category, items]) => (
        <section key={category} aria-label={CATEGORY_TITLES[category]}>
          <h4 className="text-sm font-semibold">{CATEGORY_TITLES[category]}</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {items.map((item) => (
              <DetectionRow
                key={item.detection.id}
                sourceText={review.sourceText}
                item={item}
                onDecide={(decision, replacement) =>
                  setReview(setDecision(review, item.detection.id, decision, replacement))
                }
                onReset={() => setReview(resetDecision(review, item.detection.id))}
              />
            ))}
          </ul>
        </section>
      ))}

      <section aria-label="Manual redaction">
        <h4 className="text-sm font-semibold">Redact something yourself</h4>
        <p className="mt-1 text-sm text-muted">
          Select any text below (for example a name), then choose Redact or Replace.
        </p>
        <textarea
          ref={sourceRef}
          readOnly
          value={review.sourceText}
          rows={6}
          aria-label="Original text for manual selection"
          className="mt-2 w-full rounded-md border border-edge bg-card p-3 text-sm leading-6"
        />
        {manualError && (
          <p role="alert" className="mt-1 text-sm">
            {manualError}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => handleManual(false)}>
            Redact selection
          </Button>
          <input
            type="text"
            value={manualReplacement}
            onChange={(event) => setManualReplacement(event.target.value)}
            placeholder="Replacement text"
            maxLength={200}
            aria-label="Replacement text for manual selection"
            className="h-9 w-56 rounded-md border border-edge bg-card px-3 text-sm"
          />
          <Button variant="secondary" onClick={() => handleManual(true)}>
            Replace selection
          </Button>
        </div>
        {review.manual.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {review.manual.map((span) => (
              <li key={span.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="break-words font-mono">&ldquo;{span.excerpt}&rdquo;</span>
                <span className="text-muted">
                  → {span.replacement ?? "[REDACTED]"}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setReview(removeManualSpan(review, span.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Cleaned preview">
        <h4 className="text-sm font-semibold">Cleaned preview</h4>
        <p className="mt-1 text-sm text-muted">
          {sanitized.redacted} redacted · {sanitized.replaced} replaced ·{" "}
          {sanitized.retained} kept as-is. The preview changes only through the
          choices above.
        </p>
        <textarea
          readOnly
          value={sanitized.text}
          rows={8}
          aria-label="Cleaned text preview"
          className="mt-2 w-full rounded-md border border-edge bg-card p-3 text-sm leading-6"
        />
      </section>

      <div className="rounded-md border border-edge bg-card p-3">
        <p className="text-sm font-medium">Before you approve</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Automatic detection can miss sensitive information, and anything it
          finds is only a possibility — please review carefully, especially
          names, numbers, and contact details.
        </p>
        <p className="mt-2 text-sm leading-6">
          <span className="font-medium">Analysis destination:</span> {disclosure.destination}.{" "}
          {disclosure.processingNote} Characters to send: {sanitized.text.length}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleApprove} disabled={!ready}>
          Approve cleaned text for analysis
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {!ready && (
        <p className="text-sm text-muted" role="note">
          Review each item above (or confirm all suggestions) to enable approval.
        </p>
      )}
    </div>
  );
}
