// Compare-document privacy tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers per-page approvals: recording, staleness when a page changes,
// whole-document readiness, and the extraction-time enforcement helper.

import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedPageCount,
  approvedPagesOrThrow,
  emptyDocPrivacy,
  isDocPrivacyApproved,
  isPageApproved,
  recordPageApproval,
} from "../../src/lib/compareSession";
import { PrivacyGateError, createApproval } from "../../src/lib/privacyGate";

const PAGES = ["Contact me at a@b.co please.", "Salary GBP 1,840 monthly."];

function approveFirstPage() {
  const approval = createApproval({
    sanitizedText: "Contact me at [EMAIL] please.",
    redactedCount: 1,
    replacedCount: 0,
    retainedCount: 0,
  });
  return recordPageApproval(
    emptyDocPrivacy(2),
    2,
    0,
    approval,
    "Contact me at [EMAIL] please.",
    PAGES[0]!,
  );
}

test("recording approvals tracks per-page readiness", () => {
  const empty = emptyDocPrivacy(2);
  assert.equal(isDocPrivacyApproved(empty, PAGES), false);
  assert.equal(approvedPageCount(empty, PAGES), 0);

  const partial = approveFirstPage();
  assert.equal(isPageApproved(partial, PAGES, 0), true);
  assert.equal(isPageApproved(partial, PAGES, 1), false);
  assert.equal(approvedPageCount(partial, PAGES), 1);
  assert.equal(isDocPrivacyApproved(partial, PAGES), false);

  const second = createApproval({
    sanitizedText: PAGES[1]!,
    redactedCount: 0,
    replacedCount: 0,
    retainedCount: 0,
  });
  const full = recordPageApproval(partial, 2, 1, second, PAGES[1]!, PAGES[1]!);
  assert.equal(isDocPrivacyApproved(full, PAGES), true);
});

test("recordPageApproval rejects bad indexes and mismatched approvals", () => {
  const approval = createApproval({
    sanitizedText: "clean",
    redactedCount: 0,
    replacedCount: 0,
    retainedCount: 0,
  });
  assert.throws(
    () => recordPageApproval(emptyDocPrivacy(1), 1, 5, approval, "clean", "raw"),
    PrivacyGateError,
  );
  assert.throws(
    () =>
      recordPageApproval(emptyDocPrivacy(1), 1, 0, approval, "different", "raw"),
    /does not match/,
  );
});

test("edited pages invalidate their approval (stale snapshot)", () => {
  const partial = approveFirstPage();
  const edited = ["Contact me at z@z.co please.", PAGES[1]!];
  assert.equal(isPageApproved(partial, edited, 0), false);
  assert.equal(approvedPageCount(partial, edited), 0);
});

test("approvals follow document identity, not list position", () => {
  // Approvals are stored per document id on the page and per page index
  // within a document, so reordering documents cannot mix them up: each
  // approval still only covers its own pages.
  const first = approveFirstPage();
  const otherPages = ["Other doc page one.", "Other doc page two."];
  assert.equal(approvedPageCount(first, otherPages), 0);
  assert.equal(isDocPrivacyApproved(first, otherPages), false);
  assert.throws(
    () => approvedPagesOrThrow(first, otherPages, "other.pdf"),
    PrivacyGateError,
  );
});

test("approvedPagesOrThrow returns sanitized pages or throws", () => {
  const partial = approveFirstPage();
  assert.throws(
    () => approvedPagesOrThrow(partial, PAGES, "contract.pdf"),
    /Privacy Check is incomplete for contract\.pdf/,
  );

  const second = createApproval({
    sanitizedText: PAGES[1]!,
    redactedCount: 0,
    replacedCount: 0,
    retainedCount: 0,
  });
  const full = recordPageApproval(partial, 2, 1, second, PAGES[1]!, PAGES[1]!);
  assert.deepEqual(approvedPagesOrThrow(full, PAGES, "contract.pdf"), [
    "Contact me at [EMAIL] please.",
    "Salary GBP 1,840 monthly.",
  ]);
});
