// Promise-to-Paper validation tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert extraction/comparison validation and excerpt/page
// attribution only. They do not test live retrieval, Firebase Auth,
// Firestore, or AI inference.

import assert from "node:assert/strict";
import test from "node:test";
import type { ContractDocumentText } from "../../src/lib/contractTypes";
import {
  locateExcerptPage,
  parseExtractionOutput,
  parsePromiseComparison,
  validateEmploymentClaim,
  validatePromiseToPaperFinding,
} from "../../src/lib/validation";

const AD: ContractDocumentText = {
  documentId: "doc-ad",
  documentType: "job_advertisement",
  fileName: "ad.txt",
  pages: [
    "Fruit pickers wanted in Kent. Pay is £12.50 per hour for 40 hours per week. Accommodation provided free of charge.",
  ],
};

const RECRUITER: ContractDocumentText = {
  documentId: "doc-msg",
  documentType: "recruiter_communication",
  fileName: "message.txt",
  pages: [
    "Hello! Accommodation is completely free. We pay for your flight to London.",
  ],
};

const CONTRACT: ContractDocumentText = {
  documentId: "doc-contract",
  documentType: "employment_contract",
  fileName: "contract.pdf",
  pages: [
    "Employment contract. Base salary is £12.50 per hour. Normal working hours are 40 hours per week, Monday to Friday.",
    "Accommodation fee of £120 will be deducted monthly from wages. Either party may end this agreement with 2 weeks notice.",
  ],
};

const DOCS = [AD, RECRUITER, CONTRACT];

function extractionPayload() {
  return {
    terms: [
      {
        category: "compensation",
        claim: "Base salary is £12.50 per hour.",
        sourceExcerpt: "Base salary is £12.50 per hour.",
      },
      {
        category: "deductions",
        claim: "£120 monthly accommodation deduction.",
        sourceExcerpt: "Accommodation fee of £120 will be deducted monthly from wages.",
        pageNumber: 2,
      },
    ],
    missing_categories: ["immigration", "benefits"],
  };
}

function comparisonFinding() {
  return {
    category: "deductions",
    recruiterStatement: {
      documentId: "doc-msg",
      claim: "Accommodation is free.",
      sourceExcerpt: "Accommodation is completely free.",
    },
    contractClause: {
      documentId: "doc-contract",
      claim: "£120 monthly accommodation deduction.",
      sourceExcerpt: "Accommodation fee of £120 will be deducted monthly from wages.",
      pageNumber: 2,
    },
    status: "discrepancy",
    explanation:
      "The written agreement specifies a monthly accommodation deduction, which differs from the recruiter statement. The comparison covers excerpts only.",
    followUpQuestion:
      "Is the deduction mandatory, what does it cover, and do other accommodation costs apply?",
  };
}

test("extraction output validates and attaches located page references", () => {
  const parsed = parseExtractionOutput(JSON.stringify(extractionPayload()), CONTRACT);
  assert.equal(parsed.parseError, null);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.terms.length, 2);
  assert.equal(parsed.terms[0]?.documentReference.pageNumber, 1);
  assert.equal(parsed.terms[0]?.documentReference.documentId, "doc-contract");
  assert.equal(parsed.terms[1]?.documentReference.pageNumber, 2);
  assert.deepEqual(parsed.missingCategories, ["immigration", "benefits"]);
});

test("extraction rejects malformed payloads", () => {
  assert.ok(parseExtractionOutput("not json", CONTRACT).parseError);
  assert.ok(parseExtractionOutput(JSON.stringify(["nope"]), CONTRACT).parseError);
  assert.ok(parseExtractionOutput(JSON.stringify({}), CONTRACT).parseError);
  const badCategory = extractionPayload();
  (badCategory.terms[0] as { category: string }).category = "vibes";
  const parsed = parseExtractionOutput(JSON.stringify(badCategory), CONTRACT);
  assert.equal(parsed.terms.length, 1);
  assert.equal(parsed.issues.length, 1);
});

test("extraction drops fabricated excerpts but keeps valid terms", () => {
  const payload = extractionPayload();
  payload.terms.push({
    category: "benefits",
    claim: "Company car provided.",
    sourceExcerpt: "A luxury company car is provided to every picker.",
  });
  const parsed = parseExtractionOutput(JSON.stringify(payload), CONTRACT);
  assert.equal(parsed.terms.length, 2);
  assert.match(parsed.issues.join(";"), /excerpt/i);
});

test("extraction corrects wrong AI page numbers to the located page", () => {
  const payload = extractionPayload();
  (payload.terms[1] as { pageNumber: number }).pageNumber = 1;
  const parsed = parseExtractionOutput(JSON.stringify(payload), CONTRACT);
  assert.equal(parsed.terms.length, 2);
  assert.equal(parsed.terms[1]?.documentReference.pageNumber, 2);
});

test("extraction rejects overlong excerpts and unknown missing categories", () => {
  const payload = extractionPayload();
  payload.terms[0]!.sourceExcerpt = "Base salary is £12.50 per hour.";
  payload.missing_categories = ["immigration", "telepathy"];
  const parsed = parseExtractionOutput(JSON.stringify(payload), CONTRACT);
  assert.deepEqual(parsed.missingCategories, ["immigration"]);
  assert.match(parsed.issues.join(";"), /missing_categories/i);

  const longPayload = extractionPayload();
  longPayload.terms[0]!.sourceExcerpt = "x".repeat(5000);
  const parsedLong = parseExtractionOutput(JSON.stringify(longPayload), CONTRACT);
  assert.equal(parsedLong.terms.length, 1);
});

test("comparison accepts all four statuses", () => {
  const base = comparisonFinding();
  const findings = [
    { ...base, status: "discrepancy" },
    {
      category: "compensation",
      advertisementClaim: {
        documentId: "doc-ad",
        claim: "Pay is £12.50 per hour.",
        sourceExcerpt: "Pay is £12.50 per hour for 40 hours per week.",
      },
      contractClause: {
        documentId: "doc-contract",
        claim: "Base salary is £12.50 per hour.",
        sourceExcerpt: "Base salary is £12.50 per hour.",
      },
      status: "consistent",
      explanation: "Both documents state £12.50 per hour. Excerpts only were compared.",
      followUpQuestion: "Is overtime paid at the same rate?",
    },
    {
      category: "benefits",
      recruiterStatement: {
        documentId: "doc-msg",
        claim: "Flight is paid for.",
        sourceExcerpt: "We pay for your flight to London.",
      },
      status: "not_addressed",
      explanation: "No provided written document addresses flights. Excerpts only were compared.",
      followUpQuestion: "Will flight costs be confirmed in writing before travel?",
    },
    {
      category: "working_conditions",
      advertisementClaim: {
        documentId: "doc-ad",
        claim: "Accommodation provided.",
        sourceExcerpt: "Accommodation provided free of charge.",
      },
      status: "needs_clarification",
      explanation:
        "The wording is ambiguous and a human reviewer should compare it against the written terms.",
      followUpQuestion: "What exactly does the accommodation arrangement include?",
    },
  ];
  const parsed = parsePromiseComparison(JSON.stringify(findings), DOCS);
  assert.equal(parsed.parseError, null);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.findings.length, 4);
});

test("comparison rejects bad statuses and empty text fields", () => {
  const bad = comparisonFinding();
  (bad as { status: string }).status = "fraud";
  assert.equal(parsePromiseComparison(JSON.stringify([bad]), DOCS).findings.length, 0);

  const empty = comparisonFinding();
  empty.explanation = "  ";
  assert.equal(parsePromiseComparison(JSON.stringify([empty]), DOCS).findings.length, 0);

  const emptyQ = comparisonFinding();
  emptyQ.followUpQuestion = "";
  assert.equal(parsePromiseComparison(JSON.stringify([emptyQ]), DOCS).findings.length, 0);
});

test("consistent and discrepancy findings must span two documents", () => {
  const single = comparisonFinding();
  delete (single as Partial<typeof single>).recruiterStatement;
  const parsed = parsePromiseComparison(JSON.stringify([single]), DOCS);
  assert.equal(parsed.findings.length, 0);
  assert.match(parsed.issues.join(";"), /two documents/i);
});

test("not_addressed findings must be promise-side only", () => {
  const withClause = {
    category: "benefits",
    recruiterStatement: {
      documentId: "doc-msg",
      claim: "Flight is paid for.",
      sourceExcerpt: "We pay for your flight to London.",
    },
    contractClause: {
      documentId: "doc-contract",
      claim: "Base salary is £12.50 per hour.",
      sourceExcerpt: "Base salary is £12.50 per hour.",
    },
    status: "not_addressed",
    explanation: "x".repeat(50),
    followUpQuestion: "y".repeat(20),
  };
  assert.equal(parsePromiseComparison(JSON.stringify([withClause]), DOCS).findings.length, 0);

  const contractOnly = {
    category: "compensation",
    contractClause: {
      documentId: "doc-contract",
      claim: "Base salary is £12.50 per hour.",
      sourceExcerpt: "Base salary is £12.50 per hour.",
    },
    status: "not_addressed",
    explanation: "x".repeat(50),
    followUpQuestion: "y".repeat(20),
  };
  assert.equal(parsePromiseComparison(JSON.stringify([contractOnly]), DOCS).findings.length, 0);
});

test("comparison drops fabricated excerpts and unknown document ids", () => {
  const fabricated = comparisonFinding();
  fabricated.contractClause!.sourceExcerpt = "The employer is certified fraud-free by all authorities.";
  const parsed = parsePromiseComparison(JSON.stringify([fabricated]), DOCS);
  assert.equal(parsed.findings.length, 0);
  assert.match(parsed.issues.join(";"), /excerpt/i);

  const unknownDoc = comparisonFinding();
  unknownDoc.contractClause!.documentId = "doc-evil";
  const parsedUnknown = parsePromiseComparison(JSON.stringify([unknownDoc]), DOCS);
  assert.equal(parsedUnknown.findings.length, 0);
  assert.match(parsedUnknown.issues.join(";"), /document/i);
});

test("excerpts must come from the cited document, in the matching slot", () => {
  const swapped = comparisonFinding();
  swapped.recruiterStatement!.sourceExcerpt =
    "Accommodation fee of £120 will be deducted monthly from wages.";
  const parsed = parsePromiseComparison(JSON.stringify([swapped]), DOCS);
  assert.equal(parsed.findings.length, 0);

  const wrongSlot = comparisonFinding();
  wrongSlot.recruiterStatement!.documentId = "doc-contract";
  const parsedSlot = parsePromiseComparison(JSON.stringify([wrongSlot]), DOCS);
  assert.equal(parsedSlot.findings.length, 0);
  assert.match(parsedSlot.issues.join(";"), /recruiter/i);
});

test("numeric discrepancies validate with both excerpts preserved", () => {
  const parsed = parsePromiseComparison(JSON.stringify([comparisonFinding()]), DOCS);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0]?.status, "discrepancy");
  assert.match(parsed.findings[0]?.recruiterStatement?.sourceExcerpt ?? "", /completely free/);
  assert.match(parsed.findings[0]?.contractClause?.sourceExcerpt ?? "", /£120/);
  assert.equal(parsed.findings[0]?.contractClause?.documentReference.pageNumber, 2);
});

test("comparison corrects wrong page numbers and caps finding counts", () => {
  const finding = comparisonFinding();
  finding.contractClause!.pageNumber = 1;
  const parsed = parsePromiseComparison(JSON.stringify([finding]), DOCS);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0]?.contractClause?.documentReference.pageNumber, 2);

  const many = Array.from({ length: 61 }, () => comparisonFinding());
  const parsedMany = parsePromiseComparison(JSON.stringify(many), DOCS);
  assert.equal(parsedMany.findings.length, 60);
  assert.ok(parsedMany.issues.length > 0);
});

test("comparison accepts three-document findings and reports malformed output", () => {
  const threeWay = {
    ...comparisonFinding(),
    advertisementClaim: {
      documentId: "doc-ad",
      claim: "Accommodation provided free.",
      sourceExcerpt: "Accommodation provided free of charge.",
    },
  };
  const parsed = parsePromiseComparison(JSON.stringify([threeWay]), DOCS);
  assert.equal(parsed.findings.length, 1);

  assert.ok(parsePromiseComparison("nope", DOCS).parseError);
  assert.ok(parsePromiseComparison(JSON.stringify({}), DOCS).parseError);
  const empty = parsePromiseComparison(JSON.stringify([]), DOCS);
  assert.equal(empty.parseError, null);
  assert.equal(empty.findings.length, 0);
});

test("standalone finding and claim validators enforce shapes", () => {
  const claim = {
    category: "compensation",
    claim: "Pay is £12.50 per hour.",
    documentReference: {
      documentId: "doc-ad",
      documentType: "job_advertisement",
      fileName: "ad.txt",
    },
    sourceExcerpt: "Pay is £12.50 per hour for 40 hours per week.",
  };
  assert.equal(validateEmploymentClaim(claim).valid, true);
  assert.equal(
    validateEmploymentClaim({ ...claim, category: "astrology" }).valid,
    false,
  );
  assert.equal(
    validateEmploymentClaim({
      ...claim,
      documentReference: { ...claim.documentReference, pageNumber: 0 },
    }).valid,
    false,
  );

  const recruiterClaim = {
    ...claim,
    category: "deductions",
    documentReference: {
      documentId: "doc-msg",
      documentType: "recruiter_communication",
      fileName: "message.txt",
    },
  };
  const finding = {
    category: "deductions",
    recruiterStatement: recruiterClaim,
    status: "needs_clarification",
    explanation: "Ambiguous wording needs a human reviewer.",
    followUpQuestion: "What does the deduction cover?",
  };
  assert.equal(validatePromiseToPaperFinding(finding).valid, true);
  assert.equal(
    validatePromiseToPaperFinding({ ...finding, status: "scam" }).valid,
    false,
  );
  assert.equal(
    validatePromiseToPaperFinding({
      category: "deductions",
      status: "consistent",
      explanation: "x".repeat(50),
      followUpQuestion: "y".repeat(20),
    }).valid,
    false,
  );
});

test("comparison treats explicit null slots as absent", () => {
  const finding = { ...comparisonFinding(), advertisementClaim: null };
  const parsed = parsePromiseComparison(JSON.stringify([finding]), DOCS);
  assert.equal(parsed.parseError, null);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0]?.advertisementClaim, undefined);
});

test("standalone finding validator treats null slots as absent", () => {
  const claim = {
    category: "deductions",
    claim: "Accommodation is free.",
    documentReference: {
      documentId: "doc-msg",
      documentType: "recruiter_communication",
      fileName: "message.txt",
    },
    sourceExcerpt: "Accommodation is completely free.",
  };
  const result = validatePromiseToPaperFinding({
    category: "deductions",
    recruiterStatement: claim,
    contractClause: null,
    status: "not_addressed",
    explanation: "The promise-side term has no written counterpart in the supplied documents.",
    followUpQuestion: "Where is the accommodation term written?",
  });
  assert.equal(result.valid, true);
});

test("locateExcerptPage finds normalized pages and rejects short excerpts", () => {
  assert.equal(locateExcerptPage(CONTRACT.pages, "base   SALARY is £12.50\nper hour."), 1);
  assert.equal(
    locateExcerptPage(CONTRACT.pages, "Accommodation fee of £120 will be deducted monthly from wages."),
    2,
  );
  assert.equal(locateExcerptPage(CONTRACT.pages, "clause that appears nowhere in the text"), null);
  assert.equal(locateExcerptPage(CONTRACT.pages, "short"), null);
  assert.equal(locateExcerptPage([], "Base salary is £12.50 per hour."), null);
});

test("comparison resolves file names and quoted ids to compared documents", () => {
  const byName = comparisonFinding();
  byName.recruiterStatement!.documentId = "message.txt";
  byName.contractClause!.documentId = '"contract.pdf"';
  const parsed = parsePromiseComparison(JSON.stringify([byName]), DOCS);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.findings.length, 1);
  assert.equal(
    parsed.findings[0]?.recruiterStatement?.documentReference.documentId,
    "doc-msg",
  );
  assert.equal(
    parsed.findings[0]?.contractClause?.documentReference.documentId,
    "doc-contract",
  );
});

test("comparison still rejects unknown and ambiguous document references", () => {
  const unknown = comparisonFinding();
  unknown.recruiterStatement!.documentId = "doc-nope-9";
  assert.equal(parsePromiseComparison(JSON.stringify([unknown]), DOCS).findings.length, 0);
  const ambiguousDocs: ContractDocumentText[] = [
    { ...RECRUITER, documentId: "doc-a", fileName: "same.pdf" },
    { ...CONTRACT, documentId: "doc-b", fileName: "same.pdf" },
  ];
  const ambiguous = comparisonFinding();
  ambiguous.recruiterStatement!.documentId = "same.pdf";
  ambiguous.contractClause!.documentId = "doc-b";
  assert.equal(
    parsePromiseComparison(JSON.stringify([ambiguous]), ambiguousDocs).findings.length,
    0,
  );
});

test("comparison resolves ordinal document labels in input order", () => {
  // DOCS order is [AD, RECRUITER, CONTRACT].
  const ordinal = comparisonFinding();
  ordinal.recruiterStatement!.documentId = "Document 2";
  ordinal.contractClause!.documentId = "document 3";
  const parsed = parsePromiseComparison(JSON.stringify([ordinal]), DOCS);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.findings.length, 1);
  assert.equal(
    parsed.findings[0]?.recruiterStatement?.documentReference.documentId,
    "doc-msg",
  );
  assert.equal(
    parsed.findings[0]?.contractClause?.documentReference.documentId,
    "doc-contract",
  );
  const outOfRange = comparisonFinding();
  outOfRange.recruiterStatement!.documentId = "Document 9";
  assert.equal(
    parsePromiseComparison(JSON.stringify([outOfRange]), DOCS).findings.length,
    0,
  );
});

test("comparison accepts shortened ordinal references", () => {
  for (const [recruiterRef, contractRef] of [
    ["2", "3"],
    [2, 3],
    ["Doc 2", "Doc 3"],
    ["document2", "DOCUMENT 3."],
    ["#2", "D3"],
  ] as Array<[unknown, unknown]>) {
    const finding = comparisonFinding();
    (finding.recruiterStatement as { documentId: unknown }).documentId = recruiterRef;
    (finding.contractClause as { documentId: unknown }).documentId = contractRef;
    const parsed = parsePromiseComparison(JSON.stringify([finding]), DOCS);
    assert.equal(parsed.findings.length, 1, `refs ${recruiterRef}/${contractRef} dropped`);
    assert.equal(
      parsed.findings[0]?.recruiterStatement?.documentReference.documentId,
      "doc-msg",
    );
    assert.equal(
      parsed.findings[0]?.contractClause?.documentReference.documentId,
      "doc-contract",
    );
  }
});

test("unmatched references name the received value", () => {
  const bad = comparisonFinding();
  bad.recruiterStatement!.documentId = "Exhibit Z";
  const parsed = parsePromiseComparison(JSON.stringify([bad]), DOCS);
  assert.equal(parsed.findings.length, 0);
  assert.match(parsed.issues.join(";"), /'Exhibit Z' does not match/);
});

test("comparison normalizes case variants of category and status", () => {
  const varied = { ...comparisonFinding(), category: "Deductions", status: "Discrepancy " };
  const parsed = parsePromiseComparison(JSON.stringify([varied]), DOCS);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0]?.category, "deductions");
  assert.equal(parsed.findings[0]?.status, "discrepancy");
});

test("comparison skips malformed slots but keeps findings with verified claims", () => {
  const sparse = {
    ...comparisonFinding(),
    advertisementClaim: {
      documentId: "doc-ad",
      claim: "Accommodation provided free.",
      sourceExcerpt: "",
    },
  };
  const parsed = parsePromiseComparison(JSON.stringify([sparse]), DOCS);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0]?.advertisementClaim, undefined);
  assert.ok(parsed.issues.length > 0, "skipped slots stay recorded");

  const onlyBad = {
    ...comparisonFinding(),
    recruiterStatement: {
      documentId: "doc-msg",
      claim: "Accommodation is free.",
      sourceExcerpt: "",
    },
    contractClause: {
      documentId: "doc-contract",
      claim: "£120 monthly accommodation deduction.",
      sourceExcerpt: "",
    },
  };
  const parsedEmpty = parsePromiseComparison(JSON.stringify([onlyBad]), DOCS);
  assert.equal(parsedEmpty.findings.length, 0);
});

test("standalone finding validator skips malformed slots", () => {
  const good = {
    category: "deductions",
    claim: "Accommodation is free.",
    documentReference: {
      documentId: "doc-msg",
      documentType: "recruiter_communication",
      fileName: "message.txt",
    },
    sourceExcerpt: "Accommodation is completely free.",
  };
  const result = validatePromiseToPaperFinding({
    category: "deductions",
    recruiterStatement: good,
    contractClause: { ...good, sourceExcerpt: "" },
    status: "not_addressed",
    explanation: "The promise-side term has no written counterpart in the supplied documents.",
    followUpQuestion: "Where is the accommodation term written?",
  });
  assert.equal(result.valid, true);
  assert.equal(result.value?.contractClause, undefined);
  assert.ok(result.issues.length > 0, "skipped slots stay recorded");
});

test("comparison amputates mistyped slots but keeps coherent survivors", () => {
  const misfiled = {
    ...comparisonFinding(),
    advertisementClaim: {
      documentId: "doc-contract",
      claim: "£120 monthly accommodation deduction.",
      sourceExcerpt: "Accommodation fee of £120 will be deducted monthly from wages.",
    },
  };
  const parsed = parsePromiseComparison(JSON.stringify([misfiled]), DOCS);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0]?.advertisementClaim, undefined);
  assert.ok(parsed.findings[0]?.recruiterStatement);
  assert.ok(parsed.findings[0]?.contractClause);
  assert.match(parsed.issues.join(";"), /slot skipped/);

  const onlyMistyped = {
    ...comparisonFinding(),
    recruiterStatement: {
      documentId: "doc-contract",
      claim: "£120 monthly accommodation deduction.",
      sourceExcerpt: "Accommodation fee of £120 will be deducted monthly from wages.",
    },
    contractClause: {
      documentId: "doc-contract",
      claim: "£120 monthly accommodation deduction.",
      sourceExcerpt: "Accommodation fee of £120 will be deducted monthly from wages.",
    },
  };
  const parsedEmpty = parsePromiseComparison(JSON.stringify([onlyMistyped]), DOCS);
  assert.equal(parsedEmpty.findings.length, 0);
});

test("comparison accepts supporting evidence from other documents", () => {
  const invoice: ContractDocumentText = {
    documentId: "doc-invoice",
    documentType: "other",
    fileName: "invoice.pdf",
    pages: ["Invoice total: £120 accommodation charge for March."],
  };
  const docs = [...DOCS, invoice];
  const withSupporting = {
    ...comparisonFinding(),
    supportingEvidence: {
      documentId: "doc-invoice",
      claim: "£120 accommodation charge invoiced.",
      sourceExcerpt: "Invoice total: £120 accommodation charge for March.",
    },
  };
  const parsed = parsePromiseComparison(JSON.stringify([withSupporting]), docs);
  assert.equal(parsed.findings.length, 1);
  assert.equal(
    parsed.findings[0]?.supportingEvidence?.documentReference.documentId,
    "doc-invoice",
  );

  const gap = {
    category: "deductions",
    recruiterStatement: {
      documentId: "doc-msg",
      claim: "Accommodation is free.",
      sourceExcerpt: "Accommodation is completely free.",
    },
    supportingEvidence: {
      documentId: "doc-invoice",
      claim: "£120 accommodation charge invoiced.",
      sourceExcerpt: "Invoice total: £120 accommodation charge for March.",
    },
    status: "not_addressed",
    explanation: "The promise-side term has no written counterpart in the supplied documents.",
    followUpQuestion: "Where is the accommodation term written?",
  };
  const parsedGap = parsePromiseComparison(JSON.stringify([gap]), docs);
  assert.equal(parsedGap.findings.length, 1);
});

test("comparison counts dropped findings separately from issue lines", () => {
  const bad = {
    ...comparisonFinding(),
    recruiterStatement: {
      documentId: "doc-nope",
      claim: "x",
      sourceExcerpt: "yyyy",
    },
    contractClause: {
      documentId: "doc-nope",
      claim: "x",
      sourceExcerpt: "yyyy",
    },
  };
  const parsed = parsePromiseComparison(
    JSON.stringify([comparisonFinding(), bad]),
    DOCS,
  );
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.dropped, 1);
  assert.ok(parsed.issues.length >= 1);
});

test("locateExcerptPage tolerates quoted page markers but never trusts them", () => {
  assert.equal(
    locateExcerptPage(CONTRACT.pages, "[Page 1] Base salary is £12.50 per hour."),
    1,
  );
  assert.equal(
    locateExcerptPage(CONTRACT.pages, "[page 2] Accommodation fee of £120 will be deducted monthly from wages."),
    2,
  );
  // A marker pointing elsewhere must not move attribution: search wins.
  assert.equal(
    locateExcerptPage(CONTRACT.pages, "[Page 2] Base salary is £12.50 per hour."),
    1,
  );
  // Markers alone, or around fabricated text, still locate nothing.
  assert.equal(locateExcerptPage(CONTRACT.pages, "[Page 1]"), null);
  assert.equal(
    locateExcerptPage(CONTRACT.pages, "[Page 1] clause that appears nowhere in the text"),
    null,
  );
});
