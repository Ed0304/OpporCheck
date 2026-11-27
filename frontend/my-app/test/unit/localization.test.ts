// Localization getter tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert that every owner-module get*(language) getter returns
// the canonical English wording for "en" and a non-empty Indonesian
// working draft for "id". Canonical English wording itself stays asserted
// verbatim by the existing module tests (productTrust, privacyGate, ...).

import assert from "node:assert/strict";
import test from "node:test";
import { mapServiceError } from "../../src/lib/aiErrors";
import {
  analysisGate,
  COMPARE_CATEGORY_LABELS,
  COMPARE_DOC_TYPE_LABELS,
  failedPagesLimitation,
  getCompareCategoryLabels,
  getCompareDocTypeLabels,
} from "../../src/lib/compareSession";
import {
  ANALYSIS_CONTEXT_NOTICE,
  COMPARISON_CONTEXT_NOTICE,
  CONCISE_NOTICE,
  FULL_DISCLAIMER_PARAGRAPHS,
  INVESTIGATION_CONTEXT_NOTICE,
  REVIEW_PROCESSING_NOTICE,
  UPLOAD_PII_WARNING,
  UPLOAD_SENSITIVITY_NOTICE,
  getAnalysisContextNotice,
  getComparisonContextNotice,
  getConciseNotice,
  getFullDisclaimerParagraphs,
  getInvestigationContextNotice,
  getReviewProcessingNotice,
  getUploadPiiWarning,
  getUploadSensitivityNotice,
} from "../../src/lib/disclaimer";
import {
  BACKEND_UNAUTHORIZED_MESSAGE,
  BACKEND_UNAUTHORIZED_MESSAGE_ID,
  backendErrorMessage,
  uploadImage,
  validateImageFile,
  validatePdfFile,
  type OcrResult,
  type XhrLike,
} from "../../src/lib/documents";
import { initialOcrState, ocrReducer } from "../../src/lib/ocrReview";
import {
  CATEGORY_TITLES,
  detectSensitiveInfo,
  getCategoryTitles,
} from "../../src/lib/privacyDetection";
import {
  assertAnalysisAllowed,
  createApproval,
  describeActualSource,
  describeInference,
  resolveSavePayload,
} from "../../src/lib/privacyGate";
import { addManualSpan, startReview } from "../../src/lib/privacyReview";
import {
  ASSESSMENT_LABELS,
  COMPARISON_STATUS_LABELS,
  MISSING_INFO_LABEL,
  UNVERIFIED_PHRASE,
  getAssessmentLabels,
  getComparisonStatusLabels,
  getMissingInfoLabel,
  getUnverifiedPhrase,
} from "../../src/lib/reportLanguage";

test("report-language getters keep canonical English and draft Indonesian", () => {
  assert.deepEqual(getAssessmentLabels("en"), ASSESSMENT_LABELS);
  assert.deepEqual(getComparisonStatusLabels("en"), COMPARISON_STATUS_LABELS);
  assert.equal(getMissingInfoLabel("en"), MISSING_INFO_LABEL);
  assert.equal(getUnverifiedPhrase("en"), UNVERIFIED_PHRASE);
  for (const label of Object.values(getAssessmentLabels("id"))) {
    assert.ok(label.length > 0);
  }
  for (const label of Object.values(getComparisonStatusLabels("id"))) {
    assert.ok(label.length > 0);
  }
  assert.ok(getMissingInfoLabel("id").length > 0);
  assert.ok(getUnverifiedPhrase("id").length > 0);
  assert.equal(getAssessmentLabels("id")["insufficient-evidence"], "Bukti tidak cukup");
  assert.equal(getComparisonStatusLabels("id").consistent, "Konsisten");
});

test("disclaimer getters keep canonical English and draft Indonesian", () => {
  assert.deepEqual(getFullDisclaimerParagraphs("en"), FULL_DISCLAIMER_PARAGRAPHS);
  assert.equal(getConciseNotice("en"), CONCISE_NOTICE);
  assert.equal(getAnalysisContextNotice("en"), ANALYSIS_CONTEXT_NOTICE);
  assert.equal(getComparisonContextNotice("en"), COMPARISON_CONTEXT_NOTICE);
  assert.equal(getInvestigationContextNotice("en"), INVESTIGATION_CONTEXT_NOTICE);
  assert.equal(getUploadSensitivityNotice("en"), UPLOAD_SENSITIVITY_NOTICE);
  assert.equal(getUploadPiiWarning("en"), UPLOAD_PII_WARNING);
  assert.equal(getReviewProcessingNotice("en"), REVIEW_PROCESSING_NOTICE);
  assert.equal(getFullDisclaimerParagraphs("id").length, 4);
  for (const paragraph of getFullDisclaimerParagraphs("id")) {
    assert.ok(paragraph.length > 0);
  }
  for (const notice of [
    getConciseNotice("id"),
    getAnalysisContextNotice("id"),
    getComparisonContextNotice("id"),
    getInvestigationContextNotice("id"),
    getUploadSensitivityNotice("id"),
    getUploadPiiWarning("id"),
    getReviewProcessingNotice("id"),
  ]) {
    assert.ok(notice.length > 0);
  }
});

test("compare-session getters and gate messages localize", () => {
  assert.deepEqual(getCompareCategoryLabels("en"), COMPARE_CATEGORY_LABELS);
  assert.deepEqual(getCompareDocTypeLabels("en"), COMPARE_DOC_TYPE_LABELS);
  assert.deepEqual(
    Object.keys(getCompareCategoryLabels("id")).sort(),
    Object.keys(COMPARE_CATEGORY_LABELS).sort(),
  );
  assert.deepEqual(
    Object.keys(getCompareDocTypeLabels("id")).sort(),
    Object.keys(COMPARE_DOC_TYPE_LABELS).sort(),
  );
  const gated = analysisGate("prefer-on-device", { consent: false, deviceReady: false }, "id");
  assert.equal(gated.allowed, false);
  assert.ok((gated.reason ?? "").length > 0);
  assert.ok(
    (failedPagesLimitation("a.pdf", [2], "id") ?? "").includes("a.pdf"),
  );
  assert.equal(failedPagesLimitation("a.pdf", [], "id"), null);
});

test("privacy-gate disclosures and errors localize", () => {
  assert.equal(describeInference("prefer-on-device", "en").destination, "On-device when available, cloud fallback");
  assert.ok(describeInference("prefer-on-device", "id").destination.length > 0);
  assert.ok(describeInference("on-device-only", "id").processingNote.length > 0);
  assert.equal(describeActualSource("on_device", "en").label, "Processed on-device.");
  assert.ok(describeActualSource("on_device", "id").label.length > 0);
  assert.equal(describeActualSource("bogus", "id").known, false);

  const approval = createApproval({
    sanitizedText: "hello",
    redactedCount: 0,
    replacedCount: 0,
    retainedCount: 0,
  });
  assert.throws(() => assertAnalysisAllowed(null, "hello", "id"), /Persetujuan/);
  assert.throws(() => assertAnalysisAllowed(approval, "changed", "id"), /berubah/);
  const missing = resolveSavePayload({ currentText: "hello", approval: null, analysis: null, language: "id" });
  assert.equal(missing.ok, false);
  assert.ok(missing.ok === false && missing.reason.length > 0);
  const stale = resolveSavePayload({ currentText: "changed", approval, analysis: { textHash: approval.textHash }, language: "id" });
  assert.equal(stale.ok, false);
});

test("privacy category titles localize", () => {
  assert.deepEqual(getCategoryTitles("en"), CATEGORY_TITLES);
  assert.deepEqual(Object.keys(getCategoryTitles("id")).sort(), Object.keys(CATEGORY_TITLES).sort());
  for (const title of Object.values(getCategoryTitles("id"))) {
    assert.ok(title.length > 0);
  }
});

test("manual-span errors localize", () => {
  const state = startReview("hello world", []);
  const empty = addManualSpan(state, 3, 3, null, "id");
  assert.equal(empty.ok, false);
  assert.ok(empty.ok === false && empty.error.length > 0);
  const english = addManualSpan(state, 3, 3);
  assert.deepEqual(english, { ok: false, error: "Select at least one character to redact." });
});

test("service-error and file-validation messages localize", () => {
  assert.equal(
    mapServiceError("429 quota exceeded", "en"),
    "The AI service is busy or temporarily unavailable. Wait a moment and try again — your text is unchanged.",
  );
  assert.ok((mapServiceError("429 quota exceeded", "id") ?? "").length > 0);
  assert.equal(mapServiceError("something else", "id"), null);
  const pdf = { name: "notes.txt", type: "text/plain", size: 10 } as File;
  assert.ok((validatePdfFile(pdf, "en") ?? "").includes(".pdf"));
  assert.ok((validatePdfFile(pdf, "id") ?? "").length > 0);
  assert.equal(validatePdfFile({ name: "a.pdf", type: "application/pdf", size: 10 } as File, "id"), null);
  const image = { name: "scan.pdf", type: "application/pdf", size: 10 } as File;
  assert.ok((validateImageFile(image, "id") ?? "").length > 0);
});

test("detection labels and reasons localize with identical spans", () => {
  const text = "Contact me at applicant@example.com or passport number AB123456.";
  const en = detectSensitiveInfo(text);
  const labels = en.detections.map((detection) => detection.label);
  assert.ok(labels.includes("Email address"));
  assert.ok(labels.includes("Passport number"));
  const id = detectSensitiveInfo(text, "id");
  assert.equal(id.detections.length, en.detections.length);
  assert.deepEqual(
    id.detections.map((detection) => detection.label).sort(),
    ["Alamat email", "Nomor paspor"],
  );
  for (const [index, detection] of id.detections.entries()) {
    assert.ok(detection.reason.length > 0);
    // Only the display strings change: spans, placeholders, and
    // confidence stay identical across languages.
    assert.equal(detection.start, en.detections[index]?.start);
    assert.equal(detection.end, en.detections[index]?.end);
    assert.equal(detection.placeholder, en.detections[index]?.placeholder);
    assert.equal(detection.confidence, en.detections[index]?.confidence);
  }
});

test("OCR reducer status messages localize", () => {
  const selected = ocrReducer(initialOcrState(), { type: "select", fileName: "a.png" });
  assert.match(selected.message, /Uploading a\.png/);
  const selectedId = ocrReducer(initialOcrState(), {
    type: "select",
    fileName: "a.png",
    language: "id",
  });
  assert.match(selectedId.message, /Mengunggah a\.png/);
  const result: OcrResult = {
    filename: "scan.png",
    text: "Basic pay",
    pages: 1,
    truncated: false,
    page_texts: ["Basic pay"],
    source: "ocr",
    language: "en",
    lines: 1,
    mean_confidence: 0.99,
    low_confidence_lines: 0,
  };
  const extracted = ocrReducer(
    { ...initialOcrState(), phase: "uploading" },
    { type: "extracted", result },
  );
  assert.match(extracted.message, /Extracted 1 line/);
  const extractedId = ocrReducer(
    { ...initialOcrState(), phase: "uploading" },
    { type: "extracted", result, language: "id" },
  );
  assert.match(extractedId.message, /Mengekstrak 1 baris/);
  assert.match(extractedId.message, /scan\.png/);
});

class FakeXhr implements XhrLike {
  upload: XhrLike["upload"] = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 0;
  responseText = "";

  open(): void {}

  send(): void {}

  respond(status: number, body: string): void {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }

  fail(): void {
    this.onerror?.();
  }
}

async function settled(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("document transport errors localize", async () => {
  assert.equal(
    backendErrorMessage(401, "Missing token.", "Upload failed.", "en"),
    BACKEND_UNAUTHORIZED_MESSAGE,
  );
  assert.equal(
    backendErrorMessage(401, "Missing token.", "Pengunggahan gagal.", "id"),
    BACKEND_UNAUTHORIZED_MESSAGE_ID,
  );
  // Server-provided messages always pass through untouched.
  assert.equal(
    backendErrorMessage(400, "Too large.", "Pengunggahan gagal.", "id"),
    "Too large.",
  );
  const file = new File([new Uint8Array(8)], "scan.png", { type: "image/png" });

  const bad = new FakeXhr();
  const pendingBad = uploadImage(file, "en", () => {}, () => bad, "id");
  await settled();
  bad.respond(200, "not json{{{");
  await assert.rejects(pendingBad, /tidak terbaca/);

  const failed = new FakeXhr();
  const pendingFailed = uploadImage(file, "en", () => {}, () => failed, "id");
  await settled();
  failed.respond(500, JSON.stringify({}));
  await assert.rejects(pendingFailed, /Pengunggahan gagal/);

  const offline = new FakeXhr();
  const pendingOffline = uploadImage(file, "en", () => {}, () => offline, "id");
  await settled();
  offline.fail();
  await assert.rejects(pendingOffline, /Tidak dapat menghubungi/);
});
