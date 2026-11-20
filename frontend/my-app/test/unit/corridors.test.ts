// Corridor registry tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// These tests assert profile metadata, name resolution, locale mapping,
// and guidance-list integrity. They do not test live retrieval or Firebase.

import assert from "node:assert/strict";
import test from "node:test";
import {
  CORRIDORS,
  DEFAULT_CORRIDOR_CODE,
  DEFAULT_ORIGIN_CODE,
  GUIDANCE_BY_PROFILE,
  SG_GUIDANCE,
  STATUS_LABELS,
  localeForCountryName,
  resolveCorridorCode,
} from "../../src/lib/corridors";

test("registry holds nine profiles with required metadata", () => {
  assert.equal(Object.keys(CORRIDORS).length, 9);
  assert.equal(DEFAULT_CORRIDOR_CODE, "GB");
  assert.equal(DEFAULT_ORIGIN_CODE, "ID");
  for (const profile of Object.values(CORRIDORS)) {
    assert.ok(profile.displayName);
    assert.ok(["origin", "destination", "jurisdiction"].includes(profile.kind));
    assert.ok(["sources_verified", "partial"].includes(profile.status));
    assert.ok(profile.languages.length > 0);
    assert.ok(profile.locale);
  }
  assert.equal(CORRIDORS.HK.kind, "jurisdiction");
  assert.equal(CORRIDORS.ID.kind, "origin");
  assert.equal(CORRIDORS.GB.hasPlannerPack, true);
  assert.equal(CORRIDORS.SG.hasPlannerPack, true);
  for (const code of ["JP", "NZ", "TW", "HK", "MY", "AU"] as const) {
    assert.equal(CORRIDORS[code].hasPlannerPack, true, code);
  }
  assert.equal(CORRIDORS.ID.hasPlannerPack, false);
});

test("status labels stay plain and verdict-free", () => {
  assert.equal(STATUS_LABELS.sources_verified, "Sources verified");
  assert.equal(STATUS_LABELS.partial, "Partial coverage");
});

test("UK names and nations resolve to GB", () => {
  for (const name of [
    "United Kingdom",
    "UK",
    "GB",
    "Great Britain",
    "Britain",
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
    "  singapore  ",
  ]) {
    const expected = name.trim().toLowerCase() === "singapore" ? "SG" : "GB";
    assert.equal(resolveCorridorCode(name), expected, name);
  }
});

test("destination names resolve to their codes", () => {
  assert.equal(resolveCorridorCode("Indonesia"), "ID");
  assert.equal(resolveCorridorCode("Malaysia"), "MY");
  assert.equal(resolveCorridorCode("Singapore"), "SG");
  assert.equal(resolveCorridorCode("Japan"), "JP");
  assert.equal(resolveCorridorCode("Australia"), "AU");
  assert.equal(resolveCorridorCode("New Zealand"), "NZ");
  assert.equal(resolveCorridorCode("Taiwan"), "TW");
  assert.equal(resolveCorridorCode("Hong Kong"), "HK");
  assert.equal(resolveCorridorCode("hongkong"), "HK");
});

test("missing and unknown input resolves to null, never a default", () => {
  for (const value of ["not specified", "unknown", "", "   ", "Canada", "Atlantis"]) {
    assert.equal(resolveCorridorCode(value), null, JSON.stringify(value));
  }
  assert.equal(resolveCorridorCode(null), null);
  assert.equal(resolveCorridorCode(undefined), null);
});

test("locales follow the resolved profile with a GB fallback", () => {
  assert.equal(localeForCountryName("Singapore"), "en-SG");
  assert.equal(localeForCountryName("Japan"), "ja-JP");
  assert.equal(localeForCountryName("Malaysia"), "ms-MY");
  assert.equal(localeForCountryName("Hong Kong"), "zh-Hant-HK");
  assert.equal(localeForCountryName("Canada"), "en-GB");
  assert.equal(localeForCountryName("not specified"), "en-GB");
  assert.equal(localeForCountryName(null), "en-GB");
});

test("Singapore guidance links stay inside MOM and stay labeled", () => {
  assert.ok(SG_GUIDANCE.length >= 4);
  for (const entry of SG_GUIDANCE) {
    assert.ok(entry.url.startsWith("https://"), entry.url);
    const host = new URL(entry.url).hostname;
    assert.ok(
      host === "www.mom.gov.sg" || host === "www.tal.sg",
      `${entry.url} is outside the SG guidance hosts`,
    );
    assert.equal(entry.country, "Singapore");
    assert.ok(entry.reviewed);
    assert.ok(entry.summary);
  }
});

test("guidance lists never show another profile's country", () => {
  for (const [code, entries] of Object.entries(GUIDANCE_BY_PROFILE)) {
    const displayName = CORRIDORS[code as keyof typeof CORRIDORS].displayName;
    assert.ok(entries.length >= 3, `${code} has no guidance links`);
    for (const entry of entries) {
      assert.equal(entry.country, displayName, `${code}: ${entry.url}`);
      assert.ok(entry.url.startsWith("https://"), entry.url);
      assert.ok(entry.reviewed);
    }
  }
});

test("guidance URLs stay inside their profile's official hosts", () => {
  const expectedHosts: Record<string, string[]> = {
    GB: ["www.gov.uk"],
    ID: ["siskop2mi.bp2mi.go.id", "peduliwni.kemlu.go.id", "peraturan.go.id"],
    MY: ["www.imi.gov.my", "esd.imi.gov.my", "myfuturejobs.gov.my", "www.workforworkers.com.my"],
    SG: ["www.mom.gov.sg", "www.tal.sg"],
    JP: ["www.ssw.go.jp", "www.check-roudou.mhlw.go.jp", "www.otit.go.jp", "www.moj.go.jp"],
    AU: ["immi.homeaffairs.gov.au", "www.homeaffairs.gov.au"],
    NZ: ["www.immigration.govt.nz", "www.employment.govt.nz", "gethelp.employment.govt.nz"],
    TW: ["www.wda.gov.tw", "law.moj.gov.tw", "fw.wda.gov.tw"],
    HK: ["www.immd.gov.hk", "www.eaa.labour.gov.hk", "www.fdh.labour.gov.hk", "www.labour.gov.hk"],
  };
  for (const [code, entries] of Object.entries(GUIDANCE_BY_PROFILE)) {
    for (const entry of entries) {
      const host = new URL(entry.url).hostname;
      assert.ok(
        expectedHosts[code]!.includes(host),
        `${code}: ${entry.url} is outside the expected hosts`,
      );
    }
  }
});
