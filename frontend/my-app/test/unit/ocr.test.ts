// Image OCR client tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers validation, the OCR language allowlist (Thai/Vietnamese must
// stay out), response parsing, low-confidence warnings, the upload flow
// driven through a fake XHR, and PDF-workflow regression.

import assert from "node:assert/strict";
import test from "node:test";
import {
  LOW_CONFIDENCE_MEAN,
  MAX_IMAGE_BYTES,
  OCR_LANGUAGES,
  apiBase,
  parseOcrResponse,
  registerBackendTokenProvider,
  shouldWarnLowConfidence,
  uploadImage,
  uploadPdf,
  validateImageFile,
  validatePdfFile,
  type OcrResult,
  type XhrLike,
} from "../../src/lib/documents";

function fakeFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

/** Real File (a Blob) for upload tests, since FormData.append requires one. */
function realFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

/**
 * Lets async upload setup (token resolution, XHR wiring) finish before the
 * test drives the fake XHR. Real behavior is async; tests must wait for it.
 */
async function settled(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

class FakeXhr implements XhrLike {
  upload: XhrLike["upload"] = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 0;
  responseText = "";
  opened: Array<[string, string]> = [];
  sent: unknown[] = [];
  headers: Record<string, string> = {};

  open(method: string, url: string): void {
    this.opened.push([method, url]);
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: unknown): void {
    this.sent.push(body);
  }

  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  respond(status: number, body: string): void {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }

  fail(): void {
    this.onerror?.();
  }
}

function ocrPayload(overrides: Partial<OcrResult> = {}): OcrResult {
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
    ...overrides,
  };
}

test("validateImageFile accepts jpg, jpeg, and png", () => {
  assert.equal(validateImageFile(fakeFile("a.jpg", "image/jpeg", 100)), null);
  assert.equal(validateImageFile(fakeFile("a.jpeg", "image/jpeg", 100)), null);
  assert.equal(validateImageFile(fakeFile("a.png", "image/png", 100)), null);
  assert.equal(validateImageFile(fakeFile("A.PNG", "", 100)), null);
});

test("validateImageFile rejects wrong extensions, types, and sizes", () => {
  assert.match(
    validateImageFile(fakeFile("a.gif", "image/gif", 100)) ?? "",
    /supported image/,
  );
  assert.match(
    validateImageFile(fakeFile("a.png", "text/plain", 100)) ?? "",
    /isn't a supported image/,
  );
  assert.match(validateImageFile(fakeFile("a.png", "image/png", 0)) ?? "", /empty/);
  assert.match(
    validateImageFile(fakeFile("a.png", "image/png", MAX_IMAGE_BYTES + 1)) ?? "",
    /10 MB/,
  );
});

test("OCR language allowlist holds six languages and excludes Thai/Vietnamese", () => {
  const codes = OCR_LANGUAGES.map((entry) => entry.code);
  assert.deepEqual(codes, ["en", "id", "ms", "ja", "zh-Hant", "zh-Hans"]);
  for (const entry of OCR_LANGUAGES) {
    assert.ok(entry.label.length > 0, `${entry.code} has no label`);
  }
  assert.ok(!codes.includes("th" as never), "Thai must not be an OCR option");
  assert.ok(!codes.includes("vi" as never), "Vietnamese must not be an OCR option");
});

test("shouldWarnLowConfidence flags low means and low lines only", () => {
  assert.equal(
    shouldWarnLowConfidence({ mean_confidence: 0.99, low_confidence_lines: 0 }),
    false,
  );
  assert.equal(
    shouldWarnLowConfidence({ mean_confidence: 0.85, low_confidence_lines: 0 }),
    true,
  );
  assert.equal(
    shouldWarnLowConfidence({ mean_confidence: 0.99, low_confidence_lines: 2 }),
    true,
  );
  assert.equal(LOW_CONFIDENCE_MEAN, 0.9);
});

test("parseOcrResponse accepts the backend shape and filters page texts", () => {
  const parsed = parseOcrResponse(
    { ...ocrPayload(), page_texts: ["a", 42, null] },
    "fallback.png",
  );
  assert.ok(parsed);
  assert.equal(parsed?.source, "ocr");
  assert.deepEqual(parsed?.page_texts, ["a"]);
  assert.equal(parsed?.mean_confidence, 0.99);
});

test("parseOcrResponse rejects wrong shapes", () => {
  assert.equal(parseOcrResponse(null, "f.png"), null);
  assert.equal(parseOcrResponse({ text: 42, source: "ocr" }, "f.png"), null);
  assert.equal(parseOcrResponse({ text: "x", source: "pdf" }, "f.png"), null);
  assert.equal(
    parseOcrResponse(ocrPayload({ filename: 7 as unknown as string }), "f.png")
      ?.filename,
    "f.png",
  );
});

test("uploadImage posts to the OCR endpoint and resolves parsed results", async () => {
  const xhr = new FakeXhr();
  const seen: Array<number | null> = [];
  const file = realFile("scan.png", "image/png", 500);
  const pending = uploadImage(file, "ms", (fraction) => seen.push(fraction), () => xhr);
  await settled();
  xhr.progress(250, 500);
  xhr.respond(200, JSON.stringify(ocrPayload({ language: "ms" })));
  const result = await pending;
  assert.equal(result.language, "ms");
  assert.equal(result.text, "Basic pay: GBP 11.50 per hour");
  assert.deepEqual(xhr.opened, [["POST", `${apiBase()}/api/v1/documents/ocr`]]);
  assert.deepEqual(seen, [0, 0.5]);
  assert.equal(xhr.sent.length, 1);
});

test("uploadImage rejects with the server error message", async () => {
  const xhr = new FakeXhr();
  const pending = uploadImage(
    realFile("scan.png", "image/png", 500),
    "en",
    () => {},
    () => xhr,
  );
  await settled();
  xhr.respond(400, JSON.stringify({ error: "Thai is not supported for OCR." }));
  await assert.rejects(pending, /Thai is not supported/);
});

test("uploadImage rejects unreadable responses and network failures", async () => {
  const bad = new FakeXhr();
  const pendingBad = uploadImage(
    realFile("scan.png", "image/png", 500),
    "en",
    () => {},
    () => bad,
  );
  await settled();
  bad.respond(200, "not json{{{");
  await assert.rejects(pendingBad, /unreadable response/);

  const offline = new FakeXhr();
  const pendingOffline = uploadImage(
    realFile("scan.png", "image/png", 500),
    "en",
    () => {},
    () => offline,
  );
  await settled();
  offline.fail();
  await assert.rejects(pendingOffline, /Cannot reach the document service/);
});

test("uploads attach the Firebase ID token when signed in", async () => {
  try {
    registerBackendTokenProvider(async () => "tok-upload");
    const imageXhr = new FakeXhr();
    const imagePending = uploadImage(
      realFile("scan.png", "image/png", 500),
      "en",
      () => {},
      () => imageXhr,
    );
    await settled();
    imageXhr.respond(200, JSON.stringify(ocrPayload()));
    await imagePending;
    assert.equal(imageXhr.headers["Authorization"], "Bearer tok-upload");

    const pdfXhr = new FakeXhr();
    const pdfPending = uploadPdf(
      realFile("doc.pdf", "application/pdf", 500),
      () => {},
      undefined,
      () => pdfXhr,
    );
    await settled();
    pdfXhr.respond(
      200,
      JSON.stringify({ text: "x", pages: 1, truncated: false, page_texts: ["x"] }),
    );
    await pdfPending;
    assert.equal(pdfXhr.headers["Authorization"], "Bearer tok-upload");
  } finally {
    registerBackendTokenProvider(null);
  }
});

test("upload 401 surfaces the re-sign-in message", async () => {
  registerBackendTokenProvider(null);
  const xhr = new FakeXhr();
  const pending = uploadImage(
    realFile("scan.png", "image/png", 500),
    "en",
    () => {},
    () => xhr,
  );
  await settled();
  xhr.respond(401, JSON.stringify({ error: "Missing or malformed Authorization header." }));
  await assert.rejects(pending, /sign in again/);
});

test("uploads omit the header when signed out", async () => {
  registerBackendTokenProvider(null);
  const xhr = new FakeXhr();
  const pending = uploadImage(
    realFile("scan.png", "image/png", 500),
    "en",
    () => {},
    () => xhr,
  );
  await settled();
  xhr.respond(200, JSON.stringify(ocrPayload()));
  await pending;
  assert.equal(xhr.headers["Authorization"], undefined);
});

test("PDF workflow regression: validation and client entry points intact", () => {
  assert.equal(validatePdfFile(fakeFile("a.pdf", "application/pdf", 100)), null);
  assert.match(validatePdfFile(fakeFile("a.png", "image/png", 100)) ?? "", /\.pdf/);
  assert.match(
    validatePdfFile(fakeFile("a.pdf", "application/pdf", 10 * 1024 * 1024 + 1)) ?? "",
    /10 MB/,
  );
  assert.equal(typeof uploadPdf, "function");
  assert.ok(apiBase().length > 0);
});
