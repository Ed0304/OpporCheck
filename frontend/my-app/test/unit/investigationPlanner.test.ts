// Investigation planner tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app; compiles this file plus
// the dependency-free modules it imports, then runs node --test.)
// These tests assert planner output and plan validation only. They do not
// test live retrieval, Firebase Auth, Firestore, or AI inference.

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvestigationPlan,
  INVESTIGATION_CORRIDOR,
  type InvestigationPlan,
} from "../../src/lib/investigationPlanner";
import { validateInvestigationPlan } from "../../src/lib/validation";
import type { OpportunityReport } from "../../src/lib/opportunityAnalyzer";

function baseReport(overrides: Partial<OpportunityReport> = {}): OpportunityReport {
  return {
    occupation: "Fruit Picker",
    employer: "not specified",
    salary: "not specified",
    destination_country: "United Kingdom",
    employment_type: "unknown",
    ...overrides,
  };
}

function planText(plan: InvestigationPlan): string {
  return plan.items
    .map((item) =>
      [
        item.claim,
        item.research_question,
        item.why_it_matters,
        item.evidence_required,
      ].join(" "),
    )
    .join(" ");
}

test("stated pay produces a pay-rates investigation item", async () => {
  const plan = buildInvestigationPlan(baseReport({ salary: "£11/hour, 50h/week" }), "");
  const pay = plan.items.find((item) => item.source_category === "pay-rates");
  assert.ok(pay, "expected a pay-rates item");
  assert.equal(pay.category, "explicit-claim");
  assert.match(pay.claim, /£11\/hour, 50h\/week/);
  assert.match(pay.research_question, /minimum wage/i);
});

test("seasonal UK work produces guidance and visa items", async () => {
  const plan = buildInvestigationPlan(
    baseReport({ employment_type: "seasonal" }),
    "Seasonal fruit picking in Kent.",
  );
  const categories = plan.items.map((item) => item.source_category);
  assert.ok(categories.includes("seasonal-guidance"), "expected a seasonal-guidance item");
  assert.ok(categories.includes("visa-route"), "expected a visa-route item");
});

test("fee concerns become neutral questions quoting the evidence", async () => {
  const plan = buildInvestigationPlan(
    baseReport({
      concerns: [
        {
          concern: "Upfront fee requested",
          evidence: "send £150 admin fee via bank transfer",
          confidence: "high",
        },
      ],
    }),
    "",
  );
  const fee = plan.items.find((item) => item.source_category === "worker-rights-and-fees");
  assert.ok(fee, "expected a worker-rights-and-fees item");
  assert.equal(fee.category, "potential-concern");
  assert.equal(fee.priority, "high");
  assert.match(fee.claim, /send £150 admin fee via bank transfer/);
  assert.match(fee.research_question, /\?$/);
});

test("planner output contains no accusations and no invented references", async () => {
  const plan = buildInvestigationPlan(
    baseReport({
      salary: "£11/hour cash in hand",
      employment_type: "seasonal",
      concerns: [
        { concern: "Upfront fee requested", evidence: "send £150 fee", confidence: "high" },
        { concern: "WhatsApp only contact", evidence: "message us on WhatsApp", confidence: "low" },
      ],
      missing_information: ["employer name", "contract terms"],
    }),
    "URGENT HIRING - Fruit Pickers wanted in Kent!",
  );
  assert.ok(plan.items.length > 0, "expected plan items");
  const text = planText(plan);
  assert.doesNotMatch(text, /scam|fraud|fake|criminal/i);
  assert.doesNotMatch(text, /https?:\/\//i);
  assert.doesNotMatch(text, /licence (number|no\.?)|registration number/i);
});

test("missing information becomes low-priority missing-information items", async () => {
  const plan = buildInvestigationPlan(
    baseReport({
      occupation: "Warehouse Operative",
      missing_information: ["employer name", "contract terms"],
    }),
    "",
  );
  const missing = plan.items.filter((item) => item.category === "missing-information");
  assert.equal(missing.length, 2);
  for (const item of missing) {
    assert.equal(item.priority, "low");
  }
  assert.match(planText(plan), /employer name/);
});

test("non-UK destinations produce an empty plan", async () => {
  const plan = buildInvestigationPlan(baseReport({ destination_country: "Canada" }), "");
  assert.equal(plan.corridor, INVESTIGATION_CORRIDOR);
  assert.equal(plan.items.length, 0);
});

test("empty input produces an empty plan, not invented items", async () => {
  const plan = buildInvestigationPlan(
    baseReport({
      occupation: "not specified",
      destination_country: "not specified",
    }),
    "",
  );
  assert.equal(plan.items.length, 0);
});

test("plan items are deduplicated and capped", async () => {
  const missing = Array.from({ length: 60 }, (_, index) => `missing detail ${index}`);
  const plan = buildInvestigationPlan(baseReport({ missing_information: missing }), "");
  assert.ok(plan.items.length <= 12, `expected at most 12 items, got ${plan.items.length}`);
  const questions = plan.items.map((item) => item.research_question);
  assert.equal(new Set(questions).size, questions.length);
});

test("validateInvestigationPlan accepts planner output", async () => {
  const plan = buildInvestigationPlan(
    baseReport({
      salary: "£12/hour",
      concerns: [{ concern: "Fee", evidence: "pay £50", confidence: "medium" }],
      missing_information: ["contract terms"],
    }),
    "",
  );
  const result = validateInvestigationPlan(plan);
  assert.equal(result.valid, true);
  assert.ok(result.value);
  assert.equal(result.value.corridor, INVESTIGATION_CORRIDOR);
});

test("validateInvestigationPlan rejects malformed plans", async () => {
  assert.equal(validateInvestigationPlan(null).valid, false);
  assert.equal(validateInvestigationPlan({}).valid, false);
  assert.equal(
    validateInvestigationPlan({ corridor: "United Kingdom", items: "nope" }).valid,
    false,
  );
  const badCategory = {
    corridor: "United Kingdom",
    items: [
      {
        claim: "x",
        category: "accusation",
        research_question: "q?",
        why_it_matters: "w",
        source_category: "pay-rates",
        evidence_required: "e",
        priority: "high",
      },
    ],
  };
  const rejectedCategory = validateInvestigationPlan(badCategory);
  assert.equal(rejectedCategory.valid, false);
  assert.match(rejectedCategory.issues.join(";"), /category/);
  const emptyClaim = {
    corridor: "United Kingdom",
    items: [
      {
        claim: "  ",
        category: "explicit-claim",
        research_question: "q?",
        why_it_matters: "w",
        source_category: "pay-rates",
        evidence_required: "e",
        priority: "high",
      },
    ],
  };
  assert.equal(validateInvestigationPlan(emptyClaim).valid, false);
});
