"use client";

// Review an opportunity: paste text or upload a PDF, analyze with the
// existing hybrid AI Logic analyzer, and save as an investigation.
// Plain-language UI: no model IDs, inference modes, latency, or raw JSON.

import Link from "next/link";
import { useCallback, useReducer, useRef, useState } from "react";
import {
  getGenerativeModel,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import AnalysisResults from "@/components/AnalysisResults";
import { ContextualNotice } from "@/components/Disclaimer";
import PrivacyCheckPanel from "@/components/PrivacyCheckPanel";
import { Button, Card, EmptyState, Field, StatusLabel } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { REVIEW_PROCESSING_NOTICE, UPLOAD_SENSITIVITY_NOTICE } from "@/lib/disclaimer";
import {
  OCR_LANGUAGES,
  apiBase,
  failedPageNumbers,
  ocrConfidenceSummary,
  shouldWarnLowConfidence,
  uploadImage,
  uploadPdf,
  validateImageFile,
  validatePdfFile,
  type ExtractResult,
  type OcrLanguage,
} from "@/lib/documents";
import { getFirebaseClient, probeFirebaseConfig } from "@/lib/firebaseClient";
import {
  analyzerSchema,
  buildAnalyzerPrompt,
  parseReport,
  SAMPLE_POSTING,
  type OpportunityReport,
} from "@/lib/opportunityAnalyzer";
import {
  getInvestigationsDb,
  saveInvestigation,
} from "@/lib/investigations";
import { initialOcrState, ocrReducer } from "@/lib/ocrReview";
import {
  approvalCovers,
  assertAnalysisAllowed,
  computeGateState,
  describeActualSource,
  hashContent,
  resolveSavePayload,
  type PrivacyApproval,
  type PrivacyGateState,
} from "@/lib/privacyGate";
import { mapServiceError } from "@/lib/aiErrors";

type InputTab = "paste" | "pdf" | "image";

interface DeviceStatus {
  state: "idle" | "initializing" | "ready" | "error";
  progress: number | null;
  message: string;
}

interface PdfStatus {
  phase: "idle" | "uploading" | "ready" | "error";
  progress: number | null;
  message: string;
  result: ExtractResult | null;
}

function pdfSourceCounts(result: ExtractResult): { native: number; ocr: number; failed: number } {
  const pages = result.page_results ?? [];
  if (pages.length === 0) {
    return { native: result.pages, ocr: 0, failed: 0 };
  }
  return {
    native: pages.filter((page) => page.source === "native").length,
    ocr: pages.filter((page) => page.source === "ocr").length,
    failed: failedPageNumbers(result).length,
  };
}

interface AnalysisResult {
  data: OpportunityReport | null;
  parseError: string | null;
  inferenceSource: string;
  latencyMs: number;
}

function createAnalyzer(ai: AI, cloudModel: string): GenerativeModel {
  // Hybrid mode is fixed here: on-device when available, cloud fallback.
  // The mode itself is intentionally not shown in the workspace UI.
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: analyzerSchema,
      },
    },
    onDeviceParams: { promptOptions: { responseConstraint: analyzerSchema } },
  });
}

const GATE_STATUS: Record<
  PrivacyGateState,
  { tone: "ok" | "bad" | "info" | "idle"; label: string }
> = {
  NOT_STARTED: { tone: "idle", label: "Not checked" },
  SCANNING: { tone: "info", label: "Scanning…" },
  REVIEW_REQUIRED: { tone: "info", label: "Review in progress" },
  READY_FOR_APPROVAL: { tone: "info", label: "Ready to approve" },
  APPROVED: { tone: "ok", label: "Approved for analysis" },
  INVALIDATED: { tone: "bad", label: "Approval expired — text changed" },
};

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check/i.test(message)) {
    return (
      "The request was blocked by App Check. Register a localhost debug token " +
      "(see the model playground guide) and try again."
    );
  }
  return mapServiceError(message) ?? message;
}

export default function ReviewPage() {
  const { user } = useAuth();
  const [envProbe] = useState(() => probeFirebaseConfig());
  const [modelError, setModelError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceStatus>({
    state: "idle",
    progress: null,
    message: "On-device analysis is optional; cloud fallback works without it.",
  });
  const [tab, setTab] = useState<InputTab>("paste");
  const [postingText, setPostingText] = useState(SAMPLE_POSTING);
  const [pdf, setPdf] = useState<PdfStatus>({ phase: "idle", progress: null, message: "", result: null });
  const [pdfLanguage, setPdfLanguage] = useState<OcrLanguage>("en");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [ocr, dispatchOcr] = useReducer(ocrReducer, undefined, initialOcrState);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyNonce, setPrivacyNonce] = useState(0);
  const [privacySource, setPrivacySource] = useState("");
  const [privacyProgress, setPrivacyProgress] = useState<{
    reviewed: number;
    total: number;
  } | null>(null);
  const [approval, setApproval] = useState<PrivacyApproval | null>(null);
  const [analysisSnapshot, setAnalysisSnapshot] = useState<{ textHash: string } | null>(
    null,
  );
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const modelRef = useRef<GenerativeModel | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);

  const configOk = envProbe.missingConfigKeys.length === 0;

  const gateState: PrivacyGateState = computeGateState({
    hasSource: postingText.trim().length > 0,
    scanning: false,
    review: privacyOpen
      ? {
          allReviewed:
            privacyProgress !== null &&
            (privacyProgress.total === 0 ||
              privacyProgress.reviewed >= privacyProgress.total),
        }
      : null,
    approval,
    currentText: postingText,
  });
  const analysisAllowed = approvalCovers(approval, postingText);

  // Lazily created on first user action so Firebase initializes in event
  // handlers, never in a mount effect.
  const ensureModel = (): GenerativeModel | null => {
    if (!modelRef.current) {
      try {
        const client = getFirebaseClient();
        modelRef.current = createAnalyzer(client.ai, client.cloudModelName);
      } catch (err) {
        setModelError(err instanceof Error ? err.message : String(err));
        return null;
      }
    }
    return modelRef.current;
  };

  const handleInitDevice = async () => {
    const model = ensureModel();
    if (!model) {
      return;
    }
    setDevice({ state: "initializing", progress: 0, message: "Preparing on-device analysis…" });
    try {
      await model.initializeDeviceModel((progressValue) => {
        setDevice((prev) => ({
          ...prev,
          progress: progressValue,
          message: `Downloading on-device model: ${Math.round(progressValue * 10000) / 100}%`,
        }));
      });
      setDevice({ state: "ready", progress: 1, message: "On-device analysis is ready." });
    } catch (err) {
      setDevice({ state: "error", progress: null, message: friendlyError(err) });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || pdf.phase === "uploading") {
      return;
    }
    const invalid = validatePdfFile(file);
    if (invalid) {
      setPdf({ phase: "error", progress: null, message: invalid, result: null });
      return;
    }
    setPdfFile(file);
    setPdf({ phase: "uploading", progress: 0, message: `Uploading ${file.name}…`, result: null });
    try {
      const extracted = await uploadPdf(
        file,
        (fraction) => {
          setPdf((prev) => ({ ...prev, progress: fraction }));
        },
        pdfLanguage,
      );
      const counts = pdfSourceCounts(extracted);
      const failed = failedPageNumbers(extracted);
      setPdf({
        phase: "ready",
        progress: 1,
        message:
          `Extracted ${extracted.pages} page${extracted.pages === 1 ? "" : "s"} from ` +
          `${extracted.filename}${extracted.truncated ? " (trimmed to fit)" : ""}: ` +
          `${counts.native} native, ${counts.ocr} OCR` +
          (failed.length > 0 ? `, pages ${failed.join(", ")} failed` : "") +
          ". Review below, then use the text.",
        result: extracted,
      });
    } catch (err) {
      setPdf({
        phase: "error",
        progress: null,
        message: err instanceof Error ? err.message : String(err),
        result: null,
      });
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const handleAdoptPdf = () => {
    if (pdf.phase !== "ready" || !pdf.result || pdf.result.text.trim().length === 0) {
      return;
    }
    setPostingText(pdf.result.text);
    setTab("paste");
  };

  const handleDiscardPdf = () => {
    setPdfFile(null);
    setPdf({ phase: "idle", progress: null, message: "", result: null });
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file || ocr.phase === "uploading") {
      return;
    }
    const invalid = validateImageFile(file);
    if (invalid) {
      dispatchOcr({ type: "invalidate", message: invalid });
      return;
    }
    dispatchOcr({ type: "select", fileName: file.name });
    try {
      const extracted = await uploadImage(file, ocr.language, (fraction) => {
        dispatchOcr({ type: "progress", fraction });
      });
      dispatchOcr({ type: "extracted", result: extracted });
    } catch (err) {
      dispatchOcr({
        type: "failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (imageRef.current) {
        imageRef.current.value = "";
      }
    }
  };

  const handleUseOcrText = () => {
    if (ocr.phase !== "ready" || ocr.draft.trim().length === 0) {
      return;
    }
    setPostingText(ocr.draft);
    setTab("paste");
  };

  const handlePrivacyProgress = useCallback((reviewed: number, total: number) => {
    setPrivacyProgress((prev) =>
      prev && prev.reviewed === reviewed && prev.total === total
        ? prev
        : { reviewed, total },
    );
  }, []);

  const openPrivacyCheck = () => {
    if (postingText.trim().length === 0 || running) {
      return;
    }
    setPrivacySource(postingText);
    setPrivacyProgress(null);
    setPrivacyError(null);
    setPrivacyNonce((nonce) => nonce + 1);
    setPrivacyOpen(true);
  };

  const handlePrivacyApproved = (next: PrivacyApproval, sanitized: string) => {
    if (hashContent(postingText) !== hashContent(privacySource)) {
      setPrivacyError(
        'The text changed while you were reviewing. Press "Check privacy" again on the current text.',
      );
      return;
    }
    setApproval(next);
    setPostingText(sanitized);
    setPrivacyOpen(false);
    setPrivacyError(null);
  };

  const handleAnalyze = async () => {
    try {
      assertAnalysisAllowed(approval, postingText);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      return;
    }
    const model = ensureModel();
    if (!model || running) {
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
    setAnalysisSnapshot(null);
    setSaveMessage(null);
    setSavedId(null);
    const started = performance.now();
    try {
      const response = await model.generateContent(buildAnalyzerPrompt(postingText));
      const latencyMs = performance.now() - started;
      const rawText = response.response.text();
      const inferenceSource = String(response.response.inferenceSource ?? "unknown");
      const { data, parseError } = parseReport(rawText);
      setResult({ data, parseError, inferenceSource, latencyMs });
      setAnalysisSnapshot({ textHash: hashContent(postingText) });
    } catch (err) {
      setRunError(friendlyError(err));
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!user || !result?.data || saving) {
      return;
    }
    const resolution = resolveSavePayload({
      currentText: postingText,
      approval,
      analysis: analysisSnapshot,
    });
    if (!resolution.ok) {
      setSaveMessage(resolution.reason);
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const occupation = result.data.occupation.trim();
      const country = result.data.destination_country.trim();
      const title =
        occupation && occupation.toLowerCase() !== "not specified"
          ? `${occupation} — ${country || "unknown country"}`.slice(0, 120)
          : "Untitled opportunity";
      const saved = await saveInvestigation(db, {
        ownerId: user.uid,
        title,
        status: "reviewed",
        // Sanitized by construction: resolution only succeeds for the
        // approved text the report was generated from.
        postingText: resolution.postingText.trim(),
        report: result.data,
        inferenceSource: result.inferenceSource,
        latencyMs: Math.round(result.latencyMs),
        cloudModel: "",
        mode: "hybrid",
      });
      if (saved.ok) {
        setSavedId(saved.value);
        setSaveMessage("Saved to your investigations.");
      } else {
        setSaveMessage(saved.message);
      }
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review an opportunity</h1>
        <p className="mt-1 max-w-2xl leading-6 text-muted">
          Paste a job posting or upload it as a PDF. You get a structured review with
          quoted evidence — then you can save it as an investigation.
        </p>
      </div>

      {(!configOk || modelError) && (
        <Card title="Setup required">
          <p className="text-sm leading-6">
            {!configOk
              ? `Firebase isn't configured (missing: ${envProbe.missingConfigKeys.join(", ")}). `
              : `${modelError} `}
            Check <code className="font-mono">.env.local</code> and restart the dev server.
          </p>
        </Card>
      )}

      <Card title="Your input">
        <div className="flex items-center gap-2 text-sm">
          <StatusLabel
            tone={
              device.state === "ready"
                ? "ok"
                : device.state === "error"
                  ? "bad"
                  : device.state === "initializing"
                    ? "info"
                    : "idle"
            }
          >
            {device.message}
          </StatusLabel>
          {device.state !== "ready" && device.state !== "initializing" && (
            <Button variant="secondary" onClick={() => void handleInitDevice()} disabled={!configOk}>
              Enable on-device
            </Button>
          )}
        </div>
        {device.progress !== null && device.state === "initializing" && (
          <div
            className="mt-2 h-1.5 w-full rounded-full bg-brand-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(device.progress * 100)}
            aria-label="On-device model download progress"
          >
            <div
              className="h-1.5 rounded-full bg-brand"
              style={{ width: `${Math.round(device.progress * 100)}%` }}
            />
          </div>
        )}

        <div role="tablist" aria-label="Input method" className="mt-4 flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "paste"}
            onClick={() => setTab("paste")}
            className={`h-9 cursor-pointer rounded-md px-4 text-sm font-medium ${
              tab === "paste" ? "bg-brand-soft text-navy" : "hover:bg-brand-soft"
            }`}
          >
            Paste text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pdf"}
            onClick={() => setTab("pdf")}
            className={`h-9 cursor-pointer rounded-md px-4 text-sm font-medium ${
              tab === "pdf" ? "bg-brand-soft text-navy" : "hover:bg-brand-soft"
            }`}
          >
            Upload PDF
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "image"}
            onClick={() => setTab("image")}
            className={`h-9 cursor-pointer rounded-md px-4 text-sm font-medium ${
              tab === "image" ? "bg-brand-soft text-navy" : "hover:bg-brand-soft"
            }`}
          >
            Upload image
          </button>
        </div>

        {tab === "paste" && (
          <div role="tabpanel" className="mt-3">
            <label htmlFor="posting-text" className="block text-sm font-medium">
              Job posting text
            </label>
            <textarea
              id="posting-text"
              value={postingText}
              onChange={(event) => setPostingText(event.target.value)}
              rows={10}
              maxLength={60000}
              className="mt-1 w-full rounded-md border border-edge bg-card p-3 text-sm leading-7"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPostingText(SAMPLE_POSTING)}>
                Load sample
              </Button>
              <Button variant="ghost" onClick={() => setPostingText("")}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {tab === "pdf" && (
          <div role="tabpanel" className="mt-3">
            <div className="mb-3">
              <ContextualNotice>{UPLOAD_SENSITIVITY_NOTICE}</ContextualNotice>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Document language" htmlFor="pdf-language">
                <select
                  id="pdf-language"
                  value={pdfLanguage}
                  onChange={(event) =>
                    setPdfLanguage(event.target.value as OcrLanguage)
                  }
                  disabled={pdf.phase === "uploading"}
                  className="h-10 rounded-md border border-edge bg-card px-3 text-sm"
                >
                  {OCR_LANGUAGES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="PDF offer document"
                htmlFor="pdf-file"
                hint={`PDF up to 10 MB and 30 pages. Text pages extract directly; scanned pages are OCRed by the document service at ${apiBase()}. Thai and Vietnamese are not supported.`}
                error={pdf.phase === "error" ? pdf.message : null}
              >
                <input
                  ref={fileRef}
                  id="pdf-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                  className="w-full text-sm"
                />
              </Field>
            </div>
            {pdf.phase === "uploading" && (
              <div
                className="mt-2 h-1.5 w-full rounded-full bg-brand-soft"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pdf.progress === null ? undefined : Math.round(pdf.progress * 100)}
                aria-label="PDF upload progress"
              >
                <div
                  className="h-1.5 rounded-full bg-brand"
                  style={{ width: `${pdf.progress === null ? 100 : Math.round(pdf.progress * 100)}%` }}
                />
              </div>
            )}
            {pdf.message !== "" && pdf.phase !== "error" && (
              <p className="mt-2 text-sm" role="status">
                {pdf.message}
              </p>
            )}
            {pdf.phase === "ready" && pdf.result && (
              <div className="mt-3 flex flex-col gap-2">
                {(() => {
                  const summary = ocrConfidenceSummary(pdf.result);
                  if (!summary) {
                    return null;
                  }
                  const warn =
                    summary.meanConfidence < 0.9 || summary.lowLines > 0;
                  return (
                    <StatusLabel tone={warn ? "bad" : "ok"}>
                      {warn
                        ? `OCR on ${summary.ocrPages} page${summary.ocrPages === 1 ? "" : "s"} ` +
                          `(mean ${Math.round(summary.meanConfidence * 100)}%, ` +
                          `${summary.lowLines} low-confidence lines). Check figures carefully — ` +
                          "a high score does not guarantee correctness."
                        : `OCR mean confidence ${Math.round(summary.meanConfidence * 100)}% ` +
                          `across ${summary.ocrPages} page${summary.ocrPages === 1 ? "" : "s"}. ` +
                          "Always verify figures before analysis."}
                    </StatusLabel>
                  );
                })()}
                {failedPageNumbers(pdf.result).length > 0 && (
                  <p role="alert" className="text-sm leading-6">
                    <span className="font-semibold">Pages {failedPageNumbers(pdf.result).join(", ")} failed
                    extraction and were excluded.</span>{" "}
                    You can retry, or continue with the available pages.
                  </p>
                )}
                {(pdf.result.page_results ?? []).length > 0 && (
                  <ul className="flex max-h-44 flex-col gap-1 overflow-auto tabular-nums" aria-label="Per-page extraction results">
                    {(pdf.result.page_results ?? []).map((page) => (
                      <li key={page.page} className="flex flex-wrap items-center gap-2 text-sm">
                        <StatusLabel
                          tone={
                            page.status === "failed"
                              ? "bad"
                              : page.source === "ocr"
                                ? "info"
                                : page.source === "native_empty"
                                  ? "idle"
                                  : "ok"
                          }
                        >
                          {`Page ${page.page}: ${page.source === "native" ? "Text" : page.source === "ocr" ? `OCR${page.mean_confidence !== null ? ` ${Math.round(page.mean_confidence * 100)}%` : ""}` : page.source === "native_empty" ? "Blank" : "Failed"}`}
                        </StatusLabel>
                        {page.warning && <span className="text-xs text-muted">{page.warning}</span>}
                        {page.status === "failed" && page.failure_code && (
                          <span className="text-xs text-muted">({page.failure_code})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleAdoptPdf}
                    disabled={pdf.result.text.trim().length === 0}
                  >
                    Use this text
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void handleFile(pdfFile ?? undefined)}
                    disabled={!pdfFile}
                  >
                    Retry
                  </Button>
                  <Button variant="ghost" onClick={handleDiscardPdf}>
                    Discard
                  </Button>
                </div>
              </div>
            )}
            {pdf.phase === "error" && pdfFile && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  onClick={() => void handleFile(pdfFile ?? undefined)}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "image" && (
          <div role="tabpanel" className="mt-3">
            <div className="mb-3">
              <ContextualNotice>{UPLOAD_SENSITIVITY_NOTICE}</ContextualNotice>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Document language" htmlFor="ocr-language">
                <select
                  id="ocr-language"
                  value={ocr.language}
                  onChange={(event) =>
                    dispatchOcr({
                      type: "language",
                      language: event.target.value as OcrLanguage,
                    })
                  }
                  disabled={ocr.phase === "uploading"}
                  className="h-10 rounded-md border border-edge bg-card px-3 text-sm"
                >
                  {OCR_LANGUAGES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Image offer document"
                htmlFor="ocr-file"
                hint={`JPG or PNG up to 10 MB (max 8000 px per side). Text is extracted by the document service at ${apiBase()}. Thai and Vietnamese are not supported.`}
                error={
                  ocr.phase === "invalid" || ocr.phase === "error" ? ocr.message : null
                }
              >
                <input
                  ref={imageRef}
                  id="ocr-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(event) => void handleImageFile(event.target.files?.[0])}
                  className="w-full text-sm"
                />
              </Field>
            </div>
            {ocr.phase === "uploading" && (
              <div
                className="mt-2 h-1.5 w-full rounded-full bg-brand-soft"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  ocr.progress === null ? undefined : Math.round(ocr.progress * 100)
                }
                aria-label="Image upload and OCR progress"
              >
                <div
                  className="h-1.5 rounded-full bg-brand"
                  style={{
                    width: `${ocr.progress === null ? 100 : Math.round(ocr.progress * 100)}%`,
                  }}
                />
              </div>
            )}
            {ocr.message !== "" && ocr.phase === "ready" && (
              <p className="mt-2 text-sm" role="status">
                {ocr.message}
              </p>
            )}
            {ocr.phase === "ready" && ocr.result && (
              <div className="mt-3 flex flex-col gap-2">
                <StatusLabel
                  tone={shouldWarnLowConfidence(ocr.result) ? "bad" : "ok"}
                >
                  {shouldWarnLowConfidence(ocr.result)
                    ? `Low confidence on ${ocr.result.low_confidence_lines} of ${ocr.result.lines} lines ` +
                      `(mean ${Math.round(ocr.result.mean_confidence * 100)}%). Check figures, ` +
                      "names, and dates carefully — a high score does not guarantee correctness."
                    : `Mean confidence ${Math.round(ocr.result.mean_confidence * 100)}% across ` +
                      `${ocr.result.lines} lines. Always verify figures before analysis.`}
                </StatusLabel>
                <label htmlFor="ocr-draft" className="block text-sm font-medium">
                  Extracted text — review and correct
                </label>
                <textarea
                  id="ocr-draft"
                  value={ocr.draft}
                  onChange={(event) =>
                    dispatchOcr({ type: "edit", text: event.target.value })
                  }
                  rows={10}
                  maxLength={60000}
                  className="w-full rounded-md border border-edge bg-card p-3 text-sm leading-7"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleUseOcrText}
                    disabled={ocr.draft.trim().length === 0}
                  >
                    Use this text
                  </Button>
                  <Button variant="ghost" onClick={() => dispatchOcr({ type: "reset" })}>
                    Discard
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={() => void handleAnalyze()}
            disabled={
              !configOk ||
              running ||
              postingText.trim().length === 0 ||
              !analysisAllowed
            }
          >
            {running ? "Analyzing…" : "Analyze opportunity"}
          </Button>
          {!analysisAllowed && postingText.trim().length > 0 && (
            <p className="mt-2 text-sm text-muted" role="note">
              {gateState === "INVALIDATED"
                ? "The text changed since approval — run Privacy Check again before analysis."
                : "Run Privacy Check below and approve the text before analysis."}
            </p>
          )}
        </div>
        <p className="mt-2 text-sm text-muted" role="note">
          {REVIEW_PROCESSING_NOTICE}
        </p>
        <p aria-live="polite" className="mt-2 text-sm text-muted">
          {running ? "Reading the posting and preparing your review…" : ""}
        </p>
        {runError && (
          <p role="alert" className="mt-2 text-sm leading-6">
            <span className="font-semibold">Analysis failed:</span> {runError}
          </p>
        )}
      </Card>

      <Card
        title="Privacy Check"
        description="Required before analysis: review what looks personal, clean the text, and approve exactly what may be analyzed."
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusLabel tone={GATE_STATUS[gateState].tone}>
            {GATE_STATUS[gateState].label}
          </StatusLabel>
          {gateState === "APPROVED" && approval && (
            <span className="text-sm text-muted">
              {approval.redactedCount} redacted · {approval.replacedCount} replaced ·{" "}
              {approval.retainedCount} kept
            </span>
          )}
        </div>
        {privacyError && (
          <p role="alert" className="mt-2 text-sm leading-6">
            {privacyError}
          </p>
        )}
        {!privacyOpen ? (
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={openPrivacyCheck}
              disabled={running || postingText.trim().length === 0}
            >
              {approval ? "Check privacy again" : "Check privacy"}
            </Button>
            {postingText.trim().length === 0 && (
              <p className="mt-2 text-sm text-muted">
                Add posting text above first — paste it, upload a PDF, or upload an image.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <PrivacyCheckPanel
              key={privacyNonce}
              sourceText={privacySource}
              disclosureMode="prefer-on-device"
              onApproved={handlePrivacyApproved}
              onCancel={() => setPrivacyOpen(false)}
              onProgress={handlePrivacyProgress}
            />
          </div>
        )}
      </Card>

      <Card title="Review">
        {!result && (
          <EmptyState
            title="No review yet"
            description="Your structured review — summary, details, concerns, missing information, and next steps — appears here after analysis."
          />
        )}
        {result?.parseError && (
          <p role="alert" className="mb-3 text-sm leading-6">
            The review came back in an unexpected format. Please run the analysis again.
          </p>
        )}
        {result?.data && <AnalysisResults report={result.data} />}
        {result?.data && (
          <p className="mt-2 text-sm text-muted" role="status">
            {describeActualSource(result.inferenceSource).label}
          </p>
        )}
        {result?.data && (
          <>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
            <Button onClick={() => void handleSave()} disabled={saving || savedId !== null}>
              {saving ? "Saving…" : savedId ? "Saved" : "Save as investigation"}
            </Button>
            {saveMessage && (
              <span className="text-sm" role="status">
                {saveMessage}{" "}
                {savedId && (
                  <Link href={`/workspace/investigations/${savedId}`} className="text-brand underline">
                    Open report
                  </Link>
                )}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">
            Saves the approved text analyzed above, plus its report. Nothing is saved
            until you press this button.
          </p>
          </>
        )}
      </Card>
    </div>
  );
}
