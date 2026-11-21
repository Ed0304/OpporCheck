// AI service-error mapping tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers quota/overload/outage signatures mapping to calm copy, and
// pass-through of everything else (including App Check messages, which
// each page handles with its own copy first).

import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_SERVICE_BUSY_MESSAGE,
  mapServiceError,
} from "../../src/lib/aiErrors";

test("quota and overload signatures map to the busy message", () => {
  const samples = [
    "Request failed with status 429",
    "quota exceeded for model",
    "QUOTA_EXCEEDED",
    "rate limit reached, retry later",
    "rate-limit hit",
    "RESOURCE_EXHAUSTED",
    "resource exhausted: out of quota",
    "The model is overloaded",
    "overload, try again",
    "503 Service Unavailable",
    "service unavailable",
    "temporarily unavailable",
    "backend error, retry",
    "internal error occurred",
  ];
  for (const sample of samples) {
    assert.equal(mapServiceError(sample), AI_SERVICE_BUSY_MESSAGE, sample);
  }
  assert.match(AI_SERVICE_BUSY_MESSAGE, /try again/);
  assert.match(AI_SERVICE_BUSY_MESSAGE, /text is unchanged/);
});

test("unrelated messages pass through untouched", () => {
  assert.equal(mapServiceError(""), null);
  assert.equal(mapServiceError("Network request failed"), null);
  assert.equal(mapServiceError("Invalid JSON response"), null);
  // Bare numbers that merely contain quota-adjacent digits must not match.
  assert.equal(mapServiceError("Failed after 500ms"), null);
  assert.equal(mapServiceError("4294967296 bytes"), null);
});
