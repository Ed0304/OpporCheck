// Promise-to-Paper AI integration: structured extraction and comparison
// through Firebase AI Logic only — never through a direct model API.
//
// Two inference choices, both hybrid SDK modes: on-device-only (nothing
// leaves the device; cloud fallback is impossible, not just disabled) and
// prefer-on-device (cloud fallback allowed only with explicit user
// consent, collected in the UI). One Schema object per task serves both
// paths (inCloudParams.responseSchema + onDeviceParams.responseConstraint).

import {
  getGenerativeModel,
  InferenceMode,
  Schema,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import type { ContractDocumentText } from "./contractTypes";
import {
  parseExtractionOutput,
  parsePromiseComparison,
  type ParsedExtraction,
  type ParsedPromiseComparison,
} from "./validation";

export type CompareInferenceMode = "on-device-only" | "prefer-on-device";

export const INFERENCE_MODE_INFO: Record<
  CompareInferenceMode,
  { label: string; dataNote: string }
> = {
  "on-device-only": {
    label: "On-device only",
    dataNote:
      "Documents are analyzed on this device only and are never sent for cloud processing. " +
      "If on-device analysis is unavailable, the comparison cannot run.",
  },
  "prefer-on-device": {
    label: "Prefer on-device, allow cloud",
    dataNote:
      "Tries on-device analysis first, then the cloud fallback. Cloud processing sends document " +
      "text to the configured cloud model and requires your consent below.",
  },
};

const CATEGORY_ENUM = [
  "compensation",
  "deductions",
  "working_conditions",
  "employment_period",
  "benefits",
  "termination",
  "immigration",
  "responsibilities",
];

const STATUS_ENUM = ["consistent", "discrepancy", "not_addressed", "needs_clarification"];

const comparisonClaimSchema = Schema.object({
  properties: {
    documentId: Schema.string({
      description: "Document id copied exactly from the extracted terms list.",
    }),
    claim: Schema.string({
      description: "Short neutral restatement of the term.",
    }),
    sourceExcerpt: Schema.string({
      description: "Verbatim quote from the listed excerpts. Never paraphrase or invent.",
    }),
  },
});

export const extractionSchema = Schema.object({
  properties: {
    terms: Schema.array({
      description: "Employment terms found in the document.",
      items: Schema.object({
        properties: {
          category: Schema.enumString({
            description: "Employment-term category.",
            enum: CATEGORY_ENUM,
          }),
          claim: Schema.string({
            description: "Short neutral restatement of the term.",
          }),
          sourceExcerpt: Schema.string({
            description:
              "Verbatim quote from the document text. Never paraphrase or invent.",
          }),
        },
      }),
    }),
    missing_categories: Schema.array({
      description: "Categories with no stated term in the document.",
      items: Schema.enumString({
        description: "Employment-term category absent from the document.",
        enum: CATEGORY_ENUM,
      }),
    }),
  },
  optionalProperties: ["missing_categories"],
});

export const promiseComparisonSchema = Schema.array({
  description: "Promise-to-Paper findings comparing terms across documents.",
  items: Schema.object({
    properties: {
      category: Schema.enumString({
        description: "Employment-term category.",
        enum: CATEGORY_ENUM,
      }),
      recruiterStatement: comparisonClaimSchema,
      advertisementClaim: comparisonClaimSchema,
      contractClause: comparisonClaimSchema,
      status: Schema.enumString({
        description:
          "consistent: documents agree. discrepancy: documents differ. not_addressed: a promise-side term has no written counterpart. needs_clarification: wording is ambiguous or information is insufficient.",
        enum: STATUS_ENUM,
      }),
      explanation: Schema.string({
        description: "Plain-language explanation of the comparison and its limitation.",
      }),
      followUpQuestion: Schema.string({
        description: "One concrete question the worker should ask before signing.",
      }),
    },
    optionalProperties: ["recruiterStatement", "advertisementClaim", "contractClause"],
  }),
});

function buildModel(
  ai: AI,
  cloudModel: string,
  mode: CompareInferenceMode,
  schema: typeof extractionSchema | typeof promiseComparisonSchema,
): GenerativeModel {
  if (mode === "on-device-only") {
    return getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: { promptOptions: { responseConstraint: schema } },
    });
  }
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    },
    onDeviceParams: { promptOptions: { responseConstraint: schema } },
  });
}

export function createExtractionModel(
  ai: AI,
  cloudModel: string,
  mode: CompareInferenceMode,
): GenerativeModel {
  return buildModel(ai, cloudModel, mode, extractionSchema);
}

export function createPromiseComparisonModel(
  ai: AI,
  cloudModel: string,
  mode: CompareInferenceMode,
): GenerativeModel {
  return buildModel(ai, cloudModel, mode, promiseComparisonSchema);
}

/** Parses and attribution-checks extraction output; see validation.ts. */
export function parseExtraction(
  rawText: string,
  doc: ContractDocumentText,
): ParsedExtraction {
  return parseExtractionOutput(rawText, doc);
}

/** Parses and attribution-checks comparison output; see validation.ts. */
export function parsePromiseComparisonFindings(
  rawText: string,
  docs: ContractDocumentText[],
): ParsedPromiseComparison {
  return parsePromiseComparison(rawText, docs);
}
