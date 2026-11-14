"use client";

// Review an opportunity: paste text or upload a PDF, analyze with the
// existing hybrid AI Logic analyzer, and save as an investigation.
// Plain-language UI: no model IDs, inference modes, latency, or raw JSON.

import Link from "next/link";
import { useRef, useState } from "react";
import {
  getGenerativeModel,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import AnalysisResults from "@/components/AnalysisResults";
import { Button, Card, EmptyState, Field, StatusLabel } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { apiBase, uploadPdf, validatePdfFile } from "@/lib/documents";
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

type InputTab = "paste" | "pdf";

interface DeviceStatus {
  state: "idle" | "initializing" | "ready" | "error";
  progress: number | null;
  message: string;
}

interface PdfStatus {
  phase: "idle" | "uploading" | "ready" | "error";
  progress: number | null;
  message: string;
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

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check/i.test(message)) {
    return (
      "The request was blocked by App Check. Register a localhost debug token " +
      "(see the model playground guide) and try again."
    );
  }
  return message;
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
  const [pdf, setPdf] = useState<PdfStatus>({ phase: "idle", progress: null, message: "" });
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const modelRef = useRef<GenerativeModel | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const configOk = envProbe.missingConfigKeys.length === 0;

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
    if (!file) {
      return;
    }
    const invalid = validatePdfFile(file);
    if (invalid) {
      setPdf({ phase: "error", progress: null, message: invalid });
      return;
    }
    setPdf({ phase: "uploading", progress: 0, message: `Uploading ${file.name}…` });
    try {
      const extracted = await uploadPdf(file, (fraction) => {
        setPdf((prev) => ({ ...prev, progress: fraction }));
      });
      setPostingText(extracted.text);
      setTab("paste");
      setPdf({
        phase: "ready",
        progress: 1,
        message:
          `Extracted ${extracted.pages} page${extracted.pages === 1 ? "" : "s"} from ` +
          `${extracted.filename}${extracted.truncated ? " (trimmed to fit)" : ""}. ` +
          "Review the text below, then analyze.",
      });
    } catch (err) {
      setPdf({
        phase: "error",
        progress: null,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleAnalyze = async () => {
    const model = ensureModel();
    if (!model || running) {
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
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
        postingText: postingText.trim(),
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
              className="mt-1 w-full rounded-md border border-edge bg-card p-3 text-sm leading-6"
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
            <Field
              label="PDF offer document"
              htmlFor="pdf-file"
              hint={`PDF up to 10 MB. Text is extracted by the document service at ${apiBase()}. Scanned PDFs without embedded text are not supported.`}
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
          </div>
        )}

        <div className="mt-4">
          <Button onClick={() => void handleAnalyze()} disabled={!configOk || running || postingText.trim().length === 0}>
            {running ? "Analyzing…" : "Analyze opportunity"}
          </Button>
        </div>
        <p aria-live="polite" className="mt-2 text-sm text-muted">
          {running ? "Reading the posting and preparing your review…" : ""}
        </p>
        {runError && (
          <p role="alert" className="mt-2 text-sm leading-6">
            <span className="font-semibold">Analysis failed:</span> {runError}
          </p>
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
        )}
      </Card>
    </div>
  );
}
