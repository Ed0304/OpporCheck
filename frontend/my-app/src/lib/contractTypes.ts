// Promise-to-Paper domain model: employment-document comparison types.
//
// Separate from OpportunityReport by design: job-ad analysis stays
// untouched, and contract data is never forced into the report shape.
// Dependency-free (no runtime imports) so planners, validators, and unit
// tests can use these types anywhere.

/** Documents that can take part in a Promise-to-Paper comparison. */
export type ContractDocumentType =
  | "job_advertisement"
  | "recruiter_communication"
  | "offer_letter"
  | "employment_contract"
  | "other";

/** Comparison outcome for one employment term. */
export type ComparisonStatus =
  | "consistent"
  | "discrepancy"
  | "not_addressed"
  | "needs_clarification";

/** Fixed employment-term categories (§3 of the milestone brief). */
export type ContractCategory =
  | "compensation"
  | "deductions"
  | "working_conditions"
  | "employment_period"
  | "benefits"
  | "termination"
  | "immigration"
  | "responsibilities";

/** Pointer to the exact place a claim was taken from. */
export interface DocumentReference {
  documentId: string;
  documentType: ContractDocumentType;
  fileName: string;
  /** 1-based page within PDF documents; omitted for pasted text. */
  pageNumber?: number;
}

/** One employment term with its supporting evidence. */
export interface EmploymentClaim {
  category: ContractCategory;
  claim: string;
  documentReference: DocumentReference;
  sourceExcerpt: string;
}

/** One compared term across the available documents. */
export interface PromiseToPaperFinding {
  category: ContractCategory;
  recruiterStatement?: EmploymentClaim;
  advertisementClaim?: EmploymentClaim;
  contractClause?: EmploymentClaim;
  /** Supporting evidence from an "other" document (invoice, receipt, …). */
  supportingEvidence?: EmploymentClaim;
  status: ComparisonStatus;
  explanation: string;
  followUpQuestion: string;
}

/** Document text held client-side for extraction and attribution. */
export interface ContractDocumentText {
  documentId: string;
  documentType: ContractDocumentType;
  fileName: string;
  /** Per-page text (1-based by index); pasted text is a single page. */
  pages: string[];
}

/** One raw extracted term, before document references are attached. */
export interface ExtractedTerm {
  category: ContractCategory;
  claim: string;
  sourceExcerpt: string;
  pageNumber?: number;
}

/** Validated extraction output for one document. */
export interface ExtractionResult {
  documentId: string;
  terms: EmploymentClaim[];
  missingCategories: ContractCategory[];
}
