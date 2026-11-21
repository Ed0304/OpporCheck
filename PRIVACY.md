# OpporCheck privacy notes

How OpporCheck handles your documents and data. This is a plain-language
description of the implemented behavior — it is not a legal privacy policy
and makes no claim of compliance with any privacy law or security standard.

## What is stored (Firestore)

Saved investigations only. Each record holds the approved sanitized text
you analyzed (see Privacy Check below — originals with personal details
are not saved), the structured report, and workflow metadata (title,
status, timestamps). Records saved before Privacy Check existed still
hold whatever text was analyzed then. Records are:

- **Owner-scoped**: every record carries your user id, list queries filter
  by it in code, and Firestore security rules re-check ownership
  server-side. No user can read, change, or delete another user's records
  (see `firestore.rules` and `frontend/my-app/test/rules/`).
- **Deletable by you**: "My investigations" offers per-record delete with
  confirmation; deletion removes the record immediately. There is no
  undelete, trash, or admin recovery.
- **Retained until you delete them**: OpporCheck sets no automatic expiry.
  Records persist until you delete them or the project database is removed.

Client-saved comparison findings are intentionally not supported: the
rules reject any client write containing `findings`.

## What is never stored

- **Uploaded PDFs and their contents**: the FastAPI backend extracts text
  and returns it in the same response. Nothing is written to disk or kept
  in memory between requests, and no endpoint can fetch a previously
  uploaded document (covered by a backend tripwire test). Pages with
  selectable text extract directly; pages that need OCR are rendered to
  images in memory and recognized, then discarded with the response —
  rendered pages are additional transient in-memory copies, never files.
  Pages that fail extraction are reported per page, never silently
  dropped; partially extracted documents say so. A page with adequate
  selectable text keeps it even when it also embeds images (flagged with
  a warning) — embedded-image regions are not separately detected.
- **Uploaded images and OCR output**: image OCR is transient and
  in-memory only (upload bytes, decoded bitmap, model tensors). Nothing
  is written to disk, extracted text is never saved automatically — only
  text you explicitly adopt and then save as an investigation persists —
  and per-line confidence scores are aggregated server-side (mean plus
  low-confidence count) and discarded. The OCR model cache holds model
  files only, never your documents. Transient handling is good hygiene,
  not a privacy guarantee.
- **Promise-to-Paper documents and comparisons**: document texts,
  extracted terms, and comparison results live in browser memory only.
  Leaving or reloading the page discards them.
- **Evidence-investigation results**: official-source excerpts and
  comparisons are transient and never saved.
- **Unapproved originals**: text you never approved is never analyzed and
  never saved. Editing approved text voids the approval until you check again.

## Privacy Check (mandatory)

Before any AI analysis — review, Promise-to-Paper comparison, evidence
check, or the model demo — your text passes a Privacy Check in the browser:

- **Detection runs locally.** No text is sent anywhere to find sensitive
  information. Detection looks for identity numbers (passport numbers,
  Indonesian NIK and similar), birth dates stated as such, phone numbers,
  email addresses, residential addresses, bank account and payment-card
  numbers, passwords/PINs/keys, and signature labels.
- **Employment evidence is preserved.** Salaries, currencies, pay
  frequency, overtime rates, hours, durations, deductions, benefits,
  leave, responsibilities, and employer names are never flagged and pass
  through byte-exact. You may still redact anything manually, including
  employer names.
- **You decide each item**: redact (replaced with a label such as
  `[PASSPORT]`), replace with your own text, or keep. You can also redact
  any text you select, and undo any choice before approving.
- **Approval is explicit and exact.** Analysis and saving only accept the
  approved cleaned text; any edit voids the approval. Saving an
  investigation is a second, separate action that stores the approved
  text analyzed — never a silent original.
- **What detection cannot do.** It reads text only: visual signatures,
  photographs, scanned ID images, and photo content are invisible to it.
  Matches are possibilities, not certainties, and anything may be missed
  — including names without labels and unusual ID formats. Split-line
  identifiers are caught for passports and ID numbers; spaced-out ID
  digits and card numbers split across lines may still be missed. This
  check assists review; it does not anonymize.
- **Measured behavior.** A synthetic 14-document validation corpus
  (Indonesian, Malaysian, Singaporean, Japanese, English, Traditional
  and Simplified Chinese employment texts) checks detection against
  ground truth on every test run: all annotated sensitive items are
  found, no high-confidence false alarms occur, and every protected
  employment term (salaries, deductions, dates, employer names) passes
  through untouched. Synthetic scores are a regression guard, not proof
  of real-world accuracy.

## What leaves your device

- **PDF uploads**: sent to the document service (`NEXT_PUBLIC_API_BASE_URL`,
  default `http://localhost:8000`) for hybrid text extraction and OCR,
  over plain HTTP in local development. Do not use a local-development
  backend address for sensitive documents outside a trusted network.
  Extracted text — native or OCR — still passes mandatory Privacy Check
  before any analysis, exactly like pasted and image text.
- **Image uploads**: sent to the same document service for OCR under the
  same transport conditions. Supported languages are English, Indonesian,
  Malay, Japanese, Traditional Chinese, and Simplified Chinese; Thai and
  Vietnamese uploads are rejected.
- **AI analysis**: Firebase AI Logic runs in your browser. Only the
  approved sanitized text is ever analyzed; originals never reach AI.
  - Review and evidence comparison use hybrid mode fixed to
    prefer-on-device with cloud fallback; approved text and excerpts are
    sent to the configured cloud model only when on-device analysis is
    unavailable. After each review run, the page states whether it actually
    ran on-device or in the cloud.
  - Promise-to-Paper offers on-device-only (default; cloud processing is
    impossible, not just disabled) and prefer-on-device with explicit
    consent collected before any cloud processing. Every compared page is
    privacy-approved first; comparison terms derive from approved text.
  - Evidence checks re-verify approval on the stored posting (including
    records saved before Privacy Check existed) and transmit only quotes
    from the approved text plus public official-source excerpts.
  - After each AI operation, the page states where it actually ran
    (on-device, in the cloud, or location unavailable) based on the
    SDK-reported result — never inferred from your settings.
- **No public URLs**: uploaded or analyzed documents are never published
  at a retrievable address.

## Logging

Application code never logs document contents. Server access logs (if the
operator enables them) may record request metadata such as file names,
sizes, and timestamps, but not extracted text.

## Controls still missing (honest limitations)

- Records saved before Privacy Check existed keep their original text at
  rest. They are never rewritten automatically; evidence checks on them
  still require a fresh approval, and you can delete any record yourself.
- The local document service (PDF/OCR) has no sign-in or rate limiting
  and must only ever run on your own machine over a trusted connection:
  anyone who can reach it can use it. Do not expose it to a network.
- No transport encryption guarantee for the local-development backend
  address (plain HTTP default); production deployments must terminate TLS.
- No encryption-at-rest statement beyond what Firebase/Firestore provides
  by default; no customer-managed keys.
- No automatic record expiry or retention controls.
- No bulk export of your records.
- No independent privacy or security assessment has been performed.
