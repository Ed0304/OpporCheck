// Saved comparison reports: typed Firestore repository for
// Promise-to-Paper reports the user chose to keep.
//
// Ownership model mirrors investigations: every report carries ownerId
// (the Firebase Auth uid). List queries always filter ownerId in code;
// rules enforce the same ownership server-side but are never relied on
// to filter results.
//
// Only validated report content is stored: findings pass through
// validatePromiseToPaperFinding, and stored documents render from
// stored data only. Page text itself is never persisted — quotes live
// inside the findings and terms, exactly as the report displays them.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import type {
  ContractDocumentType,
  PromiseToPaperFinding,
} from "./contractTypes";
import type { CompareDocSource } from "./compareSession";
import { classifyError, type StoreResult } from "./investigations";
import { MAX_LIST_COUNT, validatePromiseToPaperFinding, validateTitle } from "./validation";

export const COMPARISONS_COLLECTION = "comparisons";

/** Persisted per-document summary (page text itself is never stored). */
export interface SavedComparisonDocument {
  id: string;
  fileName: string;
  documentType: ContractDocumentType;
  source: CompareDocSource;
  pageCount: number;
  wasTrimmed: boolean;
  termCount: number;
}

export interface ComparisonReportInput {
  ownerId: string;
  title: string;
  documents: SavedComparisonDocument[];
  findings: PromiseToPaperFinding[];
  droppedCount: number;
  limitations: string[];
  /** Verbatim Firebase AI Logic inference source, e.g. "on_device". */
  comparisonSource: string;
}

export interface SavedComparisonReport extends ComparisonReportInput {
  id: string;
  /** ISO timestamps, or null while the server timestamp is pending. */
  createdAt: string | null;
  updatedAt: string | null;
}

const DOC_TYPES: readonly string[] = [
  "job_advertisement",
  "recruiter_communication",
  "offer_letter",
  "employment_contract",
  "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSavedDocument(value: unknown): SavedComparisonDocument | null {
  if (!isRecord(value)) {
    return null;
  }
  const source = value["source"];
  const documentType = value["documentType"];
  if (
    typeof value["id"] !== "string" ||
    typeof value["fileName"] !== "string" ||
    typeof documentType !== "string" ||
    !DOC_TYPES.includes(documentType) ||
    (source !== "pdf" && source !== "pasted") ||
    typeof value["pageCount"] !== "number" ||
    typeof value["wasTrimmed"] !== "boolean" ||
    typeof value["termCount"] !== "number"
  ) {
    return null;
  }
  return {
    id: value["id"],
    fileName: value["fileName"],
    documentType: documentType as ContractDocumentType,
    source,
    pageCount: value["pageCount"],
    wasTrimmed: value["wasTrimmed"],
    termCount: value["termCount"],
  };
}

function validateStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((entry): entry is string => typeof entry === "string")) {
    return null;
  }
  return value;
}

function invalidInput(issues: string[]): StoreResult<never> {
  return {
    ok: false,
    code: "invalid-input",
    message: `Invalid data: ${issues.join("; ")}`,
  };
}

/** Clamps list sizes to a sane integer range before querying. */
function clampCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 20;
  }
  return Math.min(MAX_LIST_COUNT, Math.max(1, Math.floor(count)));
}

function toSavedReport(id: string, data: Record<string, unknown>): SavedComparisonReport {
  const createdAt = data["createdAt"];
  const updatedAt = data["updatedAt"];
  const rawDocs = Array.isArray(data["documents"]) ? data["documents"] : [];
  const rawFindings = Array.isArray(data["findings"]) ? data["findings"] : [];
  return {
    id,
    ownerId: typeof data["ownerId"] === "string" ? data["ownerId"] : "",
    title: typeof data["title"] === "string" ? data["title"] : "Untitled comparison",
    documents: rawDocs
      .map(validateSavedDocument)
      .filter((entry): entry is SavedComparisonDocument => entry !== null),
    findings: rawFindings.flatMap((entry) => {
      const result = validatePromiseToPaperFinding(entry);
      return result.valid && result.value ? [result.value] : [];
    }),
    droppedCount: typeof data["droppedCount"] === "number" ? data["droppedCount"] : 0,
    limitations: validateStringList(data["limitations"]) ?? [],
    comparisonSource:
      typeof data["comparisonSource"] === "string" ? data["comparisonSource"] : "unknown",
    createdAt: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
    updatedAt: updatedAt instanceof Timestamp ? updatedAt.toDate().toISOString() : null,
  };
}

export async function saveComparisonReport(
  db: Firestore,
  input: ComparisonReportInput,
): Promise<StoreResult<string>> {
  const title = validateTitle(input.title);
  if (!title.valid || !title.value) {
    return invalidInput(title.issues);
  }
  if (!Array.isArray(input.documents) || input.documents.length === 0) {
    return invalidInput(["documents must list at least one compared document"]);
  }
  for (const [index, entry] of input.documents.entries()) {
    if (!validateSavedDocument(entry)) {
      return invalidInput([`documents[${index}] is malformed`]);
    }
  }
  if (!Array.isArray(input.findings)) {
    return invalidInput(["findings must be an array"]);
  }
  for (const [index, entry] of input.findings.entries()) {
    const result = validatePromiseToPaperFinding(entry);
    if (!result.valid || !result.value) {
      return invalidInput([`findings[${index}]: ${result.issues.join("; ")}`]);
    }
  }
  if (validateStringList(input.limitations) === null) {
    return invalidInput(["limitations must be a string array"]);
  }
  try {
    const ref = await addDoc(collection(db, COMPARISONS_COLLECTION), {
      ...input,
      title: title.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, value: ref.id };
  } catch (err) {
    return classifyError(err);
  }
}

/**
 * One user's saved reports, newest-first. The ownerId filter is always
 * applied in code; rules re-check ownership but never filter for us.
 * Requires a composite index (ownerId + createdAt desc).
 */
export async function listUserComparisons(
  db: Firestore,
  ownerId: string,
  count = 20,
): Promise<StoreResult<SavedComparisonReport[]>> {
  try {
    const q = query(
      collection(db, COMPARISONS_COLLECTION),
      where("ownerId", "==", ownerId),
      orderBy("createdAt", "desc"),
      limit(clampCount(count)),
    );
    const snap = await getDocs(q);
    return {
      ok: true,
      value: snap.docs.map((d) => toSavedReport(d.id, d.data())),
    };
  } catch (err) {
    return classifyError(err);
  }
}

export async function getComparisonReport(
  db: Firestore,
  id: string,
): Promise<StoreResult<SavedComparisonReport | null>> {
  try {
    const snap = await getDoc(doc(db, COMPARISONS_COLLECTION, id));
    if (!snap.exists()) {
      return { ok: true, value: null };
    }
    return { ok: true, value: toSavedReport(snap.id, snap.data()) };
  } catch (err) {
    return classifyError(err);
  }
}

export async function renameComparisonReport(
  db: Firestore,
  id: string,
  title: string,
): Promise<StoreResult<void>> {
  const validated = validateTitle(title);
  if (!validated.valid || !validated.value) {
    return invalidInput(validated.issues);
  }
  try {
    await updateDoc(doc(db, COMPARISONS_COLLECTION, id), {
      title: validated.value,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, value: undefined };
  } catch (err) {
    return classifyError(err);
  }
}

export async function deleteComparisonReport(
  db: Firestore,
  id: string,
): Promise<StoreResult<void>> {
  try {
    await deleteDoc(doc(db, COMPARISONS_COLLECTION, id));
    return { ok: true, value: undefined };
  } catch (err) {
    return classifyError(err);
  }
}
