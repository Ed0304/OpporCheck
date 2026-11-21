// Privacy Check panel: reusable review-and-approve experience (Phase 1.5).
//
// One mount handles one source text end to end: automatic detection,
// per-item redact/replace/retain decisions, manual spans, sanitized
// preview, inference disclosure, and explicit approval. Parents remount
// (via key) for each new check. Nothing is submitted automatically:
// approval is delivered through onApproved for the parent to adopt.
//
// Panel chrome follows the global website language preference, and so do
// detection labels and reasons (via detectSensitiveInfo's UI language).
// Category titles are localized; placeholders stay English.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { OC_DURATION, OC_EASE } from "@/components/motion";
import { Button, StatusLabel } from "@/components/ui";
import { useLang } from "@/lib/lang";
import { format, getStrings } from "@/lib/strings";
import {
  getCategoryTitles,
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
  const { language } = useLang();
  const t = getStrings(language);
  const [replaceText, setReplaceText] = useState("");
  const detection = item.detection;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
      className="rounded-md border border-edge p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {detection.label} · {t.pvLineWord} {lineNumberOf(sourceText, detection.start)}
        </p>
        <StatusLabel tone={confidenceTone(detection.confidence)}>
          {detection.confidence === "high"
            ? t.pvLikely
            : detection.confidence === "medium"
              ? t.pvPossibly
              : t.pvNeedsJudgment}
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
          {t.pvRedact}
        </Button>
        <Button
          variant={item.decision === "replace" ? "primary" : "secondary"}
          onClick={() => onDecide("replace", replaceText.trim())}
          disabled={item.decision === "replace" && replaceText.trim().length === 0}
        >
          {t.pvReplace}
        </Button>
        <Button
          variant={item.decision === "retain" ? "primary" : "secondary"}
          onClick={() => onDecide("retain", "")}
        >
          {t.pvKeep}
        </Button>
        {item.reviewed && (
          <Button variant="ghost" onClick={onReset}>
            {t.pvUndo}
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
          placeholder={format(t.pvReplacementPlaceholder, {
            suggestion: detection.placeholder,
          })}
          maxLength={200}
          aria-label={format(t.pvReplacementAria, { label: detection.label })}
          className="mt-2 h-9 w-full rounded-md border border-edge bg-card px-3 text-sm"
        />
      )}
    </motion.li>
  );
}

export default function PrivacyCheckPanel({
  sourceText,
  disclosureMode,
  onApproved,
  onCancel,
  onProgress,
}: PrivacyCheckPanelProps) {
  const { language } = useLang();
  const t = getStrings(language);
  const titles = getCategoryTitles(language);
  const [review, setReview] = useState<PrivacyReviewState>(() =>
    startReview(sourceText, detectSensitiveInfo(sourceText, language).detections),
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
  const disclosure = describeInference(disclosureMode, language);

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
      setManualError(t.pvNeedReplacement);
      return;
    }
    const result = addManualSpan(review, start, end, replacement, language);
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
      <p className="max-w-3xl text-sm leading-6 text-muted">{t.pvIntro}</p>

      {review.items.length === 0 ? (
        <p className="text-sm leading-6" role="status">
          {t.pvNoneFound}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm" role="status">
            {format(t.pvReviewedCount, {
              done: String(review.items.filter((item) => item.reviewed).length),
              total: String(review.items.length),
            })}
          </p>
          <Button variant="ghost" onClick={() => setReview(confirmAllSuggestions(review))}>
            {t.pvConfirmAll}
          </Button>
        </div>
      )}

      {grouped.map(([category, items]) => (
        <section key={category} aria-label={titles[category]}>
          <h4 className="text-sm font-semibold">{titles[category]}</h4>
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

      <section aria-label={t.pvManualTitle}>
        <h4 className="text-sm font-semibold">{t.pvManualTitle}</h4>
        <p className="mt-1 text-sm text-muted">{t.pvManualHint}</p>
        <textarea
          ref={sourceRef}
          readOnly
          value={review.sourceText}
          rows={6}
          aria-label={t.pvManualAria}
          className="mt-2 w-full rounded-md border border-edge bg-card p-3 text-sm leading-6"
        />
        {manualError && (
          <p role="alert" className="mt-1 text-sm">
            {manualError}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => handleManual(false)}>
            {t.pvRedactSelection}
          </Button>
          <input
            type="text"
            value={manualReplacement}
            onChange={(event) => setManualReplacement(event.target.value)}
            placeholder={t.pvReplacementShort}
            maxLength={200}
            aria-label={t.pvManualReplaceAria}
            className="h-9 w-56 rounded-md border border-edge bg-card px-3 text-sm"
          />
          <Button variant="secondary" onClick={() => handleManual(true)}>
            {t.pvReplaceSelection}
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
                  {t.commonRemove}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t.pvPreviewTitle}>
        <h4 className="text-sm font-semibold">{t.pvPreviewTitle}</h4>
        <p className="mt-1 text-sm text-muted">
          {sanitized.redacted} {t.pvCountRedacted} · {sanitized.replaced} {t.pvCountReplaced} ·{" "}
          {sanitized.retained} {t.pvCountKept}. {t.pvPreviewNote}
        </p>
        <textarea
          readOnly
          value={sanitized.text}
          rows={8}
          aria-label={t.pvPreviewTitle}
          className="mt-2 w-full rounded-md border border-edge bg-card p-3 text-sm leading-6"
        />
      </section>

      <div className="rounded-md border border-edge bg-card p-3">
        <p className="text-sm font-medium">{t.pvBeforeApprove}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{t.pvAutoDetectNote}</p>
        <p className="mt-2 text-sm leading-6">
          <span className="font-medium">{t.pvDestination}</span> {disclosure.destination}.{" "}
          {disclosure.processingNote} {t.pvCharsToSend} {sanitized.text.length}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleApprove} disabled={!ready}>
          {t.pvApprove}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t.commonCancel}
          </Button>
        )}
      </div>
      {!ready && (
        <p className="text-sm text-muted" role="note">
          {t.pvEnableNote}
        </p>
      )}
    </div>
  );
}
