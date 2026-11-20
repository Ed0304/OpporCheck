# OpporCheck — Firebase Spark Plan Compatibility Audit

Date: 2026-11-19. Audit only; no code or configuration was changed.

Verdict: the current implementation is already close to a Spark-compatible MVP. Authentication, Firestore persistence, and hybrid AI inference (via the Gemini Developer API free tier) all fit Spark with no billing account. The only hard blockers are production hosting of the Next.js frontend and the FastAPI backend, neither of which has a Firebase-hosted free path on Spark.

## 1. Current architecture and Firebase service inventory

### Firebase services in use (all client-side, browser only)

| Service | Where | Notes |
|---|---|---|
| Authentication (email/password, Google, password reset) | [auth.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/auth.tsx) | No phone auth. Session uses default local persistence. |
| Cloud Firestore (`investigations` collection) | [investigations.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/investigations.ts), [firestore.rules](/D:/Projects/HybridAI Firebase Project/firestore.rules) | Owner-scoped CRUD. One composite query (`ownerId` + `createdAt` desc). |
| Firebase AI Logic, `GoogleAIBackend` (Gemini Developer API) | [firebaseClient.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/firebaseClient.ts) | Default cloud model `gemini-3.5-flash-lite`. Never the Agent Platform (Vertex) backend. |
| App Check (reCAPTCHA Enterprise + limited-use tokens) | [firebaseClient.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/firebaseClient.ts) | Matches the production checklist (enforce App Check, limited-use tokens). |

### Firebase services NOT used (verified by search)

No `getStorage`, `getFunctions`, `httpsCallable`, or Vertex backend imports exist in `frontend/my-app/src`. No `storage.rules`, `firestore.indexes.json`, `.firebaserc`, `apphosting.yaml`, or `functions/` directory exists. [firebase.json](/D:/Projects/HybridAI Firebase Project/firebase.json) declares only Firestore rules plus a local Firestore emulator (port 8080, UI disabled). `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` appears in [.env.example](/D:/Projects/HybridAI Firebase Project/frontend/my-app/.env.example) but is never consumed by a Storage call.

### Google Cloud services (reached through Firebase)

| Service | Role | Billing relevance |
|---|---|---|
| Gemini Developer API free tier | Cloud fallback for AI Logic | Free of charge on Spark; all usage becomes pay-as-you-go if billing is ever linked. |
| reCAPTCHA Enterprise assessments | App Check attestation provider | Free up to 10,000 assessments/month; overage needs billing. |
| Chrome Prompt API (Gemini Nano) | On-device inference engine | Runs on the user's device; documented as no-cost inference. |

### External and third-party services

| Service | Role |
|---|---|
| GOV.UK pages (4 allowlisted URLs) | Fetched server-side by the backend for evidence excerpts. No API key, no Firebase involvement. |
| Vercel | Mentioned only in the default Next.js README template. Not configured. |

### Local development only (zero cost, not production hosting)

Next.js dev server (`next dev`), FastAPI via uvicorn on `localhost:8000`, Firestore emulator, and App Check debug tokens. The composite index for `ownerId + createdAt` must still be created once via the Firebase console link; index creation itself has no billing implication.

### FastAPI backend dependency check

[requirements.txt](/D:/Projects/HybridAI Firebase Project/backend/requirements.txt) contains only `fastapi`, `uvicorn`, `pypdf`, and `python-multipart`. No `firebase-admin`, no Google Cloud libraries. The backend never touches Firebase: [main.py](/D:/Projects/HybridAI Firebase Project/backend/app/main.py) exposes stateless PDF extraction and allowlisted source retrieval, and [documents.py](/D:/Projects/HybridAI Firebase Project/backend/app/documents.py) only mirrors the Firestore 60,000-character limit as a truncation cap. "Matches Firestore limit" is a comment-level alignment, not a dependency.

## 2. Spark plan compatibility matrix

Spark quotas used below are confirmed from official docs: Auth 50K MAU (non-phone); Firestore 50K reads / 20K writes / 20K deletes per day, 1 GiB stored, 10 GiB/month egress, exactly one free database, 1 MiB max document; Hosting 10 GB storage + 360 MB/day transfer; Storage, Functions, and App Hosting show "Not applicable" on Spark (Blaze-only); AI Logic itself is free-of-charge with Gemini Developer API billing following the free/paid tier.

| Feature | Firebase service | Spark compatibility | Usage/cost risk | Recommendation |
|---|---|---|---|---|
| 1. Registration and authentication (email/password, Google, reset) | Auth | Yes, no-cost up to 50K MAU | Negligible for hackathon | KEEP |
| 2. Investigation history and Firestore persistence | Firestore | Yes, within daily quotas | Low; 60 KB docs are far under the 1 MiB cap; one write per save | KEEP WITH LIMITS |
| 3. Job-ad text analysis via AI Logic (1 call per review) | AI Logic + Gemini Developer API free tier | Yes; `gemini-3.5-flash-lite` is documented as billing-not-required with free input/output tokens | Medium; project-level RPM/RPD/TPM caps return 429 when exceeded | KEEP WITH LIMITS |
| 4a. `PREFER_ON_DEVICE` (review, evidence, compare fallback) | AI Logic hybrid | Yes; on-device is documented no-cost, cloud fallback uses the free tier | Medium; silent cloud fallback consumes free-tier quota | KEEP |
| 4b. `ONLY_ON_DEVICE` (compare default) | Chrome Prompt API via AI Logic | Yes; nothing leaves the device, zero quota | None (fails closed with an exception when unavailable) | KEEP |
| 4c. `PREFER_IN_CLOUD` | AI Logic hybrid | Technically allowed on Spark free tier | High waste; maximizes cloud calls for no MVP benefit | DEFER |
| 4d. `ONLY_IN_CLOUD` (hybrid-demo page only) | AI Logic cloud | Yes on the free tier | Medium; every run is a cloud call | KEEP WITH LIMITS |
| 5. PDF upload and text extraction (10 MB, 60K chars, no OCR) | None (FastAPI + pypdf, stateless) | N/A to Firebase billing; zero Firebase cost on localhost | Hosting the backend has no Spark path (see section 6) | KEEP WITH LIMITS |
| 6. Promise-to-Paper comparison (max 6 docs, transient) | AI Logic + FastAPI extract | Yes; up to 7 AI calls per run on free tier; zero Firestore cost (never saved) | Medium-high; heaviest AI consumer per user action | KEEP WITH LIMITS |
| 7. Official-source evidence investigation (4 GOV.UK pages, excerpts, 1 AI call) | AI Logic + FastAPI retrieval | Yes; transient results, no persistence | Low; retrieval is plain HTTPS, not a metered AI call | KEEP |
| 8. Document storage and retrieval | None by design (no Storage usage) | Yes only if Storage stays unused; Storage is Blaze-only | Adopting Firebase Storage would force Blaze | KEEP |
| 9. Investigation reports (persisted) | Firestore | Yes, same as feature 2 | Low | KEEP |
| 9b. Persisted `findings` (server-side writes) | None available on Spark | No trusted server exists on Spark (Functions unavailable, backend has no Admin SDK) | Cannot be built without Blaze or external infra | DEFER |
| 10. User settings and preferences | None (localStorage + Auth profile) | Yes; zero Firebase cost | None | KEEP |

Notes on the matrix. Feature 8 is KEEP precisely because the current design already avoids document storage: PDFs are extracted statelessly, Promise-to-Paper and evidence results live in browser memory, and only extracted text inside investigation docs is persisted ([PRIVACY.md](/D:/Projects/HybridAI Firebase Project/PRIVACY.md) documents this). Feature 4c is the only mode not implemented anywhere; 4d exists only in the diagnostics demo at [hybrid-demo/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/hybrid-demo/page.tsx).

## 3. Features that can safely remain in the MVP

These stay unchanged on Spark with no billing account.

- Auth (feature 1). Email/password and Google sign-in are non-phone Auth, no-cost to 50K MAU. No phone auth is configured, so the only metered Auth path is untouched.
- `PREFER_ON_DEVICE` and `ONLY_ON_DEVICE` (4a, 4b). On-device inference is documented as no-cost; cloud fallback runs on the free tier of `gemini-3.5-flash-lite`, which Firebase marks billing-not-required and prices at free input/output tokens. The existing modes can remain unchanged, including the fixed hybrid mode in review and evidence comparison and the on-device-only default with consent-gated fallback in Promise-to-Paper.
- Evidence investigation (7). Deterministic local planner (max 12 items), backend retrieval of at most 4 allowlisted pages as short excerpts, and exactly 1 comparison call. Transient results mean zero Firestore cost.
- Document handling as designed (8). Stateless extraction plus transient browser state deliberately avoids Storage. Keep it that way.
- Investigation reports (9) and settings (10). Reports reuse the cheap Firestore path; settings cost nothing (localStorage theme in [theme.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/theme.tsx), account data from the Auth user object).

## 4. Features requiring usage limits or optimization

Already mostly capped in code; the items below are guardrails to keep, plus small follow-ups.

- Investigation persistence (2). Current caps are Spark-friendly: 60 KB `postingText`, 120-char titles, bounded lists, single-doc reads/writes, and a `limit()`-clamped list query (default 20, max 100). Keep the rules as the enforcement point; add user-facing retention guidance (delete finished investigations; per-record delete already exists) rather than automatic expiry, since Firestore TTL deletes require billing.
- Job-ad analysis (3) and `ONLY_IN_CLOUD` demo (4d). One cloud call per review is fine, but free-tier quota is project-level and shared across all users and IPs, with 429 errors on exceed. Keep the demo route as a diagnostics page, not a workspace default. Set the Firebase AI Logic API per-user rate limit (default 100 RPM, configurable in Cloud console) to a value matching real single-user need, per the quotas documentation.
- Promise-to-Paper (6). Heaviest flow: up to 6 extraction calls plus 1 comparison call per run, each up to 12K input chars. Existing controls are good (6-doc cap, 12K-char extraction cap, 40-term comparison cap, on-device-only default, consent gate for cloud). Recommended posture: keep on-device-only as the default, keep cloud consent explicit, and discourage repeated re-runs of unchanged documents (extracted terms are already cached in session state per document until its type changes).
- PDF extraction (5). The 10 MB / 60K-char caps stay. For the MVP, run the backend on localhost for demos (current design). Any hosted deployment is the deferred part, not the feature itself.

## 5. Features that should be deferred

- `PREFER_IN_CLOUD` (4c). No implementation exists and the MVP gains nothing from a cloud-first default; it only burns the shared free-tier quota. Defer indefinitely.
- Persisted `findings` (9b). The rules intentionally reserve `findings` for trusted server-side writes and reject client writes containing it. On Spark there is no trusted server: Cloud Functions is unavailable, and the FastAPI backend has no Firebase Admin SDK or service account. Keep findings transient (current behavior) until a Blaze-backed function or an external trusted server exists.
- Hosted production deployments of frontend and backend. No Firebase-hosted free path exists on Spark (section 6). Defer production hosting decisions until after the hackathon; demo locally.
- Any Firebase Storage adoption, Firestore TTL/PITR/backups, and Remote Config-driven model switching. Storage is Blaze-only; TTL deletes, PITR, backups, restores, and clones explicitly require billing; Remote Config adds no MVP value yet.

## 6. Potential sources of unexpected charges or billing upgrades

On Spark itself you cannot be charged: over-quota requests fail instead (Firestore daily caps, Gemini 429s). Every charge path below starts with linking a billing account or enabling a Blaze-only service, so the practical risk is an accidental upgrade, not a surprise invoice on Spark.

1. Linking any billing account flips all Gemini Developer API usage to pay-as-you-go. The AI Logic pricing page states this explicitly: after linking, every Gemini Developer API call (including through AI Logic SDKs) is metered, at $0.30/1M input and $2.50/1M output tokens for `gemini-3.5-flash-lite`. Firestore and other services keep their own no-cost levels, but AI calls do not. Never link billing "just to raise one quota" without expecting AI metering.
2. Switching the cloud model or backend. Only some models work without billing: `gemini-3.5-flash-lite` is marked billing-not-required, while image models (Nano Banana family) and stronger reasoning models (e.g. Gemini 4 Carbon/Neon) require it. The model name is env-configurable (`NEXT_PUBLIC_AILOGIC_CLOUD_MODEL`), so a one-line change can silently require Blaze. Likewise, swapping `GoogleAIBackend` for the Agent Platform (Vertex) backend always requires Blaze. Pin the model choice in release review.
3. Firebase Storage, Cloud Functions, Cloud Run, and App Hosting. All show "Not applicable" on Spark: there is no free path. Adopting any of them upgrades the project to Blaze.
4. reCAPTCHA Enterprise scale. App Check itself is no-cost, but its attestation provider meters assessments: free to 10,000/month, then $8 flat to 100K, then $1/1K. A hackathon MVP will not approach this; monitor assessments in Cloud console before any public launch. Spark also restricts App Check to 4 reCAPTCHA score levels (vs 11 on Blaze), a granularity limit, not a charge.
5. Firestore paid-only features. TTL deletes, PITR, backups, restores, and clones require billing. Do not enable them. Also note exactly one free database per project.
6. Free-tier data-use terms (not a charge, but a compliance risk). On the Gemini Developer API free tier, content is used to improve Google's products; on paid tiers it is not. Employment documents sent through cloud fallback fall under this. Disclose it alongside the existing processing notices and prefer on-device modes for sensitive documents.
7. FastAPI hosting and GOV.UK scraping. No Firebase charge applies (traffic never touches Firebase), but any host bills its own CPU/egress, and repeated full-page fetches depend on GOV.UK availability. The backend already caps responses (512 KB), excerpts (3 x 600 chars), and queries (10); keep those caps on any host.

## 7. Recommended free-tier MVP architecture

Keep the current shape; change nothing structurally for the hackathon.

- Frontend: Next.js run locally (`next dev`) for demos. No Firebase Hosting or App Hosting config exists, and App Hosting (the SSR path) is Blaze-only. A static export to Firebase Hosting (10 GB storage, 360 MB/day transfer on Spark) is the only Firebase-hosted option, and only if the app can live within static-export constraints; otherwise stay local for the MVP.
- Firebase project on Spark: Auth (email/password + Google), one Firestore database with the current rules, AI Logic with `GoogleAIBackend` pinned to `gemini-3.5-flash-lite`, App Check enforced with the existing limited-use-token setup.
- Backend: FastAPI on localhost as today. No Firebase Admin SDK, no stored documents, no background jobs. Production hosting is a post-MVP decision on non-Firebase infrastructure (verify that host's own free terms separately; nothing about Firebase makes it free).
- Data flow: PDFs to localhost backend only; extracted text (max 60K chars) into Firestore via the owner's account; AI calls from the browser via AI Logic; findings and comparisons transient. This preserves Promise-to-Paper and evidence-based investigation as the product core with zero persistence cost for the heaviest artifacts.

## 8. Prioritized future optimizations

1. Set the AI Logic API per-user rate limit to single-user need (quotas page recommends adjusting the 100 RPM default). Prevents one user from exhausting the shared project quota.
2. Add API-key restrictions and AI monitoring alerts per the production checklist (restrictions are free; alerts catch quota exhaustion early).
3. Reduce Promise-to-Paper cloud calls: default on-device-only is already set; consider extracting fewer docs per run or warning before 6-doc cloud runs.
4. Add a "re-run" guard convention: analysis results already persist per investigation, so re-analysis of unchanged text should be discouraged in UI copy.
5. Document the retention convention (user deletes finished investigations) and consider a createdAt-ordered "oldest first" list hint; no TTL automation on Spark.
6. Before any public launch: review the Gemini free-tier data-use terms with the team, confirm reCAPTCHA assessment volume, and decide the backend host on its own (non-Firebase) terms.

## Sources (official documentation used)

- Pricing plans and per-product Spark quotas: [Firebase pricing](https://firebase.google.com/pricing), [pricing plans guide](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).
- AI Logic billing model (free-of-charge SDK, free vs paid tiers, billing-account flip): [AI Logic pricing](https://firebase.google.com/docs/ai-logic/pricing).
- Model availability without billing (`gemini-3.5-flash-lite` billing-not-required): [AI Logic supported models](https://firebase.google.com/docs/ai-logic/models).
- Free-tier token pricing and data-use terms: [Gemini Developer API pricing](https://aistudio.google.com/docs/pricing) (`gemini-3.5-flash-lite`: free input/output on free tier; $0.30/$2.50 per 1M on paid tier).
- Quotas, 429 behavior, per-user limits: [AI Logic quotas](https://firebase.google.com/docs/ai-logic/quotas), [Gemini rate limits](https://aistudio.google.com/docs/rate-limits), [AI Logic FAQ](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting).
- On-device no-cost inference and the four inference modes: [hybrid get-started for web](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started), [hybrid configuration options](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options).
- Production hardening (App Check enforcement, limited-use tokens, key restrictions, monitoring): [AI Logic production checklist](https://firebase.google.com/docs/ai-logic/production-checklist).
- App Check on Spark (4 score levels) and assessment charging: [App Check reCAPTCHA Enterprise provider for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
- Firestore free quota, 1 MiB document cap, billing-only features: [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).

## Verification status

Confirmed from the sources above: Spark quotas for Auth, Firestore, Hosting, and the Blaze-only status of Storage/Functions/App Hosting; AI Logic free-of-charge with provider-dependent billing; `gemini-3.5-flash-lite` free-tier availability and paid rates; on-device inference at no cost; the billing-link pay-as-you-go flip; Firestore billing-only features.

Requiring confirmation (could not be pinned to an exact official number): exact free-tier RPM/RPD/TPM values for `gemini-3.5-flash-lite` (Google directs projects to view live per-project limits in AI Studio; capacity varies); exact reCAPTCHA Enterprise free-tier mechanics beyond the public 10,000 assessments/month figure (third-party corroborated, verify in Cloud console); whether Cloud Storage is hard-blocked or merely unquotaed on Spark (pricing table says "Not applicable"; either way, do not adopt it on Spark). No recommendation above depends on these numbers.
