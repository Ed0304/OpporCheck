// OCR review reducer tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Drives the image-tab state machine: selection, validation errors,
// upload progress, extraction results, text correction, language
// switching, and reset. Submission itself stays a page-level explicit
// action and is covered by asserting the draft it would submit.

import assert from "node:assert/strict";
import test from "node:test";
import type { OcrResult } from "../../src/lib/documents";
import { initialOcrState, ocrReducer } from "../../src/lib/ocrReview";

function sampleResult(): OcrResult {
  return {
    filename: "scan.png",
    text: "Basic pay: GBP 11.50 per hour",
    pages: 1,
    truncated: false,
    page_texts: ["Basic pay: GBP 11.50 per hour"],
    source: "ocr",
    language: "en",
    lines: 1,
    mean_confidence: 0.99,
    low_confidence_lines: 0,
  };
}

test("select starts uploading and clears previous results", () => {
  const state = ocrReducer(initialOcrState(), { type: "select", fileName: "a.png" });
  assert.equal(state.phase, "uploading");
  assert.equal(state.progress, 0);
  assert.match(state.message, /Uploading a\.png/);
  assert.equal(state.result, null);
  assert.equal(state.draft, "");
  assert.equal(state.dirty, false);
});

test("invalidate and failed surface messages without results", () => {
  const invalid = ocrReducer(initialOcrState(), {
    type: "invalidate",
    message: "not an image",
  });
  assert.equal(invalid.phase, "invalid");
  assert.equal(invalid.message, "not an image");
  assert.equal(invalid.result, null);

  const failed = ocrReducer(
    { ...initialOcrState(), phase: "uploading" },
    { type: "failed", message: "OCR timed out" },
  );
  assert.equal(failed.phase, "error");
  assert.equal(failed.message, "OCR timed out");
});

test("progress updates only while uploading", () => {
  const uploading = ocrReducer(initialOcrState(), {
    type: "select",
    fileName: "a.png",
  });
  const moved = ocrReducer(uploading, { type: "progress", fraction: 0.5 });
  assert.equal(moved.progress, 0.5);
  const idle = ocrReducer(initialOcrState(), { type: "progress", fraction: 0.5 });
  assert.equal(idle.progress, null);
});

test("extracted seeds the editable draft and reports lines", () => {
  const state = ocrReducer(
    { ...initialOcrState(), phase: "uploading" },
    { type: "extracted", result: sampleResult() },
  );
  assert.equal(state.phase, "ready");
  assert.equal(state.progress, 1);
  assert.equal(state.draft, "Basic pay: GBP 11.50 per hour");
  assert.equal(state.dirty, false);
  assert.match(state.message, /1 line/);
  assert.match(state.message, /scan\.png/);
});

test("edit updates the draft and marks it dirty", () => {
  const ready = ocrReducer(
    { ...initialOcrState(), phase: "uploading" },
    { type: "extracted", result: sampleResult() },
  );
  const edited = ocrReducer(ready, { type: "edit", text: "Basic pay: GBP 12.50" });
  assert.equal(edited.draft, "Basic pay: GBP 12.50");
  assert.equal(edited.dirty, true);
  // The corrected draft is what the page submits for analysis.
  assert.equal(edited.draft.trim().length > 0, true);
  const ignored = ocrReducer(initialOcrState(), { type: "edit", text: "x" });
  assert.equal(ignored.draft, "");
});

test("language switches and survives reset; reset clears the rest", () => {
  const switched = ocrReducer(initialOcrState(), {
    type: "language",
    language: "ja",
  });
  assert.equal(switched.language, "ja");
  const ready = ocrReducer(
    { ...switched, phase: "uploading" },
    { type: "extracted", result: sampleResult() },
  );
  const reset = ocrReducer(ready, { type: "reset" });
  assert.equal(reset.phase, "idle");
  assert.equal(reset.result, null);
  assert.equal(reset.draft, "");
  assert.equal(reset.language, "ja");
});
