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
