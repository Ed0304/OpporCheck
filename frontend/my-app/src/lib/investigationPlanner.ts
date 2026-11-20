// Investigation planner: turns a report plus its posting into structured
// research questions for the evidence workflow.
//
// Deterministic and dependency-free (type-only imports): it only rearranges
// strings the caller provides, so it cannot invent employers, registration
// numbers, licences, URLs, or verification results. Every item is phrased
// as a neutral question — concerns stay concerns, never accusations.
//
// Corridor routing: each supported destination owns a rule pack below.
// Unknown or unsupported destinations produce an empty plan and the caller
// asks the user to choose — the planner never defaults to any country.

import { CORRIDORS, resolveCorridorCode, type CorridorCode } from "./corridors";
import type { AnalysisConcern, OpportunityReport } from "./opportunityAnalyzer";
import type {
  InvestigationPriority,
  OfficialSourceCategory,
  PlanItemCategory,
} from "./validation";

export interface InvestigationPlanItem {
  claim: string;
  category: PlanItemCategory;
  research_question: string;
  why_it_matters: string;
  source_category: OfficialSourceCategory;
  evidence_required: string;
  priority: InvestigationPriority;
}

export interface InvestigationPlan {
  corridor: string;
  items: InvestigationPlanItem[];
}

/** Only corridor covered by the original implementation; GB display name. */
export const INVESTIGATION_CORRIDOR = "United Kingdom";

const MAX_PLAN_ITEMS = 12;
const MAX_QUOTE_CHARS = 300;

function isSpecified(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "not specified" && normalized !== "unknown";
}

/** Shortens a quote for plan display; never adds words. */
function shortQuote(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_QUOTE_CHARS) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_QUOTE_CHARS).trimEnd()}…`;
}

function priorityRank(priority: InvestigationPriority): number {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

/** Priority sort plus the shared item cap; identical for every pack. */
function capAndSort(items: InvestigationPlanItem[]): InvestigationPlanItem[] {
  items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  return items.slice(0, MAX_PLAN_ITEMS);
}

interface ConcernRoute {
  match: RegExp;
  source_category: OfficialSourceCategory;
  research_question: string;
  why_it_matters: string;
  evidence_required: string;
  priority: InvestigationPriority;
}

// Concern keywords route to the official-source category most likely to
// address them. Questions stay neutral: they ask what official guidance
// says, never whether the poster is guilty of anything.
const GB_CONCERN_ROUTES: ConcernRoute[] = [
  {
    match: /fee|payment|pay.*upfront|deposit|transfer|charge/i,
    source_category: "worker-rights-and-fees",
    research_question:
      "What does official guidance say about fees charged to workers for finding work?",
    why_it_matters:
      "Money paid upfront is hard to recover, so the worker needs to know the official position before paying anything.",
    evidence_required:
      "A written statement of what any requested payment covers, who receives it, and under what terms.",
    priority: "high",
  },
  {
    match: /cash in hand|no payslip|without.*contract|off the books/i,
    source_category: "pay-rates",
    research_question:
      "What pay records and minimum rates does official guidance say workers are entitled to?",
    why_it_matters:
      "Without payslips or a written rate, the worker cannot check whether the pay is lawful.",
    evidence_required:
      "The exact hourly rate, paid hours, and how pay is recorded, in writing.",
    priority: "high",
  },
  {
    match: /passport|document.*(keep|hold|retain)|visa.*(keep|hold)/i,
    source_category: "worker-rights-and-fees",
    research_question:
      "What do workers' rights say about employers holding passports or identity documents?",
    why_it_matters:
      "Keeping a worker's documents limits their freedom to leave, so the official position matters before handing anything over.",
    evidence_required:
      "Written confirmation of which documents are requested, why, and that the worker keeps the originals.",
    priority: "high",
  },
  {
    match: /whatsapp|telegram|social media|personal.*(email|phone)|urgent|immediately|act (now|fast)|guarantee|sure.*visa|no.*(experience|interview)/i,
    source_category: "seasonal-guidance",
    research_question:
      "What does official guidance say workers should check before accepting an offer that arrived this way?",
    why_it_matters:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    evidence_required:
      "The same offer in writing through a verifiable channel, with time to compare it against official guidance.",
    priority: "medium",
  },
];

const GB_FALLBACK_CONCERN_ROUTE: ConcernRoute = {
  match: /.*/i,
  source_category: "seasonal-guidance",
  research_question:
    "What does official guidance say workers should check about this kind of offer?",
  why_it_matters:
    "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
  evidence_required: "A written answer from the poster addressing the quoted detail.",
  priority: "medium",
};

function routeForGBConcern(concern: AnalysisConcern): ConcernRoute {
  const haystack = `${concern.concern} ${concern.evidence}`;
  return GB_CONCERN_ROUTES.find((route) => route.match.test(haystack)) ?? GB_FALLBACK_CONCERN_ROUTE;
}

function gbSourceForMissingItem(item: string): OfficialSourceCategory {
  if (/pay|salary|wage|hour|rate|overtime/i.test(item)) {
    return "pay-rates";
  }
  if (/visa|sponsor|immigration|right to work|permit/i.test(item)) {
    return "visa-route";
  }
  if (/fee|charge|deposit|cost|payment/i.test(item)) {
    return "worker-rights-and-fees";
  }
  return "seasonal-guidance";
}

const SG_CONCERN_ROUTES: ConcernRoute[] = [
  {
    match: /fee|payment|pay.*upfront|deposit|transfer|charge|levy/i,
    source_category: "recruitment-rules",
    research_question:
      "What does the Ministry of Manpower say about fees charged to workers, including pass and levy costs?",
    why_it_matters:
      "Money paid upfront is hard to recover, so the worker needs the official position before paying anything.",
    evidence_required:
      "A written statement of what any requested payment covers, who receives it, and under what terms.",
    priority: "high",
  },
  {
    match: /cash in hand|no payslip|without.*contract|off the books/i,
    source_category: "salary-protection",
    research_question:
      "What pay records does Singapore require, and where do salary disputes go?",
    why_it_matters:
      "Without payslips or a written rate, the worker cannot check the pay or raise a dispute.",
    evidence_required:
      "The exact rate, pay day, and how pay is recorded, in writing.",
    priority: "high",
  },
  {
    match: /passport|document.*(keep|hold|retain)|visa.*(keep|hold)|permit.*(keep|hold)/i,
    source_category: "recruitment-rules",
    research_question:
      "What do Singapore employment rules say about employers holding passports or identity documents?",
    why_it_matters:
      "Keeping a worker's documents limits their freedom to leave, so the official position matters before handing anything over.",
    evidence_required:
      "Written confirmation of which documents are requested, why, and that the worker keeps the originals.",
    priority: "high",
  },
  {
    match: /whatsapp|telegram|social media|personal.*(email|phone)|urgent|immediately|act (now|fast)|guarantee|sure.*visa|no.*(experience|interview)/i,
    source_category: "complaint-channels",
    research_question:
      "Which official channels can check an offer that arrived this way?",
    why_it_matters:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    evidence_required:
      "The same offer in writing through a verifiable channel, with time to compare it against official guidance.",
    priority: "medium",
  },
];

const SG_FALLBACK_CONCERN_ROUTE: ConcernRoute = {
  match: /.*/i,
  source_category: "complaint-channels",
  research_question:
    "Which official channel can check this kind of offer?",
  why_it_matters:
    "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
  evidence_required: "A written answer from the poster addressing the quoted detail.",
  priority: "medium",
};

function routeForSGConcern(concern: AnalysisConcern): ConcernRoute {
  const haystack = `${concern.concern} ${concern.evidence}`;
  return SG_CONCERN_ROUTES.find((route) => route.match.test(haystack)) ?? SG_FALLBACK_CONCERN_ROUTE;
}

function genericSourceForMissingItem(item: string): OfficialSourceCategory {
  if (/pay|salary|wage|hour|rate|overtime/i.test(item)) {
    return "salary-protection";
  }
  if (/visa|sponsor|immigration|permit|pass\b|work pass/i.test(item)) {
    return "work-authorization";
  }
  if (/fee|agency|charge|deposit|cost|payment|levy/i.test(item)) {
    return "recruitment-rules";
  }
  return "complaint-channels";
}

function buildGBItems(
  report: OpportunityReport,
  postingText: string,
  concerns?: AnalysisConcern[],
  missingInformation?: string[],
): InvestigationPlanItem[] {
  const items: InvestigationPlanItem[] = [];
  const seenQuestions = new Set<string>();

  const push = (item: InvestigationPlanItem) => {
    if (seenQuestions.has(item.research_question)) {
      return;
    }
    seenQuestions.add(item.research_question);
    items.push(item);
  };

  const posting = postingText.trim();
  const haystack = `${report.occupation} ${report.salary} ${posting}`;

  if (isSpecified(report.salary)) {
    push({
      claim: `The posting states pay: "${shortQuote(report.salary)}".`,
      category: "explicit-claim",
      research_question:
        "Does the stated pay meet the UK minimum wage for the worker's age and hours?",
      why_it_matters:
        "Underpayment is only visible by comparing the exact rate, hours, and deductions against official rates.",
      source_category: "pay-rates",
      evidence_required:
        "The worker's age, the exact hourly rate, paid hours, and any deductions such as accommodation charges.",
      priority: "medium",
    });
  }

  const seasonalSignals =
    report.employment_type === "seasonal" ||
    /seasonal|farm|crop|fruit|picking|harvest|poultry/i.test(haystack);
  if (seasonalSignals) {
    push({
      claim: "The posting describes seasonal work in the United Kingdom.",
      category: "explicit-claim",
      research_question:
        "What does official guidance say seasonal farm work involves and who can offer it?",
      why_it_matters:
        "Seasonal worker schemes have specific operators and rules; offers outside them need extra scrutiny.",
      source_category: "seasonal-guidance",
      evidence_required:
        "The scheme operator or sponsor name and how the role fits the official seasonal worker route.",
      priority: "medium",
    });
  }

  if (/visa|sponsor|certificate of sponsorship|right to work|overseas/i.test(haystack)) {
    push({
      claim: "The posting touches on visas, sponsorship, or overseas recruitment.",
      category: "research-question",
      research_question:
        "What does the official visa route require of the worker and the sponsor?",
      why_it_matters:
        "Visa routes always involve eligibility checks and a licensed sponsor; vague promises cannot replace them.",
      source_category: "visa-route",
      evidence_required:
        "The named visa route, the sponsor's licence details, and the eligibility criteria in writing.",
      priority: "medium",
    });
  } else if (seasonalSignals) {
    push({
      claim: "The posting describes seasonal work but says nothing specific about visas.",
      category: "missing-information",
      research_question: "Does this seasonal role need a visa, and who sponsors it?",
      why_it_matters:
        "Overseas workers need to know whether a visa is required before travelling; silence on visas leaves that open.",
      source_category: "visa-route",
      evidence_required:
        "A written statement of whether sponsorship is provided and which visa route applies.",
      priority: "medium",
    });
  }

  for (const concern of concerns ?? report.concerns ?? []) {
    const route = routeForGBConcern(concern);
    push({
      claim: `Potential concern ("${shortQuote(concern.concern)}"). Posting text: "${shortQuote(concern.evidence)}".`,
      category: "potential-concern",
      research_question: route.research_question,
      why_it_matters: route.why_it_matters,
      source_category: route.source_category,
      evidence_required: route.evidence_required,
      priority: route.priority,
    });
  }

  for (const item of missingInformation ?? report.missing_information ?? []) {
    if (!isSpecified(item)) {
      continue;
    }
    const quoted = shortQuote(item);
    push({
      claim: `The posting does not state: ${quoted}.`,
      category: "missing-information",
      research_question: `What should the worker confirm about "${quoted}" before agreeing?`,
      why_it_matters:
        "Missing details are unverified, not false — but the worker cannot judge the offer without them.",
      source_category: gbSourceForMissingItem(item),
      evidence_required: `The missing detail in writing from the poster: ${quoted}.`,
      priority: "low",
    });
  }

  return capAndSort(items);
}

function buildSGItems(
  report: OpportunityReport,
  postingText: string,
  concerns?: AnalysisConcern[],
  missingInformation?: string[],
): InvestigationPlanItem[] {
  const items: InvestigationPlanItem[] = [];
  const seenQuestions = new Set<string>();

  const push = (item: InvestigationPlanItem) => {
    if (seenQuestions.has(item.research_question)) {
      return;
    }
    seenQuestions.add(item.research_question);
    items.push(item);
  };

  const posting = postingText.trim();
  const haystack = `${report.occupation} ${report.salary} ${posting}`;

  if (isSpecified(report.salary)) {
    push({
      claim: `The posting states pay: "${shortQuote(report.salary)}".`,
      category: "explicit-claim",
      research_question:
        "Do the stated pay arrangements meet Singapore's salary payment rules?",
      why_it_matters:
        "Pay timing, payslips, and dispute routes decide whether underpayment is visible and recoverable.",
      source_category: "salary-protection",
      evidence_required:
        "The exact rate, pay day, and a sample payslip, in writing.",
      priority: "medium",
    });
  }

  const passSignals =
    /work permit|s pass|spass|employment pass|\bep\b|work pass/i.test(haystack);
  if (passSignals) {
    push({
      claim: "The posting names a Singapore work pass or permit.",
      category: "explicit-claim",
      research_question:
        "Which Singapore work pass applies to this role, and who is responsible for the application?",
      why_it_matters:
        "Each pass has its own eligibility rules and applicant; the wrong pass means the job cannot start.",
      source_category: "work-authorization",
      evidence_required:
        "The pass type and the applicant named in writing.",
      priority: "medium",
    });
  }

  if (/visa|sponsor|certificate|overseas|immigration/i.test(haystack) && !passSignals) {
    push({
      claim: "The posting touches on visas, sponsorship, or overseas recruitment.",
      category: "research-question",
      research_question:
        "What does the official work-pass route require of the worker and the employer?",
      why_it_matters:
        "Work passes always involve eligibility checks and an accountable employer; vague promises cannot replace them.",
      source_category: "work-authorization",
      evidence_required:
        "The named pass, the employer's obligations, and the eligibility criteria in writing.",
      priority: "medium",
    });
  }

  if (ORIGIN_TRIGGER.test(haystack)) {
    push({
      ...ORIGIN_ITEM,
      category: "research-question",
      source_category: "origin-protection",
      priority: "medium",
    });
  }

  for (const concern of concerns ?? report.concerns ?? []) {
    const route = routeForSGConcern(concern);
    push({
      claim: `Potential concern ("${shortQuote(concern.concern)}"). Posting text: "${shortQuote(concern.evidence)}".`,
      category: "potential-concern",
      research_question: route.research_question,
      why_it_matters: route.why_it_matters,
      source_category: route.source_category,
      evidence_required: route.evidence_required,
      priority: route.priority,
    });
  }

  for (const item of missingInformation ?? report.missing_information ?? []) {
    if (!isSpecified(item)) {
      continue;
    }
    const quoted = shortQuote(item);
    push({
      claim: `The posting does not state: ${quoted}.`,
      category: "missing-information",
      research_question: `What should the worker confirm about "${quoted}" before agreeing?`,
      why_it_matters:
        "Missing details are unverified, not false — but the worker cannot judge the offer without them.",
      source_category: genericSourceForMissingItem(item),
      evidence_required: `The missing detail in writing from the poster: ${quoted}.`,
      priority: "low",
    });
  }

  return capAndSort(items);
}

/** Shared origin-protection item for non-GB packs (Indonesian audience). */
const ORIGIN_ITEM = {
  claim: "The posting involves a recruiter, agency, or sponsor.",
  research_question:
    "Is the recruiting agency licensed for Indonesian overseas placement, and what protection applies before departure?",
  why_it_matters:
    "Indonesian workers need a licensed placement channel and pre-departure protection before agreeing to anything.",
  evidence_required:
    "The agency's license status plus the placement paperwork, in writing.",
} as const;

const ORIGIN_TRIGGER = /agency|recruiter|recruitment|sponsor|broker|p3mi/i;

/**
 * Per-destination question pack. Every string is a neutral question or a
 * pointer to official sources — packs state no figures, bans, or legal
 * conclusions, so they cannot go stale or misattribute another country's
 * rules. Authority names below were verified against official pages.
 */
interface PackSpec {
  passPattern: RegExp;
  passClaim: string;
  salaryQuestion: string;
  passQuestion: string;
  passWhy: string;
  passEvidence: string;
  visaQuestion: string;
  visaWhy: string;
  visaEvidence: string;
  feeQuestion: string;
  feeWhy: string;
  feeEvidence: string;
  payRecordQuestion: string;
  payRecordWhy: string;
  payRecordEvidence: string;
  documentQuestion: string;
  documentWhy: string;
  documentEvidence: string;
  channelQuestion: string;
  channelWhy: string;
  channelEvidence: string;
  fallbackQuestion: string;
  fallbackWhy: string;
  fallbackEvidence: string;
}

type GenericPackCode = "JP" | "NZ" | "TW" | "HK" | "MY" | "AU";

const GENERIC_SALARY_WHY =
  "Pay timing, records, and dispute routes decide whether underpayment is visible and recoverable.";
const GENERIC_SALARY_EVIDENCE =
  "The exact rate, pay day, and how pay is recorded, in writing.";
const GENERIC_FEE_WHY =
  "Money paid upfront is hard to recover, so the worker needs the official position before paying anything.";
const GENERIC_FEE_EVIDENCE =
  "A written statement of what any requested payment covers, who receives it, and under what terms.";
const GENERIC_DOCUMENT_WHY =
  "Keeping a worker's documents limits their freedom to leave, so the official position matters before handing anything over.";
const GENERIC_DOCUMENT_EVIDENCE =
  "Written confirmation of which documents are requested, why, and that the worker keeps the originals.";
const GENERIC_CHANNEL_EVIDENCE =
  "The same offer in writing through a verifiable channel, with time to compare it against official guidance.";

const PACK_SPECS: Record<GenericPackCode, PackSpec> = {
  JP: {
    passPattern:
      /specified skilled|\bssw\b|technical intern|\btitp\b|skill development|特定技能|技能実習|育成就労/i,
    passClaim: "The posting names a Japanese work status or program.",
    salaryQuestion:
      "Do the stated pay arrangements meet Japan's employment conditions for foreign workers?",
    passQuestion:
      "Which Japanese work status applies to this role, and who manages the procedure?",
    passWhy:
      "Each status has its own eligibility rules and responsible organization; the wrong status means the job cannot start.",
    passEvidence: "The work status and the managing organization named in writing.",
    visaQuestion:
      "What does the official immigration route require of the worker and the employer?",
    visaWhy:
      "Residence statuses always involve eligibility checks and an accountable employer; vague promises cannot replace them.",
    visaEvidence:
      "The named status, the employer's obligations, and the eligibility criteria in writing.",
    feeQuestion:
      "What do the official Japanese rules say about fees, deposits, or deductions charged to workers?",
    feeWhy: GENERIC_FEE_WHY,
    feeEvidence: GENERIC_FEE_EVIDENCE,
    payRecordQuestion:
      "What pay records and employment conditions apply to this role?",
    payRecordWhy:
      "Without written pay records, the worker cannot check the pay or raise a dispute.",
    payRecordEvidence: GENERIC_SALARY_EVIDENCE,
    documentQuestion:
      "What do Japanese employment rules say about employers holding passports or identity documents?",
    documentWhy: GENERIC_DOCUMENT_WHY,
    documentEvidence: GENERIC_DOCUMENT_EVIDENCE,
    channelQuestion:
      "Which official consultation channel can check an offer that arrived this way?",
    channelWhy:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    channelEvidence: GENERIC_CHANNEL_EVIDENCE,
    fallbackQuestion:
      "Which official consultation channel can check this kind of offer?",
    fallbackWhy:
      "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
    fallbackEvidence:
      "A written answer from the poster addressing the quoted detail.",
  },
  NZ: {
    passPattern: /accredited employer|\baewv\b|\bmepv\b|exploitation protection/i,
    passClaim: "The posting names a New Zealand work visa.",
    salaryQuestion:
      "Do the stated pay arrangements meet New Zealand's minimum employment rights?",
    passQuestion:
      "Does this role use an accredited employer, and what does the visa require?",
    passWhy:
      "Accredited-employer visas tie the worker to eligibility checks and employer duties; vague promises cannot replace them.",
    passEvidence:
      "The visa type and the employer's accreditation named in writing.",
    visaQuestion:
      "What does the official immigration route require of the worker and the employer?",
    visaWhy:
      "Work visas always involve eligibility checks and an accountable employer; vague promises cannot replace them.",
    visaEvidence:
      "The named visa, the employer's obligations, and the eligibility criteria in writing.",
    feeQuestion:
      "What do New Zealand rules say about fees or deductions charged to workers?",
    feeWhy: GENERIC_FEE_WHY,
    feeEvidence: GENERIC_FEE_EVIDENCE,
    payRecordQuestion:
      "What pay records and minimum rights apply to this role?",
    payRecordWhy:
      "Without written pay records, the worker cannot check the pay or raise a dispute.",
    payRecordEvidence: GENERIC_SALARY_EVIDENCE,
    documentQuestion:
      "What do New Zealand employment rules say about employers holding passports or identity documents?",
    documentWhy: GENERIC_DOCUMENT_WHY,
    documentEvidence: GENERIC_DOCUMENT_EVIDENCE,
    channelQuestion:
      "Which official channel can check an offer that arrived this way?",
    channelWhy:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    channelEvidence: GENERIC_CHANNEL_EVIDENCE,
    fallbackQuestion:
      "Which official channel can check this kind of offer?",
    fallbackWhy:
      "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
    fallbackEvidence:
      "A written answer from the poster addressing the quoted detail.",
  },
  TW: {
    passPattern: /broker|brokerage|1955|employment service act|workforce development/i,
    passClaim: "The posting touches on Taiwan's foreign-worker employment system.",
    salaryQuestion:
      "Do the stated pay arrangements meet Taiwan's wage and fee rules?",
    passQuestion:
      "What employment authorization applies to this role, and who arranges it?",
    passWhy:
      "Foreign-worker employment needs official authorization and an accountable employer; vague promises cannot replace them.",
    passEvidence:
      "The authorization type and the arranging employer named in writing.",
    visaQuestion:
      "What does the official employment route require of the worker and the employer?",
    visaWhy:
      "Employment authorization always involves eligibility checks and an accountable employer; vague promises cannot replace them.",
    visaEvidence:
      "The named authorization, the employer's obligations, and the eligibility criteria in writing.",
    feeQuestion:
      "What do Taiwan's rules say about brokerage and service fees charged to workers?",
    feeWhy: GENERIC_FEE_WHY,
    feeEvidence: GENERIC_FEE_EVIDENCE,
    payRecordQuestion:
      "What pay records and wage rules apply to this role?",
    payRecordWhy:
      "Without written pay records, the worker cannot check the pay or report a problem.",
    payRecordEvidence: GENERIC_SALARY_EVIDENCE,
    documentQuestion:
      "What do Taiwan's employment rules say about employers holding passports or identity documents?",
    documentWhy: GENERIC_DOCUMENT_WHY,
    documentEvidence: GENERIC_DOCUMENT_EVIDENCE,
    channelQuestion:
      "Which official complaint channel can check an offer that arrived this way?",
    channelWhy:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    channelEvidence: GENERIC_CHANNEL_EVIDENCE,
    fallbackQuestion:
      "Which official complaint channel can check this kind of offer?",
    fallbackWhy:
      "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
    fallbackEvidence:
      "A written answer from the poster addressing the quoted detail.",
  },
  HK: {
    passPattern: /domestic helper|\bfdh\b|id 407|standard employment contract/i,
    passClaim: "The posting concerns domestic helper employment in Hong Kong.",
    salaryQuestion:
      "Do the stated pay arrangements match the Standard Employment Contract terms?",
    passQuestion:
      "What does the Standard Employment Contract require for this role?",
    passWhy:
      "The prescribed contract sets the enforceable terms; anything outside it needs written clarification.",
    passEvidence:
      "The contract terms, wage, and accommodation arrangements in writing.",
    visaQuestion:
      "What does the official entry route require of the worker and the employer?",
    visaWhy:
      "Employment entry always involves eligibility checks and an accountable employer; vague promises cannot replace them.",
    visaEvidence:
      "The named entry route, the employer's obligations, and the eligibility criteria in writing.",
    feeQuestion:
      "What do Hong Kong rules say about agency commissions and fees charged to workers?",
    feeWhy: GENERIC_FEE_WHY,
    feeEvidence: GENERIC_FEE_EVIDENCE,
    payRecordQuestion:
      "What pay records and contract terms apply to this role?",
    payRecordWhy:
      "Without written pay records, the worker cannot check the pay or raise a dispute.",
    payRecordEvidence: GENERIC_SALARY_EVIDENCE,
    documentQuestion:
      "What do Hong Kong employment rules say about employers holding passports or identity documents?",
    documentWhy: GENERIC_DOCUMENT_WHY,
    documentEvidence: GENERIC_DOCUMENT_EVIDENCE,
    channelQuestion:
      "Which official complaint channel can check an offer that arrived this way?",
    channelWhy:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    channelEvidence: GENERIC_CHANNEL_EVIDENCE,
    fallbackQuestion:
      "Which official complaint channel can check this kind of offer?",
    fallbackWhy:
      "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
    fallbackEvidence:
      "A written answer from the poster addressing the quoted detail.",
  },
  MY: {
    passPattern:
      /\bplks\b|\beplks\b|employment pass|professional visit pass|\bpvp\b|myfuturejobs|xpats/i,
    passClaim: "The posting names a Malaysian pass or hiring channel.",
    salaryQuestion:
      "Do the stated pay arrangements meet Malaysia's employment conditions?",
    passQuestion:
      "Which Malaysian pass or approval applies to this role, and who arranges it?",
    passWhy:
      "Each pass has its own eligibility rules and applicant; the wrong pass means the job cannot start.",
    passEvidence:
      "The pass type and the applicant named in writing.",
    visaQuestion:
      "What does the official hiring route require of the worker and the employer?",
    visaWhy:
      "Foreign-worker hiring always involves approvals and an accountable employer; vague promises cannot replace them.",
    visaEvidence:
      "The named pass or approval, the employer's obligations, and the eligibility criteria in writing.",
    feeQuestion:
      "What do Malaysia's rules say about recruitment fees and employment conditions for foreign workers?",
    feeWhy: GENERIC_FEE_WHY,
    feeEvidence: GENERIC_FEE_EVIDENCE,
    payRecordQuestion:
      "What pay records apply to this role, and where can grievances go?",
    payRecordWhy:
      "Without written pay records, the worker cannot check the pay or use the grievance channel.",
    payRecordEvidence: GENERIC_SALARY_EVIDENCE,
    documentQuestion:
      "What do Malaysia's employment rules say about employers holding passports or identity documents?",
    documentWhy: GENERIC_DOCUMENT_WHY,
    documentEvidence: GENERIC_DOCUMENT_EVIDENCE,
    channelQuestion:
      "Which official grievance channel can check an offer that arrived this way?",
    channelWhy:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    channelEvidence: GENERIC_CHANNEL_EVIDENCE,
    fallbackQuestion:
      "Which official grievance channel can check this kind of offer?",
    fallbackWhy:
      "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
    fallbackEvidence:
      "A written answer from the poster addressing the quoted detail.",
  },
  AU: {
    passPattern: /sponsor|working holiday|skilled visa|border watch|work visa/i,
    passClaim: "The posting touches on Australian sponsorship or work visas.",
    salaryQuestion:
      "Do the stated pay arrangements meet Australia's workplace protections?",
    passQuestion:
      "What sponsorship or visa arrangement applies to this role, and what are the sponsor's obligations?",
    passWhy:
      "Sponsorship ties the worker to eligibility checks and sponsor obligations; vague promises cannot replace them.",
    passEvidence:
      "The arrangement and the sponsor's obligations named in writing.",
    visaQuestion:
      "What does the official visa route require of the worker and the sponsor?",
    visaWhy:
      "Work visas always involve eligibility checks and an accountable sponsor; vague promises cannot replace them.",
    visaEvidence:
      "The named visa, the sponsor's obligations, and the eligibility criteria in writing.",
    feeQuestion:
      "What do Australia's sponsorship rules say about costs recovered from workers?",
    feeWhy: GENERIC_FEE_WHY,
    feeEvidence: GENERIC_FEE_EVIDENCE,
    payRecordQuestion:
      "What pay records and workplace rights apply to this role?",
    payRecordWhy:
      "Without written pay records, the worker cannot check the pay or report a problem.",
    payRecordEvidence: GENERIC_SALARY_EVIDENCE,
    documentQuestion:
      "What do Australia's workplace rules say about employers holding passports or identity documents?",
    documentWhy: GENERIC_DOCUMENT_WHY,
    documentEvidence: GENERIC_DOCUMENT_EVIDENCE,
    channelQuestion:
      "Which official reporting channel can check an offer that arrived this way?",
    channelWhy:
      "Pressure tactics and informal contact channels make independent checks harder, so the worker needs to know which official checks apply.",
    channelEvidence: GENERIC_CHANNEL_EVIDENCE,
    fallbackQuestion:
      "Which official reporting channel can check this kind of offer?",
    fallbackWhy:
      "An unusual detail is a reason to ask questions, not a conclusion — official guidance shows which questions matter.",
    fallbackEvidence:
      "A written answer from the poster addressing the quoted detail.",
  },
};

const GENERIC_CONCERN_MATCHERS: ReadonlyArray<{
  match: RegExp;
  source_category: OfficialSourceCategory;
  pick: (
    spec: PackSpec,
  ) => { research_question: string; why_it_matters: string; evidence_required: string };
  priority: InvestigationPriority;
}> = [
  {
    match: /fee|payment|pay.*upfront|deposit|transfer|charge|levy|deduction/i,
    source_category: "recruitment-rules",
    pick: (spec) => ({
      research_question: spec.feeQuestion,
      why_it_matters: spec.feeWhy,
      evidence_required: spec.feeEvidence,
    }),
    priority: "high",
  },
  {
    match: /cash in hand|no payslip|without.*contract|off the books/i,
    source_category: "salary-protection",
    pick: (spec) => ({
      research_question: spec.payRecordQuestion,
      why_it_matters: spec.payRecordWhy,
      evidence_required: spec.payRecordEvidence,
    }),
    priority: "high",
  },
  {
    match: /passport|document.*(keep|hold|retain)|visa.*(keep|hold)|permit.*(keep|hold)/i,
    source_category: "recruitment-rules",
    pick: (spec) => ({
      research_question: spec.documentQuestion,
      why_it_matters: spec.documentWhy,
      evidence_required: spec.documentEvidence,
    }),
    priority: "high",
  },
  {
    match: /whatsapp|telegram|social media|personal.*(email|phone)|urgent|immediately|act (now|fast)|guarantee|sure.*visa|no.*(experience|interview)/i,
    source_category: "complaint-channels",
    pick: (spec) => ({
      research_question: spec.channelQuestion,
      why_it_matters: spec.channelWhy,
      evidence_required: spec.channelEvidence,
    }),
    priority: "medium",
  },
];

function routeForGenericConcern(spec: PackSpec, concern: AnalysisConcern): ConcernRoute {
  const haystack = `${concern.concern} ${concern.evidence}`;
  const hit = GENERIC_CONCERN_MATCHERS.find((entry) => entry.match.test(haystack));
  if (hit) {
    return { match: hit.match, source_category: hit.source_category, ...hit.pick(spec), priority: hit.priority };
  }
  return {
    match: /.*/i,
    source_category: "complaint-channels",
    research_question: spec.fallbackQuestion,
    why_it_matters: spec.fallbackWhy,
    evidence_required: spec.fallbackEvidence,
    priority: "medium",
  };
}

function buildGenericItems(
  spec: PackSpec,
  report: OpportunityReport,
  postingText: string,
  concerns?: AnalysisConcern[],
  missingInformation?: string[],
): InvestigationPlanItem[] {
  const items: InvestigationPlanItem[] = [];
  const seenQuestions = new Set<string>();

  const push = (item: InvestigationPlanItem) => {
    if (seenQuestions.has(item.research_question)) {
      return;
    }
    seenQuestions.add(item.research_question);
    items.push(item);
  };

  const posting = postingText.trim();
  const haystack = `${report.occupation} ${report.salary} ${posting}`;

  if (isSpecified(report.salary)) {
    push({
      claim: `The posting states pay: "${shortQuote(report.salary)}".`,
      category: "explicit-claim",
      research_question: spec.salaryQuestion,
      why_it_matters: GENERIC_SALARY_WHY,
      source_category: "salary-protection",
      evidence_required: GENERIC_SALARY_EVIDENCE,
      priority: "medium",
    });
  }

  const passSignals = spec.passPattern.test(haystack);
  if (passSignals) {
    push({
      claim: spec.passClaim,
      category: "explicit-claim",
      research_question: spec.passQuestion,
      why_it_matters: spec.passWhy,
      source_category: "work-authorization",
      evidence_required: spec.passEvidence,
      priority: "medium",
    });
  }

  if (/visa|sponsor|certificate|overseas|immigration/i.test(haystack) && !passSignals) {
    push({
      claim: "The posting touches on visas, sponsorship, or overseas recruitment.",
      category: "research-question",
      research_question: spec.visaQuestion,
      why_it_matters: spec.visaWhy,
      source_category: "work-authorization",
      evidence_required: spec.visaEvidence,
      priority: "medium",
    });
  }

  if (ORIGIN_TRIGGER.test(haystack)) {
    push({
      ...ORIGIN_ITEM,
      category: "research-question",
      source_category: "origin-protection",
      priority: "medium",
    });
  }

  for (const concern of concerns ?? report.concerns ?? []) {
    const route = routeForGenericConcern(spec, concern);
    push({
      claim: `Potential concern ("${shortQuote(concern.concern)}"). Posting text: "${shortQuote(concern.evidence)}".`,
      category: "potential-concern",
      research_question: route.research_question,
      why_it_matters: route.why_it_matters,
      source_category: route.source_category,
      evidence_required: route.evidence_required,
      priority: route.priority,
    });
  }

  for (const item of missingInformation ?? report.missing_information ?? []) {
    if (!isSpecified(item)) {
      continue;
    }
    const quoted = shortQuote(item);
    push({
      claim: `The posting does not state: ${quoted}.`,
      category: "missing-information",
      research_question: `What should the worker confirm about "${quoted}" before agreeing?`,
      why_it_matters:
        "Missing details are unverified, not false — but the worker cannot judge the offer without them.",
      source_category: genericSourceForMissingItem(item),
      evidence_required: `The missing detail in writing from the poster: ${quoted}.`,
      priority: "low",
    });
  }

  return capAndSort(items);
}

function normalizeExplicitCode(value: string): CorridorCode | null {
  const upper = value.trim().toUpperCase();
  return upper in CORRIDORS ? (upper as CorridorCode) : null;
}

export function buildInvestigationPlan(
  report: OpportunityReport,
  postingText: string,
  concerns?: AnalysisConcern[],
  missingInformation?: string[],
  destinationCode?: string | null,
): InvestigationPlan {
  let code: CorridorCode | null;
  if (destinationCode != null) {
    // An explicit selection wins; an unknown code plans nothing rather
    // than silently falling back to another country's rules.
    code = normalizeExplicitCode(destinationCode);
    if (code === null) {
      return { corridor: INVESTIGATION_CORRIDOR, items: [] };
    }
  } else {
    code = resolveCorridorCode(report.destination_country);
  }
  if (code === "GB") {
    return {
      corridor: CORRIDORS.GB.displayName,
      items: buildGBItems(report, postingText, concerns, missingInformation),
    };
  }
  if (code === "SG") {
    return {
      corridor: CORRIDORS.SG.displayName,
      items: buildSGItems(report, postingText, concerns, missingInformation),
    };
  }
  if (code !== null && code in PACK_SPECS) {
    const genericCode = code as GenericPackCode;
    return {
      corridor: CORRIDORS[genericCode].displayName,
      items: buildGenericItems(
        PACK_SPECS[genericCode],
        report,
        postingText,
        concerns,
        missingInformation,
      ),
    };
  }
  return { corridor: INVESTIGATION_CORRIDOR, items: [] };
}
