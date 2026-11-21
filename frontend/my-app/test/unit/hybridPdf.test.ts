// Hybrid PDF contract tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers additive parsing of the Phase 2 extract response (legacy shapes
// without page breakdowns keep working), failed-page helpers, and OCR
// confidence aggregation.

import assert from "node:assert/strict";
import test from "node:test";
import { failedPagesLimitation } from "../../src/lib/compareSession";
import {
  failedPageNumbers,
  ocrConfidenceSummary,
  parseExtractResponse,
} from "../../src/lib/documents";

function hybridPayload() {
  return {
    filename: "mixed.pdf",
    text: "Native terms.\n\nScanned terms.",
    pages: 3,
    truncated: false,
    page_texts: ["Native terms.", "Scanned terms.", ""],
    source: "mixed",
    language: "en",
    page_results: [
      {
        page: 1,
        source: "native",
        text: "Native terms.",
        truncated: false,
        mean_confidence: null,
        low_confidence_lines: 0,
        status: "ok",
        warning: null,
        failure_code: null,
      },
      {
        page: 2,
        source: "ocr",
        text: "Scanned terms.",
        truncated: false,
        mean_confidence: 0.96,
        low_confidence_lines: 1,
        status: "ok",
        warning: null,
        failure_code: null,
      },
      {
        page: 3,
        source: "failed",
        text: "",
        truncated: false,
        mean_confidence: null,
        low_confidence_lines: 0,
        status: "failed",
        warning: null,
        failure_code: "render_failed",
      },
    ],
  };
}

test("parseExtractResponse keeps the hybrid shape with per-page detail", () => {
  const parsed = parseExtractResponse(hybridPayload(), "fallback.pdf");
  assert.ok(parsed);
  assert.equal(parsed?.source, "mixed");
  assert.equal(parsed?.language, "en");
  assert.equal(parsed?.page_results?.length, 3);
  assert.equal(parsed?.page_results?.[1]?.mean_confidence, 0.96);
  assert.equal(parsed?.page_results?.[2]?.failure_code, "render_failed");
  assert.deepEqual(failedPageNumbers(parsed!), [3]);
});

test("parseExtractResponse accepts legacy responses without page breakdowns", () => {
  const parsed = parseExtractResponse(
    {
      filename: "old.pdf",
      text: "Some text.",
      pages: 1,
      truncated: false,
      page_texts: ["Some text."],
    },
    "fallback.pdf",
  );
  assert.ok(parsed);
  assert.equal(parsed?.source, undefined);
  assert.equal(parsed?.page_results, undefined);
  assert.deepEqual(failedPageNumbers(parsed!), []);
  assert.equal(ocrConfidenceSummary(parsed!), null);
});

test("parseExtractResponse rejects malformed bodies and filters bad pages", () => {
  assert.equal(parseExtractResponse(null, "f.pdf"), null);
  assert.equal(parseExtractResponse({ text: 42 }, "f.pdf"), null);
  const parsed = parseExtractResponse(
    {
      text: "x",
      pages: 1,
      truncated: false,
      page_texts: ["x"],
      page_results: [{ page: 1 }, null, "junk"],
    },
    "f.pdf",
  );
  assert.deepEqual(parsed?.page_results, []);
});

test("ocrConfidenceSummary aggregates OCR pages only", () => {
  const parsed = parseExtractResponse(hybridPayload(), "f.pdf")!;
  const summary = ocrConfidenceSummary(parsed)!;
  assert.equal(summary.ocrPages, 1);
  assert.equal(summary.meanConfidence, 0.96);
  assert.equal(summary.lowLines, 1);

  const nativeOnly = parseExtractResponse(
    {
      text: "x",
      pages: 1,
      truncated: false,
      page_texts: ["x"],
      source: "native",
      page_results: [
        {
          page: 1,
          source: "native",
          text: "x",
          truncated: false,
          mean_confidence: null,
          low_confidence_lines: 0,
          status: "ok",
          warning: null,
          failure_code: null,
        },
      ],
    },
    "f.pdf",
  )!;
  assert.equal(ocrConfidenceSummary(nativeOnly), null);
});

test("failedPagesLimitation describes exclusions or stays silent", () => {
  assert.equal(failedPagesLimitation("a.pdf", []), null);
  assert.equal(failedPagesLimitation("a.pdf", undefined), null);
  assert.equal(
    failedPagesLimitation("a.pdf", [2]),
    "a.pdf: page 2 could not be extracted and was excluded from comparison.",
  );
  assert.match(
    failedPagesLimitation("a.pdf", [3, 1]) ?? "",
    /pages 1, 3 could not be extracted/,
  );
});
