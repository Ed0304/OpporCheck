// Shared schema, sample data, and parsing for the opportunity analysis demo.
//
// The same Schema object is used for both inference paths:
// - cloud:  inCloudParams.generationConfig { responseMimeType, responseSchema }
// - device: onDeviceParams.promptOptions { responseConstraint }
// No on-device model identifier is hardcoded; the SDK resolves the
// Chrome on-device model through the Prompt API.

import { Schema } from "firebase/ai";

export const opportunitySchema = Schema.object({
  properties: {
    occupation: Schema.string({
      description: "Job title or occupation stated in the opportunity, e.g. 'Warehouse Operative'.",
    }),
    salary: Schema.string({
      description:
        "Salary or pay as stated, including amount and period (e.g. '£12.50/hour, 40h/week'), or 'not specified'.",
    }),
    destination_country: Schema.string({
      description: "Country where the work takes place, e.g. 'United Kingdom'.",
    }),
    employment_type: Schema.enumString({
      description: "Type of employment offered.",
      enum: ["full-time", "part-time", "contract", "seasonal", "apprenticeship", "unknown"],
    }),
    missing_information: Schema.array({
      description: "Important details missing from the offer (employer name, contract terms, ...).",
      items: Schema.string(),
    }),
  },
  optionalProperties: ["missing_information"],
});

export interface OpportunityAnalysis {
  occupation: string;
  salary: string;
  destination_country: string;
  employment_type: string;
  missing_information?: string[];
}

export const SAMPLE_OPPORTUNITY = `Job offer: Warehouse Operative in Manchester, United Kingdom.
Full-time contract, £12.50/hour, 40 hours per week. Accommodation assistance
provided, no experience required. Contact via WhatsApp only, start immediately.
Visa sponsorship mentioned but no sponsor licence number given.`;

export function buildAnalysisPrompt(opportunityText: string): string {
  return (
    "Analyze the following employment opportunity and extract its key facts. " +
    "If a fact is not stated, use 'not specified' for text fields, 'unknown' for " +
    "employment type, and list every important missing detail (employer name, " +
    "contract terms, visa details, contact legitimacy signals) in missing_information.\n\n" +
    `Opportunity:\n${opportunityText.trim()}`
  );
}

export interface ParsedAnalysis {
  data: OpportunityAnalysis | null;
  /** Present when the model output was not parseable JSON. */
  parseError: string | null;
}

/** Strips markdown code fences, then parses the model output as JSON. */
export function parseAnalysis(rawText: string): ParsedAnalysis {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const data = JSON.parse(cleaned) as OpportunityAnalysis;
    return { data, parseError: null };
  } catch {
    return {
      data: null,
      parseError: "Model output was not valid JSON. Raw output is shown below.",
    };
  }
}
