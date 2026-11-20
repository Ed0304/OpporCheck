// Source catalog matching tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert category-to-catalog matching only. They do not test
// live retrieval or AI inference.

import assert from "node:assert/strict";
import test from "node:test";
import { sourceIdsForCategories, type SourceCatalog } from "../../src/lib/sources";

const CATALOG: SourceCatalog = {
  corridor: "United Kingdom",
  sources: [
    {
      source_id: "seasonal-worker-visa",
      label: "Seasonal Worker visa",
      url: "https://www.gov.uk/seasonal-worker-visa",
      category: "visa-route",
    },
    {
      source_id: "minimum-wage-rates",
      label: "Minimum wage rates",
      url: "https://www.gov.uk/national-minimum-wage-rates",
      category: "pay-rates",
    },
  ],
};

test("plan categories resolve to catalog ids", () => {
  const { ids, uncovered } = sourceIdsForCategories(CATALOG, ["visa-route", "pay-rates"]);
  assert.deepEqual(ids, ["seasonal-worker-visa", "minimum-wage-rates"]);
  assert.deepEqual(uncovered, []);
});

test("categories without a catalog entry are reported as uncovered", () => {
  const { ids, uncovered } = sourceIdsForCategories(CATALOG, [
    "visa-route",
    "seasonal-guidance",
  ]);
  assert.deepEqual(ids, ["seasonal-worker-visa"]);
  assert.deepEqual(uncovered, ["seasonal-guidance"]);
});

test("empty categories select nothing", () => {
  const { ids, uncovered } = sourceIdsForCategories(CATALOG, []);
  assert.deepEqual(ids, []);
  assert.deepEqual(uncovered, []);
});
