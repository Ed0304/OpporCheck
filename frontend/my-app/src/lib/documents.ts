// FastAPI document client: PDF text extraction for opportunity review.
// Upload uses XMLHttpRequest so the UI can show real upload progress.

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB, mirrors the backend cap

export interface ExtractResult {
  filename: string;
  text: string;
  pages: number;
  truncated: boolean;
  /** Per-page text (index + 1 is the page number); [] when unavailable. */
  page_texts: string[];
}

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";
}

/** Client-side validation; the backend re-validates everything. Returns an error or null. */
export function validatePdfFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf")) {
    return `"${file.name}" doesn't look like a PDF. Please choose a .pdf file.`;
  }
  if (file.type !== "" && file.type !== "application/pdf") {
    return `"${file.name}" isn't a PDF file (detected as ${file.type}).`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_PDF_BYTES) {
    return `"${file.name}" is larger than the 10 MB limit.`;
  }
  return null;
}

export function uploadPdf(
  file: File,
  onProgress: (fraction: number | null) => void,
): Promise<ExtractResult> {
  const base = apiBase();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/api/v1/documents/extract`);
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable ? event.loaded / event.total : null);
    };
    xhr.onload = () => {
      let data: { error?: unknown } & Partial<ExtractResult> = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {
        reject(new Error(`The document service returned an unreadable response (${xhr.status}).`));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof data.text === "string") {
        const rawPages = (data as { page_texts?: unknown }).page_texts;
        const page_texts = Array.isArray(rawPages)
          ? rawPages.filter((entry): entry is string => typeof entry === "string")
          : [];
        resolve({
          filename: typeof data.filename === "string" ? data.filename : file.name,
          text: data.text,
          pages: typeof data.pages === "number" ? data.pages : 0,
          truncated: data.truncated === true,
          page_texts,
        });
      } else {
        reject(
          new Error(
            typeof data.error === "string" ? data.error : `Upload failed (${xhr.status}).`,
          ),
        );
      }
    };
    xhr.onerror = () => {
      reject(
        new Error(
          `Cannot reach the document service at ${base}. Start the backend first ` +
            "(see backend/README.md), or paste the text instead.",
        ),
      );
    };
    const form = new FormData();
    form.append("file", file, file.name);
    onProgress(0);
    xhr.send(form);
  });
}

// ---------------------------------------------------------------------------
// Direct image OCR (Phase 1). Thai and Vietnamese are intentionally absent:
// no tested Phase 1 model supports them, and the backend rejects them.
// ---------------------------------------------------------------------------

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB, mirrors the backend cap
export const MAX_IMAGE_DIMENSION = 8000; // px per side, enforced by the backend
export const MAX_IMAGE_PIXELS = 25_000_000; // decoded-pixel ceiling, backend-enforced

/** Mean line confidence below this triggers a review warning in the UI. */
export const LOW_CONFIDENCE_MEAN = 0.9;

export type OcrLanguage = "en" | "id" | "ms" | "ja" | "zh-Hant" | "zh-Hans";

export const OCR_LANGUAGES: ReadonlyArray<{ code: OcrLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "ja", label: "日本語" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "zh-Hans", label: "简体中文" },
];

export interface OcrResult {
  filename: string;
  text: string;
  pages: number;
  truncated: boolean;
  page_texts: string[];
  source: "ocr";
  language: string;
  lines: number;
  mean_confidence: number;
  low_confidence_lines: number;
}

/** Client-side validation; the backend re-validates everything. Returns an error or null. */
export function validateImageFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const hasImageExtension =
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
  if (!hasImageExtension) {
    return `"${file.name}" doesn't look like a supported image. Please choose a .jpg, .jpeg, or .png file.`;
  }
  if (file.type !== "" && file.type !== "image/jpeg" && file.type !== "image/png") {
    return `"${file.name}" isn't a supported image (detected as ${file.type}).`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is larger than the 10 MB limit.`;
  }
  return null;
}

/** True when the UI should show a review-carefully warning. High confidence never implies correctness. */
export function shouldWarnLowConfidence(result: {
  mean_confidence: number;
  low_confidence_lines: number;
}): boolean {
  return (
    result.mean_confidence < LOW_CONFIDENCE_MEAN || result.low_confidence_lines > 0
  );
}

/** Parses an OCR response body; returns null when the shape is wrong. Pure and unit-testable. */
export function parseOcrResponse(data: unknown, fallbackName: string): OcrResult | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record["text"] !== "string" || record["source"] !== "ocr") {
    return null;
  }
  const rawPages = record["page_texts"];
  const page_texts = Array.isArray(rawPages)
    ? rawPages.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    filename: typeof record["filename"] === "string" ? record["filename"] : fallbackName,
    text: record["text"],
    pages: typeof record["pages"] === "number" ? record["pages"] : 0,
    truncated: record["truncated"] === true,
    page_texts,
    source: "ocr",
    language: typeof record["language"] === "string" ? record["language"] : "",
    lines: typeof record["lines"] === "number" ? record["lines"] : 0,
    mean_confidence:
      typeof record["mean_confidence"] === "number" ? record["mean_confidence"] : 0,
    low_confidence_lines:
      typeof record["low_confidence_lines"] === "number"
        ? record["low_confidence_lines"]
        : 0,
  };
}

/** Minimal XHR surface used by uploadImage; injectable so unit tests can drive it. */
export interface XhrLike {
  open(method: string, url: string): void;
  send(body: unknown): void;
  upload: {
    onprogress:
      | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void)
      | null;
  };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  status: number;
  responseText: string;
}

export function uploadImage(
  file: File,
  language: OcrLanguage,
  onProgress: (fraction: number | null) => void,
  createXhr: () => XhrLike = () => new XMLHttpRequest() as unknown as XhrLike,
): Promise<OcrResult> {
  const base = apiBase();
  return new Promise((resolve, reject) => {
    const xhr = createXhr();
    xhr.open("POST", `${base}/api/v1/documents/ocr`);
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable ? event.loaded / event.total : null);
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        reject(new Error(`The document service returned an unreadable response (${xhr.status}).`));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const parsed = parseOcrResponse(data, file.name);
        if (parsed) {
          resolve(parsed);
          return;
        }
      }
      const message =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)["error"]
          : undefined;
      reject(
        new Error(
          typeof message === "string" ? message : `Upload failed (${xhr.status}).`,
        ),
      );
    };
    xhr.onerror = () => {
      reject(
        new Error(
          `Cannot reach the document service at ${base}. Start the backend first ` +
            "(see backend/README.md), or paste the text instead.",
        ),
      );
    };
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("language", language);
    onProgress(0);
    xhr.send(form);
  });
}
