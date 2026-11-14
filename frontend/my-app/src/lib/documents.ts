// FastAPI document client: PDF text extraction for opportunity review.
// Upload uses XMLHttpRequest so the UI can show real upload progress.

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB, mirrors the backend cap

export interface ExtractResult {
  filename: string;
  text: string;
  pages: number;
  truncated: boolean;
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
        resolve({
          filename: typeof data.filename === "string" ? data.filename : file.name,
          text: data.text,
          pages: typeof data.pages === "number" ? data.pages : 0,
          truncated: data.truncated === true,
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
