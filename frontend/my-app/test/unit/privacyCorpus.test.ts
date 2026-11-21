// Privacy corpus evaluation (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Methodology: every expectation/forbid excerpt is located in its case
// text (each must occur exactly once — authoring errors fail loudly);
// a detection matches when its span overlaps the excerpt. Recall counts
// category-correct matches; precision counts detections that match an
// expectation (ambiguous-by-design lows excluded); preservation requires
// zero detections overlapping any forbidden employment term.
//
// Thresholds below are the measured 2026-11-20 baseline: improvements
// must not regress them. See PRIVACY_HARDENING_PHASE1_6_REPORT.md §4.

import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSensitiveInfo,
  type PrivacyConfidence,
  type PrivacyDetection,
} from "../../src/lib/privacyDetection";
import { PRIVACY_CORPUS } from "./privacyCorpus";

const RANK: Record<PrivacyConfidence, number> = { high: 3, medium: 2, low: 1 };

function locate(text: string, excerpt: string, where: string): number {
  const first = text.indexOf(excerpt);
  assert.ok(first >= 0, `${where}: excerpt not found: ${JSON.stringify(excerpt)}`);
  assert.equal(
    text.lastIndexOf(excerpt),
    first,
    `${where}: excerpt is ambiguous: ${JSON.stringify(excerpt)}`,
  );
  return first;
}

function overlaps(detection: PrivacyDetection, index: number, length: number): boolean {
  return detection.start < index + length && index < detection.end;
}

interface Aggregate {
  expected: number;
  matched: number;
  detections: number;
  truePositives: number;
  highFalsePositives: number;
  forbidTotal: number;
  forbidClean: number;
}

function evaluate(): { perLocale: Map<string, Aggregate>; total: Aggregate } {
  const perLocale = new Map<string, Aggregate>();
  const blank = (): Aggregate => ({
    expected: 0,
    matched: 0,
    detections: 0,
    truePositives: 0,
    highFalsePositives: 0,
    forbidTotal: 0,
    forbidClean: 0,
  });
  const total = blank();
  for (const kase of PRIVACY_CORPUS) {
    const agg = perLocale.get(kase.locale) ?? blank();
    perLocale.set(kase.locale, agg);
    const found = detectSensitiveInfo(kase.text).detections;

    for (const item of kase.expect) {
      const index = locate(kase.text, item.excerpt, kase.id);
      agg.expected += 1;
      total.expected += 1;
      const match = found.find(
        (d) => d.category === item.category && overlaps(d, index, item.excerpt.length),
      );
      if (match) {
        agg.matched += 1;
        total.matched += 1;
        if (item.minConfidence) {
          assert.ok(
            RANK[match.confidence] >= RANK[item.minConfidence],
            `${kase.id}: ${item.excerpt} confidence ${match.confidence} below ${item.minConfidence}`,
          );
        }
      }
    }

    const uncertainSpans = (kase.allowUncertain ?? []).map((excerpt) => ({
      index: locate(kase.text, excerpt, kase.id),
      length: excerpt.length,
    }));
    for (const detection of found) {
      agg.detections += 1;
      total.detections += 1;
      const hitsExpectation = kase.expect.some((item) => {
        const index = kase.text.indexOf(item.excerpt);
        return (
          detection.category === item.category &&
          overlaps(detection, index, item.excerpt.length)
        );
      });
      if (hitsExpectation) {
        agg.truePositives += 1;
        total.truePositives += 1;
        continue;
      }
      const allowed = uncertainSpans.some(
        (span) =>
          overlaps(detection, span.index, span.length) &&
          detection.confidence === "low" &&
          detection.uncertain,
      );
      if (!allowed) {
        if (detection.confidence === "high") {
          agg.highFalsePositives += 1;
          total.highFalsePositives += 1;
        }
      }
    }
    for (const excerpt of kase.forbid) {
      const index = locate(kase.text, excerpt, kase.id);
      agg.forbidTotal += 1;
      total.forbidTotal += 1;
      const violators = found.filter((d) => overlaps(d, index, excerpt.length));
      assert.deepEqual(
        violators.map((d) => `${d.label}@${d.start}`),
        [],
        `${kase.id}: employment term flagged: ${JSON.stringify(excerpt)}`,
      );
      agg.forbidClean += 1;
      total.forbidClean += 1;
    }

    for (const gap of kase.gaps ?? []) {
      const probe = detectSensitiveInfo(gap.text).detections;
      const index = locate(gap.text, gap.excerpt, `${kase.id}:gap`);
      const strong = probe.filter(
        (d) => d.confidence !== "low" && overlaps(d, index, gap.excerpt.length),
      );
      assert.deepEqual(
        strong.map((d) => d.label),
        [],
        `${kase.id}: gap unexpectedly covered (${gap.note}) — flip to expect[]`,
      );
    }
  }
  return { perLocale, total };
}

test("corpus: recall, precision, and preservation meet the measured baseline", () => {
  const { perLocale, total } = evaluate();
  const recall = total.matched / total.expected;
  const precision =
    total.truePositives /
    Math.max(1, total.detections - countAllowedUncertain());
  const preservation = total.forbidClean / Math.max(1, total.forbidTotal);

  const rows: Array<Record<string, string>> = [];
  for (const [locale, agg] of [...perLocale.entries()].sort()) {
    rows.push({
      locale,
      recall: `${agg.matched}/${agg.expected}`,
      precision: `${agg.truePositives}/${agg.detections}`,
      preserved: `${agg.forbidClean}/${agg.forbidTotal}`,
    });
  }
  console.log("privacy-corpus: " + JSON.stringify(rows));

  // Locked 2026-11-20 behavior: the corpus defines the contract, so any
  // future change that drops below these must be deliberate + documented.
  assert.equal(total.highFalsePositives, 0, "no high-confidence false positives");
  assert.equal(preservation, 1, "employment terms fully preserved");
  assert.equal(recall, 1, `recall regressed: ${recall}`);
  assert.equal(precision, 1, `precision regressed: ${precision}`);
});

function countAllowedUncertain(): number {
  let count = 0;
  for (const kase of PRIVACY_CORPUS) {
    const found = detectSensitiveInfo(kase.text).detections;
    for (const detection of found) {
      const hitsExpectation = kase.expect.some((item) => {
        const index = kase.text.indexOf(item.excerpt);
        return (
          detection.category === item.category &&
          overlaps(detection, index, item.excerpt.length)
        );
      });
      if (hitsExpectation) {
        continue;
      }
      const allowed = (kase.allowUncertain ?? []).some((excerpt) => {
        const index = kase.text.indexOf(excerpt);
        return (
          overlaps(detection, index, excerpt.length) &&
          detection.confidence === "low" &&
          detection.uncertain
        );
      });
      if (allowed) {
        count += 1;
      }
    }
  }
  return count;
}
