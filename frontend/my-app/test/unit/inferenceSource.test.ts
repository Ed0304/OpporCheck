// Inference-source disclosure tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers the shared honest-source formatter plus the per-document run
// transitions that guarantee no stale source survives a new run, a
// failure, or a repeat.

import assert from "node:assert/strict";
import test from "node:test";
import {
  beginExtractionRun,
  completeExtractionRun,
  failExtractionRun,
} from "../../src/lib/compareSession";
import { describeActualSource } from "../../src/lib/privacyGate";

test("on-device and cloud sources render plainly", () => {
  assert.deepEqual(describeActualSource("on_device"), {
    label: "Processed on-device.",
    known: true,
  });
  assert.deepEqual(describeActualSource("in_cloud"), {
    label: "Processed in the cloud.",
    known: true,
  });
});

test("unknown, missing, and future sources render as unavailable", () => {
  for (const source of [undefined, null, "unknown", "", "edge_tpu", 42]) {
    const rendered = describeActualSource(source);
    assert.equal(rendered.label, "Processing location unavailable.");
    assert.equal(rendered.known, false);
  }
});

test("cloud fallback is reported from the result, never the preference", () => {
  // A prefer-on-device run that fell back reports the cloud source it got.
  assert.equal(describeActualSource("in_cloud").label, "Processed in the cloud.");
  // A preference string is not a source and must not render as one.
  assert.equal(describeActualSource("prefer-on-device").known, false);
  assert.equal(describeActualSource("prefer_on_device").known, false);
});

test("beginning a run clears any source left by an earlier run", () => {
  const stale = {
    status: "extracted" as const,
    inferenceSource: "on_device",
    error: null,
  };
  const begun = beginExtractionRun(stale);
  assert.equal(begun.status, "extracting");
  assert.equal(begun.inferenceSource, null);
  assert.equal(begun.error, null);
});

test("completing a run records the verbatim source; repeats overwrite", () => {
  const first = completeExtractionRun(
    beginExtractionRun({ status: "ready", inferenceSource: null, error: null }),
    "on_device",
  );
  assert.equal(first.inferenceSource, "on_device");

  const second = completeExtractionRun(beginExtractionRun(first), "in_cloud");
  assert.equal(second.inferenceSource, "in_cloud");

  const silent = completeExtractionRun(
    beginExtractionRun(first),
    undefined,
  );
  assert.equal(silent.inferenceSource, "unknown");
  assert.equal(describeActualSource(silent.inferenceSource).known, false);
});

test("failed runs keep the source null so nothing stale shows", () => {
  const failed = failExtractionRun(
    { status: "extracting", inferenceSource: null, error: null },
    "boom",
  );
  assert.equal(failed.status, "error");
  assert.equal(failed.inferenceSource, null);
  assert.equal(failed.error, "boom");
});
