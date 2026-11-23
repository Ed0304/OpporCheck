// Investigations persistence: typed Firestore repository for saved analyses.
//
// Ownership model: every investigation carries ownerId (the Firebase Auth
// uid). List queries always filter ownerId in code; rules enforce the same
// ownership server-side but are never relied on to filter results.
//
// Stored documents are validated at the read boundary (toInvestigation)
// and before writes (saveInvestigation). Malformed data is reported,
// never silently cast into the TypeScript interfaces.

import type { FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import type { OpportunityReport } from "./opportunityAnalyzer";
import {
  MAX_LIST_COUNT,
  validateFindings,
  validateReport,
  validateTitle,
} from "./validation";

export const INVESTIGATIONS_COLLECTION = "investigations";

export type InvestigationStatus = "reviewed" | "complete";

export type FindingAssessment = "supported" | "conflicting" | "insufficient-evidence";

/** Official-source finding. Written only by trusted server-side steps, never by clients. */
export interface InvestigationFinding {
  claim: string;
  excerpt: string;
  source_title: string;
  source_url: string;
  retrieved_at: string;
  assessment: FindingAssessment;
  explanation: string;
  follow_up_question: string;
}

export interface InvestigationInput {
  ownerId: string;
  title: string;
  status: InvestigationStatus;
  postingText: string;
  report: OpportunityReport;
  /** Verbatim Firebase AI Logic inference source, e.g. "on_device". */
  inferenceSource: string;
  latencyMs: number;
  cloudModel: string;
  mode: string;
}

export interface Investigation extends Omit<InvestigationInput, "report"> {
  id: string;
  /** ISO timestamp, or null while the server timestamp is pending. */
  createdAt: string | null;
  updatedAt: string | null;
  /** Null when the stored report failed validation; render an error, not guesses. */
  report: OpportunityReport | null;
  findings?: InvestigationFinding[];
}

export type StoreOk<T> = { ok: true; value: T };
export type StoreFail = { ok: false; code: StoreErrorCode; message: string };
export type StoreResult<T> = StoreOk<T> | StoreFail;

export type StoreErrorCode =
  | "not-found"
  | "permission-denied"
  | "unavailable"
  | "missing-index"
  | "invalid-input"
  | "unknown";

/**
 * Per-app Firestore cache. A single global instance would return the wrong
 * database when several Firebase apps exist (or when emulator tests pass
 * their own app), so instances are keyed by app and garbage-collected
 * with it.
 */
const dbCache = new WeakMap<FirebaseApp, Firestore>();

export function getInvestigationsDb(app: FirebaseApp): Firestore {
  const cached = dbCache.get(app);
  if (cached) {
    return cached;
  }
  const db = getFirestore(app);
  dbCache.set(app, db);
  return db;
}

/** Clamps list sizes to a sane integer range before querying. */
function clampCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 20;
  }
  return Math.min(MAX_LIST_COUNT, Math.max(1, Math.floor(count)));
}

function invalidInput(issues: string[]): StoreFail {
  return {
    ok: false,
    code: "invalid-input",
    message: `Invalid data: ${issues.join("; ")}`,
  };
}

/** Shared Firestore failure mapping, reused by sibling repositories. */
export function classifyError(err: unknown): StoreFail {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown }).code;
  const codeText = typeof code === "string" ? code : "";
  const haystack = `${codeText} ${message}`.toLowerCase();
  if (/permission-denied|permission_denied|missing or insufficient permissions/.test(haystack)) {
    return {
      ok: false,
      code: "permission-denied",
      message:
        "Firestore denied the request. Sign in with the owning account and check the " +
        "security rules for the 'investigations' collection, then try again.",
    };
  }
  if (/requires an index|needs an index/.test(haystack)) {
    return {
      ok: false,
      code: "missing-index",
      message:
        "This query needs a Firestore composite index (ownerId + createdAt). Open the " +
        "Firebase Console link from the full error message to create it with one click, " +
        "then reload.",
    };
  }
  if (/not-found|does not exist|database .* (not found|doesn't exist)|failed-precondition/.test(haystack)) {
    return {
      ok: false,
      code: "not-found",
      message:
        "No Firestore database answered this request. Create one in Firebase Console " +
        "(Firestore Database → Create database), then reload this page.",
    };
  }
  if (/unavailable|offline|network|failed to get document|deadline-exceeded/.test(haystack)) {
    return {
      ok: false,
      code: "unavailable",
      message: "Firestore is unreachable (network or service unavailable). Try again later.",
    };
  }
  return { ok: false, code: "unknown", message };
}

function toInvestigation(id: string, data: Record<string, unknown>): Investigation {
  const createdAt = data["createdAt"];
  const updatedAt = data["updatedAt"];
  const status = data["status"];
  const report = validateReport(data["report"]);
  return {
    id,
    ownerId: typeof data["ownerId"] === "string" ? data["ownerId"] : "",
    title: typeof data["title"] === "string" ? data["title"] : "Untitled investigation",
    status: status === "complete" ? "complete" : "reviewed",
    postingText: typeof data["postingText"] === "string" ? data["postingText"] : "",
    report: report.valid ? report.value : null,
    inferenceSource: typeof data["inferenceSource"] === "string" ? data["inferenceSource"] : "unknown",
    latencyMs: typeof data["latencyMs"] === "number" ? data["latencyMs"] : 0,
    cloudModel: typeof data["cloudModel"] === "string" ? data["cloudModel"] : "",
    mode: typeof data["mode"] === "string" ? data["mode"] : "",
    createdAt: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
    updatedAt: updatedAt instanceof Timestamp ? updatedAt.toDate().toISOString() : null,
    findings: validateFindings(data["findings"]),
  };
}

export async function saveInvestigation(
  db: Firestore,
  input: InvestigationInput,
): Promise<StoreResult<string>> {
  const title = validateTitle(input.title);
  if (!title.valid || !title.value) {
    return invalidInput(title.issues);
  }
  const report = validateReport(input.report);
  if (!report.valid || !report.value) {
    return invalidInput(report.issues);
  }
  try {
    const ref = await addDoc(collection(db, INVESTIGATIONS_COLLECTION), {
      ...input,
      title: title.value,
      report: report.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, value: ref.id };
  } catch (err) {
    return classifyError(err);
  }
}

/**
 * One user's investigations, newest-first. The ownerId filter is always
 * applied in code; rules re-check ownership but never filter for us.
 * Requires a composite index (ownerId + createdAt desc).
 */
export async function listUserInvestigations(
  db: Firestore,
  ownerId: string,
  count = 20,
): Promise<StoreResult<Investigation[]>> {
  try {
    const q = query(
      collection(db, INVESTIGATIONS_COLLECTION),
      where("ownerId", "==", ownerId),
      orderBy("createdAt", "desc"),
      limit(clampCount(count)),
    );
    const snap = await getDocs(q);
    return {
      ok: true,
      value: snap.docs.map((d) => toInvestigation(d.id, d.data())),
    };
  } catch (err) {
    return classifyError(err);
  }
}

export async function getInvestigation(
  db: Firestore,
  id: string,
): Promise<StoreResult<Investigation | null>> {
  try {
    const snap = await getDoc(doc(db, INVESTIGATIONS_COLLECTION, id));
    if (!snap.exists()) {
      return { ok: true, value: null };
    }
    return { ok: true, value: toInvestigation(snap.id, snap.data()) };
  } catch (err) {
    return classifyError(err);
  }
}

export async function renameInvestigation(
  db: Firestore,
  id: string,
  title: string,
): Promise<StoreResult<void>> {
  const validated = validateTitle(title);
  if (!validated.valid || !validated.value) {
    return invalidInput(validated.issues);
  }
  try {
    await updateDoc(doc(db, INVESTIGATIONS_COLLECTION, id), {
      title: validated.value,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, value: undefined };
  } catch (err) {
    return classifyError(err);
  }
}

export async function setInvestigationStatus(
  db: Firestore,
  id: string,
  status: InvestigationStatus,
): Promise<StoreResult<void>> {
  try {
    await updateDoc(doc(db, INVESTIGATIONS_COLLECTION, id), {
      status,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, value: undefined };
  } catch (err) {
    return classifyError(err);
  }
}

export async function deleteInvestigation(
  db: Firestore,
  id: string,
): Promise<StoreResult<void>> {
  try {
    await deleteDoc(doc(db, INVESTIGATIONS_COLLECTION, id));
    return { ok: true, value: undefined };
  } catch (err) {
    return classifyError(err);
  }
}
