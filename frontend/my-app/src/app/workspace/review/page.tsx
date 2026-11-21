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
import { ActivePill, Crossfade, Enter, ProgressBar } from "@/components/motion";
import PrivacyCheckPanel from "@/components/PrivacyCheckPanel";
import { Button, Card, EmptyState, Field, PageHeader, StatusLabel, Stepper } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getReviewProcessingNotice, getUploadSensitivityNotice } from "@/lib/disclaimer";
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
import { useLang } from "@/lib/lang";
import { format, getStrings, type UiLanguage, type UiStrings } from "@/lib/strings";
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

function gateStatus(t: UiStrings): Record<
  PrivacyGateState,
  { tone: "ok" | "bad" | "info" | "idle"; label: string }
> {
  return {
    NOT_STARTED: { tone: "idle", label: t.revGateNotStarted },
    SCANNING: { tone: "info", label: t.revGateScanning },
    REVIEW_REQUIRED: { tone: "info", label: t.revGateReviewing },
    READY_FOR_APPROVAL: { tone: "info", label: t.revGateReady },
    APPROVED: { tone: "ok", label: t.revGateApproved },
    INVALIDATED: { tone: "bad", label: t.revGateInvalidatedLabel },
  };
}

function friendlyError(err: unknown, language: UiLanguage): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check/i.test(message)) {
    return getStrings(language).commonAppCheckRequest;
  }
  return mapServiceError(message, language) ?? message;
}

export default function ReviewPage() {
  const { user } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [envProbe] = useState(() => probeFirebaseConfig());
  const [modelError, setModelError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceStatus>({
    state: "idle",
    progress: null,
    message: t.revDeviceIdle,
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
    setDevice({ state: "initializing", progress: 0, message: t.revDevicePreparing });
    try {
      await model.initializeDeviceModel((progressValue) => {
        setDevice((prev) => ({
          ...prev,
          progress: progressValue,
          message: format(t.revDeviceDownloading, {
            percent: String(Math.round(progressValue * 10000) / 100),
          }),
        }));
      });
      setDevice({ state: "ready", progress: 1, message: t.revDeviceReady });
    } catch (err) {
      setDevice({ state: "error", progress: null, message: friendlyError(err, language) });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || pdf.phase === "uploading") {
      return;
    }
    const invalid = validatePdfFile(file, language);
    if (invalid) {
      setPdf({ phase: "error", progress: null, message: invalid, result: null });
      return;
    }
    setPdfFile(file);
    setPdf({
      phase: "uploading",
      progress: 0,
      message: format(t.cmpUploadingFile, { name: file.name }),
      result: null,
    });
    try {
      const extracted = await uploadPdf(
        file,
        (fraction) => {
          setPdf((prev) => ({ ...prev, progress: fraction }));
        },
        pdfLanguage,
        undefined,
        language,
      );
      const counts = pdfSourceCounts(extracted);
      const failed = failedPageNumbers(extracted);
      setPdf({
        phase: "ready",
        progress: 1,
        message: format(t.revPdfExtracted, {
          pages: String(extracted.pages),
          pageWord: extracted.pages === 1 ? t.revOcrPageOne : t.revOcrPageMany,
          name: extracted.filename,
          trimmed: extracted.truncated ? t.revTrimmedSuffix : "",
          native: String(counts.native),
          nativeWord: t.revNativeWord,
          ocr: String(counts.ocr),
          failed:
            failed.length > 0
              ? format(t.cmpFailedSuffix, { pages: failed.join(", ") })
              : "",
          review: t.revReviewBelow,
        }),
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
    const invalid = validateImageFile(file, language);
    if (invalid) {
      dispatchOcr({ type: "invalidate", message: invalid });
      return;
    }
    dispatchOcr({ type: "select", fileName: file.name, language });
    try {
      const extracted = await uploadImage(
        file,
        ocr.language,
        (fraction) => {
          dispatchOcr({ type: "progress", fraction });
        },
        undefined,
        language,
      );
      dispatchOcr({ type: "extracted", result: extracted, language });
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
      setPrivacyError(t.revPrivacyChanged);
      return;
    }
    setApproval(next);
    setPostingText(sanitized);
    setPrivacyOpen(false);
    setPrivacyError(null);
  };

  const handleAnalyze = async () => {
    try {
      assertAnalysisAllowed(approval, postingText, language);
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
    // eslint-disable-next-line react-hooks/purity -- runs only in the analyze handler, never during render
    const started = performance.now();
    try {
      const response = await model.generateContent(buildAnalyzerPrompt(postingText));
      // eslint-disable-next-line react-hooks/purity -- runs only in the analyze handler, never during render
      const latencyMs = performance.now() - started;
      const rawText = response.response.text();
      const inferenceSource = String(response.response.inferenceSource ?? "unknown");
      const { data, parseError } = parseReport(rawText);
      setResult({ data, parseError, inferenceSource, latencyMs });
      setAnalysisSnapshot({ textHash: hashContent(postingText) });
    } catch (err) {
      setRunError(friendlyError(err, language));
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
      language,
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
          ? `${occupation} — ${country || t.revUnknownCountryTitle}`.slice(0, 120)
          : t.revUntitled;
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
        setSaveMessage(t.revSavedMessage);
      } else {
        setSaveMessage(saved.message);
      }
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const gateLabels = gateStatus(t);
  const hasInput = postingText.trim().length > 0;
  // Stepper reflects real gate state: input present, approval covering the
  // current text, and a generated report. No fabricated progress.
  const steps = [
    {
      label: t.revInputTitle,
      state: hasInput ? ("done" as const) : ("current" as const),
    },
    {
      label: t.revPrivacyTitle,
      state: !hasInput
        ? ("todo" as const)
        : analysisAllowed
          ? ("done" as const)
          : ("current" as const),
    },
    {
      label: t.revReviewTitle,
      state: result
        ? ("done" as const)
        : analysisAllowed
          ? ("current" as const)
          : ("todo" as const),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.wsSidebarAria}
        title={t.revTitle}
        description={t.revSubtitle}
      />
      <Stepper steps={steps} label={t.stepsAria} />

      {(!configOk || modelError) && (
        <Card title={t.commonSetupRequired}>
          <p className="text-sm leading-6">
            {!configOk
              ? `${format(t.commonSetupMissing, { keys: envProbe.missingConfigKeys.join(", ") })} `
              : `${modelError} `}
            {t.commonSetupCheckEnv}
          </p>
        </Card>
      )}

      <Card title={t.revInputTitle} eyebrow="01">
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
            {device.state === "idle" ? t.revDeviceIdle : device.message}
          </StatusLabel>
          {device.state !== "ready" && device.state !== "initializing" && (
            <Button variant="secondary" onClick={() => void handleInitDevice()} disabled={!configOk}>
              {t.revEnableDevice}
            </Button>
          )}
        </div>
        {device.progress !== null && device.state === "initializing" && (
          <ProgressBar value={device.progress} label={t.revDeviceProgressAria} />
        )}

        <div role="tablist" aria-label={t.revInputMethodAria} className="mt-4 flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "paste"}
            onClick={() => setTab("paste")}
            className={`relative h-9 cursor-pointer rounded-md px-4 text-sm font-medium ${
              tab === "paste" ? "text-navy" : "hover:bg-brand-soft"
            }`}
          >
            {tab === "paste" && <ActivePill pillId="oc-review-tabs" />}
            <span className="relative">{t.revTabPaste}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pdf"}
            onClick={() => setTab("pdf")}
            className={`relative h-9 cursor-pointer rounded-md px-4 text-sm font-medium ${
              tab === "pdf" ? "text-navy" : "hover:bg-brand-soft"
            }`}
          >
            {tab === "pdf" && <ActivePill pillId="oc-review-tabs" />}
            <span className="relative">{t.revTabPdf}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "image"}
            onClick={() => setTab("image")}
            className={`relative h-9 cursor-pointer rounded-md px-4 text-sm font-medium ${
              tab === "image" ? "text-navy" : "hover:bg-brand-soft"
            }`}
          >
            {tab === "image" && <ActivePill pillId="oc-review-tabs" />}
            <span className="relative">{t.revTabImage}</span>
          </button>
        </div>

        <Crossfade panelKey={tab}>
        {tab === "paste" && (
          <div role="tabpanel" className="mt-3">
            <label htmlFor="posting-text" className="block text-sm font-medium">
              {t.revPostingLabel}
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
                {t.revLoadSample}
              </Button>
              <Button variant="ghost" onClick={() => setPostingText("")}>
                {t.revClear}
              </Button>
            </div>
          </div>
        )}

        {tab === "pdf" && (
          <div role="tabpanel" className="mt-3">
            <div className="mb-3">
              <ContextualNotice>{getUploadSensitivityNotice(language)}</ContextualNotice>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t.revDocLanguage} htmlFor="pdf-language">
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
                label={t.revPdfLabel}
                htmlFor="pdf-file"
                hint={format(t.revPdfHint, { base: apiBase() })}
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
              <ProgressBar value={pdf.progress} label={t.revPdfProgressAria} />
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
                  const pageWord =
                    summary.ocrPages === 1 ? t.revOcrPageOne : t.revOcrPageMany;
                  return (
                    <StatusLabel tone={warn ? "bad" : "ok"}>
                      {warn
                        ? format(t.revOcrWarn, {
                            count: String(summary.ocrPages),
                            pageWord,
                            mean: String(Math.round(summary.meanConfidence * 100)),
                            low: String(summary.lowLines),
                          })
                        : format(t.revOcrMeanOk, {
                            mean: String(Math.round(summary.meanConfidence * 100)),
                            count: String(summary.ocrPages),
                            pageWord,
                          })}
                    </StatusLabel>
                  );
                })()}
                {failedPageNumbers(pdf.result).length > 0 && (
                  <p role="alert" className="text-sm leading-6">
                    <span className="font-semibold">
                      {format(t.revPagesFailed, { pages: failedPageNumbers(pdf.result).join(", ") })}
                    </span>{" "}
                    {t.revPagesFailedSuffix}
                  </p>
                )}
                {(pdf.result.page_results ?? []).length > 0 && (
                  <ul className="flex max-h-44 flex-col gap-1 overflow-auto tabular-nums" aria-label={t.revPerPageAria}>
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
                          {`${format(t.revPageLabel, { n: String(page.page) })}: ${page.source === "native" ? t.revPageText : page.source === "ocr" ? `${t.revPageOcr}${page.mean_confidence !== null ? ` ${Math.round(page.mean_confidence * 100)}%` : ""}` : page.source === "native_empty" ? t.revPageBlank : t.revPageFailed}`}
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
                    {t.commonUseThisText}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void handleFile(pdfFile ?? undefined)}
                    disabled={!pdfFile}
                  >
                    {t.commonRetry}
                  </Button>
                  <Button variant="ghost" onClick={handleDiscardPdf}>
                    {t.commonDiscard}
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
                  {t.commonRetry}
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "image" && (
          <div role="tabpanel" className="mt-3">
            <div className="mb-3">
              <ContextualNotice>{getUploadSensitivityNotice(language)}</ContextualNotice>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t.revDocLanguage} htmlFor="ocr-language">
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
                label={t.revImageLabel}
                htmlFor="ocr-file"
                hint={format(t.revImageHint, { base: apiBase() })}
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
              <ProgressBar value={ocr.progress} label={t.revImageProgressAria} />
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
                    ? format(t.revOcrLowWarn, {
                        low: String(ocr.result.low_confidence_lines),
                        lines: String(ocr.result.lines),
                        mean: String(Math.round(ocr.result.mean_confidence * 100)),
                      })
                    : format(t.revOcrLinesOk, {
                        mean: String(Math.round(ocr.result.mean_confidence * 100)),
                        lines: String(ocr.result.lines),
                      })}
                </StatusLabel>
                <label htmlFor="ocr-draft" className="block text-sm font-medium">
                  {t.revOcrDraftLabel}
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
                    {t.commonUseThisText}
                  </Button>
                  <Button variant="ghost" onClick={() => dispatchOcr({ type: "reset" })}>
                    {t.commonDiscard}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        </Crossfade>

        <div className="mt-5 border-t border-edge pt-5">
          <Button
            size="lg"
            onClick={() => void handleAnalyze()}
            disabled={
              !configOk ||
              running ||
              postingText.trim().length === 0 ||
              !analysisAllowed
            }
          >
            {running ? t.revAnalyzing : t.revAnalyze}
          </Button>
          {!analysisAllowed && postingText.trim().length > 0 && (
            <p className="mt-2 text-sm text-muted" role="note">
              {gateState === "INVALIDATED" ? t.revGateInvalidated : t.revGateNeeded}
            </p>
          )}
        </div>
        <p className="mt-2 text-sm text-muted" role="note">
          {getReviewProcessingNotice(language)}
        </p>
        <p aria-live="polite" className="mt-2 text-sm text-muted">
          {running ? t.revAnalyzingStatus : ""}
        </p>
        {runError && (
          <p role="alert" className="mt-2 text-sm leading-6">
            <span className="font-semibold">{t.revAnalysisFailed}</span> {runError}
          </p>
        )}
      </Card>

      <Card
        title={t.revPrivacyTitle}
        eyebrow="02"
        description={t.revPrivacyDesc}
        className={
          gateState === "INVALIDATED"
            ? "border-red-300 dark:border-red-900"
            : gateState === "REVIEW_REQUIRED" || gateState === "READY_FOR_APPROVAL"
              ? "border-brand/50"
              : ""
        }
      >
        <Crossfade panelKey={gateState}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel tone={gateLabels[gateState].tone}>
              {gateLabels[gateState].label}
            </StatusLabel>
            {gateState === "APPROVED" && approval && (
              <span className="text-sm text-muted">
                {approval.redactedCount} {t.revCountRedacted} · {approval.replacedCount}{" "}
                {t.revCountReplaced} · {approval.retainedCount} {t.revCountKept}
              </span>
            )}
          </div>
        </Crossfade>
        {privacyError && (
          <p role="alert" className="mt-2 text-sm leading-6">
            {privacyError}
          </p>
        )}
        <Crossfade panelKey={privacyOpen ? `open-${privacyNonce}` : "closed"}>
          {!privacyOpen ? (
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={openPrivacyCheck}
                disabled={running || postingText.trim().length === 0}
              >
                {approval ? t.revCheckAgain : t.commonCheckPrivacy}
              </Button>
              {postingText.trim().length === 0 && (
                <p className="mt-2 text-sm text-muted">{t.revAddTextFirst}</p>
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
        </Crossfade>
      </Card>

      <Card title={t.revReviewTitle} eyebrow="03">
        {!result && (
          <EmptyState title={t.revNoReviewTitle} description={t.revNoReviewDesc} />
        )}
        {result?.parseError && (
          <p role="alert" className="mb-3 text-sm leading-6">
            {t.revUnexpectedFormat}
          </p>
        )}
        {result?.data && (
          <Enter>
            <AnalysisResults report={result.data} />
          </Enter>
        )}
        {result?.data && (
          <p className="mt-2 text-sm text-muted" role="status">
            {describeActualSource(result.inferenceSource, language).label}
          </p>
        )}
        {result?.data && (
          <>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
            <Button onClick={() => void handleSave()} disabled={saving || savedId !== null}>
              {saving ? t.revSaving : savedId ? t.revSaved : t.revSaveAs}
            </Button>
            {saveMessage && (
              <span className="text-sm" role="status">
                {saveMessage}{" "}
                {savedId && (
                  <Link href={`/workspace/investigations/${savedId}`} className="text-brand underline">
                    {t.revOpenReport}
                  </Link>
                )}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">{t.revSaveNote}</p>
          </>
        )}
      </Card>
    </div>
  );
}
