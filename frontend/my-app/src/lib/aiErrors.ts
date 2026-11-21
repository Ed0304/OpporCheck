// Shared AI service-error mapping: dependency-free and unit-tested.
//
// Maps quota/overload/outage signatures to calm, actionable user copy.
// App Check handling stays per-surface (that copy differs by page);
// anything unrecognized passes through untouched.
//
// The copy renders in the UI language (default English). The Indonesian
// variant is a WORKING DRAFT needing native-speaker review — never
// present it as final.

import type { UiLanguage } from "./strings";

const BUSY_PATTERNS: RegExp[] = [
  /\b429\b/,
  /\b503\b/,
  /quota/i,
  /rate[\s\-_]?limit/i,
  /resource[\s\-_]?exhausted/i,
  /overload(ed)?/i,
  /service unavailable/i,
  /temporarily unavailable/i,
  /backend error/i,
  /internal error/i,
];

export const AI_SERVICE_BUSY_MESSAGE =
  "The AI service is busy or temporarily unavailable. Wait a moment and " +
  "try again — your text is unchanged.";

/** Indonesian working draft of the busy message (needs native-speaker review). */
export const AI_SERVICE_BUSY_MESSAGE_ID =
  "Layanan AI sedang sibuk atau sementara tidak tersedia. Tunggu sebentar dan " +
  "coba lagi — teks Anda tidak berubah.";

/** Friendly copy for service-side failures, or null to pass through. */
export function mapServiceError(message: string, language: UiLanguage = "en"): string | null {
  if (BUSY_PATTERNS.some((pattern) => pattern.test(message))) {
    return language === "id" ? AI_SERVICE_BUSY_MESSAGE_ID : AI_SERVICE_BUSY_MESSAGE;
  }
  return null;
}
