// UI strings tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert English/Bahasa Indonesia key parity, placeholder
// formatting, and that corridor copy carries no fraud verdicts.

import assert from "node:assert/strict";
import test from "node:test";
import { DISALLOWED_LABEL_PHRASES } from "../../src/lib/reportLanguage";
import {
  UI_LANGUAGES,
  format,
  getStrings,
} from "../../src/lib/strings";

test("English and Indonesian dictionaries share every key", () => {
  const en = getStrings("en");
  const id = getStrings("id");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(id).sort());
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    assert.ok(en[key].length > 0, `en.${key} is empty`);
    assert.ok(id[key].length > 0, `id.${key} is empty`);
  }
});

test("Indonesian copy uses Bahasa Indonesia terms", () => {
  const id = getStrings("id");
  assert.equal(id.destinationLabel, "Destinasi");
  assert.equal(id.rulesApplied, "Aturan yang diterapkan");
  assert.match(id.evidenceTitle, /Investigasi bukti/);
  assert.match(id.noLinksTitle, /Belum ada tautan/);
});

test("format fills placeholders and leaves unknowns alone", () => {
  assert.equal(format("No {name} links yet", { name: "Japan" }), "No Japan links yet");
  assert.equal(format("Plain text", { name: "Japan" }), "Plain text");
  assert.equal(format("Keep {other} here", { name: "Japan" }), "Keep {other} here");
});

test("corridor copy carries no fraud verdict or guarantee", () => {
  for (const language of ["en", "id"] as const) {
    const strings = getStrings(language);
    for (const value of Object.values(strings)) {
      const filled = format(value, { name: "Japan" }).toLowerCase();
      for (const phrase of DISALLOWED_LABEL_PHRASES) {
        assert.ok(!filled.includes(phrase), `${language}: "${phrase}" in: ${value}`);
      }
    }
  }
});

test("language options cover English and Bahasa Indonesia", () => {
  assert.deepEqual(
    UI_LANGUAGES.map((entry) => entry.code),
    ["en", "id"],
  );
});
