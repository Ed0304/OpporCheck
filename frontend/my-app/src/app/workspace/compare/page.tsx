// Promise-to-Paper: compare job ads, recruiter messages, offer letters,
// and employment contracts.
//
// Transient by design: documents and results live in component state only
// and are never saved or sent anywhere except the selected AI inference
// path. Inference mode is explicit, and cloud processing of document text
// requires consent.

"use client";

import { useRef, useState } from "react";
import type { GenerativeModel } from "firebase/ai";
import CompareReport, { type ReportDocument } from "@/components/CompareReport";
import { ContextualNotice } from "@/components/Disclaimer";
import PrivacyCheckPanel from "@/components/PrivacyCheckPanel";
import { Button, Card, EmptyState, EvidenceQuote, Field, Spinner, StatusLabel } from "@/components/ui";
import { UPLOAD_SENSITIVITY_NOTICE } from "@/lib/disclaimer";
import {
  createExtractionModel,
  createPromiseComparisonModel,
  INFERENCE_MODE_INFO,
  parseExtraction,
  parsePromiseComparisonFindings,
  type CompareInferenceMode,
} from "@/lib/contractAI";
import {
  buildExtractionPrompt,
  buildPromiseComparisonPrompt,
  EXTRACTION_MAX_CHARS,
  formatDocumentPages,
  type ComparisonInput,
} from "@/lib/contractPrompts";
import type {
  ContractCategory,
  ContractDocumentType,
  EmploymentClaim,
  PromiseToPaperFinding,
} from "@/lib/contractTypes";
import {
  analysisGate,
  approvedPageCount,
  approvedPagesOrThrow,
  beginExtractionRun,
  COMPARE_DOC_TYPE_LABELS,
  completeExtractionRun,
  emptyDocPrivacy,
  failedPagesLimitation,
  failExtractionRun,
  isDocPrivacyApproved,
  isPageApproved,
  recordPageApproval,
  toContractText,
  type CompareDocumentInput,
  type DocPrivacyState,
} from "@/lib/compareSession";
import { failedPageNumbers } from "@/lib/documents";
import { describeActualSource, type PrivacyApproval } from "@/lib/privacyGate";
import { mapServiceError } from "@/lib/aiErrors";
import { apiBase, uploadPdf, validatePdfFile } from "@/lib/documents";
import { getFirebaseClient, probeFirebaseConfig } from "@/lib/firebaseClient";

const MAX_DOCS = 6;
const PASTE_MAX_CHARS = 60000;

const DOC_TYPE_OPTIONS: ContractDocumentType[] = [
  "job_advertisement",
  "recruiter_communication",
  "offer_letter",
  "employment_contract",
];

interface SessionDoc {
  input: CompareDocumentInput;
  /** True when page numbers came from a fallback instead of the backend. */
  pagesEstimated: boolean;
  status: "ready" | "extracting" | "extracted" | "error";
  error: string | null;
  terms: EmploymentClaim[];
  missingCategories: ContractCategory[];
  extractionIssues: string[];
  privacy: DocPrivacyState;
  /** Verbatim SDK inference source from extraction, null until a run. */
  inferenceSource: string | null;
}

interface PrivacyTarget {
  docId: string;
  pageIndex: number;
  nonce: number;
}

interface DeviceStatus {
  state: "idle" | "initializing" | "ready" | "error";
  progress: number | null;
  message: string;
}

function friendlyError(err: unknown, mode: CompareInferenceMode): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check/i.test(message)) {
    return (
      "The request was blocked by App Check. Register a localhost debug token " +
      "(see the model playground guide) and try again."
    );
  }
  if (mode === "on-device-only" && /not (available|supported)|download|device/i.test(message)) {
    return (
      "On-device analysis isn't available in this browser. Prepare on-device analysis, " +
      "or switch to cloud fallback with consent. Nothing was sent anywhere."
    );
  }
  return mapServiceError(message) ?? message;
}

export default function ComparePage() {
  const [envProbe] = useState(() => probeFirebaseConfig());
  const configOk = envProbe.missingConfigKeys.length === 0;
  const [docs, setDocs] = useState<SessionDoc[]>([]);
  const [nextType, setNextType] = useState<ContractDocumentType>("employment_contract");
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<CompareInferenceMode>("on-device-only");
  const [consent, setConsent] = useState(false);
  const [device, setDevice] = useState<DeviceStatus>({
    state: "idle",
    progress: null,
    message: "On-device analysis is not prepared yet.",
  });
  const [extracting, setExtracting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [findings, setFindings] = useState<PromiseToPaperFinding[] | null>(null);
  const [droppedCount, setDroppedCount] = useState(0);
  const [privacyTarget, setPrivacyTarget] = useState<PrivacyTarget | null>(null);
  const [comparisonSource, setComparisonSource] = useState<string | null>(null);

  const idCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const modelsRef = useRef<Map<string, GenerativeModel>>(new Map());

  const makeDocId = (): string => {
    idCounter.current += 1;
    return `doc-${Date.now().toString(36)}-${idCounter.current}`;
  };

  // Lazily created on user actions so Firebase initializes in event
  // handlers, never in mount effects. Keyed by purpose + mode.
  const ensureModel = (purpose: "extract" | "compare"): GenerativeModel => {
    const client = getFirebaseClient();
    const key = `${purpose}:${mode}:${client.cloudModelName}`;
    const cached = modelsRef.current.get(key);
    if (cached) {
      return cached;
    }
    const created =
      purpose === "extract"
        ? createExtractionModel(client.ai, client.cloudModelName, mode)
        : createPromiseComparisonModel(client.ai, client.cloudModelName, mode);
    modelsRef.current.set(key, created);
    return created;
  };

  const pushDoc = (input: CompareDocumentInput, pagesEstimated: boolean) => {
    setDocs((prev) => [
      ...prev,
      {
        input,
        pagesEstimated,
        status: "ready",
        error: null,
        terms: [],
        missingCategories: [],
        extractionIssues: [],
        privacy: emptyDocPrivacy(input.pages.length),
        inferenceSource: null,
      },
    ]);
    setFindings(null);
  };

  const handlePdf = async (file: File | undefined) => {
    if (!file || uploading) {
      return;
    }
    if (docs.length >= MAX_DOCS) {
      setUploadMessage(`This comparison already has ${MAX_DOCS} documents. Remove one first.`);
      return;
    }
    const invalid = validatePdfFile(file);
    if (invalid) {
      setUploadMessage(invalid);
      return;
    }
    setUploading(true);
    setUploadMessage(`Uploading ${file.name}…`);
    try {
      const extracted = await uploadPdf(file, () => {});
      const pages =
        extracted.page_texts.length > 0 ? extracted.page_texts : [extracted.text];
      const id = makeDocId();
      const failedPages = failedPageNumbers(extracted);
      const record: CompareDocumentInput = {
        id,
        fileName: extracted.filename,
        documentType: nextType,
        source: "pdf",
        pages,
        wasTrimmed:
          formatDocumentPages({
            documentId: id,
            documentType: nextType,
            fileName: extracted.filename,
            pages,
          }).length > EXTRACTION_MAX_CHARS,
        failedPages,
      };
      pushDoc(record, extracted.page_texts.length === 0);
      setUploadMessage(
        `Added ${extracted.filename} (${extracted.pages} page${extracted.pages === 1 ? "" : "s"}` +
          `${failedPages.length > 0 ? `, pages ${failedPages.join(", ")} failed` : ""}).`,
      );
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const handlePasteAdd = () => {
    if (docs.length >= MAX_DOCS) {
      setUploadMessage(`This comparison already has ${MAX_DOCS} documents. Remove one first.`);
      return;
    }
    const text = pasteText.trim();
    if (text.length === 0) {
      setUploadMessage("Paste some document text first.");
      return;
    }
    const name = pasteName.trim() === "" ? "Pasted text" : pasteName.trim().slice(0, 120);
    const pages = [text];
    pushDoc(
      {
        id: makeDocId(),
        fileName: name,
        documentType: nextType,
        source: "pasted",
        failedPages: [],
        pages,
        wasTrimmed:
          formatDocumentPages({
            documentId: "preview",
            documentType: nextType,
            fileName: name,
            pages,
          }).length > EXTRACTION_MAX_CHARS,
      },
      false,
    );
    setPasteText("");
    setPasteName("");
    setUploadMessage(`Added ${name}.`);
  };

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((doc) => doc.input.id !== id));
    setFindings(null);
    setPrivacyTarget((target) => (target && target.docId === id ? null : target));
  };

  const handlePageApproved = (approval: PrivacyApproval, sanitized: string) => {
    if (!privacyTarget) {
      return;
    }
    const target = privacyTarget;
    try {
      setDocs((prev) =>
        prev.map((doc) =>
          doc.input.id !== target.docId
            ? doc
            : {
                ...doc,
                privacy: recordPageApproval(
                  doc.privacy,
                  doc.input.pages.length,
                  target.pageIndex,
                  approval,
                  sanitized,
                  doc.input.pages[target.pageIndex] ?? "",
                ),
              },
        ),
      );
      setPrivacyTarget(null);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const changeDocType = (id: string, documentType: ContractDocumentType) => {
    setDocs((prev) =>
      prev.map((doc) =>
        doc.input.id !== id
          ? doc
          : {
              ...doc,
              input: { ...doc.input, documentType },
              status: "ready",
              error: null,
              terms: [],
              missingCategories: [],
              extractionIssues: [],
              inferenceSource: null,
            },
      ),
    );
    setFindings(null);
  };

  const handlePrepareDevice = async () => {
    setDevice({ state: "initializing", progress: 0, message: "Preparing on-device analysis…" });
    try {
      const model = ensureModel("extract");
      await model.initializeDeviceModel((progressValue) => {
        setDevice((prev) => ({
          ...prev,
          progress: progressValue,
          message: `Downloading on-device model: ${Math.round(progressValue * 10000) / 100}%`,
        }));
      });
      setDevice({ state: "ready", progress: 1, message: "On-device analysis is ready." });
    } catch (err) {
      setDevice({ state: "error", progress: null, message: friendlyError(err, mode) });
    }
  };

  const gate = analysisGate(mode, { consent, deviceReady: device.state === "ready" });
  const pendingDocs = docs.filter((doc) => doc.status === "ready" || doc.status === "error");
  const extractedDocs = docs.filter((doc) => doc.status === "extracted");
  const pendingPrivacyReady =
    pendingDocs.length > 0 &&
    pendingDocs.every((doc) => isDocPrivacyApproved(doc.privacy, doc.input.pages));
  const privacyTargetDoc = privacyTarget
    ? (docs.find((doc) => doc.input.id === privacyTarget.docId) ?? null)
    : null;

  const handleExtract = async () => {
    if (extracting || comparing || pendingDocs.length === 0) {
      return;
    }
    setRunError(null);
    setFindings(null);
    setExtracting(true);
    try {
      for (const doc of pendingDocs) {
        setStatusMsg(`Extracting terms from ${doc.input.fileName}…`);
        setDocs((prev) =>
          prev.map((entry) =>
            entry.input.id === doc.input.id ? beginExtractionRun(entry) : entry,
          ),
        );
        try {
          const model = ensureModel("extract");
          const pages = approvedPagesOrThrow(
            doc.privacy,
            doc.input.pages,
            doc.input.fileName,
          );
          const text = toContractText({ ...doc.input, pages });
          const response = await model.generateContent(buildExtractionPrompt(text));
          const source = String(response.response.inferenceSource ?? "unknown");
          const parsed = parseExtraction(response.response.text(), text);
          setDocs((prev) =>
            prev.map((entry) =>
              entry.input.id === doc.input.id
                ? {
                    ...completeExtractionRun(entry, source),
                    terms: parsed.terms,
                    missingCategories: parsed.missingCategories,
                    extractionIssues: parsed.issues,
                  }
                : entry,
            ),
          );
          if (parsed.parseError) {
            const message: string = parsed.parseError;
            setDocs((prev) =>
              prev.map((entry) =>
                entry.input.id === doc.input.id
                  ? failExtractionRun(entry, message)
                  : entry,
              ),
            );
          }
        } catch (err) {
          const message = friendlyError(err, mode);
          setDocs((prev) =>
            prev.map((entry) =>
              entry.input.id === doc.input.id
                ? failExtractionRun(entry, message)
                : entry,
            ),
          );
          if (mode === "on-device-only") {
            setRunError(`${message} Nothing was sent anywhere.`);
            break;
          }
        }
      }
    } finally {
      setExtracting(false);
      setStatusMsg("");
    }
  };

  const handleCompare = async () => {
    if (comparing || extracting || extractedDocs.length < 2) {
      return;
    }
    try {
      for (const doc of extractedDocs) {
        approvedPagesOrThrow(doc.privacy, doc.input.pages, doc.input.fileName);
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      return;
    }
    setRunError(null);
    setFindings(null);
    setDroppedCount(0);
    setComparisonSource(null);
    setComparing(true);
    setStatusMsg("Comparing terms across documents…");
    try {
      const model = ensureModel("compare");
      const inputs: ComparisonInput[] = extractedDocs.map((doc) => ({
        documentId: doc.input.id,
        documentType: doc.input.documentType,
        fileName: doc.input.fileName,
        terms: doc.terms,
      }));
      const texts = extractedDocs.map((doc) => toContractText(doc.input));
      const response = await model.generateContent(buildPromiseComparisonPrompt(inputs));
      setComparisonSource(String(response.response.inferenceSource ?? "unknown"));
      const parsed = parsePromiseComparisonFindings(response.response.text(), texts);
      if (parsed.parseError) {
        setRunError(parsed.parseError);
        return;
      }
      setFindings(parsed.findings);
      setDroppedCount(parsed.issues.length);
    } catch (err) {
      setRunError(friendlyError(err, mode));
    } finally {
      setComparing(false);
      setStatusMsg("");
    }
  };

  const running = extracting || comparing;
  const reportDocs: ReportDocument[] = extractedDocs.map((doc) => ({
    id: doc.input.id,
    fileName: doc.input.fileName,
    documentType: doc.input.documentType,
    source: doc.input.source,
    pageCount: doc.input.pages.length,
    wasTrimmed: doc.input.wasTrimmed,
    termCount: doc.terms.length,
  }));
  const limitations: string[] = [];
  if (extractedDocs.some((doc) => doc.input.wasTrimmed)) {
    limitations.push(
      `Documents longer than about ${EXTRACTION_MAX_CHARS.toLocaleString()} characters were trimmed; later clauses were not analyzed.`,
    );
  }
  if (extractedDocs.some((doc) => doc.pagesEstimated)) {
    limitations.push("Some page numbers are estimated because the extraction service returned no page breakdown.");
  }
  for (const doc of extractedDocs) {
    const note = failedPagesLimitation(doc.input.fileName, doc.input.failedPages);
    if (note) {
      limitations.push(note);
    }
  }
  const extractionIssueCount = extractedDocs.reduce(
    (count, doc) => count + doc.extractionIssues.length,
    0,
  );
  if (extractionIssueCount > 0) {
    limitations.push(
      `${extractionIssueCount} extracted term${extractionIssueCount === 1 ? " was" : "s were"} dropped during validation and ${extractionIssueCount === 1 ? "was" : "were"} not compared.`,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Promise-to-Paper</h1>
        <p className="mt-1 max-w-2xl leading-6 text-muted">
          Compare what was promised with what the written agreement says. Upload a
          contract, an offer letter, a job ad, or recruiter messages — any combination
          works. Documents stay in your browser session and are never saved.
        </p>
      </div>

      {(!configOk || runError) && (
        <Card title={runError ? "Something went wrong" : "Setup required"}>
          <p className="text-sm leading-6" role={runError ? "alert" : undefined}>
            {runError ??
              `Firebase isn't configured (missing: ${envProbe.missingConfigKeys.join(", ")}). Check .env.local and restart the dev server.`}
          </p>
        </Card>
      )}

      <Card
        title="1. Documents"
        description={`Add up to ${MAX_DOCS} PDFs or pasted texts, and label each one. Comparison needs at least two documents with extracted terms. Each page needs a Privacy Check before extraction.`}
      >
        <div className="mb-3">
          <ContextualNotice>{UPLOAD_SENSITIVITY_NOTICE}</ContextualNotice>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Next document is a" htmlFor="next-doc-type">
            <select
              id="next-doc-type"
              value={nextType}
              onChange={(event) => setNextType(event.target.value as ContractDocumentType)}
              className="h-10 rounded-md border border-edge bg-card px-3 text-sm"
            >
              {DOC_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {COMPARE_DOC_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Upload PDF"
            htmlFor="compare-pdf"
            hint={`PDF up to 10 MB and 30 pages via ${apiBase()}. Text pages extract directly; scanned pages are OCRed.`}
          >
            <input
              ref={fileRef}
              id="compare-pdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={uploading || running}
              onChange={(event) => void handlePdf(event.target.files?.[0])}
              className="text-sm"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3">
          <Field label="Or paste document text" htmlFor="compare-paste">
            <textarea
              id="compare-paste"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              rows={5}
              maxLength={PASTE_MAX_CHARS}
              placeholder="Paste a recruiter message, ad, offer, or contract clause…"
              className="w-full rounded-md border border-edge bg-card p-3 text-sm leading-7"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Pasted document name" htmlFor="paste-name">
              <input
                id="paste-name"
                type="text"
                value={pasteName}
                onChange={(event) => setPasteName(event.target.value)}
                placeholder="e.g. WhatsApp message from recruiter"
                maxLength={120}
                className="h-10 w-72 rounded-md border border-edge bg-card px-3 text-sm"
              />
            </Field>
            <Button variant="secondary" onClick={handlePasteAdd} disabled={uploading || running}>
              Add pasted text
            </Button>
          </div>
        </div>

        {uploadMessage && (
          <p className="mt-2 text-sm" role="status">
            {uploadMessage}
          </p>
        )}

        <div className="mt-4">
          <h3 className="font-semibold">Added documents ({docs.length})</h3>
          {docs.length === 0 ? (
            <EmptyState
              title="No documents yet"
              description="Upload a PDF or paste text above. You can start with just a contract, or any two document types."
            />
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {docs.map((doc) => (
                <li
                  key={doc.input.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-edge p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.input.fileName}</p>
                    <p className="text-xs text-muted">
                      {doc.input.source === "pdf"
                        ? `${doc.input.pages.length} page${doc.input.pages.length === 1 ? "" : "s"}`
                        : "pasted text"}
                      {" · "}
                      <StatusLabel
                        tone={
                          doc.status === "extracted"
                            ? "ok"
                            : doc.status === "error"
                              ? "bad"
                              : doc.status === "extracting"
                                ? "info"
                                : "idle"
                        }
                      >
                        {doc.status === "extracted"
                          ? `${doc.terms.length} terms extracted`
                          : doc.status === "error"
                            ? "extraction failed"
                            : doc.status === "extracting"
                              ? "extracting…"
                              : "awaiting extraction"}
                      </StatusLabel>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Privacy: {approvedPageCount(doc.privacy, doc.input.pages)}/
                      {doc.input.pages.length} pages approved
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {doc.input.pages.map((_, index) => {
                        const done = isPageApproved(doc.privacy, doc.input.pages, index);
                        return (
                          <Button
                            key={index}
                            variant="ghost"
                            disabled={running}
                            onClick={() =>
                              setPrivacyTarget({
                                docId: doc.input.id,
                                pageIndex: index,
                                nonce: Date.now(),
                              })
                            }
                            aria-label={`${done ? "Re-check" : "Check"} privacy for page ${index + 1} of ${doc.input.fileName}`}
                          >
                            {`Page ${index + 1}${done ? " ✓" : ""}`}
                          </Button>
                        );
                      })}
                    </div>
                    {(doc.input.failedPages?.length ?? 0) > 0 && (
                      <p className="mt-1 text-sm" role="alert">
                        Pages {(doc.input.failedPages ?? []).join(", ")} failed extraction
                        and were excluded.
                      </p>
                    )}
                    {doc.error && (
                      <p className="mt-1 text-sm" role="alert">
                        {doc.error}
                      </p>
                    )}
                  </div>
                  <label className="text-sm">
                    <span className="sr-only">Document type for {doc.input.fileName}</span>
                    <select
                      value={doc.input.documentType}
                      disabled={running}
                      onChange={(event) =>
                        changeDocType(doc.input.id, event.target.value as ContractDocumentType)
                      }
                      className="h-9 rounded-md border border-edge bg-card px-2 text-sm"
                    >
                      {DOC_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {COMPARE_DOC_TYPE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="ghost"
                    onClick={() => removeDoc(doc.input.id)}
                    disabled={running}
                    aria-label={`Remove ${doc.input.fileName}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {privacyTarget && privacyTargetDoc && (
        <Card
          title={`Privacy Check — ${privacyTargetDoc.input.fileName}, page ${privacyTarget.pageIndex + 1}`}
          description="Required before extraction: review what looks personal, clean the page, and approve exactly what may be analyzed."
        >
          <PrivacyCheckPanel
            key={`${privacyTarget.docId}:${privacyTarget.pageIndex}:${privacyTarget.nonce}`}
            sourceText={privacyTargetDoc.input.pages[privacyTarget.pageIndex] ?? ""}
            disclosureMode={mode}
            onApproved={handlePageApproved}
            onCancel={() => setPrivacyTarget(null)}
          />
        </Card>
      )}

      <Card
        title="2. Analysis settings"
        description="Contracts can contain sensitive information. Choose where analysis runs."
      >
        <div role="radiogroup" aria-label="Inference mode" className="flex flex-col gap-2">
          {(["on-device-only", "prefer-on-device"] as const).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-edge p-3 hover:bg-brand-soft"
            >
              <input
                type="radio"
                name="inference-mode"
                value={option}
                checked={mode === option}
                onChange={() => setMode(option)}
                disabled={running}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{INFERENCE_MODE_INFO[option].label}</span>
                <span className="block text-sm text-muted">{INFERENCE_MODE_INFO[option].dataNote}</span>
              </span>
            </label>
          ))}
        </div>

        {mode === "prefer-on-device" && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border border-edge p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={running}
              className="mt-1"
            />
            <span className="text-sm leading-6">
              <span className="font-medium">I consent to cloud processing. </span>
              My document text may be sent to the configured cloud model when on-device
              analysis is unavailable. I understand I can choose on-device-only instead.
            </span>
          </label>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
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
            <Button variant="secondary" onClick={() => void handlePrepareDevice()} disabled={!configOk || running}>
              Prepare on-device analysis
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
      </Card>

      <Card
        title="3. Extracted terms"
        description="Each document's employment terms, with the exact supporting excerpt for every term."
      >
        {extractedDocs.length === 0 && pendingDocs.length === 0 ? (
          <EmptyState
            title="Nothing to extract"
            description="Add documents above first. Extraction reads each document's employment terms into reviewable claims."
          />
        ) : (
          <>
            <ul className="flex flex-col gap-4">
              {docs.map((doc) => (
                <li key={doc.input.id}>
                  <h3 className="font-semibold">
                    {COMPARE_DOC_TYPE_LABELS[doc.input.documentType]} — {doc.input.fileName}
                  </h3>
                  {doc.status === "extracted" ? (
                    <>
                      {doc.terms.length === 0 ? (
                        <p className="mt-1 text-sm text-muted">
                          No employment terms were found in this document.
                        </p>
                      ) : (
                        <ul className="mt-2 divide-y divide-edge">
                          {doc.terms.map((term, index) => (
                            <li key={`${term.category}-${index}`} className="py-3">
                              <p className="text-sm">
                                <span className="font-semibold">{term.category}: </span>
                                {term.claim}
                              </p>
                              <EvidenceQuote>&ldquo;{term.sourceExcerpt}&rdquo;</EvidenceQuote>
                              <p className="mt-1 text-xs text-muted">
                                {doc.input.source === "pdf"
                                  ? `p. ${term.documentReference.pageNumber}`
                                  : "pasted text"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                      {doc.missingCategories.length > 0 && (
                        <p className="mt-2 text-sm text-muted">
                          Not stated in this document: {doc.missingCategories.join(", ")}. Missing
                          means unverified — not false.
                        </p>
                      )}
                      {doc.extractionIssues.length > 0 && (
                        <p className="mt-1 text-sm text-muted">
                          {doc.extractionIssues.length} term
                          {doc.extractionIssues.length === 1 ? " was" : "s were"} dropped during
                          validation.
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted" role="status">
                        {describeActualSource(doc.inferenceSource).label}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {doc.status === "error"
                        ? `Extraction failed: ${doc.error ?? "unknown error"}`
                        : "Awaiting extraction."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button
                onClick={() => void handleExtract()}
                disabled={
                  !configOk ||
                  running ||
                  !gate.allowed ||
                  pendingDocs.length === 0 ||
                  !pendingPrivacyReady
                }
              >
                {extracting ? "Extracting…" : "Extract employment terms"}
              </Button>
            </div>
            {!gate.allowed && (
              <p className="mt-2 text-sm" role="note">
                {gate.reason}
              </p>
            )}
            {gate.allowed && pendingDocs.length > 0 && !pendingPrivacyReady && (
              <p className="mt-2 text-sm text-muted" role="note">
                Approve every page&apos;s Privacy Check above before extraction.
              </p>
            )}
          </>
        )}
      </Card>

      <Card
        title="4. Comparison report"
        description="What matches, what differs, what the written agreement never addresses, and what to ask before signing."
      >
        <p aria-live="polite" className="text-sm text-muted">
          {running ? statusMsg : ""}
        </p>
        {running && (
          <p className="mt-1">
            <Spinner label={statusMsg || "Working…"} />
          </p>
        )}
        {findings === null ? (
          <>
            <div className="mt-2">
              <EmptyState
                title="No comparison yet"
                description={
                  extractedDocs.length < 2
                    ? "Extract terms from at least two documents to compare them."
                    : "Terms are extracted. Generate the comparison when ready."
                }
              />
            </div>
            <div className="mt-4">
              <Button
                onClick={() => void handleCompare()}
                disabled={
                  !configOk || running || !gate.allowed || extractedDocs.length < 2
                }
              >
                {comparing ? "Comparing…" : "Generate comparison"}
              </Button>
            </div>
            {!gate.allowed && (
              <p className="mt-2 text-sm" role="note">
                {gate.reason}
              </p>
            )}
          </>
        ) : (
          <>
            {comparisonSource !== null && (
              <p className="mb-2 text-sm text-muted" role="status">
                Comparison {describeActualSource(comparisonSource).label.toLowerCase()}
              </p>
            )}
            <CompareReport
              documents={reportDocs}
              findings={findings}
              droppedCount={droppedCount}
              limitations={limitations}
            />
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => void handleCompare()}
                disabled={!configOk || running || !gate.allowed}
              >
                {comparing ? "Comparing…" : "Regenerate comparison"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
