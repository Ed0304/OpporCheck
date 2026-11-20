# PaddleOCR Phase 1 — Implementation Report: Direct Image OCR

Date: 2026-11-20. Phase 1 only: direct JPG/JPEG/PNG OCR with review and
correction before analysis. Scanned-PDF OCR, PDF rendering, deployment,
and all Phase 2 work are explicitly out of scope and were not started.

Finding classes: CONFIRMED (verified by code, tests, or measurements),
INFERRED (architectural conclusion), UNKNOWN (not established).

## 1. Implementation summary

Users can now upload a JPG/JPEG/PNG employment document on the review
page, pick one of six OCR languages, watch upload/OCR progress, review
the extracted text with a confidence warning, correct mistakes, and
submit the corrected text for OpporCheck analysis — explicitly, never
automatically. Backend work adds `POST /api/v1/documents/ocr` (bounded
validation, in-memory PaddleOCR 3.x CPU inference, aggregate confidence
only). The Phase 1 model comparison selected PP-OCRv6 small for all six
languages (equal quality to medium at ~4x speed). PDF extraction,
corridors, auth, Firestore rules/config, AI modes, and the comparison
workflow are unchanged. No paid Firebase service was introduced.

## 2. Files created and modified

Created (backend):

- `backend/app/ocr.py` — validation, decoding, lazy engine singleton,
  single-flight + timeout inference, aggregation. No temp files by design.
- `backend/requirements-ocr.txt` — pinned PaddleOCR CPU stack; base
  `requirements.txt` stays sufficient for PDF-only development.
- `backend/tests/test_ocr.py` — 30 tests (validation, limits, inference
  seams, errors, route shape, statelessness).

Created (frontend):

- `frontend/my-app/src/lib/ocrReview.ts` — image-tab state machine
  (reducer), dependency-free and unit-tested.
- `frontend/my-app/test/unit/ocr.test.ts` — 10 client tests.
- `frontend/my-app/test/unit/ocrReview.test.ts` — 6 reducer tests.

Created (benchmark env, experiment code — not app code):

- `benchmarks/paddleocr-phase0/bench_compare.py`,
  `diff_hant.py`, `test_ocr_smoke.py`,
  `results/compare_small_medium.json`, `samples/zh_hans_offer.*`.

Modified:

- `backend/app/main.py` — `/api/v1/documents/ocr` route + `ocr_response`
  sync core (mirrors the PDF route pattern). No other route touched.
- `backend/requirements.txt` — added `Pillow==13.0.0` only (image
  validation/decoding for base installs).
- `backend/README.md` — OCR setup, endpoint, languages, models, cache,
  limits, privacy, workarounds.
- `frontend/my-app/src/lib/documents.ts` — OCR client appended (PDF
  client untouched): `OcrResult`, `OCR_LANGUAGES`, `validateImageFile`,
  `parseOcrResponse`, `shouldWarnLowConfidence`, `uploadImage`.
- `frontend/my-app/src/app/workspace/review/page.tsx` — "Upload image"
  tab, language selector, progress, review/correct UI. Paste and PDF
  tabs byte-identical in behavior.
- `PRIVACY.md` — OCR transient-handling and language bullets.

Not modified (verified): `backend/app/documents.py`,
`backend/app/corridors.py`, `backend/app/official_sources.py`,
`firestore.rules`, `firebase.json`, `.firebaserc`, all
`src/lib` AI/auth/investigation modules, compare page, corridor
metadata (see §6).

## 3. Backend architecture

`POST /api/v1/documents/ocr` accepts multipart `file` + `language`
(form, default `en`). Flow in `app/ocr.py`:

1. `normalize_language` — strict allowlist of six codes (case-insensitive,
   canonical echo); th/vi rejected with an explicit message, anything
   else with the supported list. (CONFIRMED by tests)
2. Byte cap (10 MB, 413), empty check, MIME + extension + magic-byte
   cross-checks (declared type must match actual JPEG/PNG signature).
3. `decode_image` — Pillow header read first (dimension/pixel ceilings
   enforced before pixel decode), then full decode to RGB. Corrupt input
   → 400. `Image.MAX_IMAGE_PIXELS` mirrors our ceiling as defense in depth.
4. `_load_engine` — lazy singleton per model pair under a lock; imports
   `paddleocr` on first use (missing → 503, so base installs keep
   working); ensures the model cache dir exists and is writable
   (`OCR_MODEL_CACHE` → `PADDLE_PDX_CACHE_HOME`, else `~/.paddlex`).
   CPU inference with `enable_mkldnn=False` (benchmark-mandated) and
   orientation classifiers off. Never enables debug image/JSON output.
5. Single-flight + timeout — a `Semaphore(1)` fails extra requests fast
   with 429; inference runs on a daemon worker thread joined with a
   300 s deadline (504 on expiry; the straggler keeps the slot until it
   finishes, so load cannot pile on — INFERRED safe, timeout path tested
   with a sleeping stub).
6. Aggregation — `predict(numpy)` (3.x API; no 2.x usage anywhere),
   blank-filtered lines joined with `\n`, mean confidence, count of
   lines < 0.9, 60K-char truncation flag. Empty output → 422.

Response mirrors the PDF contract for forward compatibility:
`{filename (sanitized), text, pages: 1, truncated, page_texts: [text],
source: "ocr", language, lines, mean_confidence, low_confidence_lines}`.
Per-line scores never leave the server; raw filenames never appear in
errors (CONFIRMED by tests). Reads are bounded
(`await file.read(MAX_IMAGE_BYTES + 1)`); no temp files exist anywhere
in the path (CONFIRMED by the TMPDIR-empty test).

## 4. Frontend workflow

Review page gains an "Upload image" tab next to Paste/PDF (shared
`Field`/`Button`/`StatusLabel`/`ContextualNotice` components, same
styling):

1. Select language (6 options; Thai/Vietnamese absent) and image file
   (`accept=.jpg,.jpeg,.png,image/jpeg,image/png`).
2. Client validation errors show inline; upload + OCR progress shows on
   the same progress-bar pattern as PDF.
3. On success the result panel shows a confidence status (warning tone
   when mean < 0.9 or any line < 0.9, with copy stating a high score
   does not guarantee correctness), an editable textarea seeded with
   the extraction (60K max), "Use this text" (adopts the draft into the
   posting field and returns to the paste tab), and "Discard".
4. Nothing submits automatically: analysis still requires the existing
   "Analyze opportunity" press, and persistence still requires "Save as
   investigation". (CONFIRMED by code reading + reducer tests.)

State lives in the `ocrReview` reducer (select → uploading → ready,
invalidate/failed, progress, edit, language, reset); the draft/edit
cycle and language persistence across reset are unit-tested. The PDF
tab, paste tab, analyze, and save flows are untouched (CONFIRMED by
regression tests + suite green).

## 5. Model configurations and language routing

Phase 1 comparison (identical ground-truth samples, benchmark env,
`results/compare_small_medium.json`, 12 runs):

| Sample | v6-small CER / num / s | v6-medium CER / num / s | v5-Latin CER / num / s |
|---|---|---|---|
| id | 0.0395 / 7/7 / 7.7 | 0.0395 / 7/7 / 29.7 | 0.0395 / 7/7 / 9.4 |
| ms | 0.0407 / 7/7 / 7.2 | 0.0407 / 7/7 / 27.5 | 0.0407 / 7/7 / 9.3 |
| ja | 0.1443 / 8/8 / 6.3 | 0.1592 / 8/8 / 27.5 | — |
| zh-Hant | 0.1546 / 8/8 / 6.6 | 0.1031 / 8/8 / 26.9 | — |
| zh-Hans (new) | 0.1495 / 8/8 / 6.6 | 0.1753 / 8/8 / 25.1 | — |
| en (Phase 0 baseline) | identical to medium | baseline | — |

- ID/MS: all three configs byte-identical CER to 4 decimals.
- JA/Hans: small beats medium on CER with identical 8/8 numerics.
- Hant: small trails medium by 0.05 CER with identical 8/8 numerics. A
  dedicated output diff (`diff_hant.py`) shows the gap is purely
  line-segmentation (small merges label+value lines; medium splits
  them) plus colon-width variants — every Traditional character matches.
  No content regression. (CONFIRMED by diff output.)
- Decision: **v6-small universal** — all six languages route to
  `PP-OCRv6_small_det` + `PP-OCRv6_small_rec` (30 MB cache, ~7 s/page).
  v5-Latin stays a documented fallback for ID/MS (equal quality, 9.4 s,
  12.5 MB); medium stays available per language in `MODEL_BY_LANGUAGE`
  as reference only, never the default.

Routing implementation: `language` is validated and echoed per request;
since the v6 recognition model is multilingual (Phase 0 proved
`lang="id"` ≡ default output), one shared lazy engine serves all six
languages today. The per-language model table and pair-keyed holder make
a future split (e.g. Hant→medium) a data change, not a redesign.
(INFERRED sound; current uniformity CONFIRMED by measurement.)

## 6. Supported and removed OCR languages

Supported OCR languages (backend allowlist, frontend selector, docs,
tests — all six, CONFIRMED consistent): en, id, ms, ja, zh-Hant,
zh-Hans. Simplified Chinese was added with a new synthetic sample and a
full small-vs-medium comparison (small wins: CER 0.1495 vs 0.1753, 8/8
numerics both).

Removed: Thai and Vietnamese appear in no OCR allowlist, selector,
config, or supported-language claim. Backend rejects them with an
explicit 400 naming the supported six; the frontend selector cannot emit
them; unit tests lock the six-code list; the smoke test asserts the 400.
(CONFIRMED.)

Separately reported, NOT removed (unrelated corridor metadata, per the
mission): `backend/app/corridors.py:311` TW profile
`languages=("en", "zh-Hant", "id", "vi", "th")` and its mirror
`frontend/my-app/src/lib/corridors.ts:121` still list `vi`/`th`. These
describe official-source languages for the Taiwan corridor, not OCR
support. Taiwan/Hong Kong corridors, catalogues, and localization are
untouched. (CONFIRMED by search.)

## 7. Security and privacy safeguards

- Transient by default: in-memory bytes → bitmap → tensors; zero
  document-derived files (CONFIRMED by TMPDIR-empty test + Phase 0
  cache grep); nothing auto-saved to Firestore — adoption and saving
  stay two explicit user actions (CONFIRMED by code reading).
- Nothing logged: no content/error logging added; error strings are
  generic and never echo filenames (CONFIRMED by test).
- No debug outputs: `save_to_img`/`save_to_json` never called; per-line
  scores aggregated and discarded; response carries mean + low-count
  only (CONFIRMED by route test asserting their absence).
- Filenames sanitized (basename, printable, 120-char cap) for display;
  never trusted for type decisions (magic bytes rule).
- Model cache holds models only and is configured separately from any
  document path (`OCR_MODEL_CACHE`); operators are told to persist it
  across restarts.
- No external OCR service, no hosted inference, no new network
  destination: documents go only to the existing localhost backend
  address. (CONFIRMED by code reading.)
- Not claimed private: in-RAM copies plus user-visible results mean
  transient handling is hygiene, not a guarantee (stated in code,
  README, PRIVACY.md, and UI-adjacent copy).

## 8. Resource limits and concurrency behavior

| Limit | Value | Failure |
|---|---|---|
| Upload bytes | 10 MB | 413 |
| Image dimension | 8000 px/side | 413 |
| Total pixels | 25 MP | 413 |
| Extracted chars | 60,000 | truncate + flag |
| Inference timeout | 300 s | 504 |
| Concurrent OCR | 1 (single-flight) | 429 fail-fast |
| Low-confidence line | score < 0.9 | counted, warned |

Measured profile (small model, 1600 px page): ~7 s inference, ~470 MB
peak RSS, ~40% of 16 logical cores. The 10 MB cap is explicitly not the
sole guard — dimensions, pixels, timeout, and single-flight bound decode
and inference cost (all CONFIRMED by tests; timeout/429 paths covered
with stubs). A timed-out straggler keeps the slot until it finishes, so
overload degrades to 429s rather than piling up (INFERRED from the
design; basic timeout behavior CONFIRMED by test).

## 9. Test results

| Suite | Result |
|---|---|
| Backend `unittest discover` | 78/78 OK (48 pre-existing + 30 new OCR; exit 0) |
| Frontend `test:unit` | 94/94 pass (78 pre-existing + 16 new OCR; exit 0) |
| Real-model smoke (`test_ocr_smoke.py`, benchmark venv) | 2/2 OK in 20.7 s (end-to-end EN + TH rejection) |
| Small-vs-medium comparison | 12 runs + Hant diff, all numerics exact (see §5) |
| `tsc --noEmit` | exit 0, no errors |
| `eslint` | clean, no warnings or errors |

Backend coverage maps the mission list 1:1 (JPEG/PNG valid, MIME,
signature, empty, oversize, dimensions, pixels, corrupt, init failure,
inference failure, blank→422, aggregation math, truncation, timeout,
busy→429, no-persistence, route shape, language allowlist incl. th/vi
rejection, filename safety). Frontend covers selection, validation
errors, progress, extraction, low-confidence warning, editing,
corrected-text submission payload, reducer transitions, and PDF
regression. No test mocks away the OCR contract: stubs sit exactly at
the `_run_predict` seam with the real 3.x response shape, and the smoke
test runs the unmocked engine. (All CONFIRMED by observed runs.)

## 10. Production-build result

`npm run build` did not complete: two attempts (20+ min piped, 10+ min
streaming) both stalled with the last output
`Creating an optimized production build ...` and were terminated. No
error, no failing file — the bundler stage never finishes here.

Classification: environmental stall, not an app regression —
tsc, eslint, and unit tests all consume the changed files and pass; the
diff is small idiomatic TS/JSX with no exotic constructs; the stall is
in whole-app Turbopack production compilation (React Compiler + Cache
Components + Firebase SDK in the graph) on a machine with 2.4 GB free
RAM; and `.next/` contains no `BUILD_ID`, i.e. no production build has
ever completed in this checkout, so no baseline exists. A `next/font`
fetch probe also shows Google Fonts unreachable from node here (fast
failure, would error rather than hang — noted, not blamed). Full
exoneration would need a baseline build the environment cannot produce
(residual UNKNOWN); retry on a quiet machine with free RAM before
treating this as anything else. No build config was changed to chase it.

## 11. Firebase Spark compatibility

Unchanged posture: no new Firebase usage of any kind. The backend
imports no Firebase SDK (new deps are Pillow + the PaddleOCR CPU stack);
frontend Firebase modules (auth, client, investigations, AI Logic),
`firestore.rules`, `firebase.json`, and `.firebaserc` are untouched;
no Storage, Functions, App Hosting, or billing-adjacent service was
added; model downloads come from PaddleX hosters, never Firebase. OCR
compute cost is external (host CPU/RAM) and localhost-only, exactly as
the Spark audit requires. (CONFIRMED by code reading + unchanged files.)

## 12. Remaining limitations and risks

1. Small-universal rests on one clean synthetic sample per language —
   no skew, blur, noise, stamps, handwriting, or real scans. Synthetic
   CERs are an upper bound on quality.
2. `enable_mkldnn=False` is validated on one CPU; where oneDNN works it
   is likely faster — re-test per deployment CPU.
3. Throughput ceiling ~8 req/min (7 s single-flight); contention
   surfaces as 429s by design.
4. No backend auth or rate limiting (pre-existing gap, now more
   valuable to abuse: each request burns seconds of CPU). Blocks any
   public hosting.
5. Phone-camera originals (12 MP+, EXIF rotation unhandled) untested;
   only ≤1600 px synthetics and render tests measured.
6. Thai/Vietnamese unsupported by design; compare page has no image
   path (review-only Phase 1).
7. OCR lifts the visual-identifier barrier (signatures/photos become
   text) — the Privacy-Check redaction design grows more urgent.
8. Production build never completes in this checkout (§10).

## 13. Recommended next steps for Phase 2

1. Hybrid scanned-PDF: keep pypdf for text pages, render only
   text-empty pages via PyMuPDF at ≤200 DPI (Phase 0: higher is pure
   overhead), per-page `{source, confidence}` in the extract response,
   page-count cap, mixed-PDF handling.
2. Real-scan regression set (skew/blur/stamps/handwriting) before any
   quality claim beyond synthetics.
3. Backend auth + per-IP rate limits + host sizing before any reachable
   deployment; re-run the full QA battery there, including `next build`.
4. Compare-page image support plus the missing per-document text-edit
   UI.
5. Evaluate PP-OCRv6_tiny as a faster tier; re-test MKLDNN on the
   deployment CPU.
6. Route OCR output through the Privacy-Check redaction design before
   analysis and persistence.
