# OpporCheck

> Understand the opportunity before you commit.

OpporCheck is a decision-support workspace that helps people understand
overseas employment opportunities — recruitment promises, employment
documents, and supporting evidence — before signing anything or paying
any fee.

**What OpporCheck is not:** it is not a scam detector, an employer
verification authority, or a legal or immigration advice service. It shows
what is claimed, what is missing, what conflicts, and what still needs
clarification — so users can ask better questions.

## Features

| Area | What it does |
| ---- | ------------ |
| **Promise-to-Paper** | Compares job ads, recruiter messages, offer letters, employment contracts, and supporting documents (e.g. fee invoices). Extracts employment terms across 9 categories (including an `Others` catch-all) with verbatim excerpts and page attribution, then reports consistent terms, discrepancies, unaddressed promises, and items needing clarification. |
| **Saved comparisons** | Full CRUD library for comparison reports: save, revisit, rename, delete. Stored reports keep titles, findings, and quoted excerpts only — page text is never persisted. |
| **Opportunity review** | Single-posting analysis: occupation, employer, salary, destination, employment type, concerns with confidence levels, missing information, and follow-up questions. |
| **Investigations** | One workspace per opportunity: save, revisit, rename, mark complete, and delete, with per-user Firestore isolation. |
| **Evidence research** | Corridor-specific official sources with retrieved excerpts, freshness status, and attribution-checked findings (`supported` / `conflicting` / `insufficient-evidence`). |
| **Document intake** | Text PDFs, scanned PDFs (native text first, per-page OCR fallback), image OCR (JPG/PNG), and pasted text. Every page reports an explicit outcome (`native` / `ocr` / `native_empty` / `failed`) — failures are never silent. |
| **Privacy Check** | Mandatory, fully local PII detection (passports, IDs, contacts, financial identifiers, credentials) across 7 locales. Redact / replace / retain review with a sanitized preview and content-bound approval. Nothing unapproved reaches AI analysis or storage. |
| **Nine corridors** | Indonesia (origin), Malaysia, Singapore, Japan, Australia, New Zealand, Taiwan, Hong Kong, United Kingdom (default: GB). |
| **Hybrid inference** | On-device-first or cloud-fallback AI via Firebase AI Logic, with honest reporting of where processing actually ran. |
| **Bilingual UI** | English plus Bahasa Indonesia (working drafts pending native-speaker review). |

## Tech stack

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4,
  Firebase Web SDK v13 (Auth, Firestore, AI Logic), Motion. Runs entirely on
  the Firebase **Spark plan** — no paid services.
- **Backend** — FastAPI (Python 3.13) for PDF extraction, OCR, and
  official-source retrieval. Stateless: no document storage, no content
  logging, no AI inference.
- **OCR** — PaddleOCR 3.x (PP-OCRv6 small, CPU-only) + PyMuPDF page rendering.
  Languages: English, Indonesian, Malay, Japanese, Traditional and Simplified
  Chinese.

## Architecture

```text
Browser (Next.js)
├─ Firebase Auth      (sign-in; ID tokens)
├─ Firestore          (investigations + comparisons, owner-scoped rules)
├─ Firebase AI Logic  (on-device / cloud inference)
└─ FastAPI backend    (PDF extract, image OCR, official sources)
      └─ verifies Firebase ID tokens offline, holds no user data
```

AI analysis runs in the frontend through Firebase AI Logic; **the backend
never calls an AI model.**

## Repository layout

```text
├── backend/                 # FastAPI service
│   ├── app/                 # main, documents, ocr, corridors,
│   │                        # official_sources, auth, security
│   ├── tests/               # stdlib unittest suite (OCR stubbed)
│   ├── scripts/             # model download helper
│   ├── requirements.txt     # base deps (PDF, API, auth)
│   ├── requirements-ocr.txt # pinned OCR stack (~1 GB, CPU-only)
│   ├── Dockerfile           # Railway staging build
│   └── README.md            # API reference, OCR setup, security notes
├── frontend/my-app/         # Next.js App Router frontend
│   ├── src/app/             # routes (public + workspace + hybrid-demo)
│   ├── src/components/      # design system ("Evidence Desk")
│   ├── src/lib/             # AI, validation, privacy, Firestore repos
│   ├── test/unit/           # node:test suite (206 tests)
│   └── test/rules/          # Firestore rules tests (emulator)
├── benchmarks/              # OCR accuracy/perf probes + 5 sample PDFs
├── firebase.json            # Firestore rules/indexes wiring
├── firestore.rules          # owner-scoped security rules
├── firestore.indexes.json   # ownerId + createdAt composite indexes
├── railway.json             # backend staging deploy config
├── PRIVACY.md               # privacy model and guarantees
└── DEMO_SCENARIO_HACKATHON.md  # click-through demo script
```

## Quickstart

Prerequisites: Node.js 20+, Python 3.13, a Firebase project (Spark plan is
enough), and the Firebase CLI (or `npx firebase-tools`) for indexes/rules.

### 1. Firebase setup

1. Create a project; enable Email/Password and Google sign-in; create a
   Firestore database.
2. Register a Web app and copy its config values.
3. Deploy the indexes and rules from the repo root:

```powershell
firebase deploy --only firestore:indexes,firestore:rules --project <id>
# or without a global install:
npx -y firebase-tools@latest deploy --only firestore:indexes,firestore:rules --project <id>
```

### 2. Backend (new terminal, from `backend/`)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-ocr.txt   # image/scanned-PDF OCR (CPU-only, ~1 GB)
$env:FIREBASE_PROJECT_ID = "<your project id>"
uvicorn app.main:app --port 8000
```

Health check: `http://localhost:8000/health`

### 3. Frontend (from `frontend/my-app/`)

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in Firebase values + API URL
npm run dev                          # http://localhost:3000
```

`NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000`. See
`.env.example` for the full variable list (Firebase config, cloud model,
App Check site key, debug token).

## API reference (backend)

All routes except `GET /health` require
`Authorization: Bearer <Firebase ID token>` (verified offline, 401/503
fail-closed).

| Method & path | Purpose |
| ------------- | ------- |
| `GET /health` | Liveness probe (unauthenticated). |
| `POST /api/v1/documents/extract` | Hybrid PDF extraction. Multipart `file` + optional `language`; up to 10 MB / 30 pages. Returns full text plus per-page `page_results` (`native` / `ocr` / `native_empty` / `failed`). |
| `POST /api/v1/documents/ocr` | Image OCR. Multipart `file` + `language` (JPEG/PNG, ≤10 MB, ≤8000 px/side, ≤25M pixels). Returns text, aggregate confidence, and low-confidence line counts. |
| `GET /api/v1/corridors` | Supported investigation corridors + verification status (default `GB`). |
| `GET /api/v1/sources?profile=SG` | Approved official-source catalog for one corridor. |
| `POST /api/v1/sources/retrieve` | Fetches allowlisted pages, returns short excerpts. Raw URLs are never accepted; off-allowlist redirects are refused. |

Limits: 10 MB uploads, 30 PDF pages, 150M rendered pixels per request,
60K joined characters, single-flight OCR (concurrent requests get 429).

## Firestore data model

| Collection | Contents | Client writes |
| ---------- | -------- | ------------- |
| `investigations` | Owner, title, status, posting text, analysis report, inference metadata, timestamps. | Create full doc; update title/status only. |
| `comparisons` | Owner, title, per-document summaries, validated findings with quoted excerpts, dropped count, limitations, timestamps. | Create full doc; rename (title) only. |

Both collections are owner-scoped (`ownerId == request.auth.uid`) with
composite indexes on `ownerId` + `createdAt desc`. Page text itself is
never stored — only the quotes already shown in findings.

## Privacy model

- **Privacy Check is mandatory** before any AI analysis: local detection,
  manual redaction/replacement, sanitized preview, and an approval bound
  to the exact approved content (edits invalidate it).
- AI input is always the **approved sanitized text**; attribution checks
  run against that same text.
- The backend is transient and in-memory only: no disk writes, no content
  logs, no persistence — and per-line OCR scores never leave the server.
- Full guarantees and detector coverage: [`PRIVACY.md`](PRIVACY.md).

## Testing

Backend (from `backend/`, venv active):

```powershell
python -m unittest discover -s tests
```

OCR inference is stubbed; real-model smoke tests live in `benchmarks/`.

Frontend (from `frontend/my-app/`):

```powershell
npm run test:unit    # node:test suite, no framework
npm run test:rules   # Firestore rules tests via emulator
npm run lint         # eslint
npx tsc --noEmit     # typecheck
npm run build        # production build (validates all routes)
```

## Deployment (staging)

- Frontend → Vercel, backend → Railway (`backend/Dockerfile`, root directory
  `backend`, health check `/health`), Firebase stays on Spark.
- Backend staging vars: `FIREBASE_PROJECT_ID`, `FRONTEND_ORIGINS`,
  `OPPORCHECK_ALLOWED_HOSTS`, `TRUST_PROXY_HEADERS=true`. See
  `backend/.env.example` and `backend/README.md` for the boundary checklist.
- **Public production is not ready**: edge rate limiting and production
  ASGI hardening are still missing.

## Docs index

- [`PRIVACY.md`](PRIVACY.md) — what is detected, redacted, preserved, sent, stored.
- [`backend/README.md`](backend/README.md) — API, OCR setup, hosting, security.
- [`DEMO_SCENARIO_HACKATHON.md`](DEMO_SCENARIO_HACKATHON.md) — demo script.
- [`SPARK_COMPATIBILITY_AUDIT.md`](SPARK_COMPATIBILITY_AUDIT.md) — Spark-plan fit.
- `PHASE_*.md` — implementation reports (OCR, hybrid PDF, security, deployment).
- [`frontend/my-app/LOCALIZATION.md`](frontend/my-app/LOCALIZATION.md) — i18n conventions.

## Status

Core journeys implemented (opportunity review, Promise-to-Paper comparison
with Others-category support, saved-report libraries, evidence research,
mandatory privacy review). Staging verification in progress.
