# OpporCheck privacy notes

How OpporCheck handles your documents and data. This is a plain-language
description of the implemented behavior — it is not a legal privacy policy
and makes no claim of compliance with any privacy law or security standard.

## What is stored (Firestore)

Saved investigations only. Each record holds the posting or document text
you analyzed, the structured report, and workflow metadata (title, status,
timestamps). Records are:

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
  uploaded document (covered by a backend tripwire test).
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

## What leaves your device

- **PDF uploads**: sent to the document service (`NEXT_PUBLIC_API_BASE_URL`,
  default `http://localhost:8000`) for text extraction, over plain HTTP in
  local development. Do not use a local-development backend address for
  sensitive documents outside a trusted network.
- **Image uploads**: sent to the same document service for OCR under the
  same transport conditions. Supported languages are English, Indonesian,
  Malay, Japanese, Traditional Chinese, and Simplified Chinese; Thai and
  Vietnamese uploads are rejected.
- **AI analysis**: Firebase AI Logic runs in your browser.
  - Review and evidence comparison use hybrid mode fixed to
    prefer-on-device with cloud fallback; posting text and excerpts are
    sent to the configured cloud model only when on-device analysis is
    unavailable.
  - Promise-to-Paper offers on-device-only (default; cloud processing is
    impossible, not just disabled) and prefer-on-device with explicit
    consent collected before any cloud processing.
- **No public URLs**: uploaded or analyzed documents are never published
  at a retrievable address.

## Logging

Application code never logs document contents. Server access logs (if the
operator enables them) may record request metadata such as file names,
sizes, and timestamps, but not extracted text.

## Controls still missing (honest limitations)

- No transport encryption guarantee for the local-development backend
  address (plain HTTP default); production deployments must terminate TLS.
- No encryption-at-rest statement beyond what Firebase/Firestore provides
  by default; no customer-managed keys.
- No automatic record expiry or retention controls.
- No bulk export of your records.
- No independent privacy or security assessment has been performed.
