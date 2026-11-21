// OCR review state machine for the image-upload tab (Phase 1).
//
// Dependency-free (type-only import) so unit tests can drive every
// transition: selection, validation errors, upload progress, extraction
// results, text correction, and reset. OCR output is never submitted for
// analysis automatically; the page adopts the draft only on explicit
// user action.
//
// Status messages render in the UI language (default English). Every `id`
// message below is a WORKING DRAFT needing native-speaker review before
// it can be considered final. Never present them as final.

import type { OcrLanguage, OcrResult } from "./documents";
import type { UiLanguage } from "./strings";

export type OcrPhase = "idle" | "invalid" | "uploading" | "ready" | "error";

export interface OcrReviewState {
  phase: OcrPhase;
  progress: number | null;
  message: string;
  language: OcrLanguage;
  result: OcrResult | null;
  /** Editable corrected text; seeded from the extraction result. */
  draft: string;
  /** True once the user has edited the draft. */
  dirty: boolean;
}

export type OcrAction =
  | { type: "select"; fileName: string; language?: UiLanguage }
  | { type: "invalidate"; message: string }
  | { type: "failed"; message: string }
  | { type: "progress"; fraction: number | null }
  | { type: "extracted"; result: OcrResult; language?: UiLanguage }
  | { type: "edit"; text: string }
  | { type: "language"; language: OcrLanguage }
  | { type: "reset" };

export function initialOcrState(): OcrReviewState {
  return {
    phase: "idle",
    progress: null,
    message: "",
    language: "en",
    result: null,
    draft: "",
    dirty: false,
  };
}

export function ocrReducer(state: OcrReviewState, action: OcrAction): OcrReviewState {
  switch (action.type) {
    case "select":
      return {
        ...state,
        phase: "uploading",
        progress: 0,
        message:
          action.language === "id"
            ? `Mengunggah ${action.fileName}…`
            : `Uploading ${action.fileName}…`,
        result: null,
        draft: "",
        dirty: false,
      };
    case "invalidate":
      return { ...state, phase: "invalid", progress: null, message: action.message };
    case "failed":
      return { ...state, phase: "error", progress: null, message: action.message };
    case "progress":
      return state.phase === "uploading"
        ? { ...state, progress: action.fraction }
        : state;
    case "extracted": {
      const mean = Math.round(action.result.mean_confidence * 100);
      const message =
        action.language === "id"
          ? `Mengekstrak ${action.result.lines} baris dari ${action.result.filename} ` +
            `(rata-rata keyakinan ${mean}%` +
            `${action.result.truncated ? ", dipangkas agar muat" : ""}). ` +
            "Periksa dan koreksi teks di bawah ini, lalu gunakan."
          : `Extracted ${action.result.lines} line${action.result.lines === 1 ? "" : "s"} from ` +
            `${action.result.filename} (mean confidence ${mean}%` +
            `${action.result.truncated ? ", trimmed to fit" : ""}). ` +
            "Review and correct the text below, then use it.";
      return {
        ...state,
        phase: "ready",
        progress: 1,
        message,
        result: action.result,
        draft: action.result.text,
        dirty: false,
      };
    }
    case "edit":
      return state.phase === "ready"
        ? { ...state, draft: action.text, dirty: true }
        : state;
    case "language":
      return { ...state, language: action.language };
    case "reset":
      return { ...initialOcrState(), language: state.language };
  }
}
