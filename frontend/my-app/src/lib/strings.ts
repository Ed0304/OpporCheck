// Website-wide UI strings in English and Bahasa Indonesia.
//
// ENGLISH IS CANONICAL. The `en` map below is the source of truth for
// wording; every `id` entry is a WORKING DRAFT needing native-speaker
// review (and legal review for disclaimer-adjacent copy) before it can be
// considered final. Never present the Indonesian strings as final copy.
//
// Conventions (the authoring contract):
// - One flat string map per language; `UiStrings` is derived from the `en`
//   map, so TypeScript itself enforces key parity (a missing `id` key is a
//   compile error). test/unit/strings.test.ts additionally asserts runtime
//   parity, non-empty values, and spot wording.
// - Keys are camelCase, prefixed by surface (header*, nav*, footer*,
//   landing*, about*, how*, resources*, auth*, ws*, ov*, rev*, inv*,
//   invd*, ev*, an*, cmp*, cr*, pv*, st*, hd*, common*). Placeholders use
//   {name} and are filled with format().
// - Internal enum/validation values (priorities, statuses, model modes)
//   stay English; only the surrounding user-facing glue is localized.
// - Enum-keyed label maps live in their owner modules with get*(lang)
//   getters (reportLanguage, compareSession, privacyGate, privacyDetection,
//   contractAI, disclaimer); plan/source category labels live below as
//   getPlanCategoryLabel/getSourceCategoryLabel. This module stays flat
//   strings only, dependency-free (type-only imports), so unit tests can
//   import it without Firebase or framework code.
// - Server/client pattern: useLang is client-only, so server pages keep
//   their metadata exports and render client content components (*Content)
//   that own all copy via useLang. See LOCALIZATION.md at the app root.
//
// Hard constraints respected here: no URL, publisher, corridor-data,
// verification-status, or Firebase/backend wording changes.

import type { OfficialSourceCategory, PlanItemCategory } from "./validation";

export type UiLanguage = "en" | "id";

export const UI_LANGUAGES: ReadonlyArray<{ code: UiLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
];

const EN = {
  // ---- Corridor surfaces (original Phase C keys; wording unchanged) ----
  languageLabel: "Language",
  destinationLabel: "Destination",
  rulesApplied: "Rules applied",
  statusSourcesVerified: "Sources verified",
  statusPartial: "Partial coverage",
  sourcesVerifiedOn: "Sources verified",
  rulesNotAdded: "rules not yet added",
  evidenceTitle: "Evidence investigation",
  evidenceDescription:
    "Checks this posting's claims against official {name} guidance. Transient: results are shown once and never saved.",
  noQuestionsTitle: "No investigation questions",
  noQuestionsDescription:
    "This posting produced no {name}-corridor questions to check.",
  notCoveredTitle: "{name} is not covered yet",
  notCoveredDescription:
    "Evidence rules for {name} are not built yet, so no questions were generated. Choose a supported destination above.",
  noLinksTitle: "No {name} links yet",
  noLinksDescription:
    "Curated {name} guidance has not been added. Links appear here only after their sources are verified.",
  // ---- Shared fragments ----
  commonOpenInNewTab: "(opens in a new tab)",
  commonWorking: "Working…",
  commonLoading: "Loading…",
  commonUnknownCountry: "Unknown country",
  commonJustNow: "Just now",
  commonNotSet: "Not set",
  commonMissingMeansUnverified: "Missing information means unverified — not false.",
  commonCancel: "Cancel",
  commonClose: "Close",
  commonMenu: "Menu",
  commonSave: "Save",
  commonRemove: "Remove",
  commonRetry: "Retry",
  commonDiscard: "Discard",
  commonUseThisText: "Use this text",
  commonCheckPrivacy: "Check privacy",
  commonStatusComplete: "Complete",
  commonStatusReviewed: "Reviewed",
  commonSourceLabel: "Source:",
  commonRetrievedLabel: "Retrieved:",
  commonFollowUpLabel: "Follow-up question:",
  commonSetupMissing: "Firebase isn't configured (missing: {keys}).",
  commonSetupCheckEnv: "Check .env.local and restart the dev server.",
  commonSetupFillEnv: "Fill in .env.local and restart the dev server.",
  commonSetupRequired: "Setup required",
  commonBackToSignIn: "Back to sign in",
  commonAppCheckEvidence:
    "The comparison was blocked by App Check. Register a localhost debug token " +
    "(see the model playground guide) and try again.",
  commonAppCheckRequest:
    "The request was blocked by App Check. Register a localhost debug token " +
    "(see the model playground guide) and try again.",
  // ---- Site header ----
  headerSkipLink: "Skip to main content",
  headerHomeAria: "OpporCheck home",
  headerPrimaryAria: "Primary",
  headerMobileAria: "Mobile",
  headerSignIn: "Sign in",
  headerAccountFallback: "Account",
  headerWorkspace: "Workspace",
  headerSettings: "Settings",
  headerSignOut: "Sign out",
  headerThemeAria: "Theme: {current}. Activate to switch to {next}.",
  headerThemeTitle: "Theme: {current}",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  // ---- Public navigation ----
  navAbout: "About",
  navHowItWorks: "How it works",
  navResources: "Resources",
  // ---- Site footer ----
  footerProduct: "Product",
  footerWorkspace: "Workspace",
  footerAccount: "Account",
  footerAbout: "About OpporCheck",
  footerHowItWorks: "How it works",
  footerGuidance: "Employment guidance",
  footerReview: "Review an opportunity",
  footerInvestigations: "My investigations",
  footerPlayground: "Model playground",
  footerSignIn: "Sign in",
  footerCreateAccount: "Create account",
  footerSettings: "Settings",
  footerNavAria: "Footer: {heading}",
  footerNoticeHeading: "Product notice",
  footerTagline:
    "OpporCheck helps you review overseas job opportunities with evidence and clear explanations.",
  // ---- Disclaimer block ----
  disclaimerHeading: "What OpporCheck is — and isn't",
  disclaimerSectionAria: "About OpporCheck findings",
  // ---- Guidance list ----
  guidancePublisher: "Publisher:",
  guidanceCountry: "Country:",
  guidanceReviewed: "Reviewed for OpporCheck:",
  // ---- Landing page ----
  landingTitle: "Understand the opportunity before you commit.",
  landingSubtitle:
    "OpporCheck helps you understand what was promised, what appears in your written " +
    "employment agreement, what remains unclear, and what you should verify before signing.",
  landingGetStarted: "Get started",
  landingHowItWorks: "How it works",
  landingExampleAria: "Illustrative example of an OpporCheck finding",
  landingExampleBadge: "Example finding",
  landingExampleStatus: "Supported",
  landingExampleClaim: "Overtime is paid monthly at 1.5× the hourly rate.",
  landingExampleQuote:
    "Overtime hours shall be compensated at one hundred fifty percent of the basic hourly wage.",
  landingExampleSource: "Source: Example employment terms · p. 2",
  landingExampleCaption: "Illustrative example — not a real investigation.",
  landingWhatIs: "What is OpporCheck?",
  landingWhatIsText:
    "OpporCheck is an investigation workspace for overseas employment. Instead of reading a " +
    "posting and guessing, you get a structured review: what the offer actually says, what " +
    "is missing, which parts deserve a second look, and which official guidance applies. " +
    "It helps you ask better questions — it does not verify employers or approve offers.",
  landingWorkflow: "How the investigation workflow works",
  landingStep1Title: "Share the opportunity",
  landingStep1Text:
    "Paste the job description or upload the offer document. Your text stays in your own investigation.",
  landingStep2Title: "Get a structured review",
  landingStep2Text:
    "OpporCheck extracts the role, employer, pay, country, and employment type, then flags concerns, missing details, and questions worth asking.",
  landingStep3Title: "Check official guidance",
  landingStep3Text:
    "Compare claims against curated official sources and keep everything in one investigation report.",
  landingCapabilities: "Key capabilities",
  landingCap1Title: "Clear employment summaries",
  landingCap1Text:
    "Role, employer, salary, destination country, and contract type pulled into one readable overview.",
  landingCap2Title: "Concerns with evidence",
  landingCap2Text:
    "Each potential concern quotes the original wording and says how confident the finding is.",
  landingCap3Title: "Missing-information checklist",
  landingCap3Text:
    "See what the posting doesn't say — employer identity, fees, contract terms, visa details.",
  landingCap4Title: "Private by design",
  landingCap4Text:
    "Your investigations belong to your account. Analysis can run on your device when supported, with cloud fallback.",
  landingTransparency: "Transparency and limitations",
  landingTransparencyText:
    "OpporCheck works only from the text you provide and the official sources it links " +
    "to. It cannot confirm that an employer is genuine, check registration numbers, or " +
    "see information outside the posting.",
  landingLimit1: "A flagged concern is a reason to ask questions, not proof of fraud.",
  landingLimit2: "Missing information means unverified, not false.",
  landingLimit3:
    "Always confirm visa, pay, and contract details with official sources and, where needed, qualified advisers.",
  // ---- About page ----
  aboutTitle: "About OpporCheck",
  aboutP1:
    "OpporCheck is an AI-powered overseas employment investigation workspace. It helps " +
    "people understand job opportunities through evidence, official sources, and clear " +
    "explanations — before signing anything or paying any fee.",
  aboutP2:
    "Many overseas job seekers first meet an opportunity as a short message or a " +
    "photocopied offer: some details, many gaps, and no easy way to tell which is " +
    "which. OpporCheck turns that text into a structured review — extracted facts, " +
    "potential concerns with quoted evidence, missing information, and relevant " +
    "official guidance — so the next conversation starts from facts.",
  aboutNotTitle: "What OpporCheck is not",
  aboutNot1:
    "Not an employer verification service — it never declares an employer genuine or fraudulent.",
  aboutNot2: "Not a recruitment agency and not legal or immigration advice.",
  aboutNot3: "Not a replacement for checking official government sources yourself.",
  aboutHowTitle: "How analysis works",
  aboutHowText:
    "Reviews run in your browser using on-device AI when your device supports it, with " +
    "cloud fallback otherwise. Your postings and reports are stored in your own " +
    "account and are never shared between users.",
  // ---- How-it-works page ----
  howTitle: "How it works",
  howSubtitle: "Four steps from a raw posting to an evidence-backed investigation report.",
  howStep1Title: "Share the opportunity",
  howStep1Text:
    "Paste the job description or upload the offer as a PDF. OpporCheck reads the text and keeps it in your private workspace.",
  howStep2Title: "Review the analysis",
  howStep2Text:
    "You get an opportunity summary, extracted employment details, potential concerns with quoted evidence, a missing-information checklist, and a recommended next action.",
  howStep3Title: "Investigate with sources",
  howStep3Text:
    "Save the review as an investigation and compare its claims against curated official guidance, with each finding labelled as supported, conflicting, or insufficient evidence.",
  howStep4Title: "Decide with evidence",
  howStep4Text:
    "Bring the report — facts, gaps, concerns, and follow-up questions — to your decision or your adviser.",
  howBrowse: "Browse guidance",
  // ---- Public resources page ----
  resourcesTitle: "Employment guidance",
  resourcesSubtitle:
    "Curated official guidance for overseas employment. Destinations appear " +
    "with verified links only — more are added as their sources are verified.",
  // ---- Workspace resources page ----
  wsResourcesTitle: "Resources",
  wsResourcesSubtitle:
    "Official guidance worth checking against any opportunity. Choose a " +
    "destination to see its verified links.",
  // ---- Auth pages ----
  authEmail: "Email",
  authPassword: "Password",
  authSignInTitle: "Sign in",
  authSigningIn: "Signing in…",
  authGoogle: "Continue with Google",
  authForgot: "Forgot password?",
  authCreateAccount: "Create account",
  authLoadingSignIn: "Loading sign-in…",
  authPasswordHint: "At least 6 characters.",
  authCreating: "Creating account…",
  authHaveAccount: "Already have an account?",
  authResetTitle: "Reset password",
  authSending: "Sending…",
  authSendReset: "Send reset link",
  authResetSentBefore: "If an account exists for",
  authResetSentAfter:
    ", a reset link is on its way. Please check your inbox (and spam folder).",
  authSetupPrefix: "Firebase isn't configured:",
  // ---- Workspace shell ----
  wsMenuButton: "Workspace menu",
  wsCheckingSignIn: "Checking sign-in…",
  wsRedirecting: "Redirecting to sign-in…",
  wsSidebarAria: "Workspace",
  wsSectionsAria: "Workspace sections",
  wsCollapse: "Collapse",
  wsExpand: "Expand",
  wsCloseMenuAria: "Close workspace menu",
  wsNavOverview: "Overview",
  wsNavReview: "Review opportunity",
  wsNavCompare: "Compare documents",
  wsNavInvestigations: "My investigations",
  wsNavResources: "Resources",
  wsNavSettings: "Settings",
  // ---- Workspace overview ----
  ovWelcome: "Welcome",
  ovIntro:
    "OpporCheck turns a job posting into a structured review — facts, concerns with " +
    "quoted evidence, missing details, and relevant official guidance — saved as an " +
    "investigation you can revisit any time.",
  ovReviewCta: "Review an opportunity",
  ovRecent: "Recent investigations",
  ovViewAll: "View all",
  ovLoading: "Loading investigations…",
  ovLoadFailed: "Couldn't load investigations:",
  ovEmptyTitle: "No investigations yet",
  ovEmptyDesc:
    "Review your first opportunity to see it here with its facts, concerns, and evidence.",
  // ---- Review page ----
  revTitle: "Review an opportunity",
  revSubtitle:
    "Paste a job posting or upload it as a PDF. You get a structured review with " +
    "quoted evidence — then you can save it as an investigation.",
  revInputTitle: "Your input",
  revDeviceIdle: "On-device analysis is optional; cloud fallback works without it.",
  revDevicePreparing: "Preparing on-device analysis…",
  revDeviceDownloading: "Downloading on-device model: {percent}%",
  revDeviceReady: "On-device analysis is ready.",
  revEnableDevice: "Enable on-device",
  revDeviceProgressAria: "On-device model download progress",
  revInputMethodAria: "Input method",
  revTabPaste: "Paste text",
  revTabPdf: "Upload PDF",
  revTabImage: "Upload image",
  revPostingLabel: "Job posting text",
  revLoadSample: "Load sample",
  revClear: "Clear",
  revDocLanguage: "Document language",
  revPdfLabel: "PDF offer document",
  revPdfHint:
    "PDF up to 10 MB and 30 pages. Text pages extract directly; scanned pages are OCRed by the document service at {base}. Thai and Vietnamese are not supported.",
  revPdfProgressAria: "PDF upload progress",
  revPdfExtracted:
    "Extracted {pages} {pageWord} from {name}{trimmed}: {native} {nativeWord}, {ocr} OCR{failed}. {review}",
  revTrimmedSuffix: " (trimmed to fit)",
  revNativeWord: "native",
  revReviewBelow: "Review below, then use the text.",
  revOcrPageOne: "page",
  revOcrPageMany: "pages",
  revOcrWarn:
    "OCR on {count} {pageWord} (mean {mean}%, {low} low-confidence lines). Check figures carefully — a high score does not guarantee correctness.",
  revOcrMeanOk:
    "OCR mean confidence {mean}% across {count} {pageWord}. Always verify figures before analysis.",
  revPagesFailed: "Pages {pages} failed extraction and were excluded.",
  revPagesFailedSuffix: "You can retry, or continue with the available pages.",
  revPerPageAria: "Per-page extraction results",
  revPageLabel: "Page {n}",
  revPageText: "Text",
  revPageOcr: "OCR",
  revPageBlank: "Blank",
  revPageFailed: "Failed",
  revImageLabel: "Image offer document",
  revImageHint:
    "JPG or PNG up to 10 MB (max 8000 px per side). Text is extracted by the document service at {base}. Thai and Vietnamese are not supported.",
  revImageProgressAria: "Image upload and OCR progress",
  revOcrLowWarn:
    "Low confidence on {low} of {lines} lines (mean {mean}%). Check figures, " +
    "names, and dates carefully — a high score does not guarantee correctness.",
  revOcrLinesOk:
    "Mean confidence {mean}% across {lines} lines. Always verify figures before analysis.",
  revOcrDraftLabel: "Extracted text — review and correct",
  revAnalyze: "Analyze opportunity",
  revAnalyzing: "Analyzing…",
  revGateInvalidated:
    "The text changed since approval — run Privacy Check again before analysis.",
  revGateNeeded: "Run Privacy Check below and approve the text before analysis.",
  revAnalyzingStatus: "Reading the posting and preparing your review…",
  revAnalysisFailed: "Analysis failed:",
  revPrivacyTitle: "Privacy Check",
  revPrivacyDesc:
    "Required before analysis: review what looks personal, clean the text, and approve exactly what may be analyzed.",
  revGateNotStarted: "Not checked",
  revGateScanning: "Scanning…",
  revGateReviewing: "Review in progress",
  revGateReady: "Ready to approve",
  revGateApproved: "Approved for analysis",
  revGateInvalidatedLabel: "Approval expired — text changed",
  revCountRedacted: "redacted",
  revCountReplaced: "replaced",
  revCountKept: "kept",
  revPrivacyChanged:
    'The text changed while you were reviewing. Press "Check privacy" again on the current text.',
  revCheckAgain: "Check privacy again",
  revAddTextFirst:
    "Add posting text above first — paste it, upload a PDF, or upload an image.",
  revReviewTitle: "Review",
  revNoReviewTitle: "No review yet",
  revNoReviewDesc:
    "Your structured review — summary, details, concerns, missing information, and next steps — appears here after analysis.",
  revUnexpectedFormat:
    "The review came back in an unexpected format. Please run the analysis again.",
  revSaving: "Saving…",
  revSaved: "Saved",
  revSaveAs: "Save as investigation",
  revOpenReport: "Open report",
  revSaveNote:
    "Saves the approved text analyzed above, plus its report. Nothing is saved " +
    "until you press this button.",
  revSavedMessage: "Saved to your investigations.",
  revUntitled: "Untitled opportunity",
  revUnknownCountryTitle: "unknown country",
  // ---- Investigations list ----
  invTitle: "My investigations",
  invSubtitle: "Every opportunity you reviewed and saved.",
  invReviewNew: "Review new opportunity",
  invEmptyDesc: "Saved reviews appear here with their facts, concerns, and evidence.",
  invTitleEmpty: "Title cannot be empty.",
  invNewTitleAria: "New title",
  invRename: "Rename",
  invDelete: "Delete",
  invConfirmDelete: "Confirm delete",
  invLastUpdatedTitle: "Last updated",
  // ---- Investigation report ----
  invdLoading: "Loading investigation…",
  invdUnavailable: "Investigation unavailable",
  invdFallbackError: "Something went wrong.",
  invdBack: "Back to investigations",
  invdNotExist: "This investigation doesn't exist or was deleted.",
  invdOtherAccount: "This investigation belongs to a different account.",
  invdAll: "← All investigations",
  invdReviewedOn: "Reviewed",
  invdUpdatedOn: "Updated",
  invdUpdating: "Updating…",
  invdMarkComplete: "Mark complete",
  invdReviewUnavailable: "Review unavailable",
  invdReviewUnreadable:
    "This investigation's saved review data couldn't be read because it " +
    "doesn't match the expected format. The original posting text below is " +
    "still available.",
  invdSummary: "Summary",
  invdSummaryIn: "in",
  invdConcernOne: "potential concern",
  invdConcernMany: "potential concerns",
  invdMissingOne: "missing detail",
  invdMissingMany: "missing details",
  invdFindingOne: "official-source finding",
  invdFindingMany: "official-source findings",
  invdRecorded: "recorded.",
  invdReviewDetails: "Review details",
  invdFindingsTitle: "Official-source findings",
  invdNoFindings:
    "No saved official-source findings for this investigation. Client-saved " +
    "findings are intentionally not supported — use the transient evidence " +
    "check below instead. Its results are shown once and never saved.",
  invdOriginalPosting: "Original posting text",
  // ---- Evidence investigation (extends the corridor keys above) ----
  evConfigMissing:
    "Firebase isn't configured (missing: {keys}). The evidence comparison needs it — check .env.local and restart the dev server.",
  evPlanTitle: "Investigation questions ({count})",
  evPriorityLabel: "{priority} priority",
  evRecommendedSource: "Recommended source: {label}",
  evPrivacyApproved: "Privacy approved",
  evPrivacyRequired: "Privacy check required",
  evPrivacyExplainer:
    "The evidence check sends posting quotes to AI. Approve the cleaned " +
    "text first; the check runs on that text only.",
  evRun: "Run evidence check",
  evRunAgain: "Run again",
  evInvestigating: "Investigating…",
  evPostingChanged:
    "The posting changed while you were reviewing. Check privacy again.",
  evApproveFirst:
    "Approve the Privacy Check for this posting before running the evidence check.",
  evNoQuestionsApproved:
    "The approved text produced no investigation questions to check.",
  evContacting: "Contacting official sources…",
  evNoApprovedSource: "No approved official source covers these questions yet.",
  evNoneReached:
    "None of the official sources could be reached. The errors below explain what happened — try again later.",
  evComparing: "Comparing the posting's claims against the retrieved excerpts…",
  evFailedLabel: "Evidence check failed:",
  evSourcesTitle: "Sources checked ({count})",
  evExcerptOne: "excerpt",
  evExcerptMany: "excerpts",
  evShowExcerpts: "Show retrieved excerpts",
  evTrimmed: "(trimmed)",
  evNoSources: "No sources could be retrieved this run.",
  evFindingsTitle: "Findings ({count})",
  evComparisonPrefix: "Comparison",
  evQuotesNote:
    "Quotes are copied from the retrieved pages; each assessment is an AI-generated " +
    "interpretation of one quote, not a verdict on the offer.",
  evNoFindings:
    "No claim could be compared against the retrieved excerpts — the excerpts did not " +
    "address the investigation questions.",
  evGroupSupported: "Supported",
  evGroupConflicting: "Conflicting",
  evGroupInsufficient: "Insufficient evidence",
  evLimitsTitle: "Errors and limitations",
  evCouldNotCheck: "Could not check {url}: {error}",
  evNoSourceCovers: "No approved source covers {label} questions yet.",
  evDroppedResultOne: "comparison result",
  evDroppedResultMany: "comparison results",
  evDroppedVerbOne: "was",
  evDroppedVerbMany: "were",
  evDroppedPronounOne: "it",
  evDroppedPronounMany: "they",
  evDropped:
    "{count} {resultWord} {verb} dropped because {pronoun} failed validation " +
    "(unverifiable quote or source) and are not shown.",
  evOnlyExcerpts: "Only short excerpts were compared, not the full pages.",
  evGuidanceGeneral:
    "Government guidance pages describe general rules; they never verify a specific employer.",
  // ---- Analysis report ----
  anSummary: "Opportunity summary",
  anDetails: "Employment details",
  anOccupation: "Occupation",
  anEmployer: "Employer",
  anSalary: "Salary",
  anCountry: "Destination country",
  anEmpType: "Employment type",
  anConcerns: "Potential concerns",
  anNoConcerns:
    "No concerns flagged in this posting. That means nothing suspicious was found in " +
    "the text — not that the offer is verified.",
  anNoneReported: "None reported.",
  anNext: "Recommended next action",
  anConfidence: "Confidence:",
  anConfHigh: "high",
  anConfMedium: "medium",
  anConfLow: "low",
  anConfUnspecified: "unspecified",
  anConfHighHint: " — the wording clearly shows this",
  anConfMediumHint: " — likely, but wording is ambiguous",
  anConfLowHint: " — only a weak signal, treat as a question",
  anSumFallbackRole: "An opportunity",
  anSumWith: "with",
  anSumIn: "in",
  anSumPayStated: "Pay stated:",
  anSumNoPay: "No pay stated.",
  anSumEmpType: "Employment type:",
  anNextConcerns:
    "Ask the employer for written answers about each concern above — especially any " +
    "fees, documents, or pressure to decide quickly — and check the answers against " +
    "official guidance before paying anything or signing.",
  anNextMissing:
    "Request the missing details in writing before proceeding. A genuine employer " +
    "can name itself, describe the contract, and explain any visa route clearly.",
  anNextClear:
    "No warning signs found in the text itself. Still verify pay, hours, visa route, " +
    "and contract terms against official sources before committing.",
  anGuideFee:
    "Legitimate UK employers and agencies do not ask workers to pay for the job itself. Any requested payment deserves written justification before you send anything.",
  anGuideCash:
    "Pay without payslips or a written contract makes it hard to prove your hours, rate, or employment rights later.",
  anGuideMessaging:
    "Recruitment through personal messaging alone is common in scams. Check whether the same employer can be reached through verifiable official channels.",
  anGuidePassport:
    "No employer should keep your passport or identity documents. You have the right to hold your own documents at all times.",
  anGuideUrgency:
    "Pressure to decide fast is a classic persuasion tactic. Genuine offers allow time to read terms and ask questions.",
  anGuideGuarantee:
    "Guaranteed visas or jobs with no checks at all are unrealistic. Official routes always involve eligibility checks.",
  anGuideGeneric:
    "This detail is unusual enough to question. Ask for it in writing and compare the answer against official guidance.",
  anGuideFeeGeneric:
    "Any requested payment deserves written justification before you send " +
    "anything. Check the destination's official fee rules first.",
  // ---- Compare page ----
  cmpTitle: "Promise-to-Paper",
  cmpSubtitle:
    "Compare what was promised with what the written agreement says. Upload a " +
    "contract, an offer letter, a job ad, or recruiter messages — any combination " +
    "works. Documents stay in your browser session and are never saved.",
  cmpErrorTitle: "Something went wrong",
  cmpDocsTitle: "1. Documents",
  cmpDocsDesc:
    "Add up to {max} PDFs or pasted texts, and label each one. Comparison needs at least two documents with extracted terms. Each page needs a Privacy Check before extraction.",
  cmpNextDocLabel: "Next document is a",
  cmpUploadPdf: "Upload PDF",
  cmpUploadPdfHint:
    "PDF up to 10 MB and 30 pages via {base}. Text pages extract directly; scanned pages are OCRed.",
  cmpPasteLabel: "Or paste document text",
  cmpPastePlaceholder: "Paste a recruiter message, ad, offer, or contract clause…",
  cmpPasteNameLabel: "Pasted document name",
  cmpPasteNamePlaceholder: "e.g. WhatsApp message from recruiter",
  cmpAddPasted: "Add pasted text",
  cmpMaxDocs: "This comparison already has {max} documents. Remove one first.",
  cmpUploadingFile: "Uploading {name}…",
  cmpAddedBefore: "Added",
  cmpFailedSuffix: ", pages {pages} failed",
  cmpPasteEmpty: "Paste some document text first.",
  cmpPastedDefaultName: "Pasted text",
  cmpAddedName: "Added {name}.",
  cmpAddedDocs: "Added documents ({count})",
  cmpNoDocsTitle: "No documents yet",
  cmpNoDocsDesc:
    "Upload a PDF or paste text above. You can start with just a contract, or any two document types.",
  cmpPastedText: "pasted text",
  cmpTermsExtracted: "{count} terms extracted",
  cmpExtractionFailed: "extraction failed",
  cmpExtracting: "extracting…",
  cmpAwaitingExtraction: "awaiting extraction",
  cmpPrivacyPages: "Privacy: {done}/{total} pages approved",
  cmpRecheck: "Re-check",
  cmpCheck: "Check",
  cmpPagePrivacyAria: "{action} privacy for page {page} of {name}",
  cmpDocTypeSr: "Document type for {name}",
  cmpPrivacyTitle: "Privacy Check — {name}, page {n}",
  cmpPrivacyDesc:
    "Required before extraction: review what looks personal, clean the page, and approve exactly what may be analyzed.",
  cmpSettingsTitle: "2. Analysis settings",
  cmpSettingsDesc: "Contracts can contain sensitive information. Choose where analysis runs.",
  cmpInferenceAria: "Inference mode",
  cmpConsentTitle: "I consent to cloud processing.",
  cmpConsentBody:
    "My document text may be sent to the configured cloud model when on-device " +
    "analysis is unavailable. I understand I can choose on-device-only instead.",
  cmpDeviceIdle: "On-device analysis is not prepared yet.",
  cmpPrepareDevice: "Prepare on-device analysis",
  cmpExtractTitle: "3. Extracted terms",
  cmpExtractDesc:
    "Each document's employment terms, with the exact supporting excerpt for every term.",
  cmpNothingTitle: "Nothing to extract",
  cmpNothingDesc:
    "Add documents above first. Extraction reads each document's employment terms into reviewable claims.",
  cmpNoTerms: "No employment terms were found in this document.",
  cmpPageRef: "p. {n}",
  cmpNotStated:
    "Not stated in this document: {cats}. Missing means unverified — not false.",
  cmpTermOne: "term",
  cmpTermMany: "terms",
  cmpWas: "was",
  cmpWere: "were",
  cmpDroppedDuring: "dropped during validation.",
  cmpAwaitingLine: "Awaiting extraction.",
  cmpUnknownError: "unknown error",
  cmpExtractionFailedLine: "Extraction failed: {error}",
  cmpExtractButton: "Extract employment terms",
  cmpExtractingButton: "Extracting…",
  cmpPrivacyNeeded: "Approve every page's Privacy Check above before extraction.",
  cmpReportTitle: "4. Comparison report",
  cmpReportDesc:
    "What matches, what differs, what the written agreement never addresses, and what to ask before signing.",
  cmpExtractingStatus: "Extracting terms from {name}…",
  cmpComparingStatus: "Comparing terms across documents…",
  cmpNothingSent: "Nothing was sent anywhere.",
  cmpOnDeviceUnavailable:
    "On-device analysis isn't available in this browser. Prepare on-device analysis, " +
    "or switch to cloud fallback with consent. Nothing was sent anywhere.",
  cmpNoComparisonTitle: "No comparison yet",
  cmpNoComparisonNeedTwo: "Extract terms from at least two documents to compare them.",
  cmpNoComparisonReady: "Terms are extracted. Generate the comparison when ready.",
  cmpGenerate: "Generate comparison",
  cmpComparing: "Comparing…",
  cmpRegenerate: "Regenerate comparison",
  cmpTrimmedLimitation:
    "Documents longer than about {chars} characters were trimmed; later clauses were not analyzed.",
  cmpEstimatedLimitation:
    "Some page numbers are estimated because the extraction service returned no page breakdown.",
  cmpExtractedTermOne: "extracted term",
  cmpExtractedTermMany: "extracted terms",
  cmpDroppedValidation:
    "{count} {termWord} {verb} dropped during validation and {verb} not compared.",
  // ---- Compare report ----
  crExecSummary: "Executive summary",
  crComparedBefore: "Compared",
  crDocumentOne: "document",
  crDocumentMany: "documents",
  crConsistentOne: "consistent term",
  crConsistentMany: "consistent terms",
  crDiscrepancyOne: "discrepancy",
  crDiscrepancyMany: "discrepancies",
  crPromiseOne: "promise",
  crPromiseMany: "promises",
  crNotAddressedTail: "not addressed,",
  crNeedingTail: "needing clarification.",
  crQuotesNote:
    "Quotes are copied from your documents; each status is an AI-generated " +
    "interpretation of those quotes, not a verdict on any employer or offer.",
  crDocsIncluded: "Documents included",
  crTrimmedSuffix: ", trimmed to fit",
  crExtractedTail: "extracted)",
  crSlotRecruiter: "Recruiter statement",
  crSlotAdvertisement: "Advertisement",
  crSlotContract: "Written clause",
  crNoTerms:
    "No terms could be compared across these documents — the extracted terms did not " +
    "overlap, or every comparison result failed validation and was dropped.",
  crGroupConsistent: "Consistent terms",
  crGroupDiscrepancy: "Discrepancies",
  crGroupNotAddressed: "Promises not addressed",
  crGroupClarification: "Terms requiring clarification",
  crQuestions: "Questions to ask before signing",
  crLimits: "Limitations",
  crIs: "is",
  crAre: "are",
  crDropped:
    "{count} {resultWord} {verb} dropped because {pronoun} failed validation " +
    "(unverifiable quote or document) and {verb2} not shown.",
  crOnlyExcerpts: "Only the analyzed excerpts were compared, not entire documents.",
  crAmbiguous:
    "Ambiguous wording needs a human reviewer — statuses reflect the model's reading of short quotes, not legal analysis.",
  crMissingMeans:
    "Missing information means unverified — not false, and not proof of fraud.",
  // ---- Privacy Check panel ----
  pvIntro:
    "Employment documents often mix personal details in with the evidence you " +
    "need analyzed. This check highlights text that looks like personal " +
    "information so you can redact or replace it before analysis. Your " +
    "original text stays unchanged until you approve the cleaned version.",
  pvNoneFound:
    "No potential sensitive information was found. You can still redact " +
    "anything manually below, or approve to continue.",
  pvReviewedCount: "{done} of {total} items reviewed.",
  pvConfirmAll: "Confirm all suggestions",
  pvLikely: "Likely sensitive",
  pvPossibly: "Possibly sensitive",
  pvNeedsJudgment: "Needs judgment",
  pvLineWord: "line",
  pvRedact: "Redact",
  pvReplace: "Replace",
  pvKeep: "Keep",
  pvUndo: "Undo choice",
  pvReplacementPlaceholder: "Replacement text (suggestion: {suggestion})",
  pvReplacementAria: "Replacement for {label}",
  pvManualTitle: "Redact something yourself",
  pvManualHint: "Select any text below (for example a name), then choose Redact or Replace.",
  pvManualAria: "Original text for manual selection",
  pvNeedReplacement: "Type replacement text first, or choose Redact selection.",
  pvRedactSelection: "Redact selection",
  pvReplacementShort: "Replacement text",
  pvManualReplaceAria: "Replacement text for manual selection",
  pvReplaceSelection: "Replace selection",
  pvPreviewTitle: "Cleaned preview",
  pvCountRedacted: "redacted",
  pvCountReplaced: "replaced",
  pvCountKept: "kept as-is",
  pvPreviewNote: "The preview changes only through the choices above.",
  pvBeforeApprove: "Before you approve",
  pvAutoDetectNote:
    "Automatic detection can miss sensitive information, and anything it " +
    "finds is only a possibility — please review carefully, especially " +
    "names, numbers, and contact details.",
  pvDestination: "Analysis destination:",
  pvCharsToSend: "Characters to send:",
  pvApprove: "Approve cleaned text for analysis",
  pvEnableNote: "Review each item above (or confirm all suggestions) to enable approval.",
  // ---- Settings page ----
  stTitle: "Settings",
  stAccount: "Account",
  stEmail: "Email",
  stDisplayName: "Display name",
  stSignInMethod: "Sign-in method",
  stAppearance: "Appearance",
  stAppearanceDesc: "Choose how OpporCheck looks on this device.",
  stThemeAria: "Theme preference",
  stThemeLightHint: "Always use the light theme.",
  stThemeDarkHint: "Always use the dark theme.",
  stThemeSystemHint: "Follow your device setting.",
  // ---- Hybrid demo (model playground) ----
  hdEyebrow: "OpporCheck · Milestone 1",
  hdTitle: "Hybrid inference demo",
  hdSubtitle:
    "Analyzes an employment opportunity into structured JSON using Firebase AI Logic in the " +
    "browser. The SDK routes each prompt to the on-device model or the cloud model depending " +
    "on the selected mode and device capability.",
  hdEnvAria: "Environment status",
  hdEnvTitle: "Environment",
  hdEnvFirebaseConfig: "Firebase config",
  hdEnvConfigOk: "Loaded from env",
  hdEnvConfigMissing: "Missing: {keys}",
  hdEnvAppCheck: "App Check",
  hdEnvNoSiteKey: "No site key (cloud calls may 403 if enforced)",
  hdEnvNotInitialized: "Not initialized",
  hdEnvCloudModel: "Cloud model",
  hdEnvBrowser: "Browser",
  hdEnvChecking: "Checking…",
  hdEnvChromeDesktop: "Chrome {version} desktop",
  hdEnvNotChrome: "Not Chrome desktop — on-device unavailable, cloud still works",
  hdEnvChromeOld: "Chrome {version} — needs v139+ on desktop",
  hdEnvPromptApi: "Prompt API model",
  hdEnvPromptChecking: "checking…",
  hdSetupTitle: "Setup required before testing",
  hdSetupStep1Before: "Copy",
  hdSetupStep1Mid: "to",
  hdSetupStep1After: "and fill in your Firebase web app keys.",
  hdSetupStep2Before: "Provision AI Logic once:",
  hdSetupStep2After: "in your Firebase project directory.",
  hdSetupStep3Before: "Restart",
  hdSetupStep3After: "so the new env vars load.",
  hdSetupErrorLabel: "Error:",
  hdStep1Aria: "Initialize on-device model",
  hdStep1Title: "Step 1 · Initialize the on-device model",
  hdStep1Desc:
    "Chrome requires a user gesture before the on-device model can download. Click once; " +
    "the first download can take several minutes. This step is optional for the cloud-only " +
    "path.",
  hdInitButton: "Initialize on-device model",
  hdInitDownloading: "Downloading…",
  hdInitProgressAria: "On-device model download progress",
  hdInitFailedBefore: "Download failed. Check the Chrome flag",
  hdInitFailedAfter:
    ", available disk space, and that you are on Chrome desktop v139+. " +
    "The cloud path below still works.",
  hdDeviceIdle: "Not initialized.",
  hdDeviceStarting: "Starting on-device model…",
  hdDeviceDownloading: "Downloading on-device model: {percent}%",
  hdDeviceReady: "On-device model is ready.",
  hdStep2Aria: "Run opportunity analysis",
  hdStep2Title: "Step 2 · Analyze an opportunity",
  hdInferenceMode: "Inference mode",
  hdModePreferHint: "— on-device when available, otherwise cloud fallback",
  hdModeCloudHint: "— cloud model only, never on-device",
  hdOpportunityLabel: "Opportunity text",
  hdPrivacyTitle: "Privacy Check",
  hdPrivacyApproved: "(approved)",
  hdPrivacyRequired: "(required)",
  hdAnalyzeButton: "Analyze ({mode})",
  hdAnalyzing: "Analyzing…",
  hdRequestFailed: "Request failed:",
  hdLatency: "Latency:",
  hdModeLabel: "Mode:",
  hdFallbackNotice:
    "Notice: the on-device model was unavailable (not initialized, still downloading, " +
    "or unsupported), so the SDK fell back to the cloud model for this request.",
  hdResultOccupation: "Occupation",
  hdResultSalary: "Salary",
  hdResultCountry: "Destination country",
  hdResultEmpType: "Employment type",
  hdResultMissing: "Missing information",
  hdResultNone: "None reported",
  hdRawOutput: "Raw model output",
  hdTestAria: "How to test",
  hdTestTitle: "How to test both paths",
  hdTest1Before: "Use Chrome desktop v139+ with",
  hdTest1After: "set to Enabled, then restart Chrome.",
  hdTest2Before: "On-device path: click",
  hdTest2Mid: "wait for Ready, select",
  hdTest2After: ", and Analyze. Expect",
  hdTest3Before: "Cloud path: select",
  hdTest3Mid: "and Analyze. Expect",
  hdTest4Before:
    "Fallback check: in a fresh Chrome profile (or with the flag disabled), select",
  hdTest4Mid: "without initializing and Analyze. Expect",
  hdTest4After: "plus the fallback notice.",
  hdAppCheckHint:
    "This usually means App Check is enforced but the request had no valid token. " +
    "Register a debug token for localhost (see README section below) or check the reCAPTCHA Enterprise key.",
  hdPrivacyChanged:
    "The text changed while you were reviewing. Check privacy again.",
};

/** UiStrings is derived from the English map: key parity is a compile error. */
export type UiStrings = typeof EN;

// ---------------------------------------------------------------------------
// INDONESIAN WORKING DRAFTS — every value below needs native-speaker review
// before it can be considered final. Never present these strings as final.
// ---------------------------------------------------------------------------
const ID: UiStrings = {
  languageLabel: "Bahasa",
  destinationLabel: "Destinasi",
  rulesApplied: "Aturan yang diterapkan",
  statusSourcesVerified: "Sumber terverifikasi",
  statusPartial: "Cakupan sebagian",
  sourcesVerifiedOn: "Sumber terverifikasi",
  rulesNotAdded: "aturan belum ditambahkan",
  evidenceTitle: "Investigasi bukti",
  evidenceDescription:
    "Memeriksa klaim dalam lowongan ini terhadap panduan resmi {name}. Sementara: hasil hanya ditampilkan sekali dan tidak pernah disimpan.",
  noQuestionsTitle: "Tidak ada pertanyaan investigasi",
  noQuestionsDescription:
    "Lowongan ini tidak menghasilkan pertanyaan koridor {name} untuk diperiksa.",
  notCoveredTitle: "{name} belum dicakup",
  notCoveredDescription:
    "Aturan bukti untuk {name} belum dibuat, sehingga tidak ada pertanyaan yang dihasilkan. Pilih destinasi yang didukung di atas.",
  noLinksTitle: "Belum ada tautan {name}",
  noLinksDescription:
    "Panduan {name} yang dikurasi belum ditambahkan. Tautan hanya muncul setelah sumbernya diverifikasi.",
  commonOpenInNewTab: "(terbuka di tab baru)",
  commonWorking: "Bekerja…",
  commonLoading: "Memuat…",
  commonUnknownCountry: "Negara tidak diketahui",
  commonJustNow: "Baru saja",
  commonNotSet: "Belum diatur",
  commonMissingMeansUnverified:
    "Informasi yang hilang berarti belum terverifikasi — bukan berarti salah.",
  commonCancel: "Batal",
  commonClose: "Tutup",
  commonMenu: "Menu",
  commonSave: "Simpan",
  commonRemove: "Hapus",
  commonRetry: "Coba lagi",
  commonDiscard: "Buang",
  commonUseThisText: "Gunakan teks ini",
  commonCheckPrivacy: "Periksa privasi",
  commonStatusComplete: "Selesai",
  commonStatusReviewed: "Diulas",
  commonSourceLabel: "Sumber:",
  commonRetrievedLabel: "Diambil:",
  commonFollowUpLabel: "Pertanyaan lanjutan:",
  commonSetupMissing: "Firebase belum dikonfigurasi (kurang: {keys}).",
  commonSetupCheckEnv: "Periksa .env.local dan mulai ulang server dev.",
  commonSetupFillEnv: "Isi .env.local dan mulai ulang server dev.",
  commonSetupRequired: "Penyiapan diperlukan",
  commonBackToSignIn: "Kembali ke halaman masuk",
  commonAppCheckEvidence:
    "Perbandingan diblokir oleh App Check. Daftarkan token debug localhost " +
    "(lihat panduan playground model) dan coba lagi.",
  commonAppCheckRequest:
    "Permintaan diblokir oleh App Check. Daftarkan token debug localhost " +
    "(lihat panduan playground model) dan coba lagi.",
  headerSkipLink: "Lewati ke konten utama",
  headerHomeAria: "Beranda OpporCheck",
  headerPrimaryAria: "Utama",
  headerMobileAria: "Seluler",
  headerSignIn: "Masuk",
  headerAccountFallback: "Akun",
  headerWorkspace: "Ruang kerja",
  headerSettings: "Pengaturan",
  headerSignOut: "Keluar",
  headerThemeAria: "Tema: {current}. Aktifkan untuk beralih ke {next}.",
  headerThemeTitle: "Tema: {current}",
  themeLight: "Terang",
  themeDark: "Gelap",
  themeSystem: "Sistem",
  navAbout: "Tentang",
  navHowItWorks: "Cara kerja",
  navResources: "Sumber daya",
  footerProduct: "Produk",
  footerWorkspace: "Ruang kerja",
  footerAccount: "Akun",
  footerAbout: "Tentang OpporCheck",
  footerHowItWorks: "Cara kerja",
  footerGuidance: "Panduan ketenagakerjaan",
  footerReview: "Tinjau peluang kerja",
  footerInvestigations: "Investigasi saya",
  footerPlayground: "Playground model",
  footerSignIn: "Masuk",
  footerCreateAccount: "Buat akun",
  footerSettings: "Pengaturan",
  footerNavAria: "Footer: {heading}",
  footerNoticeHeading: "Pemberitahuan produk",
  footerTagline:
    "OpporCheck membantu Anda meninjau peluang kerja luar negeri dengan bukti dan penjelasan yang jelas.",
  disclaimerHeading: "Apa itu OpporCheck — dan apa yang bukan",
  disclaimerSectionAria: "Tentang temuan OpporCheck",
  guidancePublisher: "Penerbit:",
  guidanceCountry: "Negara:",
  guidanceReviewed: "Ditinjau untuk OpporCheck:",
  landingTitle: "Pahami peluang sebelum Anda berkomitmen.",
  landingSubtitle:
    "OpporCheck membantu Anda memahami apa yang dijanjikan, apa yang tercantum dalam " +
    "perjanjian kerja tertulis Anda, apa yang masih belum jelas, dan apa yang harus Anda verifikasi sebelum menandatangani.",
  landingGetStarted: "Mulai",
  landingHowItWorks: "Cara kerja",
  landingExampleAria: "Contoh ilustratif temuan OpporCheck",
  landingExampleBadge: "Contoh temuan",
  landingExampleStatus: "Didukung",
  landingExampleClaim: "Lembur dibayar setiap bulan sebesar 1,5× upah per jam.",
  landingExampleQuote:
    "Jam lembur akan diberi kompensasi sebesar seratus lima puluh persen dari upah dasar per jam.",
  landingExampleSource: "Sumber: Contoh ketentuan kerja · hlm. 2",
  landingExampleCaption: "Contoh ilustratif — bukan investigasi nyata.",
  landingWhatIs: "Apa itu OpporCheck?",
  landingWhatIsText:
    "OpporCheck adalah ruang kerja investigasi untuk pekerjaan luar negeri. Daripada membaca " +
    "lowongan dan menebak, Anda mendapatkan ulasan terstruktur: apa isi tawaran sebenarnya, apa " +
    "yang hilang, bagian mana yang perlu dilihat kedua kali, dan panduan resmi mana yang berlaku. " +
    "OpporCheck membantu Anda mengajukan pertanyaan yang lebih baik — OpporCheck tidak memverifikasi pemberi kerja atau menyetujui tawaran.",
  landingWorkflow: "Cara kerja alur investigasi",
  landingStep1Title: "Bagikan peluang",
  landingStep1Text:
    "Tempel deskripsi pekerjaan atau unggah dokumen tawaran. Teks Anda tetap dalam investigasi Anda sendiri.",
  landingStep2Title: "Dapatkan ulasan terstruktur",
  landingStep2Text:
    "OpporCheck mengekstrak peran, pemberi kerja, gaji, negara, dan jenis pekerjaan, lalu menandai masalah, detail yang hilang, dan pertanyaan yang layak ditanyakan.",
  landingStep3Title: "Periksa panduan resmi",
  landingStep3Text:
    "Bandingkan klaim dengan sumber resmi yang dikurasi dan simpan semuanya dalam satu laporan investigasi.",
  landingCapabilities: "Kemampuan utama",
  landingCap1Title: "Ringkasan kerja yang jelas",
  landingCap1Text:
    "Peran, pemberi kerja, gaji, negara tujuan, dan jenis kontrak dirangkum dalam satu gambaran yang mudah dibaca.",
  landingCap2Title: "Potensi masalah disertai bukti",
  landingCap2Text:
    "Setiap potensi masalah mengutip wording asli dan menyatakan tingkat kepercayaan temuan.",
  landingCap3Title: "Daftar periksa informasi yang hilang",
  landingCap3Text:
    "Lihat apa yang tidak dinyatakan lowongan — identitas pemberi kerja, biaya, ketentuan kontrak, detail visa.",
  landingCap4Title: "Privat sejak awal",
  landingCap4Text:
    "Investigasi Anda milik akun Anda. Analisis dapat berjalan di perangkat Anda bila didukung, dengan fallback cloud.",
  landingTransparency: "Transparansi dan batasan",
  landingTransparencyText:
    "OpporCheck hanya bekerja dari teks yang Anda berikan dan sumber resmi yang ditautkannya. " +
    "OpporCheck tidak dapat memastikan pemberi kerja itu asli, memeriksa nomor registrasi, atau " +
    "melihat informasi di luar lowongan.",
  landingLimit1:
    "Masalah yang ditandai adalah alasan untuk bertanya, bukan bukti penipuan.",
  landingLimit2: "Informasi yang hilang berarti belum terverifikasi, bukan salah.",
  landingLimit3:
    "Selalu konfirmasi detail visa, gaji, dan kontrak dengan sumber resmi dan, bila perlu, penasihat yang berkualifikasi.",
  aboutTitle: "Tentang OpporCheck",
  aboutP1:
    "OpporCheck adalah ruang kerja investigasi pekerjaan luar negeri bertenaga AI. OpporCheck membantu " +
    "orang memahami peluang kerja melalui bukti, sumber resmi, dan penjelasan yang jelas — sebelum menandatangani apa pun atau membayar biaya apa pun.",
  aboutP2:
    "Banyak pencari kerja luar negeri pertama kali mengenal peluang sebagai pesan singkat atau " +
    "tawaran fotokopian: sebagian detail, banyak celah, dan tidak ada cara mudah untuk membedakannya. " +
    "OpporCheck mengubah teks itu menjadi ulasan terstruktur — fakta yang diekstrak, potensi masalah " +
    "dengan bukti kutipan, informasi yang hilang, dan panduan resmi yang relevan — sehingga percakapan berikutnya berangkat dari fakta.",
  aboutNotTitle: "Apa yang bukan OpporCheck",
  aboutNot1:
    "Bukan layanan verifikasi pemberi kerja — OpporCheck tidak pernah menyatakan pemberi kerja asli atau curang.",
  aboutNot2: "Bukan agen perekrutan dan bukan nasihat hukum atau imigrasi.",
  aboutNot3: "Bukan pengganti untuk memeriksa sendiri sumber resmi pemerintah.",
  aboutHowTitle: "Cara kerja analisis",
  aboutHowText:
    "Ulasan berjalan di browser Anda menggunakan AI di perangkat bila perangkat Anda mendukungnya, " +
    "dengan fallback cloud bila tidak. Lowongan dan laporan Anda disimpan di akun Anda sendiri " +
    "dan tidak pernah dibagikan antar pengguna.",
  howTitle: "Cara kerja",
  howSubtitle: "Empat langkah dari lowongan mentah menjadi laporan investigasi berbasis bukti.",
  howStep1Title: "Bagikan peluang",
  howStep1Text:
    "Tempel deskripsi pekerjaan atau unggah tawaran sebagai PDF. OpporCheck membaca teks dan menyimpannya di ruang kerja privat Anda.",
  howStep2Title: "Tinjau analisis",
  howStep2Text:
    "Anda mendapatkan ringkasan peluang, detail pekerjaan yang diekstrak, potensi masalah dengan bukti kutipan, daftar periksa informasi yang hilang, dan tindakan berikutnya yang disarankan.",
  howStep3Title: "Investigasi dengan sumber",
  howStep3Text:
    "Simpan ulasan sebagai investigasi dan bandingkan klaimnya dengan panduan resmi yang dikurasi, dengan setiap temuan diberi label didukung, bertentangan, atau bukti tidak cukup.",
  howStep4Title: "Putuskan dengan bukti",
  howStep4Text:
    "Bawa laporan — fakta, celah, masalah, dan pertanyaan lanjutan — ke keputusan Anda atau penasihat Anda.",
  howBrowse: "Jelajahi panduan",
  resourcesTitle: "Panduan ketenagakerjaan",
  resourcesSubtitle:
    "Panduan resmi yang dikurasi untuk pekerjaan luar negeri. Destinasi muncul " +
    "hanya dengan tautan terverifikasi — destinasi lain ditambahkan setelah sumbernya terverifikasi.",
  wsResourcesTitle: "Sumber daya",
  wsResourcesSubtitle:
    "Panduan resmi yang layak diperiksa terhadap peluang apa pun. Pilih " +
    "destinasi untuk melihat tautan terverifikasinya.",
  authEmail: "Email",
  authPassword: "Kata sandi",
  authSignInTitle: "Masuk",
  authSigningIn: "Masuk…",
  authGoogle: "Lanjutkan dengan Google",
  authForgot: "Lupa kata sandi?",
  authCreateAccount: "Buat akun",
  authLoadingSignIn: "Memuat halaman masuk…",
  authPasswordHint: "Minimal 6 karakter.",
  authCreating: "Membuat akun…",
  authHaveAccount: "Sudah punya akun?",
  authResetTitle: "Atur ulang kata sandi",
  authSending: "Mengirim…",
  authSendReset: "Kirim tautan atur ulang",
  authResetSentBefore: "Jika ada akun untuk",
  authResetSentAfter:
    ", tautan atur ulang sedang dikirim. Silakan periksa kotak masuk (dan folder spam).",
  authSetupPrefix: "Firebase belum dikonfigurasi:",
  wsMenuButton: "Menu ruang kerja",
  wsCheckingSignIn: "Memeriksa status masuk…",
  wsRedirecting: "Mengalihkan ke halaman masuk…",
  wsSidebarAria: "Ruang kerja",
  wsSectionsAria: "Bagian ruang kerja",
  wsCollapse: "Ciutkan",
  wsExpand: "Bentangkan",
  wsCloseMenuAria: "Tutup menu ruang kerja",
  wsNavOverview: "Ringkasan",
  wsNavReview: "Tinjau peluang",
  wsNavCompare: "Bandingkan dokumen",
  wsNavInvestigations: "Investigasi saya",
  wsNavResources: "Sumber daya",
  wsNavSettings: "Pengaturan",
  ovWelcome: "Selamat datang",
  ovIntro:
    "OpporCheck mengubah lowongan kerja menjadi ulasan terstruktur — fakta, masalah dengan " +
    "bukti kutipan, detail yang hilang, dan panduan resmi yang relevan — disimpan sebagai " +
    "investigasi yang dapat Anda buka kapan saja.",
  ovReviewCta: "Tinjau peluang",
  ovRecent: "Investigasi terbaru",
  ovViewAll: "Lihat semua",
  ovLoading: "Memuat investigasi…",
  ovLoadFailed: "Tidak dapat memuat investigasi:",
  ovEmptyTitle: "Belum ada investigasi",
  ovEmptyDesc:
    "Tinjau peluang pertama Anda agar muncul di sini beserta fakta, masalah, dan buktinya.",
  revTitle: "Tinjau peluang",
  revSubtitle:
    "Tempel lowongan kerja atau unggah sebagai PDF. Anda mendapatkan ulasan terstruktur dengan " +
    "bukti kutipan — lalu Anda dapat menyimpannya sebagai investigasi.",
  revInputTitle: "Masukan Anda",
  revDeviceIdle: "Analisis di perangkat bersifat opsional; fallback cloud tetap berfungsi tanpanya.",
  revDevicePreparing: "Menyiapkan analisis di perangkat…",
  revDeviceDownloading: "Mengunduh model di perangkat: {percent}%",
  revDeviceReady: "Analisis di perangkat sudah siap.",
  revEnableDevice: "Aktifkan di perangkat",
  revDeviceProgressAria: "Kemajuan unduhan model di perangkat",
  revInputMethodAria: "Metode masukan",
  revTabPaste: "Tempel teks",
  revTabPdf: "Unggah PDF",
  revTabImage: "Unggah gambar",
  revPostingLabel: "Teks lowongan kerja",
  revLoadSample: "Muat contoh",
  revClear: "Bersihkan",
  revDocLanguage: "Bahasa dokumen",
  revPdfLabel: "Dokumen penawaran PDF",
  revPdfHint:
    "PDF hingga 10 MB dan 30 halaman. Halaman teks diekstrak langsung; halaman pindaian di-OCR oleh layanan dokumen di {base}. Bahasa Thai dan Vietnam tidak didukung.",
  revPdfProgressAria: "Kemajuan unggahan PDF",
  revPdfExtracted:
    "{pages} {pageWord} diekstrak dari {name}{trimmed}: {native} {nativeWord}, {ocr} OCR{failed}. {review}",
  revTrimmedSuffix: " (dipangkas agar muat)",
  revNativeWord: "teks",
  revReviewBelow: "Tinjau di bawah, lalu gunakan teks.",
  revOcrPageOne: "halaman",
  revOcrPageMany: "halaman",
  revOcrWarn:
    "OCR pada {count} {pageWord} (rata-rata {mean}%, {low} baris berkepercayaan rendah). Periksa angka dengan cermat — skor tinggi tidak menjamin kebenaran.",
  revOcrMeanOk:
    "Kepercayaan rata-rata OCR {mean}% pada {count} {pageWord}. Selalu verifikasi angka sebelum analisis.",
  revPagesFailed: "Halaman {pages} gagal diekstraksi dan dikecualikan.",
  revPagesFailedSuffix: "Anda dapat mencoba lagi, atau lanjutkan dengan halaman yang tersedia.",
  revPerPageAria: "Hasil ekstraksi per halaman",
  revPageLabel: "Halaman {n}",
  revPageText: "Teks",
  revPageOcr: "OCR",
  revPageBlank: "Kosong",
  revPageFailed: "Gagal",
  revImageLabel: "Dokumen penawaran gambar",
  revImageHint:
    "JPG atau PNG hingga 10 MB (maks 8000 px per sisi). Teks diekstrak oleh layanan dokumen di {base}. Bahasa Thai dan Vietnam tidak didukung.",
  revImageProgressAria: "Kemajuan unggahan gambar dan OCR",
  revOcrLowWarn:
    "Kepercayaan rendah pada {low} dari {lines} baris (rata-rata {mean}%). Periksa angka, " +
    "nama, dan tanggal dengan cermat — skor tinggi tidak menjamin kebenaran.",
  revOcrLinesOk:
    "Kepercayaan rata-rata {mean}% pada {lines} baris. Selalu verifikasi angka sebelum analisis.",
  revOcrDraftLabel: "Teks hasil ekstraksi — tinjau dan perbaiki",
  revAnalyze: "Analisis peluang",
  revAnalyzing: "Menganalisis…",
  revGateInvalidated:
    "Teks berubah sejak persetujuan — jalankan Periksa Privasi lagi sebelum analisis.",
  revGateNeeded: "Jalankan Periksa Privasi di bawah dan setujui teks sebelum analisis.",
  revAnalyzingStatus: "Membaca lowongan dan menyiapkan ulasan Anda…",
  revAnalysisFailed: "Analisis gagal:",
  revPrivacyTitle: "Periksa Privasi",
  revPrivacyDesc:
    "Wajib sebelum analisis: tinjau yang tampak personal, bersihkan teks, dan setujui tepatnya apa yang boleh dianalisis.",
  revGateNotStarted: "Belum diperiksa",
  revGateScanning: "Memindai…",
  revGateReviewing: "Peninjauan berlangsung",
  revGateReady: "Siap disetujui",
  revGateApproved: "Disetujui untuk analisis",
  revGateInvalidatedLabel: "Persetujuan kedaluwarsa — teks berubah",
  revCountRedacted: "disensor",
  revCountReplaced: "diganti",
  revCountKept: "dipertahankan",
  revPrivacyChanged:
    'Teks berubah saat Anda meninjau. Tekan "Periksa privasi" lagi pada teks saat ini.',
  revCheckAgain: "Periksa privasi lagi",
  revAddTextFirst:
    "Tambahkan teks lowongan di atas terlebih dahulu — tempel, unggah PDF, atau unggah gambar.",
  revReviewTitle: "Ulasan",
  revNoReviewTitle: "Belum ada ulasan",
  revNoReviewDesc:
    "Ulasan terstruktur Anda — ringkasan, detail, masalah, informasi yang hilang, dan langkah berikutnya — muncul di sini setelah analisis.",
  revUnexpectedFormat:
    "Ulasan kembali dalam format yang tidak diharapkan. Silakan jalankan analisis lagi.",
  revSaving: "Menyimpan…",
  revSaved: "Tersimpan",
  revSaveAs: "Simpan sebagai investigasi",
  revOpenReport: "Buka laporan",
  revSaveNote:
    "Menyimpan teks yang disetujui yang dianalisis di atas, beserta laporannya. Tidak ada yang disimpan " +
    "sampai Anda menekan tombol ini.",
  revSavedMessage: "Disimpan ke investigasi Anda.",
  revUntitled: "Peluang tanpa judul",
  revUnknownCountryTitle: "negara tidak diketahui",
  invTitle: "Investigasi saya",
  invSubtitle: "Setiap peluang yang Anda tinjau dan simpan.",
  invReviewNew: "Tinjau peluang baru",
  invEmptyDesc: "Ulasan yang disimpan muncul di sini beserta fakta, masalah, dan buktinya.",
  invTitleEmpty: "Judul tidak boleh kosong.",
  invNewTitleAria: "Judul baru",
  invRename: "Ganti nama",
  invDelete: "Hapus",
  invConfirmDelete: "Konfirmasi hapus",
  invLastUpdatedTitle: "Terakhir diperbarui",
  invdLoading: "Memuat investigasi…",
  invdUnavailable: "Investigasi tidak tersedia",
  invdFallbackError: "Terjadi kesalahan.",
  invdBack: "Kembali ke investigasi",
  invdNotExist: "Investigasi ini tidak ada atau telah dihapus.",
  invdOtherAccount: "Investigasi ini milik akun lain.",
  invdAll: "← Semua investigasi",
  invdReviewedOn: "Diulas",
  invdUpdatedOn: "Diperbarui",
  invdUpdating: "Memperbarui…",
  invdMarkComplete: "Tandai selesai",
  invdReviewUnavailable: "Ulasan tidak tersedia",
  invdReviewUnreadable:
    "Data ulasan tersimpan investigasi ini tidak dapat dibaca karena " +
    "tidak cocok dengan format yang diharapkan. Teks lowongan asli di bawah masih tersedia.",
  invdSummary: "Ringkasan",
  invdSummaryIn: "di",
  invdConcernOne: "potensi masalah",
  invdConcernMany: "potensi masalah",
  invdMissingOne: "detail yang hilang",
  invdMissingMany: "detail yang hilang",
  invdFindingOne: "temuan sumber resmi",
  invdFindingMany: "temuan sumber resmi",
  invdRecorded: "tercatat.",
  invdReviewDetails: "Detail ulasan",
  invdFindingsTitle: "Temuan sumber resmi",
  invdNoFindings:
    "Tidak ada temuan sumber resmi tersimpan untuk investigasi ini. Temuan yang disimpan " +
    "klien sengaja tidak didukung — gunakan pemeriksaan bukti sementara di bawah ini. " +
    "Hasilnya hanya ditampilkan sekali dan tidak pernah disimpan.",
  invdOriginalPosting: "Teks lowongan asli",
  evConfigMissing:
    "Firebase belum dikonfigurasi (kurang: {keys}). Perbandingan bukti membutuhkannya — periksa .env.local dan mulai ulang server dev.",
  evPlanTitle: "Pertanyaan investigasi ({count})",
  evPriorityLabel: "prioritas {priority}",
  evRecommendedSource: "Sumber yang disarankan: {label}",
  evPrivacyApproved: "Privasi disetujui",
  evPrivacyRequired: "Perlu pemeriksaan privasi",
  evPrivacyExplainer:
    "Pemeriksaan bukti mengirim kutipan lowongan ke AI. Setujui teks yang dibersihkan " +
    "terlebih dahulu; pemeriksaan hanya berjalan pada teks itu.",
  evRun: "Jalankan pemeriksaan bukti",
  evRunAgain: "Jalankan lagi",
  evInvestigating: "Menginvestigasi…",
  evPostingChanged:
    "Lowongan berubah saat Anda meninjau. Periksa privasi lagi.",
  evApproveFirst:
    "Setujui Periksa Privasi untuk lowongan ini sebelum menjalankan pemeriksaan bukti.",
  evNoQuestionsApproved:
    "Teks yang disetujui tidak menghasilkan pertanyaan investigasi untuk diperiksa.",
  evContacting: "Menghubungi sumber resmi…",
  evNoApprovedSource: "Belum ada sumber resmi yang disetujui mencakup pertanyaan ini.",
  evNoneReached:
    "Tidak satu pun sumber resmi dapat dihubungi. Kesalahan di bawah menjelaskan apa yang terjadi — coba lagi nanti.",
  evComparing: "Membandingkan klaim lowongan dengan kutipan yang diambil…",
  evFailedLabel: "Pemeriksaan bukti gagal:",
  evSourcesTitle: "Sumber yang diperiksa ({count})",
  evExcerptOne: "kutipan",
  evExcerptMany: "kutipan",
  evShowExcerpts: "Tampilkan kutipan yang diambil",
  evTrimmed: "(dipangkas)",
  evNoSources: "Tidak ada sumber yang dapat diambil pada proses ini.",
  evFindingsTitle: "Temuan ({count})",
  evComparisonPrefix: "Perbandingan",
  evQuotesNote:
    "Kutipan disalin dari halaman yang diambil; setiap penilaian adalah interpretasi AI atas " +
    "satu kutipan, bukan vonis atas tawaran.",
  evNoFindings:
    "Tidak ada klaim yang dapat dibandingkan dengan kutipan yang diambil — kutipan tidak " +
    "membahas pertanyaan investigasi.",
  evGroupSupported: "Didukung",
  evGroupConflicting: "Bertentangan",
  evGroupInsufficient: "Bukti tidak cukup",
  evLimitsTitle: "Kesalahan dan batasan",
  evCouldNotCheck: "Tidak dapat memeriksa {url}: {error}",
  evNoSourceCovers: "Belum ada sumber yang disetujui mencakup pertanyaan {label}.",
  evDroppedResultOne: "hasil perbandingan",
  evDroppedResultMany: "hasil perbandingan",
  evDroppedVerbOne: "telah",
  evDroppedVerbMany: "telah",
  evDroppedPronounOne: "hasil itu",
  evDroppedPronounMany: "hasil-hasil itu",
  evDropped:
    "{count} {resultWord} dibuang karena gagal validasi " +
    "(kutipan atau sumber tidak terverifikasi) dan tidak ditampilkan.",
  evOnlyExcerpts: "Hanya kutipan pendek yang dibandingkan, bukan seluruh halaman.",
  evGuidanceGeneral:
    "Halaman panduan pemerintah menjelaskan aturan umum; halaman tersebut tidak pernah memverifikasi pemberi kerja tertentu.",
  anSummary: "Ringkasan peluang",
  anDetails: "Detail pekerjaan",
  anOccupation: "Pekerjaan",
  anEmployer: "Pemberi kerja",
  anSalary: "Gaji",
  anCountry: "Negara tujuan",
  anEmpType: "Jenis pekerjaan",
  anConcerns: "Potensi masalah",
  anNoConcerns:
    "Tidak ada masalah yang ditandai dalam lowongan ini. Artinya tidak ada yang mencurigakan " +
    "dalam teks — bukan berarti tawaran terverifikasi.",
  anNoneReported: "Tidak ada yang dilaporkan.",
  anNext: "Tindakan berikutnya yang disarankan",
  anConfidence: "Kepercayaan:",
  anConfHigh: "tinggi",
  anConfMedium: "sedang",
  anConfLow: "rendah",
  anConfUnspecified: "tidak disebutkan",
  anConfHighHint: " — wording jelas menunjukkan hal ini",
  anConfMediumHint: " — kemungkinan, tetapi wording ambigu",
  anConfLowHint: " — hanya sinyal lemah, perlakukan sebagai pertanyaan",
  anSumFallbackRole: "Sebuah peluang",
  anSumWith: "dengan",
  anSumIn: "di",
  anSumPayStated: "Gaji tercantum:",
  anSumNoPay: "Tidak ada gaji tercantum.",
  anSumEmpType: "Jenis pekerjaan:",
  anNextConcerns:
    "Minta jawaban tertulis dari pemberi kerja tentang setiap masalah di atas — terutama biaya, " +
    "dokumen, atau tekanan untuk segera memutuskan — dan periksa jawabannya dengan panduan resmi " +
    "sebelum membayar apa pun atau menandatangani.",
  anNextMissing:
    "Minta detail yang hilang secara tertulis sebelum melanjutkan. Pemberi kerja asli " +
    "dapat menyebut namanya, menjelaskan kontrak, dan menjelaskan rute visa dengan jelas.",
  anNextClear:
    "Tidak ditemukan tanda bahaya dalam teks itu sendiri. Tetap verifikasi gaji, jam kerja, rute visa, " +
    "dan ketentuan kontrak dengan sumber resmi sebelum berkomitmen.",
  anGuideFee:
    "Pemberi kerja dan agen resmi Inggris tidak meminta pekerja membayar untuk pekerjaan itu sendiri. Setiap pembayaran yang diminta layak mendapat justifikasi tertulis sebelum Anda mengirim apa pun.",
  anGuideCash:
    "Gaji tanpa slip gaji atau kontrak tertulis menyulitkan pembuktian jam kerja, tarif, atau hak kerja Anda nanti.",
  anGuideMessaging:
    "Perekrutan hanya melalui pesan pribadi umum terjadi dalam penipuan. Periksa apakah pemberi kerja yang sama dapat dihubungi melalui kanal resmi yang terverifikasi.",
  anGuidePassport:
    "Tidak ada pemberi kerja yang boleh menyimpan paspor atau dokumen identitas Anda. Anda berhak memegang dokumen Anda sendiri setiap saat.",
  anGuideUrgency:
    "Tekanan untuk segera memutuskan adalah taktik persuasi klasik. Tawaran asli memberi waktu untuk membaca ketentuan dan bertanya.",
  anGuideGuarantee:
    "Visa yang dijamin atau pekerjaan tanpa pemeriksaan sama sekali tidak realistis. Rute resmi selalu melibatkan pemeriksaan kelayakan.",
  anGuideGeneric:
    "Detail ini cukup tidak biasa untuk dipertanyakan. Minta secara tertulis dan bandingkan jawabannya dengan panduan resmi.",
  anGuideFeeGeneric:
    "Setiap pembayaran yang diminta layak mendapat justifikasi tertulis sebelum Anda mengirim " +
    "apa pun. Periksa dulu aturan biaya resmi destinasi.",
  cmpTitle: "Promise-to-Paper",
  cmpSubtitle:
    "Bandingkan apa yang dijanjikan dengan apa yang dinyatakan dalam perjanjian tertulis. Unggah " +
    "kontrak, surat penawaran, iklan lowongan, atau pesan perekrut — kombinasi apa pun bisa. " +
    "Dokumen tetap di sesi browser Anda dan tidak pernah disimpan.",
  cmpErrorTitle: "Terjadi kesalahan",
  cmpDocsTitle: "1. Dokumen",
  cmpDocsDesc:
    "Tambahkan hingga {max} PDF atau teks tempelan, dan beri label masing-masing. Perbandingan membutuhkan setidaknya dua dokumen dengan ketentuan yang diekstrak. Setiap halaman perlu Periksa Privasi sebelum ekstraksi.",
  cmpNextDocLabel: "Dokumen berikutnya adalah",
  cmpUploadPdf: "Unggah PDF",
  cmpUploadPdfHint:
    "PDF hingga 10 MB dan 30 halaman via {base}. Halaman teks diekstrak langsung; halaman pindaian di-OCR.",
  cmpPasteLabel: "Atau tempel teks dokumen",
  cmpPastePlaceholder: "Tempel pesan perekrut, iklan, penawaran, atau klausul kontrak…",
  cmpPasteNameLabel: "Nama dokumen yang ditempel",
  cmpPasteNamePlaceholder: "mis. pesan WhatsApp dari perekrut",
  cmpAddPasted: "Tambahkan teks tempelan",
  cmpMaxDocs: "Perbandingan ini sudah memiliki {max} dokumen. Hapus satu terlebih dahulu.",
  cmpUploadingFile: "Mengunggah {name}…",
  cmpAddedBefore: "Ditambahkan",
  cmpFailedSuffix: ", halaman {pages} gagal",
  cmpPasteEmpty: "Tempel teks dokumen terlebih dahulu.",
  cmpPastedDefaultName: "Teks tempelan",
  cmpAddedName: "{name} ditambahkan.",
  cmpAddedDocs: "Dokumen yang ditambahkan ({count})",
  cmpNoDocsTitle: "Belum ada dokumen",
  cmpNoDocsDesc:
    "Unggah PDF atau tempel teks di atas. Anda dapat mulai hanya dengan kontrak, atau dua jenis dokumen apa pun.",
  cmpPastedText: "teks tempelan",
  cmpTermsExtracted: "{count} ketentuan diekstraksi",
  cmpExtractionFailed: "ekstraksi gagal",
  cmpExtracting: "mengekstraksi…",
  cmpAwaitingExtraction: "menunggu ekstraksi",
  cmpPrivacyPages: "Privasi: {done}/{total} halaman disetujui",
  cmpRecheck: "Periksa ulang",
  cmpCheck: "Periksa",
  cmpPagePrivacyAria: "{action} privasi untuk halaman {page} dari {name}",
  cmpDocTypeSr: "Jenis dokumen untuk {name}",
  cmpPrivacyTitle: "Periksa Privasi — {name}, halaman {n}",
  cmpPrivacyDesc:
    "Wajib sebelum ekstraksi: tinjau yang tampak personal, bersihkan halaman, dan setujui tepatnya apa yang boleh dianalisis.",
  cmpSettingsTitle: "2. Pengaturan analisis",
  cmpSettingsDesc: "Kontrak dapat memuat informasi sensitif. Pilih di mana analisis berjalan.",
  cmpInferenceAria: "Mode inferensi",
  cmpConsentTitle: "Saya menyetujui pemrosesan cloud.",
  cmpConsentBody:
    "Teks dokumen saya dapat dikirim ke model cloud yang dikonfigurasi bila analisis di perangkat " +
    "tidak tersedia. Saya memahami saya dapat memilih khusus di perangkat.",
  cmpDeviceIdle: "Analisis di perangkat belum disiapkan.",
  cmpPrepareDevice: "Siapkan analisis di perangkat",
  cmpExtractTitle: "3. Ketentuan yang diekstraksi",
  cmpExtractDesc:
    "Ketentuan kerja setiap dokumen, dengan kutipan pendukung yang tepat untuk setiap ketentuan.",
  cmpNothingTitle: "Tidak ada yang diekstraksi",
  cmpNothingDesc:
    "Tambahkan dokumen di atas terlebih dahulu. Ekstraksi membaca ketentuan kerja setiap dokumen menjadi klaim yang dapat ditinjau.",
  cmpNoTerms: "Tidak ditemukan ketentuan kerja dalam dokumen ini.",
  cmpPageRef: "hlm. {n}",
  cmpNotStated:
    "Tidak dinyatakan dalam dokumen ini: {cats}. Hilang berarti belum terverifikasi — bukan salah.",
  cmpTermOne: "ketentuan",
  cmpTermMany: "ketentuan",
  cmpWas: "telah",
  cmpWere: "telah",
  cmpDroppedDuring: "dibuang selama validasi.",
  cmpAwaitingLine: "Menunggu ekstraksi.",
  cmpUnknownError: "kesalahan tidak diketahui",
  cmpExtractionFailedLine: "Ekstraksi gagal: {error}",
  cmpExtractButton: "Ekstraksi ketentuan kerja",
  cmpExtractingButton: "Mengekstraksi…",
  cmpPrivacyNeeded: "Setujui Periksa Privasi setiap halaman di atas sebelum ekstraksi.",
  cmpReportTitle: "4. Laporan perbandingan",
  cmpReportDesc:
    "Apa yang cocok, apa yang berbeda, apa yang tidak pernah dibahas perjanjian tertulis, dan apa yang perlu ditanyakan sebelum menandatangani.",
  cmpExtractingStatus: "Mengekstraksi ketentuan dari {name}…",
  cmpComparingStatus: "Membandingkan ketentuan antar dokumen…",
  cmpNothingSent: "Tidak ada yang dikirim ke mana pun.",
  cmpOnDeviceUnavailable:
    "Analisis di perangkat tidak tersedia di browser ini. Siapkan analisis di perangkat, " +
    "atau beralih ke fallback cloud dengan persetujuan. Tidak ada yang dikirim ke mana pun.",
  cmpNoComparisonTitle: "Belum ada perbandingan",
  cmpNoComparisonNeedTwo: "Ekstraksi ketentuan dari setidaknya dua dokumen untuk membandingkannya.",
  cmpNoComparisonReady: "Ketentuan sudah diekstraksi. Buat perbandingan saat siap.",
  cmpGenerate: "Buat perbandingan",
  cmpComparing: "Membandingkan…",
  cmpRegenerate: "Buat ulang perbandingan",
  cmpTrimmedLimitation:
    "Dokumen yang lebih panjang dari sekitar {chars} karakter dipangkas; klausul berikutnya tidak dianalisis.",
  cmpEstimatedLimitation:
    "Beberapa nomor halaman merupakan perkiraan karena layanan ekstraksi tidak mengembalikan rincian halaman.",
  cmpExtractedTermOne: "ketentuan yang diekstraksi",
  cmpExtractedTermMany: "ketentuan yang diekstraksi",
  cmpDroppedValidation:
    "{count} {termWord} dibuang selama validasi dan tidak dibandingkan.",
  crExecSummary: "Ringkasan eksekutif",
  crComparedBefore: "Dibandingkan",
  crDocumentOne: "dokumen",
  crDocumentMany: "dokumen",
  crConsistentOne: "ketentuan konsisten",
  crConsistentMany: "ketentuan konsisten",
  crDiscrepancyOne: "perbedaan",
  crDiscrepancyMany: "perbedaan",
  crPromiseOne: "janji",
  crPromiseMany: "janji",
  crNotAddressedTail: "tidak dibahas,",
  crNeedingTail: "perlu klarifikasi.",
  crQuotesNote:
    "Kutipan disalin dari dokumen Anda; setiap status adalah interpretasi AI atas " +
    "kutipan tersebut, bukan vonis atas pemberi kerja atau tawaran apa pun.",
  crDocsIncluded: "Dokumen yang disertakan",
  crTrimmedSuffix: ", dipangkas agar muat",
  crExtractedTail: "diekstraksi)",
  crSlotRecruiter: "Pernyataan perekrut",
  crSlotAdvertisement: "Iklan",
  crSlotContract: "Klausul tertulis",
  crNoTerms:
    "Tidak ada ketentuan yang dapat dibandingkan antar dokumen ini — ketentuan yang diekstrak tidak " +
    "tumpang tindih, atau setiap hasil perbandingan gagal validasi dan dibuang.",
  crGroupConsistent: "Ketentuan konsisten",
  crGroupDiscrepancy: "Perbedaan",
  crGroupNotAddressed: "Janji yang tidak dibahas",
  crGroupClarification: "Ketentuan yang perlu klarifikasi",
  crQuestions: "Pertanyaan untuk ditanyakan sebelum menandatangani",
  crLimits: "Batasan",
  crIs: "adalah",
  crAre: "adalah",
  crDropped:
    "{count} {resultWord} dibuang karena gagal validasi " +
    "(kutipan atau dokumen tak terverifikasi) dan tidak ditampilkan.",
  crOnlyExcerpts: "Hanya kutipan yang dianalisis yang dibandingkan, bukan seluruh dokumen.",
  crAmbiguous:
    "Wording yang ambigu perlu peninjau manusia — status mencerminkan pembacaan model atas kutipan pendek, bukan analisis hukum.",
  crMissingMeans:
    "Informasi yang hilang berarti belum terverifikasi — bukan salah, dan bukan bukti penipuan.",
  pvIntro:
    "Dokumen kerja sering mencampur detail personal dengan bukti yang perlu " +
    "dianalisis. Pemeriksaan ini menandai teks yang tampak seperti informasi " +
    "personal agar Anda dapat menyensor atau menggantinya sebelum analisis. Teks " +
    "asli Anda tidak berubah sampai Anda menyetujui versi yang dibersihkan.",
  pvNoneFound:
    "Tidak ditemukan potensi informasi sensitif. Anda masih dapat menyensor " +
    "apa pun secara manual di bawah, atau menyetujui untuk melanjutkan.",
  pvReviewedCount: "{done} dari {total} item ditinjau.",
  pvConfirmAll: "Konfirmasi semua saran",
  pvLikely: "Kemungkinan sensitif",
  pvPossibly: "Mungkin sensitif",
  pvNeedsJudgment: "Perlu penilaian",
  pvLineWord: "baris",
  pvRedact: "Sensor",
  pvReplace: "Ganti",
  pvKeep: "Pertahankan",
  pvUndo: "Batalkan pilihan",
  pvReplacementPlaceholder: "Teks pengganti (saran: {suggestion})",
  pvReplacementAria: "Pengganti untuk {label}",
  pvManualTitle: "Sensor sendiri",
  pvManualHint: "Pilih teks apa pun di bawah (misalnya nama), lalu pilih Sensor atau Ganti.",
  pvManualAria: "Teks asli untuk seleksi manual",
  pvNeedReplacement: "Ketik teks pengganti terlebih dahulu, atau pilih Sensor seleksi.",
  pvRedactSelection: "Sensor seleksi",
  pvReplacementShort: "Teks pengganti",
  pvManualReplaceAria: "Teks pengganti untuk seleksi manual",
  pvReplaceSelection: "Ganti seleksi",
  pvPreviewTitle: "Pratinjau bersih",
  pvCountRedacted: "disensor",
  pvCountReplaced: "diganti",
  pvCountKept: "dipertahankan",
  pvPreviewNote: "Pratinjau hanya berubah melalui pilihan di atas.",
  pvBeforeApprove: "Sebelum Anda menyetujui",
  pvAutoDetectNote:
    "Deteksi otomatis dapat melewatkan informasi sensitif, dan apa pun yang " +
    "ditemukannya hanya kemungkinan — harap tinjau dengan cermat, terutama " +
    "nama, angka, dan detail kontak.",
  pvDestination: "Tujuan analisis:",
  pvCharsToSend: "Karakter yang dikirim:",
  pvApprove: "Setujui teks bersih untuk analisis",
  pvEnableNote: "Tinjau setiap item di atas (atau konfirmasi semua saran) untuk mengaktifkan persetujuan.",
  stTitle: "Pengaturan",
  stAccount: "Akun",
  stEmail: "Email",
  stDisplayName: "Nama tampilan",
  stSignInMethod: "Metode masuk",
  stAppearance: "Tampilan",
  stAppearanceDesc: "Pilih tampilan OpporCheck di perangkat ini.",
  stThemeAria: "Preferensi tema",
  stThemeLightHint: "Selalu gunakan tema terang.",
  stThemeDarkHint: "Selalu gunakan tema gelap.",
  stThemeSystemHint: "Ikuti pengaturan perangkat.",
  hdEyebrow: "OpporCheck · Tonggak 1",
  hdTitle: "Demo inferensi hibrida",
  hdSubtitle:
    "Menganalisis peluang kerja menjadi JSON terstruktur menggunakan Firebase AI Logic di " +
    "browser. SDK mengarahkan setiap prompt ke model di perangkat atau model cloud tergantung " +
    "mode yang dipilih dan kemampuan perangkat.",
  hdEnvAria: "Status lingkungan",
  hdEnvTitle: "Lingkungan",
  hdEnvFirebaseConfig: "Konfigurasi Firebase",
  hdEnvConfigOk: "Dimuat dari env",
  hdEnvConfigMissing: "Kurang: {keys}",
  hdEnvAppCheck: "App Check",
  hdEnvNoSiteKey: "Tidak ada site key (panggilan cloud dapat 403 jika diberlakukan)",
  hdEnvNotInitialized: "Belum diinisialisasi",
  hdEnvCloudModel: "Model cloud",
  hdEnvBrowser: "Browser",
  hdEnvChecking: "Memeriksa…",
  hdEnvChromeDesktop: "Chrome {version} desktop",
  hdEnvNotChrome: "Bukan Chrome desktop — model di perangkat tidak tersedia, cloud tetap berfungsi",
  hdEnvChromeOld: "Chrome {version} — perlu v139+ di desktop",
  hdEnvPromptApi: "Model Prompt API",
  hdEnvPromptChecking: "memeriksa…",
  hdSetupTitle: "Penyiapan diperlukan sebelum pengujian",
  hdSetupStep1Before: "Salin",
  hdSetupStep1Mid: "ke",
  hdSetupStep1After: "dan isi kunci aplikasi web Firebase Anda.",
  hdSetupStep2Before: "Provisikan AI Logic sekali:",
  hdSetupStep2After: "di direktori proyek Firebase Anda.",
  hdSetupStep3Before: "Mulai ulang",
  hdSetupStep3After: "agar variabel env baru dimuat.",
  hdSetupErrorLabel: "Kesalahan:",
  hdStep1Aria: "Inisialisasi model di perangkat",
  hdStep1Title: "Langkah 1 · Inisialisasi model di perangkat",
  hdStep1Desc:
    "Chrome memerlukan gestur pengguna sebelum model di perangkat dapat diunduh. Klik sekali; " +
    "unduhan pertama dapat memakan waktu beberapa menit. Langkah ini opsional untuk jalur khusus cloud.",
  hdInitButton: "Inisialisasi model di perangkat",
  hdInitDownloading: "Mengunduh…",
  hdInitProgressAria: "Kemajuan unduhan model di perangkat",
  hdInitFailedBefore: "Unduhan gagal. Periksa flag Chrome",
  hdInitFailedAfter:
    ", ruang disk yang tersedia, dan bahwa Anda menggunakan Chrome desktop v139+. " +
    "Jalur cloud di bawah tetap berfungsi.",
  hdDeviceIdle: "Belum diinisialisasi.",
  hdDeviceStarting: "Memulai model di perangkat…",
  hdDeviceDownloading: "Mengunduh model di perangkat: {percent}%",
  hdDeviceReady: "Model di perangkat sudah siap.",
  hdStep2Aria: "Jalankan analisis peluang",
  hdStep2Title: "Langkah 2 · Analisis peluang",
  hdInferenceMode: "Mode inferensi",
  hdModePreferHint: "— di perangkat bila tersedia, jika tidak fallback cloud",
  hdModeCloudHint: "— hanya model cloud, tidak pernah di perangkat",
  hdOpportunityLabel: "Teks peluang",
  hdPrivacyTitle: "Periksa Privasi",
  hdPrivacyApproved: "(disetujui)",
  hdPrivacyRequired: "(wajib)",
  hdAnalyzeButton: "Analisis ({mode})",
  hdAnalyzing: "Menganalisis…",
  hdRequestFailed: "Permintaan gagal:",
  hdLatency: "Latensi:",
  hdModeLabel: "Mode:",
  hdFallbackNotice:
    "Perhatian: model di perangkat tidak tersedia (belum diinisialisasi, masih mengunduh, " +
    "atau tidak didukung), sehingga SDK beralih ke model cloud untuk permintaan ini.",
  hdResultOccupation: "Pekerjaan",
  hdResultSalary: "Gaji",
  hdResultCountry: "Negara tujuan",
  hdResultEmpType: "Jenis pekerjaan",
  hdResultMissing: "Informasi yang hilang",
  hdResultNone: "Tidak ada yang dilaporkan",
  hdRawOutput: "Output mentah model",
  hdTestAria: "Cara menguji",
  hdTestTitle: "Cara menguji kedua jalur",
  hdTest1Before: "Gunakan Chrome desktop v139+ dengan",
  hdTest1After: "diatur ke Enabled, lalu mulai ulang Chrome.",
  hdTest2Before: "Jalur di perangkat: klik",
  hdTest2Mid: "tunggu hingga siap, pilih",
  hdTest2After: ", lalu Analisis. Harapkan",
  hdTest3Before: "Jalur cloud: pilih",
  hdTest3Mid: "dan Analisis. Harapkan",
  hdTest4Before:
    "Pemeriksaan fallback: di profil Chrome baru (atau dengan flag dinonaktifkan), pilih",
  hdTest4Mid: "tanpa inisialisasi dan Analisis. Harapkan",
  hdTest4After: "plus pemberitahuan fallback.",
  hdAppCheckHint:
    "Ini biasanya berarti App Check diberlakukan tetapi permintaan tidak memiliki token yang valid. " +
    "Daftarkan token debug untuk localhost (lihat bagian README di bawah) atau periksa kunci reCAPTCHA Enterprise.",
  hdPrivacyChanged:
    "Teks berubah saat Anda meninjau. Periksa privasi lagi.",
};

const STRINGS: Record<UiLanguage, UiStrings> = { en: EN, id: ID };

export function getStrings(language: UiLanguage): UiStrings {
  return STRINGS[language];
}

/** Fills {name} placeholders; unknown placeholders are left untouched. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? (values[key] as string) : match,
  );
}

// ---- Enum-keyed plan/source labels (kept here, next to the flat map) ----

const PLAN_CATEGORY_LABELS: Record<UiLanguage, Record<PlanItemCategory, string>> = {
  en: {
    "explicit-claim": "Posting claim",
    "potential-concern": "Potential concern",
    "missing-information": "Missing information",
    "research-question": "Research question",
  },
  // WORKING DRAFTS — need native-speaker review, like every `id` value here.
  id: {
    "explicit-claim": "Klaim lowongan",
    "potential-concern": "Potensi masalah",
    "missing-information": "Informasi yang hilang",
    "research-question": "Pertanyaan penelitian",
  },
};

const SOURCE_CATEGORY_LABELS: Record<UiLanguage, Record<OfficialSourceCategory, string>> = {
  en: {
    "visa-route": "Visa route guidance",
    "worker-rights-and-fees": "Worker rights and fees",
    "seasonal-guidance": "Seasonal work guidance",
    "pay-rates": "Pay rates",
    "work-authorization": "Work authorization",
    "recruitment-rules": "Recruitment rules",
    "salary-protection": "Salary protection",
    "complaint-channels": "Complaint channels",
    "origin-protection": "Origin-country protection",
  },
  // WORKING DRAFTS — need native-speaker review, like every `id` value here.
  id: {
    "visa-route": "Panduan rute visa",
    "worker-rights-and-fees": "Hak pekerja dan biaya",
    "seasonal-guidance": "Panduan kerja musiman",
    "pay-rates": "Tarif upah",
    "work-authorization": "Otorisasi kerja",
    "recruitment-rules": "Aturan perekrutan",
    "salary-protection": "Perlindungan gaji",
    "complaint-channels": "Kanal pengaduan",
    "origin-protection": "Perlindungan negara asal",
  },
};

export function getPlanCategoryLabel(
  language: UiLanguage,
  category: PlanItemCategory,
): string {
  return PLAN_CATEGORY_LABELS[language][category];
}

export function getSourceCategoryLabel(
  language: UiLanguage,
  category: OfficialSourceCategory,
): string {
  return SOURCE_CATEGORY_LABELS[language][category];
}
