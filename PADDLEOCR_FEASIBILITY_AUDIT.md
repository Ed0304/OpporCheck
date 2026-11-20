# OpporCheck — PaddleOCR Integration Feasibility Audit

Date: 2026-11-20. Inspection only; no files were modified, no packages installed, nothing implemented.

Docs accessed 2026-11-19/20. Finding classes: CONFIRMED (repository code/config), INFERRED (architectural conclusion), UNKNOWN (needs testing or external verification).

## 1. Current extraction architecture

PDF-only, text-only, stateless. The browser uploads a whole PDF to FastAPI, which extracts embedded text with pypdf and returns it; image uploads and scanned pages are explicitly rejected everywhere. No OCR engine exists anywhere in the dependency tree.

Upload flow: file input (`accept=".pdf,application/pdf"`) → `validatePdfFile` (extension, MIME, non-empty, 10 MB) → XHR multipart POST to `/api/v1/documents/extract` → backend magic-byte, size (10 MB), and encryption checks → per-page `extract_text()` → normalized text truncated to 60,000 chars plus uncapped per-page `page_texts`. Empty-text PDFs (including all scanned PDFs) fail with 422 "no extractable text … (no OCR)".

Downstream, extracted text feeds AI analysis unmodified: review sends up to 60K chars in one analyzer prompt; Promise-to-Paper truncates each document to 12K chars per extraction call; evidence comparison sends plan claims plus official excerpts. The review page places extracted text in an editable textarea (review-and-correct already possible there); the compare page offers no text editing (add/remove only).

## 2. Relevant files and functions

| Area | File | Function / symbol |
|---|---|---|
| PDF validation + extraction | [backend/app/documents.py](/D:/Projects/HybridAI Firebase Project/backend/app/documents.py) | `extract_pdf_text`, `DocumentError`, `MAX_PDF_BYTES` (10 MB), `MAX_TEXT_CHARS` (60K), `PDF_MAGIC` |
| Extract endpoint | [backend/app/main.py](/D:/Projects/HybridAI Firebase Project/backend/app/main.py) | `extract_document` (multipart `file`), `extract_response` (MIME check, shape `{filename, text, pages, truncated, page_texts}`) |
| Backend deps | [backend/requirements.txt](/D:/Projects/HybridAI Firebase Project/backend/requirements.txt) | fastapi, uvicorn, pypdf, python-multipart only |
| Frontend upload client | [frontend/my-app/src/lib/documents.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/documents.ts) | `validatePdfFile`, `uploadPdf` (XHR + progress), `MAX_PDF_BYTES`, `apiBase()` |
| Review upload + edit | [frontend/my-app/src/app/workspace/review/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/review/page.tsx) | `handleFile`, `handleAnalyze`; textarea `maxLength={60000}` |
| Compare upload (no edit) | [frontend/my-app/src/app/workspace/compare/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/compare/page.tsx) | `handlePdf`, `handlePasteAdd`, `MAX_DOCS = 6`, `PASTE_MAX_CHARS = 60000` |
| AI handoff caps | [frontend/my-app/src/lib/contractPrompts.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/contractPrompts.ts) | `EXTRACTION_MAX_CHARS = 12000`, `COMPARISON_MAX_TERMS = 40` |
| Statelessness proof | [backend/tests/test_documents.py](/D:/Projects/HybridAI Firebase Project/backend/tests/test_documents.py) | `test_sequential_uploads_share_no_server_state` (no fetch-back route) |
| Prior art (read-only) | `D:/Projects/SignalBait/backend/fastAPI/main.py` | `get_ocr()` lazy singleton, `ocr_image` (`POST /ocr`), `scan_image` (`POST /scan-image`) |
| Prior art pins | `D:/Projects/SignalBait/backend/fastAPI/requirements.txt` | `paddleocr==3.7.0`, `paddlepaddle==3.3.1`, `paddlex==3.7.2`, `opencv-contrib-python-headless==4.10.0.84` |

Findings:

- Image uploads (JPG/JPEG/PNG) are not accepted anywhere: both file inputs restrict to PDF, `validatePdfFile` rejects non-`.pdf` names, and `extract_response` returns 400 for non-`application/pdf` content types. (CONFIRMED)
- There is no page-count limit and `page_texts` is uncapped: a thousand-page PDF returns a thousand normalized page strings even though joined `text` truncates at 60K. (CONFIRMED — `documents.py:84-109`)
- The installed backend runs Python 3.13.7 with pypdf 7.1.0; `paddleocr`, `paddlepaddle`, Pillow, numpy, OpenCV, pdf2image, and PyMuPDF are all absent. (CONFIRMED — `pip list` output + failed `import paddleocr`)
- pypdf cannot render pages to images, so scanned-page OCR requires a new renderer dependency; nothing in the repo provides one. (CONFIRMED + INFERRED)

## 3. PaddleOCR integration feasibility

Feasible. The current versions, the SignalBait prior art, and this machine's toolchain all line up on PaddleOCR 3.x CPU inference.

- Current version is 3.7.0 (PyPI `paddleocr` JSON, `version: 3.7.0`), identical to SignalBait's pins — the prior experience is current, not legacy. The 3.x API (`PaddleOCR(...).predict(...)` returning `result.json["res"]` with `rec_texts`/`rec_scores`) is what SignalBait uses and what the [3.x installation docs](https://www.paddleocr.ai/latest/en/version3.x/installation.html) describe; the 2.x `ocr.ocr()` list-returning API must not be copied. (CONFIRMED — PyPI + docs + SignalBait `main.py:161-212`)
- The engine installs on this exact stack: PyPI ships `paddlepaddle-3.3.1-cp313-cp313-win_amd64.whl`, matching the backend's Python 3.13.7 on 64-bit Windows, and `paddleocr` classifiers list Python 3.8–3.13. The feared Python-version blocker does not exist. (CONFIRMED — PyPI file index)
- CPU execution is a first-class target (documented `paddlepaddle` CPU wheel alongside `-gpu`; OS badge covers linux/win/mac). SignalBait runs CPU-oriented flags (`enable_mkldnn=False`, orientation classifiers off). Exact throughput and RAM on this machine are unmeasured. (CONFIRMED availability; UNKNOWN performance)
- Language support is uneven by design. PP-OCRv5's default model covers Simplified Chinese, Pinyin, Traditional Chinese, English, and Japanese with no `lang` needed; Indonesian (`id`) and Malay (`ms`) need explicit `lang` selection into Latin-script models, whose published benchmark (84.7%) trails the East-Asian defaults. OpporCheck needs five scripts (EN/ID/MS/JA/Traditional Chinese), so language selection must be explicit per document or per corridor — there is no single model setting covering ID/MS at default quality. ([Multilingual doc](https://www.paddleocr.ai/v3.1.1/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html); CONFIRMED)
- Confidence output exists natively: 3.x results carry per-line `rec_scores` (plus boxes/polys), confirmed both in SignalBait's response handling and the documented `overall_ocr_res` schema. (CONFIRMED)
- First run downloads models from Baidu-hosted storage (`paddle-model-ecology.bj.bcebos.com` in doc examples) into a local cache. Total cache size and download time were not established. (INFERRED destination; UNKNOWN size)
- SignalBait patterns worth reusing: lazy singleton load (`get_ocr()`), orientation preprocessing disabled for speed, `finally`-block temp cleanup. Patterns that must NOT be reused: the fixed `/tmp/temp_ocr_image{ext}` path (breaks on Windows, which has no `/tmp`, and races under concurrent requests), the unbounded `await file.read()`, and the absence of size/dimension/confidence handling. (CONFIRMED — SignalBait `main.py:184-223`)

## 4. Proposed extraction architecture

The proposed 7-step hybrid maps cleanly onto the existing code, with two gaps called out.

1. Detect extractable text: already implemented per page — `extract_pdf_text` collects per-page strings; a page is "scanned" when its normalized text is empty. Per-page routing is therefore a small extension, not new detection logic. (CONFIRMED — `documents.py:84-94`)
2. pypdf for text pages: unchanged. (CONFIRMED)
3. Render scanned pages: new dependency required. PyMuPDF (pip wheel, documented page rendering, Windows/macOS/Linux wheels) fits the existing pure-pip setup; pdf2image would add a Poppler system binary and complicate Windows installs. (INFERRED)
4. OCR only scanned pages: natural per-page branch inside the existing loop; mixed PDFs fall out of the design with zero special cases. (INFERRED)
5. Direct image uploads: new endpoint + frontend accept-list extension; reuse SignalBait's image validation shape but with bounded reads and unique temp handling. (INFERRED)
6. Confidence to the frontend: extend the extract response with per-page `{source: "text"|"ocr", mean_confidence, low_confidence_lines}` alongside `page_texts`. The current response shape in `extract_response` is the extension point. (INFERRED)
7. Review-and-correct: already exists on the review path (editable textarea) but NOT on the compare path (add/remove only). Step 7 needs new compare UI: per-document "review extracted text" editing before term extraction. (CONFIRMED gap)

## 5. Dependency and deployment requirements

New pip packages (all wheels, no system binaries if PyMuPDF is chosen): `paddleocr==3.7.0`, `paddlepaddle==3.3.1` (CPU wheel), `paddlex==3.7.2`, `opencv-contrib-python-headless`, `PyMuPDF`, Pillow (likely via transitive deps — pin explicitly). Pin exactly, mirroring SignalBait, because PaddlePaddle minor versions change model compatibility.

Deployment implications: first request (or a warmup call) downloads model files to a cache directory that must persist across restarts or every cold start pays the download; the cache location must be configurable (SignalBait relies on defaults). CPU RAM headroom is the binding constraint — size UNKNOWN until benchmarked. GPU is optional and out of scope for the current localhost assumptions. Windows deployment is supported by all wheels above; Linux hosting changes nothing except paths.

## 6. Firebase Spark compatibility

PaddleOCR has zero Firebase interaction: it would run entirely inside the existing FastAPI backend, which itself uses no Firebase services (its requirements are fastapi/uvicorn/pypdf/python-multipart only). It therefore introduces no Firebase billing requirement and cannot push the project off Spark. (CONFIRMED — `requirements.txt` + `documents.py` have no Firebase imports)

The costs it does introduce are all external to Firebase: bigger install footprint, model download bandwidth, CPU/RAM on whatever hosts FastAPI, and longer per-request compute. Current deployment assumptions (localhost demo) remain realistic for development; any production host must be sized for OCR workloads on its own bill — nothing about Firebase makes that free or paid. (INFERRED)

## 7. Privacy and security risks

Current posture: uploads are processed transiently — bytes live in request memory, nothing is written to disk, no fetch-back route exists (tripwire-tested), and no document content is logged. OCR threatens each of these properties and must be held to the same bar.

- Rendered page images and OCR inputs create additional in-memory copies of sensitive pages (one image per scanned page plus model tensors). Prefer in-memory bytes/numpy arrays end to end; any file-based handoff must use unique temp files (never SignalBait's fixed `/tmp` path, which additionally races between concurrent requests) with `finally`-block deletion. (INFERRED)
- The 422 rejection of scanned PDFs is currently a privacy-positive accident: signatures, photos, and ID scans never reach AI. OCR removes that barrier — visual identifiers become text that flows into Gemini prompts and Firestore. The Privacy Check design (sanitized-text redaction before analysis) becomes mandatory rather than optional once OCR ships. (INFERRED)
- New limits are required before OCR: page-count cap (none exists today), per-image dimension and byte caps, per-request processing timeout (OCR is seconds-per-page on CPU vs milliseconds for pypdf), and ideally single-flight OCR execution to bound memory under concurrency. The existing 10 MB upload cap alone is insufficient — a 10 MB scanned PDF can hold hundreds of pages. (INFERRED)
- Model cache and any debug artifacts (`save_to_img`/`save_to_json` helpers exist in the 3.x API) must never be enabled in the service path; they would write document-derived files to disk. (INFERRED)
- Do not describe OCR processing as private: during inference the document exists as upload bytes, rendered images, and model inputs simultaneously, in a process with no sandboxing. Transient is not the same as private. (INFERRED)

## 8. Potential performance bottlenecks

1. Cold start: model load (seconds to a minute, UNKNOWN exactly) plus first-run model downloads. Mitigate with a warmup call at startup and a persistent cache. (UNKNOWN magnitude)
2. Per-page CPU inference: seconds per scanned page vs milliseconds for pypdf — a 20-page scan could take minutes and exceed default HTTP timeouts. Mitigate with page caps, per-request timeouts, and progress reporting. (UNKNOWN magnitude)
3. Concurrency: the singleton model plus Python's GIL means concurrent OCR requests largely serialize while each holds full page images in memory. Mitigate with single-flight execution and request queuing. (INFERRED)
4. Response bloat: `page_texts` is already uncapped; adding per-line confidence multiplies payload size. Cap pages and summarize confidence per page (mean + low-confidence line count) rather than returning every score. (INFERRED)
5. Language coverage cost: ID/MS documents need the Latin-script model while JA/Chinese use defaults — auto-detecting script per page adds latency; prefer explicit per-corridor language selection reusing the existing corridor codes. (INFERRED)

## 9. Recommended implementation phases

- Phase 0 — Spike (no product wiring): install pinned deps in a scratch venv, verify `import paddleocr` + one `predict()` on CPU, measure cold-start time, per-page seconds, peak RAM, and model cache size. Promotes every UNKNOWN above to a number. Not part of the app.
- Phase 1 — Direct image OCR: new `POST /api/v1/documents/ocr` (bounded read, image MIME + magic-byte validation, dimension caps, unique temp handling or in-memory input, confidence in response), frontend accept-list extension, review-and-correct UI. Reuse SignalBait's lazy singleton and 3.x response parsing; do not reuse its temp path or unbounded read.
- Phase 2 — Hybrid PDF: per-page text/OCR routing in `extract_pdf_text`, PyMuPDF rendering for scanned pages only, page-count cap, per-page `{source, confidence}` in the extract response.
- Phase 3 — Hardening: single-flight execution, request timeouts, warmup + persistent cache config, backend tests mirroring the existing scripted style, frontend unit tests for confidence display, updated size-limit docs.

## 10. Outstanding questions and blockers

1. Benchmarks: cold-start seconds, per-page CPU seconds, peak RAM, model cache MB — needs the Phase 0 spike. (UNKNOWN, blocker for limits)
2. OCR quality on real employment contracts per language (EN/ID/MS/JA/Traditional Chinese), especially ID/MS Latin-script accuracy on dense contract layouts. (UNKNOWN, needs sample testing)
3. Traditional Chinese default-model quality vs explicit selection for contract vocabulary. (UNKNOWN)
4. Production host choice and sizing (external cost, not Firebase). (UNKNOWN, decision)
5. Whether per-corridor language routing (ID→`id`, MY→`ms`, JP→`japan`, TW/HK→default) matches real document scripts — mixed-language contracts may need multi-pass or default-model fallback. (UNKNOWN)
6. No hard blockers found: versions, wheels, API, languages, and Spark compatibility all check out. The only stop sign would be Phase 0 numbers that exceed the hosting budget.
