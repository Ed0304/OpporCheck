// FastAPI official-source client: catalog listing and excerpt retrieval
// for evidence investigation. The backend owns the allowlist; this client
// only ever sends catalog ids and research-question queries, never URLs.
//
// Indonesian error strings are WORKING DRAFTS needing native-speaker review.

import { apiBase, backendAuthHeaders, backendErrorMessage } from "./documents";
import type { UiLanguage } from "./strings";
import type { OfficialSourceCategory } from "./validation";

export interface SourceCatalogEntry {
  source_id: string;
  label: string;
  url: string;
  category: OfficialSourceCategory;
}

export interface SourceCatalog {
  corridor: string;
  /** Corridor code (e.g. "GB", "SG"); absent from older backend responses. */
  code?: string;
  /** Verification status (e.g. "sources_verified", "partial"). */
  status?: string;
  sources: SourceCatalogEntry[];
}

export interface SourceExcerpt {
  text: string;
  truncated: boolean;
}

export interface RetrievedSource {
  source_id: string;
  title: string;
  url: string;
  retrieved_at: string;
  excerpts: SourceExcerpt[];
}

export interface SourceRetrievalError {
  source_id: string;
  url: string;
  error: string;
}

export interface RetrievalResult {
  sources: RetrievedSource[];
  errors: SourceRetrievalError[];
}

function serviceHint(base: string, language: UiLanguage): string {
  return language === "id"
    ? `Tidak dapat menghubungi layanan bukti di ${base}. Jalankan backend terlebih dahulu ` +
      "(lihat backend/README.md)."
    : `Cannot reach the evidence service at ${base}. Start the backend first ` +
      "(see backend/README.md).";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseCatalogEntry(value: unknown): SourceCatalogEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const source_id = asString(value["source_id"]);
  const label = asString(value["label"]);
  const url = asString(value["url"]);
  const category = asString(value["category"]);
  if (!source_id || !label || !url || !category) {
    return null;
  }
  return { source_id, label, url, category: category as OfficialSourceCategory };
}

function parseRetrievedSource(value: unknown): RetrievedSource | null {
  if (!isRecord(value)) {
    return null;
  }
  const source_id = asString(value["source_id"]);
  const title = asString(value["title"]);
  const url = asString(value["url"]);
  const retrieved_at = asString(value["retrieved_at"]);
  if (!source_id || !title || !url || !retrieved_at || !Array.isArray(value["excerpts"])) {
    return null;
  }
  const excerpts: SourceExcerpt[] = [];
  for (const item of value["excerpts"]) {
    if (!isRecord(item) || typeof item["text"] !== "string") {
      return null;
    }
    excerpts.push({ text: item["text"], truncated: item["truncated"] === true });
  }
  return { source_id, title, url, retrieved_at, excerpts };
}

function parseRetrievalError(value: unknown): SourceRetrievalError | null {
  if (!isRecord(value)) {
    return null;
  }
  const source_id = asString(value["source_id"]);
  const url = asString(value["url"]);
  const error = asString(value["error"]);
  if (!source_id || !url || !error) {
    return null;
  }
  return { source_id, url, error };
}

export async function listOfficialSources(
  profile = "GB",
  language: UiLanguage = "en",
): Promise<SourceCatalog> {
  const base = apiBase();
  const headers = await backendAuthHeaders();
  const id = language === "id";
  let response: Response;
  try {
    response = await fetch(
      `${base}/api/v1/sources?profile=${encodeURIComponent(profile)}`,
      { headers },
    );
  } catch {
    throw new Error(serviceHint(base, language));
  }
  let data: unknown = null;
  try {
    data = (await response.json()) as unknown;
  } catch {
    throw new Error(
      id
        ? `Layanan bukti mengembalikan respons yang tidak terbaca (${response.status}).`
        : `The evidence service returned an unreadable response (${response.status}).`,
    );
  }
  if (!response.ok || !isRecord(data) || !Array.isArray(data["sources"])) {
    if (response.status === 401) {
      throw new Error(backendErrorMessage(response.status, undefined, "", language));
    }
    const detail = isRecord(data) && typeof data["error"] === "string" ? `: ${data["error"]}` : "";
    throw new Error(
      id
        ? `Permintaan layanan bukti gagal (${response.status})${detail}.`
        : `The evidence service request failed (${response.status})${detail}.`,
    );
  }
  const sources: SourceCatalogEntry[] = [];
  for (const item of data["sources"]) {
    const entry = parseCatalogEntry(item);
    if (!entry) {
      throw new Error(
        id
          ? "Layanan bukti mengembalikan katalog sumber yang tidak terbaca."
          : "The evidence service returned an unreadable source catalog.",
      );
    }
    sources.push(entry);
  }
  const corridor = asString(data["corridor"]) ?? "";
  const code = asString(data["code"]) ?? undefined;
  const status = asString(data["status"]) ?? undefined;
  return { corridor, code, status, sources };
}

export async function retrieveOfficialSources(
  sourceIds: string[] | null,
  queries: string[],
  profile = "GB",
  language: UiLanguage = "en",
): Promise<RetrievalResult> {
  const base = apiBase();
  const headers = {
    "Content-Type": "application/json",
    ...(await backendAuthHeaders()),
  };
  const id = language === "id";
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/sources/retrieve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source_ids: sourceIds, queries, profile }),
    });
  } catch {
    throw new Error(serviceHint(base, language));
  }
  let data: unknown = null;
  try {
    data = (await response.json()) as unknown;
  } catch {
    throw new Error(
      id
        ? `Layanan bukti mengembalikan respons yang tidak terbaca (${response.status}).`
        : `The evidence service returned an unreadable response (${response.status}).`,
    );
  }
  if (!response.ok || !isRecord(data)) {
    if (response.status === 401) {
      throw new Error(backendErrorMessage(response.status, undefined, "", language));
    }
    const detail = isRecord(data) && typeof data["error"] === "string" ? `: ${data["error"]}` : "";
    throw new Error(
      id
        ? `Permintaan layanan bukti gagal (${response.status})${detail}.`
        : `The evidence service request failed (${response.status})${detail}.`,
    );
  }
  if (!Array.isArray(data["sources"]) || !Array.isArray(data["errors"])) {
    throw new Error(
      id
        ? "Layanan bukti mengembalikan respons yang tidak terbaca."
        : "The evidence service returned an unreadable response.",
    );
  }
  const sources: RetrievedSource[] = [];
  for (const item of data["sources"]) {
    const source = parseRetrievedSource(item);
    if (!source) {
      throw new Error(
        id
          ? "Layanan bukti mengembalikan sumber yang tidak terbaca."
          : "The evidence service returned an unreadable source.",
      );
    }
    sources.push(source);
  }
  const errors: SourceRetrievalError[] = [];
  for (const item of data["errors"]) {
    const failure = parseRetrievalError(item);
    if (!failure) {
      throw new Error(
        id
          ? "Layanan bukti mengembalikan entri kesalahan yang tidak terbaca."
          : "The evidence service returned an unreadable error entry.",
      );
    }
    errors.push(failure);
  }
  return { sources, errors };
}

/**
 * Picks catalog ids covering the plan's source categories. Matching is
 * case-insensitive; categories with no catalog entry are skipped and
 * reported by the caller as a limitation.
 */
export function sourceIdsForCategories(
  catalog: SourceCatalog,
  categories: OfficialSourceCategory[],
): { ids: string[]; uncovered: OfficialSourceCategory[] } {
  const wanted = new Set(categories.map((category) => category.toLowerCase()));
  const ids: string[] = [];
  const covered = new Set<string>();
  for (const entry of catalog.sources) {
    const normalized = entry.category.toLowerCase();
    if (wanted.has(normalized)) {
      ids.push(entry.source_id);
      covered.add(normalized);
    }
  }
  const uncovered = [...wanted].filter((category) => !covered.has(category));
  return { ids, uncovered: uncovered as OfficialSourceCategory[] };
}
