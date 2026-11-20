# OpporCheck — Privacy, Data Exposure & Document Safety Audit

Date: 2026-11-19. Read-only audit; no source, config, rules, or dependency was changed. The only new file is this report.

Docs accessed 2026-11-19. Source URLs are listed in each section; access date applies to all.

## 1. Executive summary

OpporCheck's architecture is privacy-conscious in its broad shape: PDF bytes go only to a stateless localhost backend that stores nothing (proven by a tripwire test), Promise-to-Paper and evidence results live only in browser memory, Firestore stores owner-scoped investigations behind strict rules, and no document content is ever logged. Three gaps prevent real employment contracts from being accepted safely today.

1. Cloud fallback can process sensitive documents on Gemini's free tier without the user ever being told what actually happened. The review page discloses fallback only with static wording, the evidence check discloses nothing about processing destination, and Promise-to-Paper never inspects or displays `inferenceSource` even though it collects cloud consent. On the free tier, Google's terms state submitted content may be used to improve products and may be read by human reviewers, and state "Do not submit sensitive, confidential, or personal information to the Unpaid Services."
2. The product's UK-corridor focus collides with the Gemini API terms, which state developers may use only Paid Services when making API clients available to users in the UK (and EEA/Switzerland). Serving UK users through the free tier needs legal review before any public launch. No compliance conclusion is drawn here; the quoted terms are the finding.
3. Full unredacted posting text (up to 60 KB) persists in Firestore indefinitely with no retention control, and original PDF bytes including metadata, images, and hidden content traverse to the backend even though only text is used. A Privacy Check stage before analysis and before saving is feasible within the current architecture and Spark limits, and this report designs it.

Severity counts: 0 Critical, 3 High, 7 Medium, 4 Low, 6 Informational. Findings F1–F3 are High; everything else follows in the findings register (section 12).

## 2. Complete data-flow diagram

### End-to-end flow (review path with PDF)

```
User picks PDF ──browser──▶ validatePdfFile (extension, MIME, 10 MB)
      │ XHR multipart to NEXT_PUBLIC_API_BASE_URL (default http://localhost:8000)
      ▼
FastAPI /api/v1/documents/extract ──▶ magic-byte + size + decrypt checks
      │ pypdf extract_text per page, normalize, truncate to 60,000 chars
      ▼ (JSON: text + page_texts; nothing stored, nothing fetchable later)
Browser state (postingText) ──▶ "Analyze" ──▶ Firebase AI Logic (PREFER_ON_DEVICE)
      ├── on-device (Chrome Prompt API, Gemini Nano) ──▶ stays on device
      └── cloud fallback ──▶ Gemini Developer API free tier (gemini-3.5-flash-lite)
                                              ▲ full prompt + posting text
      ▼ parsed + validated OpportunityReport rendered
"Save" ──▶ Firestore investigations/{id} (ownerId, postingText, report, metadata)
```

Promise-to-Paper differs: up to 6 docs, extraction call per doc plus one comparison call, mode chosen by the user (on-device-only default, or prefer-on-device with consent checkbox), results transient. Evidence differs: deterministic local plan, backend fetches allowlisted GOV.UK excerpts, one comparison call over claims plus excerpts, results transient.

### Stage table

| Stage | Data involved | Destination | Persistence | Potential exposure |
|---|---|---|---|---|
| File selection | File object in browser | Nowhere yet | Browser memory | None |
| Client validation | File name, size, MIME | Nowhere | None | None |
| PDF upload | Entire PDF bytes (text, metadata, images, hidden content) | FastAPI backend | None server-side | Full file traverses network; plaintext HTTP on localhost default |
| Extraction | PDF bytes in, text out | Backend process memory | None; no fetch-back route exists | Uvicorn access logs may record file name, size, timestamp (not text) |
| Extracted text return | Text + per-page texts (max 60K chars) | Browser memory | React state only | None beyond the user's own screen |
| Review analysis | Prompt + posting text | On-device model or Gemini free tier | Google-side per free-tier terms when cloud is used | Silent cloud fallback; content usable for product improvement, human review possible |
| Extraction (per doc) | Prompt + up to 12K doc chars | On-device or cloud per chosen mode | Same as above | Up to 6 cloud calls per run; actual source never shown |
| Comparison | Prompt + up to 40 terms with excerpts | On-device or cloud per chosen mode | Same as above | Excerpts re-transmitted; dropped terms excluded by validation |
| Evidence retrieval | Catalog ids + research questions | FastAPI, then GOV.UK (server-side) | None | User IP never touches GOV.UK; backend IP does |
| Evidence comparison | Prompt + plan claims + official excerpts | On-device or cloud (fixed hybrid) | Same as above | No processing disclosure shown at all |
| Investigation save | postingText + report + metadata | Firestore | Indefinite, until user deletes | Unredacted sensitive text at rest under owner-scoped rules |
| Settings | Theme choice | localStorage (`oc-theme`) | Until cleared | None sensitive |
| Auth session | Firebase user + tokens | Firebase SDK storage (origin-scoped) | SDK-managed | Standard; no app code touches secrets |
| Deletion | Investigation doc | Removed from Firestore | Record gone; copies elsewhere survive (see section 6) | False sense of complete erasure |

### Direct answers

The original PDF leaves the browser (uploaded whole to FastAPI). PDF contents are transmitted to FastAPI, but only extracted text returns and only text ever reaches Gemini; images, metadata, and hidden PDF content are received by the backend yet never forwarded. Extracted text is sent to Gemini whenever cloud inference runs. Posting text is stored in Firestore on save; contract and comparison text is never persisted. AI prompts and raw responses are not persisted anywhere in the app. Browser storage holds only the theme key plus Firebase's own Auth session. No document content enters application logs; only file names and sizes can reach server access logs. Third-party transmission on the cloud path goes to Google under the Gemini API terms; GOV.UK receives only the backend's page fetches, never user documents.

## 3. Sensitive information inventory

Sensitivity scale: S3 (identity/financial takeover risk), S2 (directly identifying or sensitive employment data), S1 (useful for analysis, low standalone risk).

| Category | Examples in scope | Sensitivity | Current handling |
|---|---|---|---|
| Full legal names | Worker, recruiter, signatory | S2 | Preserved end to end; never detected or redacted |
| Home address, phone, personal email, date of birth | Contact blocks, application forms | S2–S3 | Preserved; may enter prompts, Firestore, screen |
| Passport / national ID / tax ID numbers | Visa paperwork, contracts | S3 | Preserved; no detection; persisted if inside posting text |
| Signatures, photographs, facial images | Scanned pages, signature blocks | S3 | Ignored by design: pypdf extracts text only, so visual identifiers never reach AI or Firestore — but they DO reach the backend inside the uploaded bytes |
| Bank account / payment details | Salary payment clauses | S3 | Preserved as text; no detection |
| Salary, bonuses, allowances, deductions, tax, loans | Compensation clauses | S2 | Preserved; required for comparison accuracy (see section 10) |
| Employer / recruiter identity, workplace, visa details, work authorization, employment history | All analysis inputs | S2 | Preserved; core analysis content |
| Personal circumstances in recruiter messages | Family, health, hardship disclosures | S2 | Preserved; pasted-text path has zero inspection |
| PDF metadata (author, creator, timestamps) | Document properties | S1–S2 | Transmitted to backend, never read, never forwarded |
| Embedded images, headers/footers, annotations, tracked changes, hidden text, QR/barcodes | PDF internals | S1–S3 depending on content | Headers/footers/hidden text: extracted as text if in the content stream. Images, annotations, tracked changes, QR codes: not extracted, never reach AI. All arrive at the backend inside the file bytes |
| Scanned pages | Image-only PDFs | — | Rejected with 422 "no extractable text"; nothing proceeds. Privacy-positive: unscannable identifiers never reach AI |

Nothing in the pipeline detects, classifies, or removes sensitive content. The upload notice (`UPLOAD_SENSITIVITY_NOTICE`) warns users that documents may contain sensitive information and to upload only authorized documents; that warning plus user judgment is the entire current control. No automated scanner can guarantee anonymity because identifiers hide in free text, images, context ("my husband's employer"), and cross-document combinations that only a human reader recognizes.

## 4. Firebase AI Logic inference-mode audit

Implementation files: [firebaseClient.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/firebaseClient.ts), [contractAI.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/contractAI.ts), [evidenceComparison.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/evidenceComparison.ts), [review/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/review/page.tsx), [compare/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/compare/page.tsx), [EvidenceInvestigation.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/components/EvidenceInvestigation.tsx), [hybrid-demo/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/hybrid-demo/page.tsx).

| Mode | Used by | Behavior in code |
|---|---|---|
| PREFER_ON_DEVICE | Review analysis, evidence comparison, compare "prefer-on-device", hybrid-demo option | On-device when available, otherwise automatic cloud fallback |
| ONLY_ON_DEVICE | Compare "on-device-only" (default) | Throws when unavailable; nothing is sent anywhere |
| PREFER_IN_CLOUD | Nothing | Not implemented anywhere |
| ONLY_IN_CLOUD | Hybrid-demo option only | Always cloud; never a workspace default |

1. Feature-to-mode mapping is as above; no workspace feature uses PREFER_IN_CLOUD or ONLY_IN_CLOUD.
2. Yes, PREFER_ON_DEVICE can silently fall back. The SDK performs fallback automatically; the review page shows only the static `REVIEW_PROCESSING_NOTICE`, and the evidence flow shows no processing-destination text at all. Only the diagnostics demo shows a fallback notice.
3. No. `inferenceSource` is read in exactly two places: the demo (displayed) and review (saved to Firestore, never displayed). Compare extraction, compare comparison, and evidence comparison never read it.
4. No, except in the demo. Workspace users are never told which source processed their data after the fact.
5. Yes. ONLY_ON_DEVICE fails closed: the SDK throws, `friendlyError` explains nothing was sent, and the consent gate (`analysisGate`) additionally requires a prepared device before on-device-only runs. Verified by code reading, not by runtime test.
6. No bypass exists in code: every model is built through the four `getGenerativeModel` call sites with explicit modes, and no direct model API is used anywhere.
7. No. All AI inputs are assembled text strings; no PDF, image, or audio object is passed to any model, so no multimodal-triggered fallback path exists. On-device structured output (JSON schemas) is within documented Prompt API capability.
8. Yes. `NEXT_PUBLIC_AILOGIC_CLOUD_MODEL` selects the cloud model (default `gemini-3.5-flash-lite`). A misconfigured value can point cloud calls at a billing-required model or fail; see the Spark audit.
9. Cloud inference is used for opportunity analysis, per-document term extraction, Promise-to-Paper comparison, and evidence comparison — i.e. every AI operation except on-device-only compare runs.

### Operation classification

| AI operation | Classification | Data transmitted on cloud path |
|---|---|---|
| Review analysis | HYBRID_WITH_CLOUD_FALLBACK | Full analyzer prompt + posting text (up to 60K chars) |
| Evidence comparison | HYBRID_WITH_CLOUD_FALLBACK | Comparison prompt + up to 12 plan claims + official excerpts |
| Compare extraction (per doc) | ON_DEVICE_ONLY or HYBRID_WITH_CLOUD_FALLBACK per user mode | Extraction prompt + up to 12K doc chars |
| Compare comparison | ON_DEVICE_ONLY or HYBRID_WITH_CLOUD_FALLBACK per user mode | Comparison prompt + up to 40 terms with excerpts |
| Demo runs | HYBRID_WITH_CLOUD_FALLBACK or CLOUD_ONLY per selected option | Same shapes as review |

### Service distinction (per official terms, no legal claims)

- Firebase AI Logic SDK: free-of-charge client SDK and proxy; its own layer adds App Check enforcement and per-user rate limits, not data-use terms.
- Gemini Developer API free tier (Unpaid Services): Google "uses the content you submit ... and any generated responses to provide, improve, and develop Google products and services and machine learning technologies"; "human reviewers may read, annotate, and process your API input and output"; terms say "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Source: [Gemini API Additional Terms](https://aistudio.google.com/docs/terms) (effective March 23, 2026).
- Paid tier: content is not used to improve products; processing follows Google's Data Processor terms; prompts/responses are logged for a limited time for abuse, safety, and legal purposes and "may be stored transiently or cached in any country" with Google facilities. Same source.
- On-device inference: "No data is sent to Google or any third party when using the model." Source: [Chrome Prompt API docs](https://developer.chrome.com/docs/ai/prompt-api).

### Prompt API compatibility (official requirements)

Chrome desktop only (Windows 10/11, macOS 13+, Linux, Chromebook Plus); mobile and non-Plus ChromeOS unsupported. At least 22 GB free profile storage (model removed below 10 GB). GPU with strictly more than 4 GB VRAM, or CPU with 16 GB RAM and 4+ cores; audio input needs GPU. Network needed only for the initial model download. The app's probe (Chrome 139+ desktop check plus `LanguageModel.availability()`) is consistent with this. Practical consequence: a large share of real users, especially on modest hardware or non-Chrome browsers, will always take the cloud path.

## 5. Cloud versus on-device data exposure analysis

On-device runs expose nothing beyond the user's own machine: the Prompt API documentation states no data is sent to Google or any third party. Every cloud run transmits the full assembled prompt — instructions plus user document text, claims, or excerpts — to the Gemini Developer API free tier, where the terms quoted in section 4 apply. There is no middle ground in the current implementation: no redaction, no summarization, no field filtering happens before transmission.

Exposure ranking of current operations, worst first:

1. Review analysis on cloud fallback: up to 60K unexamined characters per call, with only a static notice and no per-run disclosure.
2. Evidence comparison: plan claims plus excerpts, with no processing disclosure whatsoever.
3. Compare extraction/comparison with cloud consent: bounded (12K chars/doc, 40 terms) and consent-gated, but the user is never shown the actual source afterward.
4. Saved investigations: the same unredacted text then persists in Firestore indefinitely.

The misleading-assumption risk is concentrated in one belief users will reasonably hold: "I chose on-device / saw an on-device label, so my document stayed local." Today that belief is unverifiable in the workspace UI for every flow except the diagnostics demo.

## 6. Current persistence and deletion analysis

### Retention table

| Data type | Current location | Persistence | Deletion behavior | Risk |
|---|---|---|---|---|
| Original PDF bytes | Browser memory, then backend process memory during extraction | Transient; never written to disk by app code | Garbage-collected after response | Low on localhost; file traverses network to any hosted backend |
| Extracted posting text (review) | Browser state; Firestore on save | Indefinite in Firestore until user deletes | Investigation delete removes the Firestore doc; browser copy remains until reload/navigation | Medium: unredacted S2/S3 text at rest indefinitely |
| Contract/compare texts | Browser React state only | Session only; reload or Remove discards | Remove button or page leave; no server copy exists | Low |
| Evidence excerpts + findings | Browser state only | Transient per run | Re-run or leave replaces; nothing saved | Low |
| AI reports (review) | Browser state; Firestore on save | Same as posting text | Same as posting text | Low-Medium (derived data, still contains quotes) |
| Theme preference | localStorage `oc-theme` | Until cleared | Browser controls | None |
| Auth session | Firebase SDK storage | SDK-managed | Sign-out clears app session | None beyond standard session handling |
| Cloud-side prompt copies | Google systems (free tier) | Per Google terms, outside app control | Not deletable by the user or the app | High inherent exposure; only avoidable by staying on-device |
| File names | UI messages, compare session, possibly server access logs | Session, plus log retention if enabled | Session copies vanish; log copies follow operator policy | Low-Medium: names like `Amina_Khan_passport.pdf` are identifying |

Deleting an investigation removes exactly one Firestore document. It does not clear the browser's in-memory copies, does not touch anything Google-side from prior cloud runs, does not purge logs, and cannot retract what the user screenshotted or downloaded. [PRIVACY.md](/D:/Projects/HybridAI Firebase Project/PRIVACY.md) is honest about record deletion and retention but does not mention cloud-side copies or in-memory residue. Contract text can never be persisted today (no compare write path exists), which is a privacy strength to preserve. No TTL, Storage, Functions, or other Blaze-only mechanism is used or recommended.

## 7. Security-boundary review

- Firestore rules ([firestore.rules](/D:/Projects/HybridAI Firebase Project/firestore.rules)): authenticated owner-only access; `ownerId` must equal the caller on create and is immutable after; `createdAt`/`updatedAt` must equal server time; client update surface is title/status/`updatedAt` only; any client write containing `findings` is rejected; strict allowlist of fields with size caps; default deny-all. Ownership is additionally checked client-side before rendering. No weakening recommended.
- Auth: email/password (6+ chars, Firebase server rule plus client hint), Google sign-in, password reset; passwords go directly to the SDK, never logged, never stored by the app; route guard redirects signed-out visitors while rules remain the real enforcement.
- FastAPI: no authentication mechanism exists — anyone who can reach the backend can extract PDFs and fetch allowlisted pages. CORS defaults to localhost origins with GET/POST and Content-Type only, no credentials. Request caps: 10 MB upload, 512 KB page fetch, 10 queries, 10 source ids. MIME, extension, and magic-byte validation plus encrypted/corrupt handling are solid. No rate limiting exists. On localhost this is acceptable; publicly hosted without auth and abuse controls it becomes an open CPU-burning PDF parser and fetch proxy (allowlisted targets only, but attacker-driven volume). Backend hardening blocks any public hosting.
- App Check: correctly initialized with reCAPTCHA Enterprise and limited-use tokens, matching the [AI Logic security checklist](https://firebase.google.com/docs/ai-logic/security-checklist). Enforcement itself is console-side and cannot be verified from code; Firebase auto-enforced App Check for AI Logic on 2026-11-02 with mandatory re-enforcement on 2027-01-21. Verify enforcement and API-key restrictions in the console before launch (checklist items the code cannot show).
- Secrets: `.env.local` (real keys present locally) is correctly gitignored via `.env*` in [frontend .gitignore](/D:/Projects/HybridAI Firebase Project/frontend/my-app/.gitignore); only `.env.example` is committable. `NEXT_PUBLIC_*` exposure in the browser bundle is inherent to Firebase web apps and expected — protection comes from rules and App Check, not key secrecy.
- Logging: no `console.*`, `print`, or logger calls in app source; the only matches are test-runner progress output. Uvicorn access logs can record file names and sizes. Backend error strings echo the uploaded file name to the caller; safe on localhost, worth neutralizing before public hosting since file names can identify people.
- Hardening gaps: no custom security headers in [next.config.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/next.config.ts) (confirm served headers at runtime); backend dependencies are unpinned (`>=` ranges, no lock file) unlike the frontend's `package-lock.json`; pypdf parses complex files without worker timeouts (fine locally, needs limits when hosted).

## 8. Privacy Check workflow proposal

Feasible with the current stack and inside Spark: all detection and redaction below runs in the browser over already-extracted text, costing zero Firebase quota. No new dependency is needed for the deterministic layer; the optional AI-assisted layer reuses the existing on-device model.

Proposed stage order between document add and analysis: extract → inspect → review → redact → disclose → confirm → analyze.

1. Extract text as today (backend for PDFs, direct state for pastes).
2. Run deterministic inspection in the browser: email regex, international phone patterns, IBAN/account-like digit runs, passport/ID-like patterns (explicitly documented as heuristic, since formats vary by country), address cues (postcode plus street keywords), and user-supplied custom terms (their own name, employer name). Each hit records excerpt, page number (via the existing `locateExcerptPage` search), and category.
3. Optionally run one ONLY_ON_DEVICE pass asking the model to flag spans that look like names, addresses, or identity numbers. This sends sensitive text to the local model only — acceptable — but its output is advisory, never trusted: every AI span must be verified present in the text (same attribution discipline as `parseExtractionOutput`) and the user reviews each one.
4. Present the privacy summary (section 11): counts by category, items needing manual review, and an explicit banner when the source PDF contains pages or images the text pipeline could not see (scanned pages are currently rejected outright, which is the safe behavior — keep it).
5. Let the user redact (placeholder like `[PHONE_1]`), alias (consistent `EMPLOYER_A`), or retain each item. Salary and term figures default to preserved; identifiers default to redacted; the user can override either.
6. Disclose the processing destination for the chosen mode, including fallback possibility and the free-tier data-use terms in plain language.
7. Require explicit confirmation that names the destination ("Analyze on this device only" vs "Analyze with cloud fallback"). On-device-only unavailability stops with an explanation and never switches silently.
8. Run analysis over the sanitized text. The sanitized variant is what gets transmitted and, on the review path, what gets saved — the original stays only in that page's memory unless the user saves it.

False positives (contract reference numbers flagged as IDs, "May" flagged as a name) are handled by per-item retain; false negatives (unusual formats, contextual identifiers, text inside images) are handled by honest wording: the scanner assists, it does not anonymize. Deterministic detection is predictable and explainable but narrow; AI-assisted detection is broader but can hallucinate spans and miss novel formats, which is why it must stay advisory and on-device-only.

## 9. Redaction strategy and technical limitations

Recommended: redact the extracted-text representation and analyze that; never claim the original PDF was redacted. Concretely: apply user-approved replacements to the per-page strings, keep the `[Page N]` markers and page-number attribution intact (the existing page search keeps working because placeholders remain searchable), preserve a visible "sanitized" badge on every downstream artifact, and offer a redacted `.txt` download. Do not offer a "redacted PDF": drawing black rectangles over PDF text while the original text remains extractable is worse than no redaction because it manufactures false confidence, and the installed pipeline cannot do real PDF redaction — pypdf is a text-extraction library with no redaction, image-removal, or metadata-stripping capability for producing sanitized PDFs. Stating that limitation plainly is part of the design.

Image-based identifiers (signatures, photos, scanned ID pages, QR codes) need a different approach because they never enter the text pipeline: they cannot be inspected or redacted by any text tool. Current posture is accidentally safe (ignored entirely) except that the bytes reach the backend. Options within architecture: warn whenever a PDF contains images the pipeline cannot see (detectable without new dependencies by counting image XObjects per page); keep rejecting image-only PDFs; and document that visual identifiers must be removed by the user before upload (e.g. scan coverage, photo redaction in their own tools). Any future in-browser PDF rasterization or blurring would be a new feature with its own review, not part of this proposal.

## 10. Promise-to-Paper accuracy considerations

Evaluation of the four approaches against the ¥220,000 vs ¥190,000 example (the ¥30,000 gap must survive):

- A. Preserve exact terms, remove unrelated identifiers. Keeps every figure, date, and hour count byte-identical; redacts only names, contact details, and ID numbers that play no comparative role. The gap survives perfectly. Trade-off: figures can occasionally be identifying in combination (rare salary + small employer), so the UI should say sanitized, not anonymous. Recommended default.
- B. Consistent aliases for employer/recruiter names. `EMPLOYER_A` / `RECRUITER_A` applied uniformly across all compared documents preserves cross-document coreference ("A promises X, A's contract says Y") while hiding identities from cloud prompts and any saved artifact. Recommended alongside A as the standard name handling. Trade-off: aliasing must be consistent and visible, or reviewers will confuse aliased and original text.
- C. Synthetic test dataset with consistent transforms. Useful only as a demo/sandbox mode with clearly fake data, never as a transform of a real user document: any arithmetic on real figures risks destroying the exact discrepancies the product exists to find. Recommend as an optional sample-data feature, forbidden as a silent transform.
- D. Keep originals local, send minimum necessary sanitized content to cloud. This is the correct transmission principle and largely already the shape (on-device default, excerpt-bounded prompts); combined with A+B it becomes: cloud sees aliased, identifier-stripped text only. Recommended as the transmission rule whenever cloud runs.

Every sanitized artifact must carry its provenance: which placeholders were applied and that figures are original while names are aliased. Concretely, keep a small in-session transform ledger (placeholder → category, never the original value) and render a "sanitized copy — figures original, identifiers replaced" badge on extraction lists and comparison reports so transformed content is never mistaken for verified original wording.

## 11. Recommended user-facing privacy disclosures

- Document privacy summary (per document): "3 items flagged: 1 phone number, 1 email, 1 possible ID number; 2 need your review. This PDF has 2 pages with images we cannot inspect — identifiers there will not be flagged."
- Per-item review: show the excerpt with page number, state the category and why it was flagged ("looks like a phone number"), and offer Redact / Alias / Keep with figures defaulting to Keep and identifiers defaulting to Redact.
- Processing disclosure (before confirm): name the mode in plain words — "On-device only: your text never leaves this browser. If on-device is unavailable, analysis stops." or "Cloud fallback allowed: when on-device is unavailable, your text is sent to Google's Gemini API free tier, where Google may use it to improve its products and human reviewers may see it. Do not proceed with documents you cannot share." Include the fallback possibility and the consent state explicitly.
- Final confirmation: two distinct buttons carrying the destination ("Analyze on this device only" / "Analyze with cloud fallback") instead of a generic checkbox; after the run, show the actual source ("Processed on-device" / "Processed in the cloud") using the now-inspected `inferenceSource`.
- Standing notices to keep and extend: retain `UPLOAD_SENSITIVITY_NOTICE` and `REVIEW_PROCESSING_NOTICE`; add an evidence-flow equivalent; extend [PRIVACY.md](/D:/Projects/HybridAI Firebase Project/PRIVACY.md) with cloud-side copies, in-memory residue after delete, and the free-tier terms summary.

## 12. Prioritized remediation roadmap

### Findings register

- F1. Silent cloud fallback with no per-run disclosure (review + evidence). Severity HIGH. Evidence: CONFIRMED IN CODE. Files: [review/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/review/page.tsx), [EvidenceInvestigation.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/components/EvidenceInvestigation.tsx). Evidence: fixed `PREFER_ON_DEVICE`; review reads `inferenceSource` but never renders it; evidence never reads it and shows no processing text. Impact: sensitive postings reach the free tier without the user knowing. Remediation: inspect and display the actual source after every run; add an evidence-flow processing notice. Blocks public launch: yes.
- F2. Compare never inspects or displays the actual inference source. Severity HIGH. Evidence: CONFIRMED IN CODE. File: [compare/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/compare/page.tsx). Evidence: `handleExtract`/`handleCompare` use only `response.response.text()`; zero `inferenceSource` references in compare code. Impact: consent is collected but never reconciled with reality. Remediation: capture per-call source, show "Processed on-device / in the cloud" on extraction and comparison reports. Blocks public launch: yes.
- F3. UK-corridor product served via free tier against API terms. Severity HIGH. Evidence: CONFIRMED BY OFFICIAL DOCUMENTATION, REQUIRES HUMAN REVIEW. File: product scope (UK corridor) vs terms. Evidence: terms state "You may use only Paid Services when making API Clients available to users in the EEA, Switzerland, or the UK" and "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Impact: terms violation risk exactly where the product operates. Remediation: legal review of serving UK users on the free tier before launch; no code fix substitutes. Blocks public launch: yes.
- F4. Unredacted posting text persists in Firestore indefinitely. Severity MEDIUM. Evidence: CONFIRMED IN CODE. Files: [investigations.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/investigations.ts), [firestore.rules](/D:/Projects/HybridAI Firebase Project/firestore.rules). Evidence: `postingText` up to 60K saved verbatim; no expiry (TTL would need Blaze). Impact: S2/S3 text at rest indefinitely under good but not infallible access control. Remediation: Privacy Check sanitization before save; retention guidance in UI. Blocks real contracts: yes; blocks launch: no.
- F5. Whole PDF bytes (metadata, images, hidden content) reach the backend. Severity MEDIUM. Evidence: CONFIRMED IN CODE. Files: [documents.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/lib/documents.ts), [main.py](/D:/Projects/HybridAI Firebase Project/backend/app/main.py). Evidence: XHR uploads the full file; backend reads bytes and extracts text only. Impact: over-collection; on a hosted backend, sensitive bytes traverse networks and TLS termination unnecessarily. Remediation: document the limitation; evaluate client-side text extraction later; never store uploads. Blocks real contracts: no (localhost); blocks hosted launch: yes.
- F6. Backend has no authentication or rate limiting. Severity MEDIUM. Evidence: CONFIRMED IN CODE. File: [main.py](/D:/Projects/HybridAI Firebase Project/backend/app/main.py). Evidence: no auth middleware, no throttling; CORS is the only boundary. Impact: publicly hosted, it is an open parse-and-fetch service. Remediation: add auth plus per-IP limits before any public hosting; keep localhost-only until then. Blocks hosted launch: yes.
- F7. File names echoed in errors, UI, and possibly access logs. Severity MEDIUM. Evidence: CONFIRMED IN CODE. Files: [documents.py](/D:/Projects/HybridAI Firebase Project/backend/app/documents.py), [main.py](/D:/Projects/HybridAI Firebase Project/backend/app/main.py). Evidence: `DocumentError` messages embed `filename`; frontend renders them. Impact: names like `Amina_Khan_passport.pdf` identify people in logs and screenshots. Remediation: genericize backend errors ("the uploaded file"); keep names only in the user's own session UI. Blocks launch: no.
- F8. Deletion removes one Firestore doc, not every copy. Severity MEDIUM. Evidence: CONFIRMED IN CODE + INFERRED. Files: [investigations page](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/investigations/page.tsx), [PRIVACY.md](/D:/Projects/HybridAI Firebase Project/PRIVACY.md). Evidence: `deleteDoc` only; browser state, Google-side copies, and logs survive. Impact: users overestimate erasure. Remediation: extend deletion copy and PRIVACY.md with the residue list. Blocks launch: no.
- F9. pypdf parsing without worker isolation or timeouts. Severity MEDIUM. Evidence: CONFIRMED IN CODE. File: [documents.py](/D:/Projects/HybridAI Firebase Project/backend/app/documents.py). Evidence: synchronous parse of up to 10 MB with no time bound. Impact: malformed PDFs can spike CPU/memory; acceptable on localhost, a DoS vector when hosted. Remediation: worker timeouts and request caps with any hosted deployment. Blocks hosted launch: yes.
- F10. Pasted-text path has zero inspection before AI and save. Severity MEDIUM. Evidence: CONFIRMED IN CODE. Files: review paste tab, compare paste box. Evidence: pasted text goes straight to prompts and (review) Firestore. Impact: highest-sensitivity channel (recruiter messages) is the least guarded. Remediation: route pastes through the same Privacy Check as extractions. Blocks real contracts: yes.
- F11. Inaccurate saved provenance (`cloudModel: ""`, `mode: "hybrid"`). Severity LOW. Evidence: CONFIRMED IN CODE. File: [review/page.tsx](/D:/Projects/HybridAI Firebase Project/frontend/my-app/src/app/workspace/review/page.tsx) (`handleSave`). Evidence: hardcoded empty model name and generic mode label instead of the actual values. Impact: stored records misdescribe how they were produced. Remediation: save the real model name and mode. Blocks launch: no.
- F12. App Check enforcement and key restrictions unverifiable from code. Severity LOW. Evidence: REQUIRES HUMAN REVIEW + CONFIRMED BY OFFICIAL DOCUMENTATION. File: console-side config. Evidence: code initializes App Check correctly; enforcement lives in the console (auto-enforced 2026-11-02, mandatory 2027-01-21). Impact: unenforced project would accept forged clients. Remediation: verify enforcement, key restrictions, and metrics in the console. Blocks launch: yes (verification, not code).
- F13. No custom security headers. Severity LOW. Evidence: CONFIRMED IN CODE + REQUIRES RUNTIME TESTING. File: [next.config.ts](/D:/Projects/HybridAI Firebase Project/frontend/my-app/next.config.ts). Evidence: no `headers()` configured. Impact: missing defense-in-depth on a hosted frontend. Remediation: add standard headers with hosting; confirm at runtime. Blocks launch: no.
- F14. Backend dependencies unpinned, no lock file. Severity LOW. Evidence: CONFIRMED IN CODE. File: [requirements.txt](/D:/Projects/HybridAI Firebase Project/backend/requirements.txt). Evidence: `>=` ranges only. Impact: non-reproducible builds, supply-chain drift. Remediation: pin versions and keep a lock. Blocks launch: no.
- F15. No document content in application logs. Severity INFORMATIONAL (strength). Evidence: CONFIRMED IN CODE. Scope: all app source. Evidence: zero `console.*`/`print`/logger calls in app code. Remediation: keep; add a lint rule against logging request bodies.
- F16. Browser storage holds no sensitive app data. Severity INFORMATIONAL (strength). Evidence: CONFIRMED IN CODE. Evidence: only `oc-theme` in localStorage; Auth session is SDK-managed and origin-scoped. Remediation: keep documents out of persistent browser storage.
- F17. Stateless backend proven by tripwire test. Severity INFORMATIONAL (strength). Evidence: CONFIRMED IN CODE. File: [test_documents.py](/D:/Projects/HybridAI Firebase Project/backend/tests/test_documents.py). Evidence: route test fails the suite if any fetch-by-id route appears. Remediation: keep the tripwire green.
- F18. Strong Firestore rules with narrow update surface. Severity INFORMATIONAL (strength). Evidence: CONFIRMED IN CODE. File: [firestore.rules](/D:/Projects/HybridAI Firebase Project/firestore.rules). Evidence: owner-only, server timestamps, immutable fields, findings blocked for clients, default deny. Remediation: change nothing without re-running the rules tests.
- F19. Visual identifiers never reach AI or Firestore. Severity INFORMATIONAL (strength with a caveat). Evidence: CONFIRMED IN CODE. Evidence: pypdf text-only extraction; image-only PDFs rejected with 422. Remediation: preserve; warn users that images are invisible to the pipeline.
- F20. Secrets correctly gitignored. Severity INFORMATIONAL (strength). Evidence: CONFIRMED IN CODE. File: [frontend .gitignore](/D:/Projects/HybridAI Firebase Project/frontend/my-app/.gitignore). Evidence: `.env*` ignored, `.env.example` explicitly committable. Remediation: keep real keys out of the repo.

### Must fix before accepting real employment contracts

- F1, F2: per-run inference-source disclosure in review, evidence, and compare.
- F4, F10: Privacy Check sanitization before AI transmission and before Firestore save, covering pastes equally.
- F3: resolve the UK free-tier terms question; until resolved, real UK employment documents should not flow through cloud fallback.

### Must fix before public launch

- All of the above, plus F12 (verify App Check enforcement and key restrictions), F6 + F9 (backend auth, rate limits, worker bounds before any public hosting), and F5 (hosting decision with TLS and a no-storage guarantee).

### Recommended for future iterations

- F7 (neutral error wording), F8 (deletion-copy honesty), F11 (accurate provenance), F13 (security headers), F14 (pinned backend deps), F15–F20 (preserve the strengths: no-content logging, clean browser storage, tripwire, rules, visual-identifier posture, secret hygiene).
