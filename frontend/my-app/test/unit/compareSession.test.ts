// Promise-to-Paper session tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert report math and labels only.

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComparisonTitle,
  collectQuestions,
  countCitedExcerpts,
  summarizeFindings,
  toContractText,
  COMPARE_CATEGORY_LABELS,
} from "../../src/lib/compareSession";
import type { PromiseToPaperFinding } from "../../src/lib/contractTypes";

function finding(status: PromiseToPaperFinding["status"], question: string): PromiseToPaperFinding {
  return {
    category: "compensation",
    status,
    explanation: "Comparison of excerpts only, with stated limitations.",
    followUpQuestion: question,
  };
}

test("summarizeFindings counts each status", () => {
  const summary = summarizeFindings([
    finding("consistent", "Q1?"),
    finding("discrepancy", "Q2?"),
    finding("discrepancy", "Q3?"),
    finding("not_addressed", "Q4?"),
    finding("needs_clarification", "Q5?"),
  ]);
  assert.deepEqual(summary, {
    consistent: 1,
    discrepancy: 2,
    not_addressed: 1,
    needs_clarification: 1,
    total: 5,
  });
  assert.deepEqual(summarizeFindings([]), {
    consistent: 0,
    discrepancy: 0,
    not_addressed: 0,
    needs_clarification: 0,
    total: 0,
  });
});

test("collectQuestions deduplicates case-insensitively in order", () => {
  const questions = collectQuestions([
    finding("consistent", "Is overtime paid?"),
    finding("discrepancy", "is OVERTIME paid?"),
    finding("discrepancy", "What does the fee cover?"),
    finding("discrepancy", "  "),
  ]);
  assert.deepEqual(questions, ["Is overtime paid?", "What does the fee cover?"]);
});

test("toContractText maps session input to comparison text", () => {
  const text = toContractText({
    id: "doc-1",
    fileName: "contract.pdf",
    documentType: "employment_contract",
    source: "pdf",
    pages: ["a", "b"],
    wasTrimmed: true,
  });
  assert.equal(text.documentId, "doc-1");
  assert.equal(text.pages.length, 2);
});

test("every contract category has a display label", () => {
  assert.equal(Object.keys(COMPARE_CATEGORY_LABELS).length, 9);
  for (const label of Object.values(COMPARE_CATEGORY_LABELS)) {
    assert.ok(label.trim().length > 0);
  }
});

test("countCitedExcerpts counts distinct cited excerpts per document", () => {
  const cited = (excerpt: string, documentId: string): PromiseToPaperFinding => ({
    category: "compensation",
    status: "consistent",
    explanation: "Comparison of excerpts only, with stated limitations.",
    followUpQuestion: "Is overtime paid?",
    contractClause: {
      category: "compensation",
      claim: "Base salary is £12.50 per hour.",
      documentReference: {
        documentId,
        documentType: "employment_contract",
        fileName: "c.pdf",
        pageNumber: 1,
      },
      sourceExcerpt: excerpt,
    },
  });
  const findings = [
    cited("Base salary is £12.50 per hour.", "doc-contract"),
    cited("Base salary is £12.50 per hour.", "doc-contract"),
    cited("Normal working hours are 40 hours per week.", "doc-contract"),
  ];
  // The repeated excerpt counts once; unknown docs and empty lists are zero.
  assert.equal(countCitedExcerpts(findings, "doc-contract"), 2);
  assert.equal(countCitedExcerpts(findings, "doc-other"), 0);
  assert.equal(countCitedExcerpts([], "doc-contract"), 0);
});

test("buildComparisonTitle joins names with vs and counts the rest", () => {
  assert.equal(buildComparisonTitle([]), "");
  assert.equal(buildComparisonTitle(["contract.pdf"]), "contract.pdf");
  assert.equal(buildComparisonTitle(["ad.txt", "contract.pdf"]), "ad.txt vs contract.pdf");
  assert.equal(
    buildComparisonTitle(["ad.txt", "message.txt", "contract.pdf"]),
    "ad.txt vs message.txt +1",
  );
  assert.equal(
    buildComparisonTitle(["a", "b", "c", "d"]),
    "a vs b +2",
  );
});
