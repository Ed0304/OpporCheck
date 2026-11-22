// FastAPI document client: PDF text extraction for opportunity review.
// Upload uses XMLHttpRequest so the UI can show real upload progress.
//
// Error copy renders in the UI language (default English). Every `id`
// string below is a WORKING DRAFT needing native-speaker review before
// it can be considered final. Never present them as final.

import type { UiLanguage } from "./strings";

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB, mirrors the backend cap

export type PdfPageSource = "native" | "ocr" | "native_empty" | "failed";
export type PdfDocumentSource = "native" | "ocr" | "mixed";

export interface PdfPageResult {
  /** 1-based page number. */
  page: number;
  source: PdfPageSource;
  text: string;
  truncated: boolean;
  /** Aggregate OCR confidence; null for non-OCR pages. */
  mean_confidence: number | null;
  low_confidence_lines: number;
  status: "ok" | "empty" | "failed";
  warning: string | null;
  failure_code: string | null;
}

export interface ExtractResult {
  filename: string;
  text: string;
  pages: number;
  truncated: boolean;
  /** Per-page text (index + 1 is the page number); [] when unavailable. */
  page_texts: string[];
  /** Hybrid source breakdown (Phase 2); absent from older responses. */
  source?: PdfDocumentSource;
  language?: string;
  page_results?: PdfPageResult[];
}

export function apiBase(): string {
  // Strip trailing slashes: callers append "/api/..." themselves, and a
  // configured "https://host/" would otherwise produce "//api/..." URLs
  // the backend router does not match.
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  return raw && raw.length > 0 ? raw : "http://localhost:8000";
}

/** Client-side validation; the backend re-validates everything. Returns an error or null. */
export function validatePdfFile(file: File, language: UiLanguage = "en"): string | null {
  const lower = file.name.toLowerCase();
  // Indonesian messages are WORKING DRAFTS needing native-speaker review.
  const id = language === "id";
  if (!lower.endsWith(".pdf")) {
    return id
      ? `"${file.name}" tampaknya bukan PDF. Pilih berkas .pdf.`
      : `"${file.name}" doesn't look like a PDF. Please choose a .pdf file.`;
  }
  if (file.type !== "" && file.type !== "application/pdf") {
    return id
      ? `"${file.name}" bukan berkas PDF (terdeteksi sebagai ${file.type}).`
      : `"${file.name}" isn't a PDF file (detected as ${file.type}).`;
  }
  if (file.size === 0) {
    return id ? `"${file.name}" kosong.` : `"${file.name}" is empty.`;
  }
  if (file.size > MAX_PDF_BYTES) {
    return id
      ? `"${file.name}" melebihi batas 10 MB.`
      : `"${file.name}" is larger than the 10 MB limit.`;
  }
  return null;
}

const PDF_PAGE_SOURCES: ReadonlySet<string> = new Set([
  "native",
  "ocr",
  "native_empty",
  "failed",
]);

const PDF_DOCUMENT_SOURCES: ReadonlySet<string> = new Set(["native", "ocr", "mixed"]);

function parsePdfPage(raw: unknown): PdfPageResult | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record["page"] !== "number" || typeof record["text"] !== "string") {
    return null;
  }
  const source = record["source"];
  const status = record["status"];
  return {
    page: record["page"],
    source: typeof source === "string" && PDF_PAGE_SOURCES.has(source) ? (source as PdfPageSource) : "failed",
    text: record["text"],
    truncated: record["truncated"] === true,
    mean_confidence:
      typeof record["mean_confidence"] === "number" ? record["mean_confidence"] : null,
    low_confidence_lines:
      typeof record["low_confidence_lines"] === "number"
        ? record["low_confidence_lines"]
        : 0,
    status: status === "ok" || status === "empty" || status === "failed" ? status : "failed",
    warning: typeof record["warning"] === "string" ? record["warning"] : null,
    failure_code:
      typeof record["failure_code"] === "string" ? record["failure_code"] : null,
  };
}

/** Parses an extract response body; returns null when the shape is wrong. Pure and unit-testable. */
export function parseExtractResponse(data: unknown, fallbackName: string): ExtractResult | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record["text"] !== "string") {
    return null;
  }
  const rawPages = record["page_texts"];
  const page_texts = Array.isArray(rawPages)
    ? rawPages.filter((entry): entry is string => typeof entry === "string")
    : [];
  const rawResults = record["page_results"];
  const page_results = Array.isArray(rawResults)
    ? rawResults
        .map(parsePdfPage)
        .filter((entry): entry is PdfPageResult => entry !== null)
    : undefined;
  const source = record["source"];
  return {
    filename: typeof record["filename"] === "string" ? record["filename"] : fallbackName,
    text: record["text"],
    pages: typeof record["pages"] === "number" ? record["pages"] : 0,
    truncated: record["truncated"] === true,
    page_texts,
    source:
      typeof source === "string" && PDF_DOCUMENT_SOURCES.has(source)
        ? (source as PdfDocumentSource)
        : undefined,
    language: typeof record["language"] === "string" ? record["language"] : undefined,
    page_results,
  };
}

/** 1-based numbers of pages that failed extraction (never silent). */
export function failedPageNumbers(result: ExtractResult): number[] {
  return (result.page_results ?? [])
    .filter((page) => page.status === "failed")
    .map((page) => page.page);
}

/** Aggregate OCR confidence across a result's OCR pages, if any. */
export function ocrConfidenceSummary(result: ExtractResult): {
  ocrPages: number;
  meanConfidence: number;
  lowLines: number;
} | null {
  const ocrPages = (result.page_results ?? []).filter((page) => page.source === "ocr");
  if (ocrPages.length === 0) {
    return null;
  }
  const scored = ocrPages.filter(
    (page): page is PdfPageResult & { mean_confidence: number } =>
      typeof page.mean_confidence === "number",
  );
  const meanConfidence =
    scored.length === 0
      ? 0
      : scored.reduce((sum, page) => sum + page.mean_confidence, 0) / scored.length;
  return {
    ocrPages: ocrPages.length,
    meanConfidence,
    lowLines: ocrPages.reduce((sum, page) => sum + page.low_confidence_lines, 0),
  };
}

export function uploadPdf(
  file: File,
  onProgress: (fraction: number | null) => void,
  language?: string,
  createXhr: () => XhrLike = () => new XMLHttpRequest() as unknown as XhrLike,
  uiLanguage: UiLanguage = "en",
): Promise<ExtractResult> {
  const base = apiBase();
  // Indonesian errors are WORKING DRAFTS needing native-speaker review.
  const id = uiLanguage === "id";
  return (async () => {
    const headers = await backendAuthHeaders();
    return new Promise<ExtractResult>((resolve, reject) => {
    const xhr = createXhr();
    xhr.open("POST", `${base}/api/v1/documents/extract`);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader?.(name, value);
    }
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable ? event.loaded / event.total : null);
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        reject(
          new Error(
            id
              ? `Layanan dokumen mengembalikan respons yang tidak terbaca (${xhr.status}).`
              : `The document service returned an unreadable response (${xhr.status}).`,
          ),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const parsed = parseExtractResponse(data, file.name);
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
          backendErrorMessage(
            xhr.status,
            message,
            id ? `Pengunggahan gagal (${xhr.status}).` : `Upload failed (${xhr.status}).`,
            uiLanguage,
          ),
        ),
      );
    };
    xhr.onerror = () => {
      reject(
        new Error(
          id
            ? `Tidak dapat menghubungi layanan dokumen di ${base}. Jalankan backend terlebih ` +
              "dahulu (lihat backend/README.md), atau tempel teks sebagai gantinya."
            : `Cannot reach the document service at ${base}. Start the backend first ` +
              "(see backend/README.md), or paste the text instead.",
        ),
      );
    };
    const form = new FormData();
    form.append("file", file, file.name);
    if (language !== undefined && language !== "") {
      form.append("language", language);
    }
    onProgress(0);
    xhr.send(form);
    });
  })();
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
export function validateImageFile(file: File, language: UiLanguage = "en"): string | null {
  const lower = file.name.toLowerCase();
  const hasImageExtension =
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
  // Indonesian messages are WORKING DRAFTS needing native-speaker review.
  const id = language === "id";
  if (!hasImageExtension) {
    return id
      ? `"${file.name}" tampaknya bukan gambar yang didukung. Pilih berkas .jpg, .jpeg, atau .png.`
      : `"${file.name}" doesn't look like a supported image. Please choose a .jpg, .jpeg, or .png file.`;
  }
  if (file.type !== "" && file.type !== "image/jpeg" && file.type !== "image/png") {
    return id
      ? `"${file.name}" bukan gambar yang didukung (terdeteksi sebagai ${file.type}).`
      : `"${file.name}" isn't a supported image (detected as ${file.type}).`;
  }
  if (file.size === 0) {
    return id ? `"${file.name}" kosong.` : `"${file.name}" is empty.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return id
      ? `"${file.name}" melebihi batas 10 MB.`
      : `"${file.name}" is larger than the 10 MB limit.`;
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

/**
 * Firebase ID-token provider for backend calls, registered by the Firebase
 * client module at browser runtime. Resolving per request keeps tokens
 * fresh (SDK-cached, auto-refreshed) and never stored anywhere.
 */
type BackendTokenProvider = () => Promise<string | null>;

let backendTokenProvider: BackendTokenProvider | null = null;

/** Registers (or clears, with null) the backend token provider. */
export function registerBackendTokenProvider(provider: BackendTokenProvider | null): void {
  backendTokenProvider = provider;
}

/** Authorization header for backend calls; {} when signed out or failing. */
export async function backendAuthHeaders(): Promise<Record<string, string>> {
  if (!backendTokenProvider) {
    return {};
  }
  try {
    const token = await backendTokenProvider();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export const BACKEND_UNAUTHORIZED_MESSAGE =
  "Your sign-in expired. Please sign in again, then retry.";

/** Indonesian working draft of the re-sign-in message (needs native-speaker review). */
export const BACKEND_UNAUTHORIZED_MESSAGE_ID =
  "Sesi masuk Anda kedaluwarsa. Silakan masuk lagi, lalu coba lagi.";

/** Maps backend failures to user copy; 401 always means re-sign-in. */
export function backendErrorMessage(
  status: number | null,
  serverMessage: unknown,
  fallback: string,
  language: UiLanguage = "en",
): string {
  if (status === 401) {
    return language === "id" ? BACKEND_UNAUTHORIZED_MESSAGE_ID : BACKEND_UNAUTHORIZED_MESSAGE;
  }
  return typeof serverMessage === "string" ? serverMessage : fallback;
}

/** Minimal XHR surface used by uploads; injectable so unit tests can drive it. */
export interface XhrLike {
  open(method: string, url: string): void;
  setRequestHeader?: (name: string, value: string) => void;
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
  uiLanguage: UiLanguage = "en",
): Promise<OcrResult> {
  const base = apiBase();
  // Indonesian errors are WORKING DRAFTS needing native-speaker review.
  const id = uiLanguage === "id";
  return (async () => {
    const headers = await backendAuthHeaders();
    return new Promise<OcrResult>((resolve, reject) => {
    const xhr = createXhr();
    xhr.open("POST", `${base}/api/v1/documents/ocr`);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader?.(name, value);
    }
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable ? event.loaded / event.total : null);
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        reject(
          new Error(
            id
              ? `Layanan dokumen mengembalikan respons yang tidak terbaca (${xhr.status}).`
              : `The document service returned an unreadable response (${xhr.status}).`,
          ),
        );
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
          backendErrorMessage(
            xhr.status,
            message,
            id ? `Pengunggahan gagal (${xhr.status}).` : `Upload failed (${xhr.status}).`,
            uiLanguage,
          ),
        ),
      );
    };
    xhr.onerror = () => {
      reject(
        new Error(
          id
            ? `Tidak dapat menghubungi layanan dokumen di ${base}. Jalankan backend terlebih ` +
              "dahulu (lihat backend/README.md), atau tempel teks sebagai gantinya."
            : `Cannot reach the document service at ${base}. Start the backend first ` +
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
  })();
}
