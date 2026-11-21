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
(multipart fields `file` + optional `language`, PDF up to 10 MB and 30
pages; hybrid native/OCR extraction — see below. Response keeps
`filename`/`text`/`pages`/`truncated`/`page_texts` and adds `source`
(`native`|`ocr`|`mixed`), `language`, and per-page `page_results`.)

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

## Hosting and security notes (Phase 2.5A)

Three deployment boundaries — do not confuse them:

- **Local development (safe as configured):** run
  `uvicorn app.main:app --port 8000` (binds 127.0.0.1 by default —
  never pass `--host 0.0.0.0` for local work). CORS allows the local
  frontend origins, the host allowlist accepts only loopback, and a
  generous per-IP rate limit (60 req/min, `/health` exempt) is on.
  Set `FIREBASE_PROJECT_ID` to your Firebase project id and sign in
  through the frontend; the browser attaches ID tokens automatically.
- **Private/internal deployment (Railway):** set `FRONTEND_ORIGINS`
  to the exact frontend origin, `OPPORCHECK_ALLOWED_HOSTS` to the
  service domain, `FIREBASE_PROJECT_ID` to the Firebase project id,
  and `TRUST_PROXY_HEADERS=true` (Railway's edge overwrites
  `X-Real-IP` per request, so client IPs stay accurate). TLS is
  platform-managed. Railway settings: Root Directory `backend`,
  builder Dockerfile (auto-detected, pinned in `railway.json`),
  health check `/health`. No code changes needed.
- **Public production: NOT READY.** Still missing: edge rate limiting
  (the built-in limiter is per-process memory only) and production
  ASGI hardening. Per-user Firebase authentication IS implemented
  (all routes except `/health` verify ID tokens offline); what remains
  is operational (secret handling, abuse monitoring), not architectural.
  Do not expose this service publicly until those exist.

What the code does and does not do: Firebase ID-token verification IS
access control (401/503 fail-closed, UID on request state); the host
allowlist and rate limiter are abuse friction. CORS never controls
access. Upload, page, pixel, text, timeout, and single-flight limits
bound per-request work; nothing is logged or persisted. See
`PHASE_2_5A_PRODUCTION_SECURITY_REPORT.md` and
`PHASE_2_6B_RAILWAY_IMPLEMENTATION_REPORT.md` for the full audits.

## Firebase authentication (Phase 2.6B)

Every route except `GET /health` requires
`Authorization: Bearer <Firebase ID token>`. Tokens verify offline via
`google-auth` against Google's signing keys with the audience pinned to
`FIREBASE_PROJECT_ID` (missing project config answers 503; bad tokens
answer 401; unreachable signing keys answer 503). The verified UID is
available as `request.state.firebase_uid`. The backend holds no service
credentials and touches no Firestore data. Local development uses real
tokens: sign in through the frontend running against the same Firebase
project — no test bypass exists by design.

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

## Hybrid PDF extraction (Phase 2)

Each page is classified independently: native pypdf text first, OCR
fallback only for pages without meaningful native text. A page counts as
text-based with ≥12 alphanumeric characters and ≥2 words; page numbers,
footers, and symbols alone route to OCR, as does text dominated by
replacement/control characters (corrupt extraction). Truly blank pages
(no text, no images) are reported empty without invoking OCR.

Pages needing OCR render in memory with PyMuPDF at 150 DPI
(`OCR_RENDER_DPI`, clamped 72–200; Phase 0 measured 300 DPI as pure
overhead) and run through the shared PaddleOCR singleton — one engine,
one single-flight slot, one total time budget (600 s) per request.
Native-only PDFs never initialize PaddleOCR. Per-page outcomes are
`native` / `ocr` / `native_empty` / `failed`, each with text,
confidence (OCR pages), status, and optional warning/failure code; the
top-level `source` is `mixed` unless every page shares one successful
source. Failed pages never silently vanish: partial results return HTTP
200 with explicit codes, and only a fully unusable document returns 422
(or 503/429/504 when every failure shares that cause).

Limits: 10 MB upload, 30 pages, 150M rendered pixels per request,
8000 px render side, 60K joined characters (per-page `truncated` flags
mark content past the cutoff). Without the OCR packages installed, OCR
pages report `ocr_unavailable` while native pages still succeed.

Known limitation: region-level detection is out of scope — a page with
adequate native text keeps it even when it also embeds images (flagged
with a warning); only fully scanned pages and sparse/corrupt pages OCR.

Example `page_results` entry (OCR page):
`{"page": 2, "source": "ocr", "text": "...", "truncated": false,
"mean_confidence": 0.97, "low_confidence_lines": 1, "status": "ok",
"warning": null, "failure_code": null}`

## Tests (stdlib unittest, no network — HTTP is scripted)

```powershell
.venv\Scripts\Activate.ps1
python -m unittest discover -s tests
```

OCR inference is stubbed in these tests (PaddleOCR is not required). The
real-model smoke tests live in `benchmarks/paddleocr-phase0/` (that venv
has paddle + PyMuPDF): `test_ocr_smoke.py` runs the image route end to
end, `test_hybrid_smoke.py` runs native/scanned/mixed PDFs end to end,
and `bench_hybrid_perf.py` measures the hybrid pipeline.
