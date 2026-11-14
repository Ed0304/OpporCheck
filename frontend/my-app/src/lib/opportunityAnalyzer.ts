// Opportunity Analyzer: schema, prompt, and parsing for the OpporCheck dashboard.
//
// Same hybrid pattern as the demo: one Schema object serves both paths
// (inCloudParams.responseSchema + onDeviceParams.responseConstraint).
// The prompt explicitly forbids inventing employers, registries, licence
// numbers, URLs, or any fact not present in the pasted posting.

import { Schema } from "firebase/ai";
import { validateReport } from "./validation";

export const analyzerSchema = Schema.object({
  properties: {
    occupation: Schema.string({
      description: "Job title or occupation stated in the posting.",
    }),
    employer: Schema.string({
      description:
        "Employer name as stated, or 'not specified' when the posting names no employer.",
    }),
    salary: Schema.string({
      description:
        "Pay as stated with amount and period (e.g. '£12.50/hour, 40h/week'), or 'not specified'.",
    }),
    destination_country: Schema.string({
      description: "Country where the work takes place, or 'not specified'.",
    }),
    employment_type: Schema.enumString({
      description: "Type of employment offered.",
      enum: ["full-time", "part-time", "contract", "seasonal", "apprenticeship", "unknown"],
    }),
    missing_information: Schema.array({
      description:
        "Important details missing from the posting (employer identity, contract terms, fees, visa details, ...).",
      items: Schema.string(),
    }),
    concerns: Schema.array({
      description:
        "Potential concerns found in the posting. Leave empty when nothing looks suspicious.",
      items: Schema.object({
        properties: {
          concern: Schema.string({
            description: "Short label, e.g. 'Upfront fee requested'.",
          }),
          evidence: Schema.string({
            description:
              "The exact posting text (or concrete indicator) this concern is based on. Never invent evidence.",
          }),
          confidence: Schema.enumString({
            description: "How certain this concern is, given only the posting text.",
            enum: ["high", "medium", "low"],
          }),
        },
      }),
    }),
  },
  optionalProperties: ["missing_information", "concerns"],
});

export type ConcernConfidence = "high" | "medium" | "low";

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "seasonal"
  | "apprenticeship"
  | "unknown";

export interface AnalysisConcern {
  concern: string;
  evidence: string;
  confidence: ConcernConfidence;
}

export interface OpportunityReport {
  occupation: string;
  employer: string;
  salary: string;
  destination_country: string;
  employment_type: EmploymentType;
  missing_information?: string[];
  concerns?: AnalysisConcern[];
}

export const SAMPLE_POSTING = `URGENT HIRING - Fruit Pickers wanted in Kent, United Kingdom!
Seasonal work, £11/hour cash in hand, 50+ hours/week guaranteed.
No experience needed, start tomorrow. We arrange everything!
Just send £150 admin fee via bank transfer to reserve your place,
message us on WhatsApp now. Accommodation provided (£80/week deducted).`;

export function buildAnalyzerPrompt(postingText: string): string {
  return (
    "You are an assistant that extracts facts from overseas job postings. " +
    "Analyze the posting below and report: occupation, employer, salary, " +
    "destination country, employment type, missing information, and potential concerns.\n" +
    "Rules:\n" +
    "- Only use facts stated in the posting. If a fact is absent, use 'not specified' " +
    "(text), 'unknown' (employment type), or list it under missing_information.\n" +
    "- Every concern MUST quote its evidence from the posting text. If the posting " +
    "gives no evidence for a suspicion, mark confidence 'low' and say what is missing.\n" +
    "- NEVER invent employer identities, registration numbers, licence numbers, " +
    "official sources, URLs, or verification results. Do not claim any employer " +
    "is verified or unverified; only describe what the posting does or does not say.\n\n" +
    `Posting:\n${postingText.trim()}`
  );
}

export interface ParsedReport {
  data: OpportunityReport | null;
  /** Present when the model output was not parseable JSON. */
  parseError: string | null;
}

/**
 * Strips markdown code fences, parses the model output as JSON, and
 * validates it against the report schema. Anything malformed is rejected
 * with a parse error instead of being cast into the interface.
 */
export function parseReport(rawText: string): ParsedReport {
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
      data: null,
      parseError: "Model output was not valid JSON. Raw output is shown below.",
    };
  }
  const result = validateReport(parsed);
  if (!result.valid || !result.value) {
    return {
      data: null,
      parseError:
        "Model output did not match the expected report format. " +
        "Please run the analysis again.",
    };
  }
  return { data: result.value, parseError: null };
}
