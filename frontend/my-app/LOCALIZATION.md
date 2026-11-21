# OpporCheck UI localization (EN/ID)

Website-wide English / Bahasa Indonesia UI language. The preference lives in
`src/lib/lang.tsx` (`LangProvider` + `useLang`, persisted as `oc-lang`),
exactly as before; this pass extends the hand-rolled dictionary system to
cover the whole site. No i18n framework, no new dependencies.

> Indonesian strings are WORKING DRAFTS. Every `id` value needs
> native-speaker review (and legal review for disclaimer-adjacent copy)
> before it can be considered final. Never present them as final.

## Hard constraints (unchanged)

- No Firebase/backend/`firestore.rules`/corridor-data/URL/verification-status
  changes.
- Internal enum and validation values stay English (`high`, `reviewed`,
  `on_device`, …); only the surrounding user-facing glue is localized.
- No new dependencies; extend the hand-rolled `useLang` + dictionary system.

## Dictionary paths and getters

| Content | Path | Access |
|---|---|---|
| Flat website-wide UI strings (EN canonical, ID drafts) | `src/lib/strings.ts` | `getStrings(lang)` → `t.key`, `format(tpl, {…})` |
| Plan-item / official-source category labels | `src/lib/strings.ts` | `getPlanCategoryLabel(lang, cat)`, `getSourceCategoryLabel(lang, cat)` |
| Assessment / comparison status labels, phrases | `src/lib/reportLanguage.ts` | `getAssessmentLabels`, `getComparisonStatusLabels`, `getMissingInfoLabel`, `getUnverifiedPhrase` |
| Full disclaimer + contextual notices | `src/lib/disclaimer.ts` | `getFullDisclaimerParagraphs`, `getConciseNotice`, `getAnalysisContextNotice`, `getComparisonContextNotice`, `getInvestigationContextNotice`, `getUploadSensitivityNotice`, `getReviewProcessingNotice` |
| Compare category / doc-type labels, gate reasons | `src/lib/compareSession.ts` | `getCompareCategoryLabels`, `getCompareDocTypeLabels`, `analysisGate(…, lang?)`, `failedPagesLimitation(…, lang?)`, `recordPageApproval(…, lang?)`, `approvedPagesOrThrow(…, lang?)` |
| Privacy-gate disclosures and enforcement messages | `src/lib/privacyGate.ts` | `describeInference(…, lang?)`, `describeActualSource(…, lang?)`, `assertAnalysisAllowed(…, lang?)`, `resolveSavePayload({…, language?})` |
| Privacy category titles, detection labels/reasons | `src/lib/privacyDetection.ts` | `getCategoryTitles(lang)`, `detectSensitiveInfo(text, lang?)` |
| Manual-span errors | `src/lib/privacyReview.ts` | `addManualSpan(…, lang?)` |
| AI busy message | `src/lib/aiErrors.ts` | `mapServiceError(msg, lang?)` |
| File validation + upload/backend messages | `src/lib/documents.ts` | `validatePdfFile / validateImageFile(file, lang?)`, `uploadPdf / uploadImage(…, uiLanguage?)`, `backendErrorMessage(…, lang?)` |
| Auth errors | `src/lib/auth.tsx` | `friendlyAuthError(err, lang?)` |
| Compare inference-mode info | `src/lib/contractAI.ts` | `getInferenceModeInfo(lang)` |

Key conventions: flat camelCase keys in `strings.ts`, prefixed by surface
(`common*`, `header*`, `theme*`, `nav*`, `footer*`, `landing*`, `about*`,
`how*`, `resources*`, `auth*`, `ws*`, `ov*`, `rev*`, `inv*`, `invd*`, `ev*`,
`an*`, `cmp*`, `cr*`, `pv*`, `st*`, `hd*`). Placeholders are `{name}`-style and
filled with `format()`. `UiStrings` is derived from the English map, so a
missing `id` key is a compile error; `test/unit/strings.test.ts` asserts
runtime parity, non-empty values, aria-key presence, and spot wording.

Review-flag convention: every module carrying Indonesian has a header
comment marking the `id` values as working drafts needing native-speaker
review (plus legal review in `disclaimer.ts`); one-off draft strings use
an inline `// WORKING DRAFT` comment.

## Global selector and document language

- The ONE global website language selector lives in the site header
  (`src/components/AppHeader.tsx`, next to the theme switcher), wired to
  `useLang`/`oc-lang`. Quiet segmented EN/ID control, same height as the
  theme switcher.
- The local-only approach is gone: `ResourceLanguageFilter.tsx` and
  `LanguageToggle.tsx` are deleted; `CorridorResources` uses the global
  `useLang`, and the evidence panel's per-surface toggle is removed.
- Document language follows the preference: `layout.tsx` (server) keeps a
  blocking pre-paint script that sets `<html lang>` from `oc-lang`, and the
  minimal client companion `src/components/DocumentLang.tsx` keeps it in
  sync afterwards.

## Server/client pattern

`useLang` is client-only, so localized copy always renders in client
components:

- Client pages/components call `useLang()` + `getStrings(language)` directly.
- Server pages keep their `metadata` exports and render a client `*Content`
  component that owns all copy (`LandingContent`, `AboutContent`,
  `HowItWorksContent`, `PublicResourcesContent`). `PublicShell`,
  `SiteFooter`, `Disclaimer`, and `GuidanceList` are client components for
  the same reason; page `metadata` titles stay English (documented below).

## Scope decisions

- (a) Deterministic planner packs (`investigationPlanner.ts`): DEFERRED.
  Plan questions feed the English comparison prompt and are checked against
  English official-source excerpts; translating display text would fork the
  prompt language from the excerpt language and mislead the comparison.
  Exact-string planner tests also pin the English. Panel chrome around the
  plan is localized.
- (b) Guidance entry titles/summaries: stay English. They describe
  third-party official pages; translating them would misrepresent publisher
  content. URLs, publishers, and verification status never change. List
  chrome (publisher/country/reviewed labels) is localized.
- (c) `disclaimer.ts` legal-adjacent notices: Indonesian working drafts are
  provided behind `get*()` getters and flagged for native-speaker AND legal
  review; the English constants are byte-identical and still asserted
  verbatim by `productTrust.test.ts`.
- (d) `reportLanguage.ts` labels: kept in-module with `*_ID` maps plus
  `get*()` getters (no migration into `strings.ts`); all call sites
  (`EvidenceInvestigation`, investigation report, `AnalysisResults`,
  `CompareReport`) use the getters. `productTrust.test.ts` stays green.
- Model prompts and schemas stay English by design
  (`opportunityAnalyzer.ts`, `evidenceComparison.ts`); `contractPrompts.ts`
  likewise keeps its prompt text English and only appends one instruction
  rule for `language: "id"` asking for free-text fields (`claim`,
  `explanation`, `followUpQuestion`) in Bahasa Indonesia, with excerpts
  verbatim and category/status enums unchanged. Sample postings are example
  user data, not UI copy.
- Now localized (previously deferred): `documents.ts` upload/retrieval
  errors, OCR reducer messages (`ocrReview.ts`), detection-engine
  labels/reasons (`privacyDetection.ts`, corpus tests still pin the English
  defaults), the `/hybrid-demo` model playground (verbatim SDK/diagnostic
  values stay English), the `Spinner` default label
  (`commonLoading`, via `useLang`), `sources.ts` evidence-service errors
  (optional `language` param, 401 via `backendErrorMessage`), and the
  compare-page `uploadPdf` call site (now passes the UI language).
- Still deferred as diagnostics: `investigations.ts`
  classification/fallback messages, and model-output parse errors
  (`validation.ts`, `parseReport`). They wrap server/model text or are
  pinned by exact-string tests; threading UI language through them is
  follow-up work.
- Still deferred surfaces: page `metadata` titles (server metadata cannot
  read the `localStorage` preference).

## Adding a string

1. Add the `en` value to the `EN` map in `src/lib/strings.ts` (or the owner
   module's canonical map) and the `id` working draft beside it.
2. Read it via `getStrings(language)` in a client component (or a
   `*Content` component for server pages).
3. Keep enum/validation values English; localize glue only.
4. Run `npx tsc --noEmit` (parity is a compile error) and
   `npm run test:unit`.
