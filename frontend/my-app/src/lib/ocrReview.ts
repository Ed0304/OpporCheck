// OCR review state machine for the image-upload tab (Phase 1).
//
// Dependency-free (type-only import) so unit tests can drive every
// transition: selection, validation errors, upload progress, extraction
// results, text correction, and reset. OCR output is never submitted for
// analysis automatically; the page adopts the draft only on explicit
// user action.

import type { OcrLanguage, OcrResult } from "./documents";

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
  | { type: "select"; fileName: string }
  | { type: "invalidate"; message: string }
  | { type: "failed"; message: string }
  | { type: "progress"; fraction: number | null }
  | { type: "extracted"; result: OcrResult }
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
        message: `Uploading ${action.fileName}…`,
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
      return {
        ...state,
        phase: "ready",
        progress: 1,
        message:
          `Extracted ${action.result.lines} line${action.result.lines === 1 ? "" : "s"} from ` +
          `${action.result.filename} (mean confidence ${mean}%` +
          `${action.result.truncated ? ", trimmed to fit" : ""}). ` +
          "Review and correct the text below, then use it.",
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
