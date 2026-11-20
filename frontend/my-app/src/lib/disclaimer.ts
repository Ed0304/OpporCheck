// Canonical product notices: the full disclaimer and its contextual
// variants. Single source of truth — every placement imports from here so
// the wording cannot drift between pages. The full disclaimer must keep
// its canonical meaning; concise variants link to pages carrying the full
// notice. Dependency-free so unit tests can assert exact wording.

export const FULL_DISCLAIMER_PARAGRAPHS: readonly string[] = [
  "OpporCheck is an informational and decision-support tool. It is not a scam detection service, fraud detector, legal advisory service, or employment verification authority.",
  "Our analysis highlights potential concerns, unclear terms, missing information, and relevant official guidance. These findings do not establish that an employer, recruiter, job advertisement, or employment contract is legitimate, fraudulent, or legally compliant.",
  "Always independently verify important information. If you suspect fraud, exploitation, illegal recruitment, or other misconduct, contact your local authorities or relevant government agencies through their official channels.",
  "Do not rely solely on OpporCheck when making employment, financial, immigration, or legal decisions.",
];

/** Short notice for the landing page, near the primary call to action. */
export const CONCISE_NOTICE =
  "OpporCheck is a decision-support tool, not a scam detector, legal adviser, or employment verification authority. Always verify important information independently.";

/** Analysis reports: flagged concerns are questions, not proof. */
export const ANALYSIS_CONTEXT_NOTICE =
  "Potential concerns flagged here are reasons to ask questions, not proof of fraud. Missing information means unverified — not false.";

/** Promise-to-Paper reports: differences are not verdicts. */
export const COMPARISON_CONTEXT_NOTICE =
  "Discrepancies between documents are differences in wording that need clarification — not automatic proof of wrongdoing or legal non-compliance.";

/** Official-source investigations: guidance is general, not a verification. */
export const INVESTIGATION_CONTEXT_NOTICE =
  "Cited government guidance describes general rules. It does not independently verify any specific employer, recruiter, or job opportunity.";

/** Shown before document upload: employment documents are sensitive. */
export const UPLOAD_SENSITIVITY_NOTICE =
  "Employment documents may contain sensitive personal information such as names, addresses, identity numbers, and bank details. Upload only documents you are authorized to share.";

/** Review-page processing disclosure: fixed hybrid mode, stated plainly. */
export const REVIEW_PROCESSING_NOTICE =
  "Analysis runs on-device when your browser supports it, otherwise in the cloud via Firebase AI Logic. Your posting text leaves the device only for cloud analysis.";
