# OpporCheck backend

FastAPI service for document utilities and official-source retrieval.
Stateless throughout (no storage, no OCR, no AI inference — analysis stays
in the frontend via Firebase AI Logic).

## Setup (Windows PowerShell, from `backend/`)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
.venv\Scripts\Activate.ps1
uvicorn app.main:app --port 8000
```

Health check: `GET http://localhost:8000/health`

Extract endpoint: `POST http://localhost:8000/api/v1/documents/extract`
(multipart field `file`, PDF up to 10 MB; response includes per-page
`page_texts` for source references alongside the joined `text`)

OCR endpoint: `POST http://localhost:8000/api/v1/documents/ocr`
(multipart fields `file` + `language`; JPEG/PNG up to 10 MB, max 8000 px
per side, max 25M pixels; response includes `text`, `source: "ocr"`,
`language`, `lines`, `mean_confidence`, `low_confidence_lines`, and the
same `pages`/`page_texts`/`truncated` shape as PDF extraction so future
scanned-PDF support can extend the contract. Per-line scores are
aggregated server-side and never returned.)

Corridor registry: `GET http://localhost:8000/api/v1/corridors`
(supported investigation corridors with verification status; default `GB`).

Official-source catalog: `GET http://localhost:8000/api/v1/sources?profile=SG`
(`profile` is optional, defaults to `GB`; unknown codes return 400).
Official-source retrieval: `POST http://localhost:8000/api/v1/sources/retrieve`
(JSON body `{ source_ids?: string[], queries?: string[], profile?: string }`;
source ids come from that profile's catalog — raw URLs are never accepted.
Only the profile's approved pages can be fetched; redirects off the
profile allowlist are refused, and ids from one profile never resolve
under another.)

Set `FRONTEND_ORIGINS` (comma-separated) to allow other dev origins.

## Image OCR setup (Phase 1)

Base PDF extraction needs only `requirements.txt`. Image OCR needs the
separate pinned stack (CPU-only, ~1 GB install):

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements-ocr.txt
```

Without these packages, `POST /api/v1/documents/ocr` answers 503; PDF
extraction keeps working. Supported OCR languages: English (`en`),
Indonesian (`id`), Malay (`ms`), Japanese (`ja`), Traditional Chinese
(`zh-Hant`), Simplified Chinese (`zh-Hans`). Thai and Vietnamese are
rejected — no tested Phase 1 model supports them.

Models (lazy-loaded once per process, CPU-only): PP-OCRv6 small
detection + recognition for all six languages (30 MB cache), chosen by
the Phase 1 small-vs-medium comparison in
`benchmarks/paddleocr-phase0/`. Medium remains available per language in
`app/ocr.py` if a regression is ever found.

Model cache: PaddleX downloads models once into `~/.paddlex` (override
with `PADDLE_PDX_CACHE_HOME`, or OpporCheck's `OCR_MODEL_CACHE` which is
forwarded to it). The cache directory must exist and be writable, must
persist across restarts (else every cold start re-downloads), and holds
model files only — never user documents. Behind slow proxies, first-run
downloads may also need `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True`
(PaddleX's documented bypass for its 1-second hoster healthcheck, which
false-negatives there); do not set it otherwise.

Known environment workaround: `enable_mkldnn=False` is set because
oneDNN execution fails on the benchmark CPU (plain paddle mode). Re-test
on other CPUs before changing it.

Resource profile (measured, 16-logical-core desktop CPU): ~7 s per
1600 px page with the small model (~28 s medium), ~470 MB peak RSS per
request, strict single-flight (concurrent requests get 429), 300 s
per-request timeout (504). Tune `MAX_IMAGE_BYTES`,
`MAX_IMAGE_DIMENSION`, `MAX_IMAGE_PIXELS`, `MAX_OCR_CHARS`, and
`OCR_TIMEOUT_SECONDS` in `app/ocr.py` to taste. The 10 MB upload cap
alone does not bound decode cost — the dimension/pixel/timeout limits
do that.

Privacy: OCR is transient and in-memory only (upload bytes, decoded
bitmap, model tensors); nothing is written to disk, nothing is logged,
extracted text is never auto-saved, and per-line scores never leave the
server. Transient is not the same as private — see `PRIVACY.md`.

Not production readiness: no auth/rate-limiting on the backend, localhost
HTTP only, synthetic-image validation only. See the Phase 1 report.

## Tests (stdlib unittest, no network — HTTP is scripted)

```powershell
.venv\Scripts\Activate.ps1
python -m unittest discover -s tests
```

OCR inference is stubbed in these tests (PaddleOCR is not required). The
one real-model smoke test lives in `benchmarks/paddleocr-phase0/` (that
venv has paddle): `test_ocr_smoke.py` runs the real route end to end.
