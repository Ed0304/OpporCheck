// Promise-to-Paper session tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert report math and labels only.

import assert from "node:assert/strict";
import test from "node:test";
import {
  collectQuestions,
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
