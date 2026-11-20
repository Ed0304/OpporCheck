// Product trust tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert canonical disclaimer wording, preferred report
// language, and the absence of fraud-verdict phrases in user-facing
// labels. Page-level placement is verified by review, not by tests.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYSIS_CONTEXT_NOTICE,
  COMPARISON_CONTEXT_NOTICE,
  CONCISE_NOTICE,
  FULL_DISCLAIMER_PARAGRAPHS,
  INVESTIGATION_CONTEXT_NOTICE,
  REVIEW_PROCESSING_NOTICE,
  UPLOAD_SENSITIVITY_NOTICE,
} from "../../src/lib/disclaimer";
import {
  ASSESSMENT_LABELS,
  ASSESSMENT_TONES,
  COMPARISON_STATUS_LABELS,
  COMPARISON_STATUS_TONES,
  DISALLOWED_LABEL_PHRASES,
  MISSING_INFO_LABEL,
  UNVERIFIED_PHRASE,
} from "../../src/lib/reportLanguage";
import { analysisGate } from "../../src/lib/compareSession";

test("canonical disclaimer keeps its four paragraphs verbatim", () => {
  assert.equal(FULL_DISCLAIMER_PARAGRAPHS.length, 4);
  assert.match(FULL_DISCLAIMER_PARAGRAPHS[0]!, /informational and decision-support tool/);
  assert.match(FULL_DISCLAIMER_PARAGRAPHS[0]!, /not a scam detection service/);
  assert.match(FULL_DISCLAIMER_PARAGRAPHS[1]!, /do not establish/);
  assert.match(FULL_DISCLAIMER_PARAGRAPHS[1]!, /legitimate, fraudulent, or legally compliant/);
  assert.match(FULL_DISCLAIMER_PARAGRAPHS[2]!, /independently verify/);
  assert.match(FULL_DISCLAIMER_PARAGRAPHS[2]!, /local authorities/);
  assert.match(
    FULL_DISCLAIMER_PARAGRAPHS[3]!,
    /Do not rely solely on OpporCheck when making employment, financial, immigration, or legal decisions\./,
  );
});

test("concise notice is shorter but keeps the core negation", () => {
  const full = FULL_DISCLAIMER_PARAGRAPHS.join(" ");
  assert.ok(CONCISE_NOTICE.length < full.length / 2);
  assert.match(CONCISE_NOTICE, /not a scam detector/);
  assert.match(CONCISE_NOTICE, /verify important information independently/);
});

test("contextual notices carry their placement-specific meaning", () => {
  assert.match(ANALYSIS_CONTEXT_NOTICE, /not proof of fraud/);
  assert.match(COMPARISON_CONTEXT_NOTICE, /not automatic proof of wrongdoing/);
  assert.match(INVESTIGATION_CONTEXT_NOTICE, /does not independently verify any specific employer/);
  assert.match(UPLOAD_SENSITIVITY_NOTICE, /sensitive personal information/);
  assert.match(UPLOAD_SENSITIVITY_NOTICE, /only documents you are authorized to share/);
  assert.match(REVIEW_PROCESSING_NOTICE, /on-device when your browser supports it/);
  assert.match(REVIEW_PROCESSING_NOTICE, /leaves the device only for cloud analysis/);
});

test("assessment labels use the preferred comparison language", () => {
  assert.equal(ASSESSMENT_LABELS.supported, "Supported by the retrieved excerpt");
  assert.equal(ASSESSMENT_LABELS.conflicting, "Conflicting with the retrieved excerpt");
  assert.equal(ASSESSMENT_LABELS["insufficient-evidence"], "Insufficient evidence");
  assert.equal(COMPARISON_STATUS_LABELS.discrepancy, "Discrepancy identified");
  assert.equal(COMPARISON_STATUS_LABELS.not_addressed, "Not addressed in the supplied documents");
  assert.equal(COMPARISON_STATUS_LABELS.needs_clarification, "Needs clarification");
  assert.equal(MISSING_INFO_LABEL, "Information not provided");
  assert.match(UNVERIFIED_PHRASE, /Unable to establish from available information/);
});

test("conflicting evidence never renders in red", () => {
  assert.equal(ASSESSMENT_TONES.conflicting, "warn");
  assert.equal(ASSESSMENT_TONES.supported, "ok");
  assert.equal(COMPARISON_STATUS_TONES.discrepancy, "warn");
  assert.equal(COMPARISON_STATUS_TONES.needs_clarification, "warn");
  const tones = [...Object.values(ASSESSMENT_TONES), ...Object.values(COMPARISON_STATUS_TONES)];
  for (const tone of tones) {
    assert.notEqual(tone, "bad");
  }
});

test("no user-facing label carries a fraud verdict or guarantee", () => {
  const labels = [
    ...Object.values(ASSESSMENT_LABELS),
    ...Object.values(COMPARISON_STATUS_LABELS),
    MISSING_INFO_LABEL,
    UNVERIFIED_PHRASE,
    ANALYSIS_CONTEXT_NOTICE,
    COMPARISON_CONTEXT_NOTICE,
    INVESTIGATION_CONTEXT_NOTICE,
    CONCISE_NOTICE,
    UPLOAD_SENSITIVITY_NOTICE,
    REVIEW_PROCESSING_NOTICE,
  ];
  for (const label of labels) {
    const lowered = label.toLowerCase();
    for (const phrase of DISALLOWED_LABEL_PHRASES) {
      assert.ok(
        !lowered.includes(phrase),
        `disallowed phrase "${phrase}" found in: ${label}`,
      );
    }
  }
});

test("analysis gate enforces consent and on-device boundaries", () => {
  assert.deepEqual(analysisGate("prefer-on-device", { consent: false, deviceReady: false }), {
    allowed: false,
    reason: "Consent to cloud processing is required for this mode.",
  });
  assert.deepEqual(analysisGate("prefer-on-device", { consent: true, deviceReady: false }), {
    allowed: true,
    reason: null,
  });
  const gated = analysisGate("on-device-only", { consent: false, deviceReady: false });
  assert.equal(gated.allowed, false);
  assert.match(gated.reason ?? "", /never falls back to cloud/);
  assert.deepEqual(analysisGate("on-device-only", { consent: false, deviceReady: true }), {
    allowed: true,
    reason: null,
  });
});
