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
  getPlanCategoryLabel,
  getSourceCategoryLabel,
  getStrings,
} from "../../src/lib/strings";
import {
  OFFICIAL_SOURCE_CATEGORIES,
  PLAN_ITEM_CATEGORIES,
} from "../../src/lib/validation";

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

test("website-wide surfaces all have dictionary keys", () => {
  const en = getStrings("en");
  const required = [
    // Header, nav, footer, disclaimer, guidance chrome.
    "headerSkipLink",
    "headerHomeAria",
    "headerSignOut",
    "headerThemeAria",
    "themeSystem",
    "navHowItWorks",
    "footerNoticeHeading",
    "footerTagline",
    "disclaimerHeading",
    "guidanceReviewed",
    // Public pages.
    "landingTitle",
    "landingCap4Text",
    "landingLimit3",
    "aboutNot2",
    "howStep4Text",
    "howBrowse",
    "resourcesSubtitle",
    "wsResourcesSubtitle",
    // Hybrid demo (model playground).
    "hdTitle",
    "hdStep2Title",
    "hdAnalyzeButton",
    "hdTestTitle",
    // Auth and workspace shell.
    "authPasswordHint",
    "authResetSentAfter",
    "wsMenuButton",
    "wsNavCompare",
    "ovIntro",
    "ovEmptyDesc",
    // Review, investigations, evidence, analysis.
    "revTitle",
    "revPrivacyDesc",
    "revUnexpectedFormat",
    "invConfirmDelete",
    "invdSummary",
    "invdNoFindings",
    "evPlanTitle",
    "evNoSourceCovers",
    "anSummary",
    "anGuideGuarantee",
    // Compare and privacy panel.
    "cmpTitle",
    "cmpConsentBody",
    "cmpRegenerate",
    "crExecSummary",
    "crMissingMeans",
    "pvIntro",
    "pvApprove",
    // Settings.
    "stAppearanceDesc",
    "stThemeSystemHint",
  ] as const;
  for (const key of required) {
    assert.ok(key in en, `missing key: ${key}`);
  }
  // The dictionary covers the whole site, not just the corridor surfaces.
  assert.ok(Object.keys(en).length > 200, `only ${Object.keys(en).length} keys`);
});

test("aria-label keys exist for the localized accessible names", () => {
  const en = getStrings("en");
  const id = getStrings("id");
  const ariaKeys = [
    "headerHomeAria",
    "headerPrimaryAria",
    "headerMobileAria",
    "headerThemeAria",
    "footerNavAria",
    "disclaimerSectionAria",
    "landingExampleAria",
    "wsSectionsAria",
    "wsCloseMenuAria",
    "revInputMethodAria",
    "revDeviceProgressAria",
    "revPerPageAria",
    "invNewTitleAria",
    "cmpInferenceAria",
    "cmpPagePrivacyAria",
    "cmpDocTypeSr",
    "pvManualAria",
    "stThemeAria",
    "hdEnvAria",
    "hdStep1Aria",
    "hdStep2Aria",
    "hdInitProgressAria",
    "hdTestAria",
  ] as const;
  for (const key of ariaKeys) {
    assert.ok(en[key].length > 0, `en.${key} is empty`);
    assert.ok(id[key].length > 0, `id.${key} is empty`);
  }
});

test("Indonesian working drafts use Bahasa Indonesia terms", () => {
  const id = getStrings("id");
  assert.equal(id.headerSignIn, "Masuk");
  assert.equal(id.headerSignOut, "Keluar");
  assert.equal(id.themeSystem, "Sistem");
  assert.equal(id.navResources, "Sumber daya");
  assert.equal(id.authCreateAccount, "Buat akun");
  assert.equal(id.wsNavOverview, "Ringkasan");
  assert.equal(id.revAnalyze, "Analisis peluang");
  assert.equal(id.evRun, "Jalankan pemeriksaan bukti");
  assert.equal(id.anConcerns, "Potensi masalah");
  assert.equal(id.pvApprove, "Setujui teks bersih untuk analisis");
  assert.equal(id.hdTitle, "Demo inferensi hibrida");
  assert.equal(id.hdPrivacyTitle, "Periksa Privasi");
});

test("format fills several placeholders at once", () => {
  const en = getStrings("en");
  assert.equal(
    format(en.headerThemeAria, { current: "Light", next: "Dark" }),
    "Theme: Light. Activate to switch to Dark.",
  );
  assert.equal(
    format(en.evDropped, {
      count: "2",
      resultWord: "comparison results",
      verb: "were",
      pronoun: "they",
    }),
    "2 comparison results were dropped because they failed validation " +
      "(unverifiable quote or source) and are not shown.",
  );
});

test("plan and source category labels cover every enum value", () => {
  for (const language of ["en", "id"] as const) {
    for (const category of PLAN_ITEM_CATEGORIES) {
      assert.ok(
        getPlanCategoryLabel(language, category).length > 0,
        `${language}.${category} is empty`,
      );
    }
    for (const category of OFFICIAL_SOURCE_CATEGORIES) {
      assert.ok(
        getSourceCategoryLabel(language, category).length > 0,
        `${language}.${category} is empty`,
      );
    }
  }
  assert.equal(getPlanCategoryLabel("en", "explicit-claim"), "Posting claim");
  assert.equal(getSourceCategoryLabel("en", "pay-rates"), "Pay rates");
  assert.equal(getPlanCategoryLabel("id", "research-question"), "Pertanyaan penelitian");
  assert.equal(getSourceCategoryLabel("id", "origin-protection"), "Perlindungan negara asal");
});
