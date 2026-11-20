// Evidence comparison: schema, prompt, and parsing for comparing posting
// claims against retrieved official-source excerpts.
//
// Same hybrid pattern as the analyzer: one Schema object serves both paths
// (inCloudParams.responseSchema + onDeviceParams.responseConstraint).
// Comparison runs through Firebase AI Logic only — never through a direct
// model API from the backend. Output is attribution-checked before display:
// every excerpt must come from retrieved content, every URL from a
// retrieved source.

import {
  getGenerativeModel,
  InferenceMode,
  Schema,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import type { InvestigationPlanItem } from "./investigationPlanner";
import type { RetrievedSource } from "./sources";
import {
  parseComparisonFindings,
  type ParsedComparison,
} from "./validation";

export const comparisonSchema = Schema.array({
  description:
    "Evidence findings comparing posting claims against official-source excerpts.",
  items: Schema.object({
    properties: {
      claim: Schema.string({
        description: "The posting claim being checked, in the worker's own words.",
      }),
      excerpt: Schema.string({
        description:
          "Verbatim quote from the retrieved excerpts below. Never paraphrase or invent.",
      }),
      source_title: Schema.string({
        description: "Title of the retrieved source, copied exactly.",
      }),
      source_url: Schema.string({
        description: "URL of the retrieved source, copied exactly.",
      }),
      retrieved_at: Schema.string({
        description: "Retrieval timestamp of the source, copied exactly.",
      }),
      assessment: Schema.enumString({
        description:
          "supported: the excerpt directly backs the claim. conflicting: the excerpt contradicts it. insufficient-evidence: the excerpt does not settle it.",
        enum: ["supported", "conflicting", "insufficient-evidence"],
      }),
      explanation: Schema.string({
        description:
          "Plain-language explanation of the comparison and its limitations.",
      }),
      follow_up_question: Schema.string({
        description: "One concrete question the worker should ask next.",
      }),
    },
  }),
});

export function createComparisonModel(ai: AI, cloudModel: string): GenerativeModel {
  // Hybrid mode, fixed: on-device when available, cloud fallback.
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: comparisonSchema,
      },
    },
    onDeviceParams: { promptOptions: { responseConstraint: comparisonSchema } },
  });
}

function formatSource(source: RetrievedSource): string {
  const excerpts = source.excerpts
    .map((excerpt, index) => `Excerpt ${index + 1}${excerpt.truncated ? " (trimmed)" : ""}: ${excerpt.text}`)
    .join("\n");
  return (
    `Source: ${source.title}\nURL: ${source.url}\nRetrieved: ${source.retrieved_at}\n${excerpts}`
  );
}

function formatClaim(item: InvestigationPlanItem, index: number): string {
  return (
    `Claim ${index + 1}: ${item.claim}\n` +
    `Research question: ${item.research_question}\n` +
    `Why it matters: ${item.why_it_matters}`
  );
}

export function buildComparisonPrompt(
  items: InvestigationPlanItem[],
  sources: RetrievedSource[],
): string {
  const claims = items.map(formatClaim).join("\n\n");
  const retrieved = sources.map(formatSource).join("\n\n");
  return (
    "You compare claims from a job posting against retrieved official-source excerpts. " +
    "For each claim that any excerpt addresses, output one finding as JSON.\n" +
    "Rules:\n" +
    "- Every excerpt MUST be copied verbatim from the retrieved excerpts below. Never paraphrase, shorten, or invent quotations.\n" +
    "- Every source_title, source_url, and retrieved_at MUST be copied exactly from the retrieved source it quotes.\n" +
    "- Use 'supported' only when the excerpt directly backs the claim, 'conflicting' only when it contradicts it. " +
    "Otherwise use 'insufficient-evidence' — including when the excerpts say nothing about the claim.\n" +
    "- A general government guidance page NEVER verifies a specific employer. Say so in the explanation when relevant.\n" +
    "- Missing information is unverified, never false. Do not infer fraud from silence.\n" +
    "- Do not label any employer, recruiter, or offer legitimate, fraudulent, or compliant. Describe only what the excerpts do or do not say.\n" +
    "- Every explanation MUST state the comparison's limitation in one sentence (e.g. excerpts only cover part of the page; the page may have changed since retrieval).\n" +
    "- Skip claims no excerpt addresses rather than guessing.\n" +
    "- Output a JSON array only, no surrounding text.\n\n" +
    `Claims under investigation:\n${claims}\n\n` +
    `Retrieved official content (the ONLY quotable text):\n${retrieved}`
  );
}

/** Parses and attribution-checks comparison output; see validation.ts. */
export function parseEvidenceComparison(
  rawText: string,
  retrieved: RetrievedSource[],
): ParsedComparison {
  return parseComparisonFindings(rawText, retrieved);
}
