// Runtime validation for stored AI output. Firestore returns untyped data;
// these validators check it before anything casts it into a TypeScript
// interface or renders it. Invalid documents are reported, never rendered.

import type {
  AnalysisConcern,
  ConcernConfidence,
  EmploymentType,
  OpportunityReport,
} from "./opportunityAnalyzer";
import type { InvestigationFinding } from "./investigations";
import type { InvestigationPlan, InvestigationPlanItem } from "./investigationPlanner";
import type {
  ComparisonStatus,
  ContractCategory,
  ContractDocumentText,
  ContractDocumentType,
  DocumentReference,
  EmploymentClaim,
  PromiseToPaperFinding,
} from "./contractTypes";

export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "full-time",
  "part-time",
  "contract",
  "seasonal",
  "apprenticeship",
  "unknown",
];

export const CONFIDENCE_LEVELS: readonly ConcernConfidence[] = ["high", "medium", "low"];

const FINDING_ASSESSMENTS = ["supported", "conflicting", "insufficient-evidence"] as const;

export const MAX_TITLE_LENGTH = 120;
export const MAX_POSTING_LENGTH = 60000;
export const MAX_LIST_COUNT = 100;
export const MAX_PLAN_ITEMS = 50;

/** Plan item kinds; the planner distinguishes claims, concerns, gaps, and research. */
export type PlanItemCategory =
  | "explicit-claim"
  | "potential-concern"
  | "missing-information"
  | "research-question";

/** Official-source categories; the backend allowlist resolves them to pages.
 * The first four mirror the GB corridor pages; the generic keys serve all
 * newer corridors so new destinations need no type-level change. */
export type OfficialSourceCategory =
  | "visa-route"
  | "worker-rights-and-fees"
  | "seasonal-guidance"
  | "pay-rates"
  | "work-authorization"
  | "recruitment-rules"
  | "salary-protection"
  | "complaint-channels"
  | "origin-protection";

export type InvestigationPriority = "high" | "medium" | "low";

export const PLAN_ITEM_CATEGORIES: readonly PlanItemCategory[] = [
  "explicit-claim",
  "potential-concern",
  "missing-information",
  "research-question",
];

export const OFFICIAL_SOURCE_CATEGORIES: readonly OfficialSourceCategory[] = [
  "visa-route",
  "worker-rights-and-fees",
  "seasonal-guidance",
  "pay-rates",
  "work-authorization",
  "recruitment-rules",
  "salary-protection",
  "complaint-channels",
  "origin-protection",
];

export const PLAN_PRIORITIES: readonly InvestigationPriority[] = ["high", "medium", "low"];

export interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  issues: string[];
}

function fail<T>(issues: string[]): ValidationResult<T> {
  return { valid: false, value: null, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEmploymentType(value: unknown): value is EmploymentType {
  return (
    typeof value === "string" &&
    (EMPLOYMENT_TYPES as readonly string[]).includes(value)
  );
}

export function validateConcern(value: unknown): ValidationResult<AnalysisConcern> {
  if (!isRecord(value)) {
    return fail(["concern must be an object"]);
  }
  const issues: string[] = [];
  if (!isNonEmptyString(value["concern"])) {
    issues.push("concern.concern must be a non-empty string");
  }
  if (!isNonEmptyString(value["evidence"])) {
    issues.push("concern.evidence must be a non-empty string");
  }
  if (
    typeof value["confidence"] !== "string" ||
    !(CONFIDENCE_LEVELS as readonly string[]).includes(value["confidence"])
  ) {
    issues.push("concern.confidence must be high, medium, or low");
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  return {
    valid: true,
    value: {
      concern: (value["concern"] as string).trim(),
      evidence: (value["evidence"] as string).trim(),
      confidence: value["confidence"] as ConcernConfidence,
    },
    issues: [],
  };
}

export function validateReport(value: unknown): ValidationResult<OpportunityReport> {
  if (!isRecord(value)) {
    return fail(["report must be an object"]);
  }
  const issues: string[] = [];
  for (const field of ["occupation", "employer", "salary", "destination_country"] as const) {
    if (typeof value[field] !== "string") {
      issues.push(`report.${field} must be a string`);
    }
  }
  if (!validateEmploymentType(value["employment_type"])) {
    issues.push(
      `report.employment_type must be one of: ${EMPLOYMENT_TYPES.join(", ")}`,
    );
  }
  let missing: string[] | undefined;
  if (value["missing_information"] !== undefined) {
    if (
      !Array.isArray(value["missing_information"]) ||
      value["missing_information"].some((item) => typeof item !== "string")
    ) {
      issues.push("report.missing_information must be an array of strings");
    } else {
      missing = (value["missing_information"] as string[]).slice(0, 100);
    }
  }
  let concerns: AnalysisConcern[] | undefined;
  if (value["concerns"] !== undefined) {
    if (!Array.isArray(value["concerns"])) {
      issues.push("report.concerns must be an array");
    } else if (value["concerns"].length > 50) {
      issues.push("report.concerns must have at most 50 items");
    } else {
      const validated: AnalysisConcern[] = [];
      value["concerns"].forEach((item: unknown, index: number) => {
        const result = validateConcern(item);
        if (result.valid && result.value) {
          validated.push(result.value);
        } else {
          issues.push(`report.concerns[${index}]: ${result.issues.join("; ")}`);
        }
      });
      if (issues.length === 0) {
        concerns = validated;
      }
    }
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  return {
    valid: true,
    value: {
      occupation: value["occupation"] as string,
      employer: value["employer"] as string,
      salary: value["salary"] as string,
      destination_country: value["destination_country"] as string,
      employment_type: value["employment_type"] as EmploymentType,
      ...(missing === undefined ? {} : { missing_information: missing }),
      ...(concerns === undefined ? {} : { concerns }),
    },
    issues: [],
  };
}

export function validateFinding(value: unknown): ValidationResult<InvestigationFinding> {
  if (!isRecord(value)) {
    return fail(["finding must be an object"]);
  }
  const issues: string[] = [];
  for (const field of [
    "claim",
    "excerpt",
    "source_title",
    "source_url",
    "retrieved_at",
    "explanation",
    "follow_up_question",
  ] as const) {
    if (!isNonEmptyString(value[field])) {
      issues.push(`finding.${field} must be a non-empty string`);
    }
  }
  if (
    typeof value["assessment"] !== "string" ||
    !(FINDING_ASSESSMENTS as readonly string[]).includes(value["assessment"])
  ) {
    issues.push("finding.assessment must be supported, conflicting, or insufficient-evidence");
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  const record = value as Record<string, string>;
  return {
    valid: true,
    value: {
      claim: record["claim"]!.trim(),
      excerpt: record["excerpt"]!.trim(),
      source_title: record["source_title"]!.trim(),
      source_url: record["source_url"]!.trim(),
      retrieved_at: record["retrieved_at"]!.trim(),
      assessment: record["assessment"] as InvestigationFinding["assessment"],
      explanation: record["explanation"]!.trim(),
      follow_up_question: record["follow_up_question"]!.trim(),
    },
    issues: [],
  };
}

/** All-or-nothing: partially invalid finding lists are dropped entirely. */
export function validateFindings(value: unknown): InvestigationFinding[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 50) {
    return undefined;
  }
  const validated: InvestigationFinding[] = [];
  for (const item of value) {
    const result = validateFinding(item);
    if (!result.valid || !result.value) {
      return undefined;
    }
    validated.push(result.value);
  }
  return validated;
}

export function validatePlanItem(value: unknown): ValidationResult<InvestigationPlanItem> {
  if (!isRecord(value)) {
    return fail(["plan item must be an object"]);
  }
  const issues: string[] = [];
  for (const field of [
    "claim",
    "research_question",
    "why_it_matters",
    "evidence_required",
  ] as const) {
    if (!isNonEmptyString(value[field])) {
      issues.push(`plan item.${field} must be a non-empty string`);
    }
  }
  if (
    typeof value["category"] !== "string" ||
    !(PLAN_ITEM_CATEGORIES as readonly string[]).includes(value["category"])
  ) {
    issues.push(`plan item.category must be one of: ${PLAN_ITEM_CATEGORIES.join(", ")}`);
  }
  if (
    typeof value["source_category"] !== "string" ||
    !(OFFICIAL_SOURCE_CATEGORIES as readonly string[]).includes(value["source_category"])
  ) {
    issues.push(
      `plan item.source_category must be one of: ${OFFICIAL_SOURCE_CATEGORIES.join(", ")}`,
    );
  }
  if (
    typeof value["priority"] !== "string" ||
    !(PLAN_PRIORITIES as readonly string[]).includes(value["priority"])
  ) {
    issues.push(`plan item.priority must be one of: ${PLAN_PRIORITIES.join(", ")}`);
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  const record = value as Record<string, string>;
  return {
    valid: true,
    value: {
      claim: record["claim"]!.trim(),
      category: record["category"] as InvestigationPlanItem["category"],
      research_question: record["research_question"]!.trim(),
      why_it_matters: record["why_it_matters"]!.trim(),
      source_category: record["source_category"] as InvestigationPlanItem["source_category"],
      evidence_required: record["evidence_required"]!.trim(),
      priority: record["priority"] as InvestigationPlanItem["priority"],
    },
    issues: [],
  };
}

export function validateInvestigationPlan(value: unknown): ValidationResult<InvestigationPlan> {
  if (!isRecord(value)) {
    return fail(["plan must be an object"]);
  }
  const issues: string[] = [];
  if (!isNonEmptyString(value["corridor"])) {
    issues.push("plan.corridor must be a non-empty string");
  }
  let items: InvestigationPlanItem[] | undefined;
  if (!Array.isArray(value["items"])) {
    issues.push("plan.items must be an array");
  } else if (value["items"].length > MAX_PLAN_ITEMS) {
    issues.push(`plan.items must have at most ${MAX_PLAN_ITEMS} items`);
  } else {
    const validated: InvestigationPlanItem[] = [];
    value["items"].forEach((item: unknown, index: number) => {
      const result = validatePlanItem(item);
      if (result.valid && result.value) {
        validated.push(result.value);
      } else {
        issues.push(`plan.items[${index}]: ${result.issues.join("; ")}`);
      }
    });
    if (issues.length === 0) {
      items = validated;
    }
  }
  if (issues.length > 0 || items === undefined) {
    return fail(issues);
  }
  return {
    valid: true,
    value: { corridor: (value["corridor"] as string).trim(), items },
    issues: [],
  };
}

/**
 * Minimal retrieved-source shape for attribution checks. The retrieval
 * client returns a richer type that stays assignable to this one.
 */
export interface AttributableSource {
  url: string;
  excerpts: Array<{ text: string }>;
}

/** Minimum normalized excerpt length for a match (avoids trivial substrings). */
export const MIN_ATTRIBUTION_CHARS = 20;

function normalizeForAttribution(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function stripCodeFences(rawText: string): string {
  return rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export interface AttributedFindings {
  /** Findings that passed validation and attribution; safe to display. */
  findings: InvestigationFinding[];
  /** One human-readable issue per dropped finding. */
  issues: string[];
}

/**
 * Per-item filtering: every candidate must pass finding validation, cite a
 * URL from the retrieved set, and quote an excerpt verifiably present in
 * that source's retrieved content. Failures drop only their own item.
 */
export function validateAttributedFindings(
  value: unknown,
  retrieved: AttributableSource[],
): AttributedFindings {
  const issues: string[] = [];
  const findings: InvestigationFinding[] = [];
  if (!Array.isArray(value)) {
    return { findings, issues: ["findings must be an array"] };
  }
  const knownUrls = new Set(retrieved.map((source) => source.url.trim()));
  const contentByUrl = new Map<string, string>();
  for (const source of retrieved) {
    contentByUrl.set(
      source.url.trim(),
      normalizeForAttribution(source.excerpts.map((excerpt) => excerpt.text).join("\n")),
    );
  }
  value.forEach((item: unknown, index: number) => {
    const label = `findings[${index}]`;
    const result = validateFinding(item);
    if (!result.valid || !result.value) {
      issues.push(`${label}: ${result.issues.join("; ")}`);
      return;
    }
    const finding = result.value;
    if (!knownUrls.has(finding.source_url)) {
      issues.push(
        `${label}: source URL was not retrieved in this investigation (${finding.source_url})`,
      );
      return;
    }
    const normalizedExcerpt = normalizeForAttribution(finding.excerpt);
    const sourceContent = contentByUrl.get(finding.source_url) ?? "";
    if (
      normalizedExcerpt.length < MIN_ATTRIBUTION_CHARS ||
      !sourceContent.includes(normalizedExcerpt)
    ) {
      issues.push(
        `${label}: excerpt does not appear in the retrieved content from ${finding.source_url}`,
      );
      return;
    }
    findings.push(finding);
  });
  return { findings, issues };
}

export interface ParsedComparison {
  findings: InvestigationFinding[];
  issues: string[];
  /** Present when the model output was not a parseable JSON array. */
  parseError: string | null;
}

/**
 * Strips markdown code fences, parses the comparison output as a JSON
 * array, and attribution-checks every finding. Anything malformed or
 * unattributed is reported, never displayed.
 */
export function parseComparisonFindings(
  rawText: string,
  retrieved: AttributableSource[],
): ParsedComparison {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return {
      findings: [],
      issues: [],
      parseError: "Model output was not valid JSON. Please run the comparison again.",
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      findings: [],
      issues: [],
      parseError: "Model output was not a findings list. Please run the comparison again.",
    };
  }
  const { findings, issues } = validateAttributedFindings(parsed, retrieved);
  return { findings, issues, parseError: null };
}

export const CONTRACT_DOCUMENT_TYPES: readonly ContractDocumentType[] = [
  "job_advertisement",
  "recruiter_communication",
  "offer_letter",
  "employment_contract",
];

export const COMPARISON_STATUSES: readonly ComparisonStatus[] = [
  "consistent",
  "discrepancy",
  "not_addressed",
  "needs_clarification",
];

export const CONTRACT_CATEGORIES: readonly ContractCategory[] = [
  "compensation",
  "deductions",
  "working_conditions",
  "employment_period",
  "benefits",
  "termination",
  "immigration",
  "responsibilities",
];

/** Promise-side slots (advertisements, recruiter messages) vs written terms. */
export const PROMISE_SIDE_TYPES: readonly ContractDocumentType[] = [
  "job_advertisement",
  "recruiter_communication",
];

export const MAX_EXCERPT_CHARS = 4000;
export const MAX_CLAIM_CHARS = 2000;
export const MAX_DOC_ID_CHARS = 64;
export const MAX_FILENAME_CHARS = 255;
export const MAX_EXPLANATION_CHARS = 2000;
export const MAX_QUESTION_CHARS = 1000;
export const MAX_PAGE_NUMBER = 10000;
export const MAX_COMPARISON_ITEMS = 60;
export const MAX_EXTRACTION_TERMS = 60;

function isValidPageNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_PAGE_NUMBER
  );
}

export function validateDocumentReference(
  value: unknown,
): ValidationResult<DocumentReference> {
  if (!isRecord(value)) {
    return fail(["document reference must be an object"]);
  }
  const issues: string[] = [];
  const documentId = value["documentId"];
  if (
    typeof documentId !== "string" ||
    documentId.trim().length === 0 ||
    documentId.trim().length > MAX_DOC_ID_CHARS
  ) {
    issues.push(`reference.documentId must be 1..${MAX_DOC_ID_CHARS} characters`);
  }
  if (
    typeof value["documentType"] !== "string" ||
    !(CONTRACT_DOCUMENT_TYPES as readonly string[]).includes(value["documentType"])
  ) {
    issues.push(`reference.documentType must be one of: ${CONTRACT_DOCUMENT_TYPES.join(", ")}`);
  }
  const fileName = value["fileName"];
  if (
    typeof fileName !== "string" ||
    fileName.trim().length === 0 ||
    fileName.trim().length > MAX_FILENAME_CHARS
  ) {
    issues.push(`reference.fileName must be 1..${MAX_FILENAME_CHARS} characters`);
  }
  if (value["pageNumber"] !== undefined && !isValidPageNumber(value["pageNumber"])) {
    issues.push(`reference.pageNumber must be an integer 1..${MAX_PAGE_NUMBER}`);
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  return {
    valid: true,
    value: {
      documentId: (documentId as string).trim(),
      documentType: value["documentType"] as ContractDocumentType,
      fileName: (fileName as string).trim(),
      ...(value["pageNumber"] === undefined
        ? {}
        : { pageNumber: value["pageNumber"] as number }),
    },
    issues: [],
  };
}

export function validateEmploymentClaim(value: unknown): ValidationResult<EmploymentClaim> {
  if (!isRecord(value)) {
    return fail(["claim must be an object"]);
  }
  const issues: string[] = [];
  if (
    typeof value["category"] !== "string" ||
    !(CONTRACT_CATEGORIES as readonly string[]).includes(value["category"])
  ) {
    issues.push(`claim.category must be one of: ${CONTRACT_CATEGORIES.join(", ")}`);
  }
  if (
    typeof value["claim"] !== "string" ||
    value["claim"].trim().length === 0 ||
    value["claim"].trim().length > MAX_CLAIM_CHARS
  ) {
    issues.push(`claim.claim must be 1..${MAX_CLAIM_CHARS} characters`);
  }
  if (
    typeof value["sourceExcerpt"] !== "string" ||
    value["sourceExcerpt"].trim().length === 0 ||
    value["sourceExcerpt"].trim().length > MAX_EXCERPT_CHARS
  ) {
    issues.push(`claim.sourceExcerpt must be 1..${MAX_EXCERPT_CHARS} characters`);
  }
  const reference = validateDocumentReference(value["documentReference"]);
  if (!reference.valid || !reference.value) {
    issues.push(`claim.documentReference: ${reference.issues.join("; ")}`);
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  return {
    valid: true,
    value: {
      category: value["category"] as ContractCategory,
      claim: (value["claim"] as string).trim(),
      documentReference: reference.value as DocumentReference,
      sourceExcerpt: (value["sourceExcerpt"] as string).trim(),
    },
    issues: [],
  };
}

/** Claim slots in a finding and the document types each slot may cite. */
const FINDING_SLOTS = [
  { key: "recruiterStatement", types: ["recruiter_communication"] as const, label: "recruiter" },
  { key: "advertisementClaim", types: ["job_advertisement"] as const, label: "advertisement" },
  { key: "contractClause", types: ["offer_letter", "employment_contract"] as const, label: "contract" },
] as const;

interface SlotPartition {
  kept: Array<{ slot: string; claim: EmploymentClaim }>;
  dropped: string[];
}

/**
 * Drops claims filed in the wrong slot (e.g. an offer letter cited as a
 * recruiter statement) while keeping verified, correctly filed claims.
 * Slot mistyping amputates the slot; it never kills the finding alone —
 * coherence below still decides whether the survivors stand.
 */
function partitionValidSlots(
  claims: Array<{ slot: string; claim: EmploymentClaim }>,
): SlotPartition {
  const kept: Array<{ slot: string; claim: EmploymentClaim }> = [];
  const dropped: string[] = [];
  for (const { slot, claim } of claims) {
    const spec = FINDING_SLOTS.find((entry) => entry.key === slot);
    const allowed = spec ? (spec.types as readonly string[]) : [];
    if (!allowed.includes(claim.documentReference.documentType)) {
      const ref = claim.documentReference;
      dropped.push(
        `finding.${slot} cites '${ref.fileName}' (${ref.documentType}), ` +
          `not a ${spec?.label ?? slot} document — slot skipped`,
      );
      continue;
    }
    kept.push({ slot, claim });
  }
  return { kept, dropped };
}

function checkFindingCoherence(
  claims: Array<{ slot: string; claim: EmploymentClaim }>,
  status: ComparisonStatus,
): string | null {
  if (claims.length === 0) {
    return "finding must include at least one claim";
  }
  const distinctDocs = new Set(claims.map(({ claim }) => claim.documentReference.documentId));
  if (status === "consistent" || status === "discrepancy") {
    if (distinctDocs.size < 2) {
      return "consistent and discrepancy findings must span at least two documents";
    }
    return null;
  }
  if (status === "not_addressed") {
    const hasContract = claims.some(({ slot }) => slot === "contractClause");
    const allPromiseSide = claims.every(({ claim }) =>
      (PROMISE_SIDE_TYPES as readonly string[]).includes(claim.documentReference.documentType),
    );
    if (hasContract || !allPromiseSide) {
      return "not_addressed findings must cite promise-side claims only, with no written clause";
    }
    return null;
  }
  return null;
}

export function validatePromiseToPaperFinding(
  value: unknown,
): ValidationResult<PromiseToPaperFinding> {
  if (!isRecord(value)) {
    return fail(["finding must be an object"]);
  }
  const issues: string[] = [];
  if (
    typeof value["category"] !== "string" ||
    !(CONTRACT_CATEGORIES as readonly string[]).includes(value["category"])
  ) {
    issues.push(`finding.category must be one of: ${CONTRACT_CATEGORIES.join(", ")}`);
  }
  if (
    typeof value["status"] !== "string" ||
    !(COMPARISON_STATUSES as readonly string[]).includes(value["status"])
  ) {
    issues.push(`finding.status must be one of: ${COMPARISON_STATUSES.join(", ")}`);
  }
  if (
    typeof value["explanation"] !== "string" ||
    value["explanation"].trim().length === 0 ||
    value["explanation"].trim().length > MAX_EXPLANATION_CHARS
  ) {
    issues.push(`finding.explanation must be 1..${MAX_EXPLANATION_CHARS} characters`);
  }
  if (
    typeof value["followUpQuestion"] !== "string" ||
    value["followUpQuestion"].trim().length === 0 ||
    value["followUpQuestion"].trim().length > MAX_QUESTION_CHARS
  ) {
    issues.push(`finding.followUpQuestion must be 1..${MAX_QUESTION_CHARS} characters`);
  }
  const claims: Array<{ slot: string; claim: EmploymentClaim }> = [];
  const slotIssues: string[] = [];
  for (const slot of FINDING_SLOTS) {
    const raw = value[slot.key];
    if (raw === undefined || raw === null) {
      continue;
    }
    const result = validateEmploymentClaim(raw);
    if (result.valid && result.value) {
      claims.push({ slot: slot.key, claim: result.value });
    } else {
      // A malformed slot is skipped, not fatal: the finding survives on
      // its remaining verified claims, and the structural check below
      // still requires coherent evidence for its status.
      slotIssues.push(`finding.${slot.key}: ${result.issues.join("; ")}`);
    }
  }
  if (issues.length > 0) {
    return fail(issues);
  }
  const partition = partitionValidSlots(claims);
  const coherent = checkFindingCoherence(partition.kept, value["status"] as ComparisonStatus);
  if (coherent) {
    return fail([...slotIssues, ...partition.dropped, coherent]);
  }
  const bySlot = new Map(partition.kept.map(({ slot, claim }) => [slot, claim]));
  return {
    valid: true,
    value: {
      category: value["category"] as ContractCategory,
      ...(bySlot.has("recruiterStatement")
        ? { recruiterStatement: bySlot.get("recruiterStatement") as EmploymentClaim }
        : {}),
      ...(bySlot.has("advertisementClaim")
        ? { advertisementClaim: bySlot.get("advertisementClaim") as EmploymentClaim }
        : {}),
      ...(bySlot.has("contractClause")
        ? { contractClause: bySlot.get("contractClause") as EmploymentClaim }
        : {}),
      status: value["status"] as ComparisonStatus,
      explanation: (value["explanation"] as string).trim(),
      followUpQuestion: (value["followUpQuestion"] as string).trim(),
    },
    issues: [...slotIssues, ...partition.dropped],
  };
}

/**
 * Locates an excerpt within document pages. Returns the 1-based page
 * number, or null when the excerpt is too short or not verifiably
 * present. Matching is case-insensitive over collapsed whitespace.
 *
 * Extraction prompts embed our own "[Page N]" markers, so a faithfully
 * verbatim quote may include them; the retry below strips that
 * scaffolding before giving up. Fabrication still cannot match, and the
 * page always comes from search, never from a quoted marker.
 */
export function locateExcerptPage(pages: string[], excerpt: string): number | null {
  const normalized = normalizeForAttribution(excerpt);
  if (normalized.length < MIN_ATTRIBUTION_CHARS) {
    return null;
  }
  const candidates = [normalized];
  const stripped = normalized.replace(/\[page\s+\d+\]/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length >= MIN_ATTRIBUTION_CHARS && stripped !== normalized) {
    candidates.push(stripped);
  }
  for (const candidate of candidates) {
    for (let index = 0; index < pages.length; index += 1) {
      if (normalizeForAttribution(pages[index] ?? "").includes(candidate)) {
        return index + 1;
      }
    }
  }
  return null;
}

export interface ParsedExtraction {
  terms: EmploymentClaim[];
  missingCategories: ContractCategory[];
  issues: string[];
  /** Present when the model output was not a parseable extraction object. */
  parseError: string | null;
}

/**
 * Parses extraction output for one document. References are attached from
 * our own document record — never from AI output — and page numbers are
 * located by search, never trusted. Terms with unverifiable excerpts are
 * dropped individually.
 */
export function parseExtractionOutput(
  rawText: string,
  doc: ContractDocumentText,
): ParsedExtraction {
  const cleaned = stripCodeFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return {
      terms: [],
      missingCategories: [],
      issues: [],
      parseError: "Model output was not valid JSON. Please run the extraction again.",
    };
  }
  if (!isRecord(parsed) || !Array.isArray(parsed["terms"])) {
    return {
      terms: [],
      missingCategories: [],
      issues: [],
      parseError: "Model output was not an extraction result. Please run the extraction again.",
    };
  }
  const issues: string[] = [];
  const terms: EmploymentClaim[] = [];
  const rawTerms = (parsed["terms"] as unknown[]).slice(0, MAX_EXTRACTION_TERMS);
  if ((parsed["terms"] as unknown[]).length > MAX_EXTRACTION_TERMS) {
    issues.push(`extraction kept the first ${MAX_EXTRACTION_TERMS} terms; the rest were dropped`);
  }
  rawTerms.forEach((item: unknown, index: number) => {
    const label = `terms[${index}]`;
    if (!isRecord(item)) {
      issues.push(`${label} must be an object`);
      return;
    }
    if (
      typeof item["category"] !== "string" ||
      !(CONTRACT_CATEGORIES as readonly string[]).includes(item["category"])
    ) {
      issues.push(`${label}.category must be one of: ${CONTRACT_CATEGORIES.join(", ")}`);
      return;
    }
    if (
      typeof item["claim"] !== "string" ||
      item["claim"].trim().length === 0 ||
      item["claim"].trim().length > MAX_CLAIM_CHARS
    ) {
      issues.push(`${label}.claim must be 1..${MAX_CLAIM_CHARS} characters`);
      return;
    }
    if (
      typeof item["sourceExcerpt"] !== "string" ||
      item["sourceExcerpt"].trim().length === 0 ||
      item["sourceExcerpt"].trim().length > MAX_EXCERPT_CHARS
    ) {
      issues.push(`${label}.sourceExcerpt must be 1..${MAX_EXCERPT_CHARS} characters`);
      return;
    }
    const excerpt = (item["sourceExcerpt"] as string).trim();
    const pageNumber = locateExcerptPage(doc.pages, excerpt);
    if (pageNumber === null) {
      issues.push(`${label}.sourceExcerpt does not appear in ${doc.fileName}`);
      return;
    }
    terms.push({
      category: item["category"] as ContractCategory,
      claim: (item["claim"] as string).trim(),
      documentReference: {
        documentId: doc.documentId,
        documentType: doc.documentType,
        fileName: doc.fileName,
        pageNumber,
      },
      sourceExcerpt: excerpt,
    });
  });
  const missingCategories: ContractCategory[] = [];
  const rawMissing = parsed["missing_categories"];
  if (rawMissing !== undefined) {
    if (!Array.isArray(rawMissing)) {
      issues.push("missing_categories must be an array");
    } else {
      rawMissing.forEach((entry: unknown, index: number) => {
        if (
          typeof entry === "string" &&
          (CONTRACT_CATEGORIES as readonly string[]).includes(entry)
        ) {
          missingCategories.push(entry as ContractCategory);
        } else {
          issues.push(`missing_categories[${index}] must be one of: ${CONTRACT_CATEGORIES.join(", ")}`);
        }
      });
    }
  }
  return { terms, missingCategories, issues, parseError: null };
}

export interface ParsedPromiseComparison {
  findings: PromiseToPaperFinding[];
  issues: string[];
  /** Findings attempted minus findings kept (issues may outnumber drops). */
  dropped: number;
  /** Present when the model output was not a parseable findings list. */
  parseError: string | null;
}

interface RawComparisonClaim {
  documentId: string;
  claim: EmploymentClaim;
}

/**
 * Parses comparison output against the documents under comparison.
 * Document identities, types, file names, and page numbers all come from
 * our own records: AI output supplies only document ids, claims, and
 * excerpts, and every excerpt must be located in the cited document.
 */
export function parsePromiseComparison(
  rawText: string,
  docs: ContractDocumentText[],
): ParsedPromiseComparison {
  const cleaned = stripCodeFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return {
      findings: [],
      issues: [],
      dropped: 0,
      parseError: "Model output was not valid JSON. Please run the comparison again.",
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      findings: [],
      issues: [],
      dropped: 0,
      parseError: "Model output was not a findings list. Please run the comparison again.",
    };
  }
  const issues: string[] = [];
  const findings: PromiseToPaperFinding[] = [];
  const byId = new Map(docs.map((doc) => [doc.documentId, doc]));
  const rawItems = (parsed as unknown[]).slice(0, MAX_COMPARISON_ITEMS);
  if ((parsed as unknown[]).length > MAX_COMPARISON_ITEMS) {
    issues.push(`comparison kept the first ${MAX_COMPARISON_ITEMS} findings; the rest were dropped`);
  }

  const parseSlotClaim = (
    label: string,
    slotKey: string,
    raw: unknown,
  ): RawComparisonClaim | null => {
    if (!isRecord(raw)) {
      issues.push(`${label}.${slotKey} must be an object`);
      return null;
    }
    // Small models often cite the human-meaningful file name shown beside
    // the id, or wrap the id in quotes. Resolve leniently: exact id first,
    // then a unique file-name match. Ambiguous or unknown references still
    // fail rather than guess.
    const rawId = raw["documentId"];
    const cleanedId =
      typeof rawId === "string" ? rawId.trim().replace(/^["']+|["']+$/g, "").trim() : "";
    let doc = cleanedId !== "" ? byId.get(cleanedId) : undefined;
    if (!doc && cleanedId !== "") {
      const matches = docs.filter(
        (entry) => entry.fileName.toLowerCase() === cleanedId.toLowerCase(),
      );
      if (matches.length === 1) {
        doc = matches[0];
      }
    }
    if (!doc && cleanedId !== "") {
      // Ordinal labels assigned by the comparison prompt ("Document 1"),
      // resolved in the same input order the prompt lists them.
      const ordinal = cleanedId.match(/^documents?\s+(\d+)$/i);
      const index = ordinal?.[1] !== undefined ? Number.parseInt(ordinal[1], 10) - 1 : -1;
      if (index >= 0 && index < docs.length) {
        doc = docs[index];
      }
    }
    if (!doc) {
      issues.push(`${label}.${slotKey}.documentId does not match a compared document`);
      return null;
    }
    if (
      typeof raw["claim"] !== "string" ||
      raw["claim"].trim().length === 0 ||
      raw["claim"].trim().length > MAX_CLAIM_CHARS
    ) {
      issues.push(`${label}.${slotKey}.claim must be 1..${MAX_CLAIM_CHARS} characters`);
      return null;
    }
    if (
      typeof raw["sourceExcerpt"] !== "string" ||
      raw["sourceExcerpt"].trim().length === 0 ||
      raw["sourceExcerpt"].trim().length > MAX_EXCERPT_CHARS
    ) {
      issues.push(`${label}.${slotKey}.sourceExcerpt must be 1..${MAX_EXCERPT_CHARS} characters`);
      return null;
    }
    const excerpt = (raw["sourceExcerpt"] as string).trim();
    const pageNumber = locateExcerptPage(doc.pages, excerpt);
    if (pageNumber === null) {
      issues.push(`${label}.${slotKey}.sourceExcerpt does not appear in ${doc.fileName}`);
      return null;
    }
    return {
      documentId: doc.documentId,
      claim: {
        category: "" as ContractCategory,
        claim: (raw["claim"] as string).trim(),
        documentReference: {
          documentId: doc.documentId,
          documentType: doc.documentType,
          fileName: doc.fileName,
          pageNumber,
        },
        sourceExcerpt: excerpt,
      },
    };
  };

  rawItems.forEach((item: unknown, index: number) => {
    const label = `findings[${index}]`;
    if (!isRecord(item)) {
      issues.push(`${label} must be an object`);
      return;
    }
    // Enum values match case-insensitively: only case/whitespace
    // variants of valid values are normalized, never other words.
    const categoryValue =
      typeof item["category"] === "string" ? item["category"].trim().toLowerCase() : "";
    if (!(CONTRACT_CATEGORIES as readonly string[]).includes(categoryValue)) {
      issues.push(`${label}.category must be one of: ${CONTRACT_CATEGORIES.join(", ")}`);
      return;
    }
    const statusValue =
      typeof item["status"] === "string" ? item["status"].trim().toLowerCase() : "";
    if (!(COMPARISON_STATUSES as readonly string[]).includes(statusValue)) {
      issues.push(`${label}.status must be one of: ${COMPARISON_STATUSES.join(", ")}`);
      return;
    }
    if (
      typeof item["explanation"] !== "string" ||
      item["explanation"].trim().length === 0 ||
      item["explanation"].trim().length > MAX_EXPLANATION_CHARS
    ) {
      issues.push(`${label}.explanation must be 1..${MAX_EXPLANATION_CHARS} characters`);
      return;
    }
    if (
      typeof item["followUpQuestion"] !== "string" ||
      item["followUpQuestion"].trim().length === 0 ||
      item["followUpQuestion"].trim().length > MAX_QUESTION_CHARS
    ) {
      issues.push(`${label}.followUpQuestion must be 1..${MAX_QUESTION_CHARS} characters`);
      return;
    }
    const category = categoryValue as ContractCategory;
    const slotClaims: Array<{ slot: string; claim: EmploymentClaim }> = [];
    for (const slot of FINDING_SLOTS) {
      const raw = item[slot.key];
      // Optional slots may arrive explicitly null from looser model
      // outputs; that means absent, not malformed.
      if (raw === undefined || raw === null) {
        continue;
      }
      const parsedClaim = parseSlotClaim(label, slot.key, raw);
      // A malformed slot is skipped, not fatal: the finding survives on
      // its remaining verified claims (issues stay recorded), and the
      // structural check below still requires coherent evidence.
      if (!parsedClaim) {
        continue;
      }
      parsedClaim.claim.category = category;
      slotClaims.push({ slot: slot.key, claim: parsedClaim.claim });
    }
    const partition = partitionValidSlots(slotClaims);
    for (const dropped of partition.dropped) {
      issues.push(`${label}: ${dropped}`);
    }
    const coherent = checkFindingCoherence(partition.kept, statusValue as ComparisonStatus);
    if (coherent) {
      issues.push(`${label}: ${coherent}`);
      return;
    }
    const bySlot = new Map(partition.kept.map(({ slot, claim }) => [slot, claim]));
    findings.push({
      category,
      ...(bySlot.has("recruiterStatement")
        ? { recruiterStatement: bySlot.get("recruiterStatement") as EmploymentClaim }
        : {}),
      ...(bySlot.has("advertisementClaim")
        ? { advertisementClaim: bySlot.get("advertisementClaim") as EmploymentClaim }
        : {}),
      ...(bySlot.has("contractClause")
        ? { contractClause: bySlot.get("contractClause") as EmploymentClaim }
        : {}),
      status: statusValue as ComparisonStatus,
      explanation: (item["explanation"] as string).trim(),
      followUpQuestion: (item["followUpQuestion"] as string).trim(),
    });
  });
  return { findings, issues, dropped: rawItems.length - findings.length, parseError: null };
}

/** Titles must be non-empty after trimming; overlong titles are rejected, not cut. */
export function validateTitle(value: unknown): ValidationResult<string> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(["title must be a non-empty string"]);
  }
  if (value.trim().length > MAX_TITLE_LENGTH) {
    return fail([`title must be at most ${MAX_TITLE_LENGTH} characters`]);
  }
  return { valid: true, value: value.trim(), issues: [] };
}
