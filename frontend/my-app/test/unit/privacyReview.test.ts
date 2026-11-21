// Privacy review tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers decisions, manual spans, sanitized-text construction, and the
// headline guarantee: employment evidence survives redaction byte-exact.

import assert from "node:assert/strict";
import test from "node:test";
import { detectSensitiveInfo } from "../../src/lib/privacyDetection";
import {
  addManualSpan,
  allReviewed,
  buildSanitized,
  confirmAllSuggestions,
  removeManualSpan,
  resetDecision,
  setDecision,
  startReview,
  suggestDecision,
} from "../../src/lib/privacyReview";

const MISSION_EXAMPLE =
  "Employee receives ¥220,000 monthly. Passport number AB1234567. " +
  "Accommodation deduction ¥15,000.";

test("employment evidence survives while the passport is redacted", () => {
  const found = detectSensitiveInfo(MISSION_EXAMPLE);
  assert.equal(found.detections.length, 1);
  let state = startReview(MISSION_EXAMPLE, found.detections);
  state = setDecision(state, found.detections[0]!.id, "redact");
  const result = buildSanitized(state);
  assert.equal(
    result.text,
    "Employee receives ¥220,000 monthly. Passport number [PASSPORT]. " +
      "Accommodation deduction ¥15,000.",
  );
  assert.equal(result.redacted, 1);
  // Amounts, currencies, and terms are byte-exact.
  assert.match(result.text, /¥220,000 monthly/);
  assert.match(result.text, /Accommodation deduction ¥15,000/);
});

test("replace uses custom text and retain keeps the original", () => {
  const found = detectSensitiveInfo("Call +6281234567890 or mail a@b.co.").detections;
  let state = startReview("Call +6281234567890 or mail a@b.co.", found);
  const phone = found.find((d) => d.label === "Phone number")!;
  const email = found.find((d) => d.label === "Email address")!;
  state = setDecision(state, phone.id, "replace", "[WORK PHONE]");
  state = setDecision(state, email.id, "retain");
  const result = buildSanitized(state);
  assert.match(result.text, /\[WORK PHONE\]/);
  assert.match(result.text, /a@b\.co/);
  assert.equal(result.replaced, 1);
  assert.equal(result.retained, 1);
});

test("adjacent edits do not corrupt surrounding text", () => {
  const source = "NIK 3174051209900001, phone 0812345678.";
  const found = detectSensitiveInfo(source).detections;
  let state = startReview(source, found);
  for (const item of found) {
    state = setDecision(state, item.id, "redact");
  }
  const result = buildSanitized(state);
  assert.ok(!result.text.includes("3174051209900001"));
  assert.ok(!result.text.includes("0812345678"));
  assert.match(result.text, /^NIK \[ID_NUMBER\], phone \[PHONE\]\.$/);
});

test("decisions track reviewed state and can be reset", () => {
  const found = detectSensitiveInfo("mail a@b.co").detections;
  let state = startReview("mail a@b.co", found);
  assert.equal(allReviewed(state), false);
  state = setDecision(state, found[0]!.id, "redact");
  assert.equal(allReviewed(state), true);
  state = resetDecision(state, found[0]!.id);
  assert.equal(allReviewed(state), false);
  assert.equal(buildSanitized(state).redacted, 0);
});

test("confirmAllSuggestions redacts high and retains low explicitly", () => {
  const source = "Passport number AB1234567. Signed: done.";
  const found = detectSensitiveInfo(source).detections;
  let state = startReview(source, found);
  assert.equal(suggestDecision(found.find((d) => d.label === "Passport number")!), "redact");
  assert.equal(suggestDecision(found.find((d) => d.label === "Signature field")!), "retain");
  state = confirmAllSuggestions(state);
  assert.equal(allReviewed(state), true);
  const result = buildSanitized(state);
  assert.match(result.text, /\[PASSPORT\]/);
  assert.match(result.text, /Signed: done\./);
});

test("empty reviews count as reviewed but still need explicit approval", () => {
  const state = startReview("No sensitive data here.", []);
  assert.equal(allReviewed(state), true);
  assert.equal(buildSanitized(state).text, "No sensitive data here.");
});

test("manual spans add, overlap-reject, and remove", () => {
  const source = "Employer Kent Farms, salary 500.";
  let state = startReview(source, []);
  const added = addManualSpan(state, 9, 19, null);
  assert.equal(added.ok, true);
  if (!added.ok) {
    return;
  }
  state = added.state;
  assert.equal(buildSanitized(state).text, "Employer [REDACTED], salary 500.");

  const overlap = addManualSpan(state, 10, 25, null);
  assert.equal(overlap.ok, false);

  const empty = addManualSpan(state, 5, 5, null);
  assert.equal(empty.ok, false);

  const outside = addManualSpan(state, -1, 4, null);
  assert.equal(outside.ok, false);

  state = removeManualSpan(state, state.manual[0]!.id);
  assert.equal(buildSanitized(state).text, source);
});

test("manual spans reject overlap with detected items", () => {
  const source = "mail a@b.co today";
  const found = detectSensitiveInfo(source).detections;
  const state = startReview(source, found);
  const overlap = addManualSpan(state, 5, 12, null);
  assert.equal(overlap.ok, false);
  if (!overlap.ok) {
    assert.match(overlap.error, /overlaps/);
  }
});
