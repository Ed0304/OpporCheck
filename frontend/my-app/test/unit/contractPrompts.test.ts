// Promise-to-Paper prompt tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert prompt assembly only: verbatim content inclusion,
// page markers, category coverage, rules, and input caps.

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExtractionPrompt,
  buildPromiseComparisonPrompt,
  COMPARISON_MAX_TERMS,
  EXTRACTION_MAX_CHARS,
  type ComparisonInput,
} from "../../src/lib/contractPrompts";
import type { ContractDocumentText, EmploymentClaim } from "../../src/lib/contractTypes";

const DOC: ContractDocumentText = {
  documentId: "doc-1",
  documentType: "employment_contract",
  fileName: "contract.pdf",
  pages: [
    "Base salary is £12.50 per hour, paid monthly into the worker bank account.",
    "Accommodation fee of £120 will be deducted monthly from wages without exception.",
  ],
};

function claim(overrides: Partial<EmploymentClaim> = {}): EmploymentClaim {
  return {
    category: "compensation",
    claim: "Base salary is £12.50 per hour.",
    documentReference: {
      documentId: "doc-1",
      documentType: "employment_contract",
      fileName: "contract.pdf",
      pageNumber: 1,
    },
    sourceExcerpt: "Base salary is £12.50 per hour, paid monthly into the worker bank account.",
    ...overrides,
  };
}

test("extraction prompt embeds pages with markers and category rules", () => {
  const prompt = buildExtractionPrompt(DOC);
  assert.match(prompt, /\[Page 1\]/);
  assert.match(prompt, /\[Page 2\]/);
  assert.ok(prompt.includes("Base salary is £12.50 per hour, paid monthly into the worker bank account."));
  for (const category of [
    "compensation",
    "deductions",
    "working_conditions",
    "employment_period",
    "benefits",
    "termination",
    "immigration",
    "responsibilities",
  ]) {
    assert.ok(prompt.includes(category), `missing category ${category}`);
  }
  assert.match(prompt, /verbatim/i);
  assert.match(prompt, /missing_categories/);
  assert.match(prompt, /never invent/i);
  assert.match(prompt, /Do not judge whether any clause is legal/i);
});

test("extraction prompt truncates long documents with a marker", () => {
  const long: ContractDocumentText = {
    ...DOC,
    pages: ["Long clause. ".repeat(2000)],
  };
  const prompt = buildExtractionPrompt(long);
  assert.match(prompt, /\[trimmed: remaining text not analyzed\]/);
  assert.match(prompt, /trimmed to fit/);
  const body = prompt.split("Document (contract.pdf")[1] ?? "";
  assert.ok(body.length < EXTRACTION_MAX_CHARS + 500, "extraction input is bounded");
});

test("comparison prompt embeds terms, ids, statuses, and the worked example", () => {
  const inputs: ComparisonInput[] = [
    { documentId: "doc-1", documentType: "employment_contract", fileName: "c.pdf", terms: [claim()] },
    {
      documentId: "doc-2",
      documentType: "recruiter_communication",
      fileName: "m.txt",
      terms: [
        claim({
          category: "deductions",
          claim: "Accommodation is free.",
          documentReference: {
            documentId: "doc-2",
            documentType: "recruiter_communication",
            fileName: "m.txt",
            pageNumber: 1,
          },
          sourceExcerpt: "Accommodation is completely free for every worker.",
        }),
      ],
    },
  ];
  const prompt = buildPromiseComparisonPrompt(inputs);
  assert.ok(prompt.includes("doc-1"));
  assert.ok(prompt.includes("doc-2"));
  assert.ok(prompt.includes("Base salary is £12.50 per hour, paid monthly into the worker bank account."));
  assert.ok(prompt.includes("Accommodation is completely free for every worker."));
  for (const status of ["consistent", "discrepancy", "not_addressed", "needs_clarification"]) {
    assert.ok(prompt.includes(status), `missing status ${status}`);
  }
  assert.match(prompt, /human reviewer should examine/i);
  assert.match(prompt, /numerical differences/);
  assert.match(prompt, /Do not label any employer/i);
  assert.match(prompt, /recruiter says accommodation is free/);
});

test("comparison prompt caps terms and excerpts with markers", () => {
  const terms = Array.from({ length: COMPARISON_MAX_TERMS + 10 }, (_, index) =>
    claim({ claim: `Term number ${index} with enough words to validate length.` }),
  );
  const inputs: ComparisonInput[] = [
    { documentId: "doc-1", documentType: "employment_contract", fileName: "c.pdf", terms },
  ];
  const prompt = buildPromiseComparisonPrompt(inputs);
  assert.ok(!prompt.includes("Term number 40"), "terms beyond the cap are excluded");
  assert.ok(prompt.includes("Term number 39"), "terms within the cap are included");

  const longExcerpt = "Important clause text. ".repeat(100);
  const longInputs: ComparisonInput[] = [
    {
      documentId: "doc-1",
      documentType: "employment_contract",
      fileName: "c.pdf",
      terms: [claim({ sourceExcerpt: longExcerpt })],
    },
  ];
  const longPrompt = buildPromiseComparisonPrompt(longInputs);
  assert.match(longPrompt, /\[trimmed\]/);
  assert.ok(!longPrompt.includes(longExcerpt), "overlong excerpts are shortened");
  assert.ok(longExcerpt.startsWith(longPrompt.split('Excerpt: "')[1]!.split(" [trimmed]")[0]!));
});
