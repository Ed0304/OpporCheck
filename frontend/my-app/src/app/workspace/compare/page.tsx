// Promise-to-Paper: compare job ads, recruiter messages, offer letters,
// and employment contracts.
//
// Transient by design: documents and results live in component state only
// and are never saved or sent anywhere except the selected AI inference
// path. Inference mode is explicit, and cloud processing of document text
// requires consent.

"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerativeModel } from "firebase/ai";
import { AnimatePresence, motion } from "motion/react";
import { DocSheet, DocStack } from "@/components/atelier";
import CompareReport, { type ReportDocument } from "@/components/CompareReport";
import { ContextualNotice } from "@/components/Disclaimer";
import { Crossfade, Enter, ProgressBar } from "@/components/motion";
import PrivacyCheckPanel from "@/components/PrivacyCheckPanel";
import { Button, Card, EmptyState, EvidenceQuote, Field, FilePicker, PageHeader, Spinner, StatusLabel, Stepper } from "@/components/ui";
import { getUploadSensitivityNotice } from "@/lib/disclaimer";
import {
  createExtractionModel,
  createPromiseComparisonModel,
  getInferenceModeInfo,
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
  completeExtractionRun,
  emptyDocPrivacy,
  failedPagesLimitation,
  failExtractionRun,
  getCompareCategoryLabels,
  getCompareDocTypeLabels,
  isDocPrivacyApproved,
  isPageApproved,
  recordPageApproval,
  toContractText,
  type CompareDocumentInput,
  type DocPrivacyState,
} from "@/lib/compareSession";
import { failedPageNumbers } from "@/lib/documents";
import { describeActualSource, type PrivacyApproval } from "@/lib/privacyGate";
import { useLang } from "@/lib/lang";
import { format, getStrings, type UiLanguage } from "@/lib/strings";
import { useReducedMotion } from "@/lib/useReducedMotion";
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

function friendlyError(err: unknown, mode: CompareInferenceMode, language: UiLanguage): string {
  const t = getStrings(language);
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check/i.test(message)) {
    return t.commonAppCheckRequest;
  }
  if (mode === "on-device-only" && /not (available|supported)|download|device/i.test(message)) {
    return t.cmpOnDeviceUnavailable;
  }
  return mapServiceError(message, language) ?? message;
}

export default function ComparePage() {
  const [envProbe] = useState(() => probeFirebaseConfig());
  const { language } = useLang();
  const t = getStrings(language);
  const docTypeLabels = getCompareDocTypeLabels(language);
  const categoryLabels = getCompareCategoryLabels(language);
  const modeInfo = getInferenceModeInfo(language);
  const configOk = envProbe.missingConfigKeys.length === 0;
  const [docs, setDocs] = useState<SessionDoc[]>([]);
  const [nextType, setNextType] = useState<ContractDocumentType>("employment_contract");
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [mode, setMode] = useState<CompareInferenceMode>("on-device-only");
  const [consent, setConsent] = useState(false);
  const [device, setDevice] = useState<DeviceStatus>({
    state: "idle",
    progress: null,
    message: t.cmpDeviceIdle,
  });
  const [extracting, setExtracting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [findings, setFindings] = useState<PromiseToPaperFinding[] | null>(null);
  const [droppedIssues, setDroppedIssues] = useState<string[]>([]);
  const [privacyTarget, setPrivacyTarget] = useState<PrivacyTarget | null>(null);
  const [comparisonSource, setComparisonSource] = useState<string | null>(null);

  const reducedMotion = useReducedMotion();
  const reportRef = useRef<HTMLDivElement>(null);
  const seenFindingsRef = useRef<PromiseToPaperFinding[] | null>(null);

  // Results transition into view only after a comparison actually
  // succeeds: findings is non-null solely on the success path.
  useEffect(() => {
    if (findings !== null && seenFindingsRef.current !== findings) {
      reportRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
    seenFindingsRef.current = findings;
  }, [findings, reducedMotion]);

  const idCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const modelsRef = useRef<Map<string, GenerativeModel>>(new Map());

  const makeDocId = (): string => {
    idCounter.current += 1;
    // eslint-disable-next-line react-hooks/purity -- runs only in event handlers, never during render
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
      setUploadMessage(format(t.cmpMaxDocs, { max: String(MAX_DOCS) }));
      return;
    }
    const invalid = validatePdfFile(file, language);
    if (invalid) {
      setUploadMessage(invalid);
      return;
    }
    setPdfName(file.name);
    setUploading(true);
    setUploadMessage(format(t.cmpUploadingFile, { name: file.name }));
    try {
      const extracted = await uploadPdf(file, () => {}, undefined, undefined, language);
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
        `${t.cmpAddedBefore} ${extracted.filename} (${extracted.pages} ` +
          `${extracted.pages === 1 ? t.revOcrPageOne : t.revOcrPageMany}` +
          `${failedPages.length > 0 ? format(t.cmpFailedSuffix, { pages: failedPages.join(", ") }) : ""}).`,
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
      setUploadMessage(format(t.cmpMaxDocs, { max: String(MAX_DOCS) }));
      return;
    }
    const text = pasteText.trim();
    if (text.length === 0) {
      setUploadMessage(t.cmpPasteEmpty);
      return;
    }
    const name = pasteName.trim() === "" ? t.cmpPastedDefaultName : pasteName.trim().slice(0, 120);
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
    setUploadMessage(format(t.cmpAddedName, { name }));
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
                  language,
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
    setDevice({ state: "initializing", progress: 0, message: t.revDevicePreparing });
    try {
      const model = ensureModel("extract");
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
      setDevice({ state: "error", progress: null, message: friendlyError(err, mode, language) });
    }
  };

  const gate = analysisGate(mode, { consent, deviceReady: device.state === "ready" }, language);
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
        setStatusMsg(format(t.cmpExtractingStatus, { name: doc.input.fileName }));
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
            language,
          );
          const text = toContractText({ ...doc.input, pages });
          const response = await model.generateContent(buildExtractionPrompt(text, language));
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
          const message = friendlyError(err, mode, language);
          setDocs((prev) =>
            prev.map((entry) =>
              entry.input.id === doc.input.id
                ? failExtractionRun(entry, message)
                : entry,
            ),
          );
          if (mode === "on-device-only") {
            setRunError(`${message} ${t.cmpNothingSent}`);
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
        approvedPagesOrThrow(doc.privacy, doc.input.pages, doc.input.fileName, language);
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      return;
    }
    setRunError(null);
    setFindings(null);
    setDroppedIssues([]);
    setComparisonSource(null);
    setComparing(true);
    setStatusMsg(t.cmpComparingStatus);
    try {
      const model = ensureModel("compare");
      const inputs: ComparisonInput[] = extractedDocs.map((doc) => ({
        documentId: doc.input.id,
        documentType: doc.input.documentType,
        fileName: doc.input.fileName,
        terms: doc.terms,
      }));
      // Validate against the same approved pages extraction used: terms and
      // excerpts derive from sanitized text, so originals would wrongly fail
      // attribution for every redacted region and drop the findings.
      const texts = extractedDocs.map((doc) =>
        toContractText({
          ...doc.input,
          pages: approvedPagesOrThrow(doc.privacy, doc.input.pages, doc.input.fileName, language),
        }),
      );
      const response = await model.generateContent(
        buildPromiseComparisonPrompt(inputs, language),
      );
      setComparisonSource(String(response.response.inferenceSource ?? "unknown"));
      const parsed = parsePromiseComparisonFindings(response.response.text(), texts);
      if (parsed.parseError) {
        setRunError(parsed.parseError);
        return;
      }
      setFindings(parsed.findings);
      setDroppedIssues(parsed.issues);
    } catch (err) {
      setRunError(friendlyError(err, mode, language));
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
      format(t.cmpTrimmedLimitation, { chars: EXTRACTION_MAX_CHARS.toLocaleString() }),
    );
  }
  if (extractedDocs.some((doc) => doc.pagesEstimated)) {
    limitations.push(t.cmpEstimatedLimitation);
  }
  for (const doc of extractedDocs) {
    const note = failedPagesLimitation(doc.input.fileName, doc.input.failedPages, language);
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
      format(t.cmpDroppedValidation, {
        count: String(extractionIssueCount),
        termWord: extractionIssueCount === 1 ? t.cmpExtractedTermOne : t.cmpExtractedTermMany,
        verb: extractionIssueCount === 1 ? t.cmpWas : t.cmpWere,
      }),
    );
  }

  // Stepper reflects real session state across the four required moves:
  // documents added, privacy approved, terms extracted, report generated.
  // Labels are short step names (the Stepper numbers them); the numbered
  // card titles below use the same order. No mock progress.
  const allDocsApproved =
    docs.length > 0 &&
    docs.every((doc) => isDocPrivacyApproved(doc.privacy, doc.input.pages));
  const extractionDone = extractedDocs.length > 0 && pendingDocs.length === 0;
  const compareSteps = [
    {
      label: t.cmpStepDocs,
      state: (docs.length === 0 ? "current" : "done") as "done" | "current" | "todo",
    },
    {
      label: t.revPrivacyTitle,
      state: (docs.length === 0
        ? "todo"
        : allDocsApproved
          ? "done"
          : "current") as "done" | "current" | "todo",
    },
    {
      label: t.cmpStepExtract,
      state: (!allDocsApproved
        ? "todo"
        : extractionDone
          ? "done"
          : "current") as "done" | "current" | "todo",
    },
    {
      label: t.cmpStepReport,
      state: (findings
        ? "done"
        : extractedDocs.length >= 2
          ? "current"
          : "todo") as "done" | "current" | "todo",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.wsSidebarAria}
        title={t.cmpTitle}
        description={t.cmpSubtitle}
      />
      <Stepper steps={compareSteps} label={t.stepsAria} />

      {(!configOk || runError) && (
        <Card title={runError ? t.cmpErrorTitle : t.commonSetupRequired}>
          <p className="text-sm leading-6" role={runError ? "alert" : undefined}>
            {runError ??
              `${format(t.commonSetupMissing, { keys: envProbe.missingConfigKeys.join(", ") })} ${t.commonSetupCheckEnv}`}
          </p>
        </Card>
      )}

      <Card
        title={t.cmpDocsTitle}
        eyebrow="01"
        description={format(t.cmpDocsDesc, { max: String(MAX_DOCS) })}
      >
        <div className="mb-3">
          <ContextualNotice>{getUploadSensitivityNotice(language)}</ContextualNotice>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t.cmpNextDocLabel} htmlFor="next-doc-type">
            <select
              id="next-doc-type"
              value={nextType}
              onChange={(event) => setNextType(event.target.value as ContractDocumentType)}
              className="h-10 rounded-md border border-edge bg-card px-3 text-sm"
            >
              {DOC_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {docTypeLabels[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t.cmpUploadPdf}
            htmlFor="compare-pdf"
            hint={format(t.cmpUploadPdfHint, { base: apiBase() })}
          >
            <FilePicker
              id="compare-pdf"
              accept=".pdf,application/pdf"
              disabled={uploading || running}
              onSelect={(file) => void handlePdf(file)}
              fileName={pdfName}
              chooseLabel={t.commonChooseFile}
              noFileLabel={t.commonNoFile}
              inputRef={fileRef}
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3">
          <Field label={t.cmpPasteLabel} htmlFor="compare-paste">
            <textarea
              id="compare-paste"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              rows={5}
              maxLength={PASTE_MAX_CHARS}
              placeholder={t.cmpPastePlaceholder}
              className="w-full rounded-md border border-edge bg-card p-3 text-sm leading-7"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t.cmpPasteNameLabel} htmlFor="paste-name">
              <input
                id="paste-name"
                type="text"
                value={pasteName}
                onChange={(event) => setPasteName(event.target.value)}
                placeholder={t.cmpPasteNamePlaceholder}
                maxLength={120}
                className="h-10 w-72 rounded-md border border-edge bg-card px-3 text-sm"
              />
            </Field>
            <Button variant="secondary" onClick={handlePasteAdd} disabled={uploading || running}>
              {t.cmpAddPasted}
            </Button>
          </div>
        </div>

        {uploadMessage && (
          <p className="mt-2 text-sm" role="status">
            {uploadMessage}
          </p>
        )}

        <div className="mt-4">
          <h3 className="font-semibold">
            {format(t.cmpAddedDocs, { count: String(docs.length) })}
          </h3>
          <Crossfade panelKey={docs.length === 0 ? "empty" : "docs"}>
            {docs.length === 0 ? (
              <EmptyState title={t.cmpNoDocsTitle} description={t.cmpNoDocsDesc} />
            ) : (
              <ul className="mt-2 grid gap-4 xl:grid-cols-2">
                <AnimatePresence initial={false}>
                {docs.map((doc) => (
                  <motion.li
                    key={doc.input.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    {/* Entrance plays on mount, which happens only after the
                        doc was actually added (pushDoc runs solely on the
                        upload/paste success paths). */}
                    <DocStack label={doc.input.fileName}>
                    <DocSheet
                      eyebrow={docTypeLabels[doc.input.documentType]}
                      title={doc.input.fileName}
                      meta={
                        <>
                          {doc.input.source === "pdf"
                            ? `${doc.input.pages.length} ${doc.input.pages.length === 1 ? t.revOcrPageOne : t.revOcrPageMany}`
                            : t.cmpPastedText}
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
                              ? format(t.cmpTermsExtracted, { count: String(doc.terms.length) })
                              : doc.status === "error"
                                ? t.cmpExtractionFailed
                                : doc.status === "extracting"
                                  ? t.cmpExtracting
                                  : t.cmpAwaitingExtraction}
                          </StatusLabel>
                        </>
                      }
                      actions={
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-sm">
                            <span className="sr-only">
                              {format(t.cmpDocTypeSr, { name: doc.input.fileName })}
                            </span>
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
                                  {docTypeLabels[option]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Button
                            variant="ghost"
                            onClick={() => removeDoc(doc.input.id)}
                            disabled={running}
                            aria-label={`${t.commonRemove} ${doc.input.fileName}`}
                          >
                            {t.commonRemove}
                          </Button>
                        </div>
                      }
                      selected={privacyTarget?.docId === doc.input.id}
                    >
                      <p className="mt-1 text-xs text-muted">
                        {format(t.cmpPrivacyPages, {
                          done: String(approvedPageCount(doc.privacy, doc.input.pages)),
                          total: String(doc.input.pages.length),
                        })}
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
                              aria-label={format(t.cmpPagePrivacyAria, {
                                action: done ? t.cmpRecheck : t.cmpCheck,
                                page: String(index + 1),
                                name: doc.input.fileName,
                              })}
                            >
                              {`${format(t.revPageLabel, { n: String(index + 1) })}${done ? " ✓" : ""}`}
                            </Button>
                          );
                        })}
                      </div>
                      {(doc.input.failedPages?.length ?? 0) > 0 && (
                        <p className="mt-1 text-sm" role="alert">
                          {format(t.revPagesFailed, { pages: (doc.input.failedPages ?? []).join(", ") })}
                        </p>
                      )}
                      {doc.error && (
                        <p className="mt-1 text-sm" role="alert">
                          {doc.error}
                        </p>
                      )}
                    </DocSheet>
                    </DocStack>
                  </motion.li>
                ))}
                </AnimatePresence>
              </ul>
            )}
          </Crossfade>
        </div>
      </Card>

      <AnimatePresence initial={false}>
        {privacyTarget && privacyTargetDoc && (
          <Enter
            key={`${privacyTarget.docId}:${privacyTarget.pageIndex}:${privacyTarget.nonce}`}
          >
            <Card
              title={format(t.cmpPrivacyTitle, {
                name: privacyTargetDoc.input.fileName,
                n: String(privacyTarget.pageIndex + 1),
              })}
              eyebrow={t.revPrivacyTitle}
              description={t.cmpPrivacyDesc}
            >
              <PrivacyCheckPanel
                key={`${privacyTarget.docId}:${privacyTarget.pageIndex}:${privacyTarget.nonce}`}
                sourceText={privacyTargetDoc.input.pages[privacyTarget.pageIndex] ?? ""}
                disclosureMode={mode}
                onApproved={handlePageApproved}
                onCancel={() => setPrivacyTarget(null)}
              />
            </Card>
          </Enter>
        )}
      </AnimatePresence>

      <Card title={t.cmpSettingsTitle} description={t.cmpSettingsDesc}>
        <div role="radiogroup" aria-label={t.cmpInferenceAria} className="flex flex-col gap-2">
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
                <span className="block text-sm font-medium">{modeInfo[option].label}</span>
                <span className="block text-sm text-muted">{modeInfo[option].dataNote}</span>
              </span>
            </label>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {mode === "prefer-on-device" && (
            <motion.label
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border border-edge p-3"
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                disabled={running}
                className="mt-1"
              />
              <span className="text-sm leading-6">
                <span className="font-medium">{t.cmpConsentTitle} </span>
                {t.cmpConsentBody}
              </span>
            </motion.label>
          )}
        </AnimatePresence>

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
            {device.state === "idle" ? t.cmpDeviceIdle : device.message}
          </StatusLabel>
          {device.state !== "ready" && device.state !== "initializing" && (
            <Button variant="secondary" onClick={() => void handlePrepareDevice()} disabled={!configOk || running}>
              {t.cmpPrepareDevice}
            </Button>
          )}
        </div>
        {device.progress !== null && device.state === "initializing" && (
          <ProgressBar value={device.progress} label={t.revDeviceProgressAria} />
        )}
      </Card>

      <Card title={t.cmpExtractTitle} eyebrow="03" description={t.cmpExtractDesc}>
        {extractedDocs.length === 0 && pendingDocs.length === 0 ? (
          <EmptyState title={t.cmpNothingTitle} description={t.cmpNothingDesc} />
        ) : (
          <>
            <ul className="flex flex-col gap-4">
              {docs.map((doc) => (
                <li key={doc.input.id}>
                  <h3 className="font-semibold">
                    {docTypeLabels[doc.input.documentType]} — {doc.input.fileName}
                  </h3>
                  {doc.status === "extracted" ? (
                    <>
                      {doc.terms.length === 0 ? (
                        <p className="mt-1 text-sm text-muted">
                          {t.cmpNoTerms}
                        </p>
                      ) : (
                        <ul className="mt-2 divide-y divide-edge">
                          {doc.terms.map((term, index) => (
                            <li key={`${term.category}-${index}`} className="py-3">
                              <p className="text-sm">
                                <span className="font-semibold">{categoryLabels[term.category]}: </span>
                                {term.claim}
                              </p>
                              <EvidenceQuote>&ldquo;{term.sourceExcerpt}&rdquo;</EvidenceQuote>
                              <p className="mt-1 text-xs text-muted">
                                {doc.input.source === "pdf"
                                  ? format(t.cmpPageRef, {
                                      n: String(term.documentReference.pageNumber),
                                    })
                                  : t.cmpPastedText}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                      {doc.missingCategories.length > 0 && (
                        <p className="mt-2 text-sm text-muted">
                          {format(t.cmpNotStated, {
                            cats: doc.missingCategories
                              .map((category) => categoryLabels[category])
                              .join(", "),
                          })}
                        </p>
                      )}
                      {doc.extractionIssues.length > 0 && (
                        <div className="mt-1 text-sm text-muted">
                          <p>
                            {doc.extractionIssues.length}{" "}
                            {doc.extractionIssues.length === 1 ? t.cmpTermOne : t.cmpTermMany}{" "}
                            {doc.extractionIssues.length === 1 ? t.cmpWas : t.cmpWere}{" "}
                            {t.cmpDroppedDuring}
                          </p>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[13px] font-medium text-brand">
                              {t.cmpDroppedDetails}
                            </summary>
                            <ul className="mt-1 list-disc pl-5 text-[13px] leading-6">
                              {doc.extractionIssues.map((issue, index) => (
                                <li key={`${index}-${issue.slice(0, 24)}`}>{issue}</li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      )}
                      <p className="mt-1 text-xs text-muted" role="status">
                        {describeActualSource(doc.inferenceSource, language).label}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {doc.status === "error"
                        ? format(t.cmpExtractionFailedLine, { error: doc.error ?? t.cmpUnknownError })
                        : t.cmpAwaitingLine}
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
                {extracting ? t.cmpExtractingButton : t.cmpExtractButton}
              </Button>
            </div>
            {!gate.allowed && (
              <p className="mt-2 text-sm" role="note">
                {gate.reason}
              </p>
            )}
            {gate.allowed && pendingDocs.length > 0 && !pendingPrivacyReady && (
              <p className="mt-2 text-sm text-muted" role="note">
                {t.cmpPrivacyNeeded}
              </p>
            )}
          </>
        )}
      </Card>

      <div ref={reportRef} className="scroll-mt-4">
      <Card title={t.cmpReportTitle} eyebrow="04" description={t.cmpReportDesc}>
        <p aria-live="polite" className="text-sm text-muted">
          {running ? statusMsg : ""}
        </p>
        {running && (
          <p className="mt-1">
            <Spinner label={statusMsg || t.commonWorking} />
          </p>
        )}
        <Crossfade panelKey={findings === null ? "empty" : "report"}>
        {findings === null ? (
          <div>
            <div className="mt-2">
              <EmptyState
                title={t.cmpNoComparisonTitle}
                description={
                  extractedDocs.length < 2
                    ? t.cmpNoComparisonNeedTwo
                    : t.cmpNoComparisonReady
                }
              />
            </div>
            <div className="mt-5 border-t border-edge pt-5">
              <Button
                size="lg"
                onClick={() => void handleCompare()}
                disabled={
                  !configOk || running || !gate.allowed || extractedDocs.length < 2
                }
              >
                {comparing ? t.cmpComparing : t.cmpGenerate}
              </Button>
            </div>
            {!gate.allowed && (
              <p className="mt-2 text-sm" role="note">
                {gate.reason}
              </p>
            )}
          </div>
        ) : (
          <div>
            {comparisonSource !== null && (
              <p className="mb-2 text-sm text-muted" role="status">
                {t.evComparisonPrefix}{" "}
                {describeActualSource(comparisonSource, language).label.toLowerCase()}
              </p>
            )}
            <CompareReport
              documents={reportDocs}
              findings={findings}
              droppedIssues={droppedIssues}
              limitations={limitations}
            />
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => void handleCompare()}
                disabled={!configOk || running || !gate.allowed}
              >
                {comparing ? t.cmpComparing : t.cmpRegenerate}
              </Button>
            </div>
          </div>
        )}
        </Crossfade>
      </Card>
      </div>
    </div>
  );
}
