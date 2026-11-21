// Privacy gate tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers content-bound approvals, invalidation on any change, save
// resolution, gate-state derivation, inference disclosure honesty, and
// composition with the on-device-only fail-closed mode gate.

import assert from "node:assert/strict";
import test from "node:test";
import { analysisGate } from "../../src/lib/compareSession";
import { detectSensitiveInfo } from "../../src/lib/privacyDetection";
import {
  addManualSpan,
  buildSanitized,
  setDecision,
  startReview,
} from "../../src/lib/privacyReview";
import {
  PrivacyGateError,
  approvalCovers,
  assertAnalysisAllowed,
  computeGateState,
  createApproval,
  describeInference,
  hashContent,
  resolveSavePayload,
} from "../../src/lib/privacyGate";

const TEXT = "Employee receives ¥220,000 monthly.";
const OTHER = "Completely different document.";

function approvedFor(text: string) {
  return createApproval({
    sanitizedText: text,
    redactedCount: 1,
    replacedCount: 0,
    retainedCount: 0,
  });
}

test("content hash is deterministic and change-sensitive", () => {
  assert.equal(hashContent(TEXT), hashContent(TEXT));
  assert.notEqual(hashContent(TEXT), hashContent(TEXT + " "));
  assert.notEqual(hashContent(TEXT), hashContent(OTHER));
  assert.match(hashContent("日本語テスト"), /^[0-9a-f]{8}$/);
});

test("approval covers exactly one text", () => {
  const approval = approvedFor(TEXT);
  assert.equal(approvalCovers(approval, TEXT), true);
  assert.equal(approvalCovers(approval, TEXT + " appended"), false);
  assert.equal(approvalCovers(approval, OTHER), false);
  assert.equal(approvalCovers(approval, ""), false);
  assert.equal(approvalCovers(null, TEXT), false);
  assert.equal(approvalCovers(undefined, TEXT), false);
});

test("analysis guard rejects missing, malformed, and stale approvals", () => {
  assert.throws(() => assertAnalysisAllowed(null, TEXT), PrivacyGateError);
  try {
    assertAnalysisAllowed(null, TEXT);
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal((err as PrivacyGateError).code, "missing");
  }

  const malformed = { ...approvedFor(TEXT), textHash: "" };
  assert.throws(() => assertAnalysisAllowed(malformed, TEXT), /invalid/);

  const staleDetector = { ...approvedFor(TEXT), detectorVersion: "0" };
  assert.equal(approvalCovers(staleDetector, TEXT), false);

  assert.throws(() => assertAnalysisAllowed(approvedFor(TEXT), OTHER), /changed since/);
  assert.doesNotThrow(() => assertAnalysisAllowed(approvedFor(TEXT), TEXT));
});

test("approval cannot be reused for another document", () => {
  const approval = approvedFor(TEXT);
  assert.throws(() => assertAnalysisAllowed(approval, OTHER), PrivacyGateError);
});

test("save resolution requires matching approval and analysis", () => {
  const approval = approvedFor(TEXT);
  const analysis = { textHash: approval.textHash };

  const ok = resolveSavePayload({ currentText: TEXT, approval, analysis });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.postingText, TEXT);
  }

  assert.equal(
    resolveSavePayload({ currentText: TEXT, approval: null, analysis }).ok,
    false,
  );
  const stale = resolveSavePayload({ currentText: TEXT + "!", approval, analysis });
  assert.equal(stale.ok, false);

  const mismatched = resolveSavePayload({
    currentText: TEXT,
    approval,
    analysis: { textHash: hashContent(OTHER) },
  });
  assert.equal(mismatched.ok, false);

  const noAnalysis = resolveSavePayload({ currentText: TEXT, approval, analysis: null });
  assert.equal(noAnalysis.ok, false);
});

test("gate states derive from review and approval facts", () => {
  assert.equal(
    computeGateState({
      hasSource: false,
      scanning: false,
      review: null,
      approval: null,
      currentText: "",
    }),
    "NOT_STARTED",
  );
  assert.equal(
    computeGateState({
      hasSource: true,
      scanning: true,
      review: null,
      approval: null,
      currentText: TEXT,
    }),
    "SCANNING",
  );
  assert.equal(
    computeGateState({
      hasSource: true,
      scanning: false,
      review: { allReviewed: false },
      approval: null,
      currentText: TEXT,
    }),
    "REVIEW_REQUIRED",
  );
  assert.equal(
    computeGateState({
      hasSource: true,
      scanning: false,
      review: { allReviewed: true },
      approval: null,
      currentText: TEXT,
    }),
    "READY_FOR_APPROVAL",
  );
  assert.equal(
    computeGateState({
      hasSource: true,
      scanning: false,
      review: { allReviewed: true },
      approval: approvedFor(TEXT),
      currentText: TEXT,
    }),
    "APPROVED",
  );
  assert.equal(
    computeGateState({
      hasSource: true,
      scanning: false,
      review: { allReviewed: true },
      approval: approvedFor(TEXT),
      currentText: TEXT + " edited",
    }),
    "INVALIDATED",
  );
});

test("inference disclosure never calls fallback modes on-device-only", () => {
  const hybrid = describeInference("prefer-on-device");
  assert.equal(hybrid.allowsCloudFallback, true);
  assert.ok(!hybrid.destination.toLowerCase().includes("only"));
  assert.match(hybrid.processingNote, /approved sanitized text is ever sent/);

  const device = describeInference("on-device-only");
  assert.equal(device.allowsCloudFallback, false);
  assert.match(device.processingNote, /never leaves the browser/);

  const cloud = describeInference("only-in-cloud");
  assert.equal(cloud.allowsCloudFallback, true);
  assert.match(cloud.processingNote, /always runs in the cloud/);
});

test("approval from one investigation never unlocks another", () => {
  const approvalA = approvedFor("Investigation A sanitized text.");
  assert.throws(
    () => assertAnalysisAllowed(approvalA, "Investigation B sanitized text."),
    PrivacyGateError,
  );
  const save = resolveSavePayload({
    currentText: "Investigation B sanitized text.",
    approval: approvalA,
    analysis: { textHash: approvalA.textHash },
  });
  assert.equal(save.ok, false);
});

test("changed redaction decisions invalidate the earlier approval", () => {
  const source = "Passport number AB1234567. Salary GBP 100.";
  const found = detectSensitiveInfo(source).detections;
  let state = startReview(source, found);
  state = setDecision(state, found[0]!.id, "retain");
  const first = buildSanitized(state).text;
  const approval = approvedFor(first);
  assert.doesNotThrow(() => assertAnalysisAllowed(approval, first));

  state = setDecision(state, found[0]!.id, "redact");
  const second = buildSanitized(state).text;
  assert.notEqual(first, second);
  assert.throws(() => assertAnalysisAllowed(approval, second), PrivacyGateError);
});

test("manual edits after approval invalidate it", () => {
  const source = "Employer Kent Farms, salary 500.";
  const first = buildSanitized(startReview(source, [])).text;
  const approval = approvedFor(first);
  const added = addManualSpan(startReview(source, []), 9, 19, null);
  assert.equal(added.ok, true);
  const second = added.ok ? buildSanitized(added.state).text : first;
  assert.throws(() => assertAnalysisAllowed(approval, second), PrivacyGateError);
});

test("clean text with zero detections still requires an approval", () => {
  const clean = "Salary GBP 100 monthly, no personal details.";
  assert.deepEqual(detectSensitiveInfo(clean).detections, []);
  assert.throws(() => assertAnalysisAllowed(null, clean), PrivacyGateError);
  assert.doesNotThrow(() => assertAnalysisAllowed(approvedFor(clean), clean));
});

test("malformed approvals are rejected, not trusted", () => {
  const base = approvedFor(TEXT);
  const wrongVersion = { ...base, version: 2 };
  assert.equal(
    approvalCovers(wrongVersion as typeof base, TEXT),
    false,
  );
  const noHash = { ...base, textHash: undefined as unknown as string };
  assert.equal(approvalCovers(noHash, TEXT), false);
  assert.throws(
    () => assertAnalysisAllowed(wrongVersion as typeof base, TEXT),
    /invalid/,
  );
});

test("repeated and concurrent guard checks are deterministic", () => {
  const approval = approvedFor(TEXT);
  for (let i = 0; i < 5; i += 1) {
    assert.doesNotThrow(() => assertAnalysisAllowed(approval, TEXT));
    assert.throws(() => assertAnalysisAllowed(approval, OTHER), PrivacyGateError);
  }
  const input = {
    currentText: TEXT,
    approval,
    analysis: { textHash: approval.textHash },
  };
  const first = resolveSavePayload(input);
  const second = resolveSavePayload(input);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
});

test("on-device-only still fails closed alongside privacy approval", () => {
  const approval = approvedFor(TEXT);
  // Privacy approval alone never unlocks on-device-only mode.
  assert.doesNotThrow(() => assertAnalysisAllowed(approval, TEXT));
  const gate = analysisGate("on-device-only", { consent: false, deviceReady: false });
  assert.equal(gate.allowed, false);
  assert.match(gate.reason ?? "", /Prepare on-device analysis first/);

  const ready = analysisGate("on-device-only", { consent: false, deviceReady: true });
  assert.equal(ready.allowed, true);
});
