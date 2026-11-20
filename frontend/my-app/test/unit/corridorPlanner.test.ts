// Corridor planner tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert destination routing, the Singapore rule pack, and the
// empty-plan behavior for unsupported destinations. GB behavior itself is
// covered by investigationPlanner.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvestigationPlan,
  INVESTIGATION_CORRIDOR,
} from "../../src/lib/investigationPlanner";
import { validateInvestigationPlan } from "../../src/lib/validation";
import type { OpportunityReport } from "../../src/lib/opportunityAnalyzer";

function sgReport(overrides: Partial<OpportunityReport> = {}): OpportunityReport {
  return {
    occupation: "Construction Worker",
    employer: "not specified",
    salary: "not specified",
    destination_country: "Singapore",
    employment_type: "unknown",
    ...overrides,
  };
}

test("Singapore salary produces a salary-protection item", () => {
  const plan = buildInvestigationPlan(sgReport({ salary: "S$800/month" }), "", undefined, undefined, "SG");
  assert.equal(plan.corridor, "Singapore");
  const pay = plan.items.find((item) => item.source_category === "salary-protection");
  assert.ok(pay, "expected a salary-protection item");
  assert.equal(pay.category, "explicit-claim");
  assert.match(pay.claim, /S\$800\/month/);
  assert.match(pay.research_question, /salary payment rules/);
});

test("Singapore pass mentions produce a work-authorization item", () => {
  const plan = buildInvestigationPlan(
    sgReport({ occupation: "Work Permit holder, shipyard" }),
    "S Pass application arranged by employer.",
    undefined,
    undefined,
    "SG",
  );
  const pass = plan.items.find((item) => item.source_category === "work-authorization");
  assert.ok(pass, "expected a work-authorization item");
  assert.match(pass.research_question, /Which Singapore work pass applies/);
});

test("Singapore fee concerns become high-priority recruitment-rules items", () => {
  const plan = buildInvestigationPlan(
    sgReport({
      concerns: [
        {
          concern: "Upfront fee requested",
          evidence: "pay $500 agent fee before arrival",
          confidence: "high",
        },
      ],
    }),
    "",
    undefined,
    undefined,
    "SG",
  );
  const fee = plan.items.find((item) => item.source_category === "recruitment-rules");
  assert.ok(fee, "expected a recruitment-rules item");
  assert.equal(fee.priority, "high");
  assert.match(fee.research_question, /Ministry of Manpower/);
});

test("destination resolves from the report when no code is passed", () => {
  const plan = buildInvestigationPlan(sgReport({ salary: "S$800/month" }), "");
  assert.equal(plan.corridor, "Singapore");
  assert.ok(plan.items.length > 0);
});

test("explicit destination wins over the report text", () => {
  const plan = buildInvestigationPlan(
    sgReport({ salary: "S$800/month" }),
    "",
    undefined,
    undefined,
    "GB",
  );
  assert.equal(plan.corridor, "United Kingdom");
  const pay = plan.items.find((item) => item.source_category === "pay-rates");
  assert.ok(pay, "expected the GB pay-rates item under an explicit GB code");
});

test("destinations without a rule pack produce an empty plan", () => {
  // ID is origin-only context; every destination now owns a pack.
  const plan = buildInvestigationPlan(sgReport(), "", undefined, undefined, "ID");
  assert.equal(plan.items.length, 0);
  assert.equal(plan.corridor, INVESTIGATION_CORRIDOR);
});

test("every destination pack plans salary, passes, and fees without UK rules", () => {
  const cases: Array<{
    code: string;
    corridor: string;
    passText: string;
    passQuestion: RegExp;
  }> = [
    { code: "JP", corridor: "Japan", passText: "SSW visa arranged", passQuestion: /Which Japanese work status applies/ },
    { code: "NZ", corridor: "New Zealand", passText: "Accredited Employer Work Visa", passQuestion: /accredited employer/i },
    { code: "TW", corridor: "Taiwan", passText: "broker arranges the permit", passQuestion: /What employment authorization applies/ },
    { code: "HK", corridor: "Hong Kong", passText: "FDH Standard Employment Contract", passQuestion: /Standard Employment Contract require/ },
    { code: "MY", corridor: "Malaysia", passText: "ePLKS renewal by employer", passQuestion: /Which Malaysian pass or approval applies/ },
    { code: "AU", corridor: "Australia", passText: "sponsored work visa", passQuestion: /sponsorship or visa arrangement/ },
  ];
  for (const { code, corridor, passText, passQuestion } of cases) {
    const plan = buildInvestigationPlan(
      sgReport({
        destination_country: corridor,
        salary: "800/month",
        concerns: [
          { concern: "Upfront fee requested", evidence: "pay 500 fee", confidence: "high" },
        ],
      }),
      passText,
      undefined,
      undefined,
      code,
    );
    assert.equal(plan.corridor, corridor, code);
    assert.ok(
      plan.items.some((item) => item.source_category === "salary-protection"),
      `${code}: expected a salary-protection item`,
    );
    const pass = plan.items.find((item) => item.source_category === "work-authorization");
    assert.ok(pass, `${code}: expected a work-authorization item`);
    assert.match(pass.research_question, passQuestion);
    const fee = plan.items.find((item) => item.source_category === "recruitment-rules");
    assert.ok(fee, `${code}: expected a recruitment-rules item`);
    assert.equal(fee.priority, "high");
    const text = plan.items
      .map((item) => [item.claim, item.research_question, item.why_it_matters].join(" "))
      .join(" ");
    assert.doesNotMatch(text, /UK minimum wage|certificate of sponsorship|scheme operator|sponsor's licence/i, code);
    assert.doesNotMatch(text, /United Kingdom|Kent|Manchester/, code);
    assert.doesNotMatch(text, /scam|fraud|fake|criminal/i, code);
    assert.doesNotMatch(text, /https?:\/\//i, code);
    assert.equal(validateInvestigationPlan(plan).valid, true, code);
  }
});

test("agency postings gain an origin-protection item outside GB", () => {
  for (const code of ["SG", "JP", "MY"]) {
    const plan = buildInvestigationPlan(
      sgReport({ occupation: "Factory worker via recruitment agency" }),
      "",
      undefined,
      undefined,
      code,
    );
    const origin = plan.items.find((item) => item.source_category === "origin-protection");
    assert.ok(origin, `${code}: expected an origin-protection item`);
    assert.match(origin.research_question, /licensed for Indonesian overseas placement/);
  }
  const gb = buildInvestigationPlan(
    sgReport({
      destination_country: "United Kingdom",
      occupation: "Factory worker via recruitment agency",
    }),
    "",
    undefined,
    undefined,
    "GB",
  );
  assert.ok(
    gb.items.every((item) => item.source_category !== "origin-protection"),
    "GB output stays byte-identical: no origin item",
  );
});

test("unknown explicit codes plan nothing instead of guessing", () => {
  const plan = buildInvestigationPlan(sgReport(), "", undefined, undefined, "XX");
  assert.equal(plan.items.length, 0);
});

test("UK nation names still route to the GB pack", () => {
  const plan = buildInvestigationPlan(
    sgReport({ destination_country: "England", salary: "£11/hour" }),
    "",
  );
  assert.equal(plan.corridor, "United Kingdom");
  assert.ok(plan.items.some((item) => item.source_category === "pay-rates"));
});

test("Singapore output validates and carries no UK-specific rules", () => {
  const plan = buildInvestigationPlan(
    sgReport({
      salary: "S$800/month",
      concerns: [{ concern: "Fee", evidence: "pay $50", confidence: "medium" }],
      missing_information: ["contract terms"],
    }),
    "Work Permit arranged.",
    undefined,
    undefined,
    "SG",
  );
  const result = validateInvestigationPlan(plan);
  assert.equal(result.valid, true);
  const text = plan.items
    .map((item) => [item.claim, item.research_question, item.why_it_matters].join(" "))
    .join(" ");
  assert.doesNotMatch(text, /UK minimum wage|certificate of sponsorship|scheme operator|sponsor's licence/i);
  assert.doesNotMatch(text, /United Kingdom|Kent|Manchester/);
  assert.doesNotMatch(text, /scam|fraud|fake|criminal/i);
  assert.doesNotMatch(text, /https?:\/\//i);
});
