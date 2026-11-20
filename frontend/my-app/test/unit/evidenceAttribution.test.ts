// Evidence attribution tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert finding validation and excerpt/URL attribution only.
// They do not test live retrieval, Firebase Auth, Firestore, or AI inference.

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseComparisonFindings,
  validateAttributedFindings,
  validateFinding,
  type AttributableSource,
} from "../../src/lib/validation";

const SOURCES: AttributableSource[] = [
  {
    url: "https://www.gov.uk/national-minimum-wage-rates",
    excerpts: [
      {
        text: "The National Minimum Wage for workers aged 21 and over is £12.21 per hour from April 2025.",
      },
    ],
  },
  {
    url: "https://www.gov.uk/agency-workers-your-rights/fees",
    excerpts: [
      {
        text: "An agency cannot charge you a fee for finding you work, and this ban covers most upfront payments.",
      },
    ],
  },
];

function validFinding() {
  return {
    claim: "The posting states pay of £11 per hour.",
    excerpt:
      "The National Minimum Wage for workers aged 21 and over is £12.21 per hour from April 2025.",
    source_title: "National Minimum Wage rates",
    source_url: "https://www.gov.uk/national-minimum-wage-rates",
    retrieved_at: "2026-11-15T00:00:00Z",
    assessment: "conflicting",
    explanation: "The stated £11 rate is below the official £12.21 rate for this age group.",
    follow_up_question: "What is the worker's exact age and contracted hourly rate?",
  };
}

test("validateFinding accepts a well-formed finding", async () => {
  const result = validateFinding(validFinding());
  assert.equal(result.valid, true);
  assert.ok(result.value);
});

test("validateFinding rejects bad assessments and empty fields", async () => {
  assert.equal(validateFinding({ ...validFinding(), assessment: "scam" }).valid, false);
  assert.equal(validateFinding({ ...validFinding(), assessment: "verified" }).valid, false);
  assert.equal(validateFinding({ ...validFinding(), excerpt: "  " }).valid, false);
  assert.equal(validateFinding({ ...validFinding(), source_url: "" }).valid, false);
  assert.equal(validateFinding(null).valid, false);
  assert.equal(validateFinding("not-an-object").valid, false);
});

test("attributed findings require excerpt and URL to match retrieved sources", async () => {
  const result = validateAttributedFindings([validFinding()], SOURCES);
  assert.deepEqual(result.issues, []);
  assert.equal(result.findings.length, 1);
});

test("fabricated source URLs are rejected", async () => {
  const fabricated = {
    ...validFinding(),
    source_url: "https://www.gov.uk/some-unretrieved-page",
  };
  const result = validateAttributedFindings([fabricated], SOURCES);
  assert.equal(result.findings.length, 0);
  assert.match(result.issues.join(";"), /fabricated|not.*retrieved|unknown source/i);
});

test("excerpts not present in retrieved content are rejected", async () => {
  const invented = {
    ...validFinding(),
    excerpt: "This employer is confirmed fraudulent by the government licensing authority.",
  };
  const result = validateAttributedFindings([invented], SOURCES);
  assert.equal(result.findings.length, 0);
  assert.match(result.issues.join(";"), /excerpt/i);
});

test("missing or malformed source content rejects every finding", async () => {
  const empty: AttributableSource[] = [
    { url: "https://www.gov.uk/national-minimum-wage-rates", excerpts: [] },
  ];
  const result = validateAttributedFindings([validFinding()], empty);
  assert.equal(result.findings.length, 0);
  assert.ok(result.issues.length > 0);
});

test("invalid findings are dropped individually, valid ones kept", async () => {
  const bad = { ...validFinding(), assessment: "definitely-a-scam" };
  const result = validateAttributedFindings([validFinding(), bad], SOURCES);
  assert.equal(result.findings.length, 1);
  assert.equal(result.issues.length, 1);
});

test("parseComparisonFindings strips fences and parses arrays", async () => {
  const raw = "```json\n" + JSON.stringify([validFinding()]) + "\n```";
  const parsed = parseComparisonFindings(raw, SOURCES);
  assert.equal(parsed.parseError, null);
  assert.equal(parsed.findings.length, 1);
});

test("parseComparisonFindings reports invalid JSON and non-arrays", async () => {
  const badJson = parseComparisonFindings("not json at all", SOURCES);
  assert.equal(badJson.findings.length, 0);
  assert.ok(badJson.parseError);

  const notArray = parseComparisonFindings(JSON.stringify(validFinding()), SOURCES);
  assert.equal(notArray.findings.length, 0);
  assert.ok(notArray.parseError);
});
