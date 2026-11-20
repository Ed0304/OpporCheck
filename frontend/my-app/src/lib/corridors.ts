// Corridor profiles: country/jurisdiction metadata for destination-aware
// investigation. Dependency-free (type-only and data-only imports) so unit
// tests can use it without Firebase. ISO 3166-1 alpha-2 codes throughout;
// Hong Kong is a jurisdiction, never labeled a country in UI copy.
//
// Coverage truth lives here: a profile with sources is NOT automatically
// supported end to end. hasPlannerPack marks profiles whose investigation
// planner rules exist; the UI disables evidence investigation elsewhere.

import { UK_GUIDANCE, type GuidanceEntry } from "./guidance";

export type CorridorCode =
  | "GB"
  | "ID"
  | "MY"
  | "SG"
  | "JP"
  | "AU"
  | "NZ"
  | "TW"
  | "HK";

export type CorridorKind = "origin" | "destination" | "jurisdiction";

export type CorridorStatus = "sources_verified" | "partial";

export interface CorridorProfile {
  code: CorridorCode;
  displayName: string;
  kind: CorridorKind;
  status: CorridorStatus;
  /** YYYY-MM-DD of the last source verification, or null when never done. */
  lastReviewed: string | null;
  languages: readonly string[];
  /** BCP-47 locale for dates and formatting. */
  locale: string;
  /** True when planner rules exist for this destination. */
  hasPlannerPack: boolean;
}

export const DEFAULT_CORRIDOR_CODE: CorridorCode = "GB";
export const DEFAULT_ORIGIN_CODE: CorridorCode = "ID";

export const CORRIDORS: Record<CorridorCode, CorridorProfile> = {
  GB: {
    code: "GB",
    displayName: "United Kingdom",
    kind: "destination",
    status: "partial",
    lastReviewed: null,
    languages: ["en-GB"],
    locale: "en-GB",
    hasPlannerPack: true,
  },
  ID: {
    code: "ID",
    displayName: "Indonesia",
    kind: "origin",
    status: "sources_verified",
    lastReviewed: "2026-11-19",
    languages: ["id", "en"],
    locale: "id-ID",
    hasPlannerPack: false,
  },
  MY: {
    code: "MY",
    displayName: "Malaysia",
    kind: "destination",
    status: "partial",
    lastReviewed: "2026-11-19",
    languages: ["ms", "en"],
    locale: "ms-MY",
    hasPlannerPack: true,
  },
  SG: {
    code: "SG",
    displayName: "Singapore",
    kind: "destination",
    status: "sources_verified",
    lastReviewed: "2026-11-19",
    languages: ["en"],
    locale: "en-SG",
    hasPlannerPack: true,
  },
  JP: {
    code: "JP",
    displayName: "Japan",
    kind: "destination",
    status: "sources_verified",
    lastReviewed: "2026-11-19",
    languages: ["ja", "en", "id"],
    locale: "ja-JP",
    hasPlannerPack: true,
  },
  AU: {
    code: "AU",
    displayName: "Australia",
    kind: "destination",
    status: "partial",
    lastReviewed: "2026-11-19",
    languages: ["en"],
    locale: "en-AU",
    hasPlannerPack: true,
  },
  NZ: {
    code: "NZ",
    displayName: "New Zealand",
    kind: "destination",
    status: "sources_verified",
    lastReviewed: "2026-11-19",
    languages: ["en", "mi"],
    locale: "en-NZ",
    hasPlannerPack: true,
  },
  TW: {
    code: "TW",
    displayName: "Taiwan",
    kind: "destination",
    status: "sources_verified",
    lastReviewed: "2026-11-19",
    languages: ["en", "zh-Hant", "id", "vi", "th"],
    locale: "zh-Hant-TW",
    hasPlannerPack: true,
  },
  HK: {
    code: "HK",
    displayName: "Hong Kong",
    kind: "jurisdiction",
    status: "sources_verified",
    lastReviewed: "2026-11-19",
    languages: ["en", "zh-Hant", "zh-Hans", "id"],
    locale: "zh-Hant-HK",
    hasPlannerPack: true,
  },
};

export const STATUS_LABELS: Record<CorridorStatus, string> = {
  sources_verified: "Sources verified",
  partial: "Partial coverage",
};

/** Free-text country names (and UK nations) to corridor codes. */
const COUNTRY_ALIASES: Readonly<Record<string, CorridorCode>> = {
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  indonesia: "ID",
  malaysia: "MY",
  singapore: "SG",
  japan: "JP",
  australia: "AU",
  "new zealand": "NZ",
  taiwan: "TW",
  "hong kong": "HK",
  hongkong: "HK",
};

/**
 * Resolves free text (an AI-extracted destination_country, a pasted label)
 * to a corridor code. Returns null for missing, unspecified, or unknown
 * input — callers must ask the user instead of assuming a destination.
 */
export function resolveCorridorCode(
  value: string | null | undefined,
): CorridorCode | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "not specified" || normalized === "unknown") {
    return null;
  }
  return COUNTRY_ALIASES[normalized] ?? null;
}

/** Locale for formatting dates/numbers for a free-text country name. */
export function localeForCountryName(value: string | null | undefined): string {
  const code = resolveCorridorCode(value);
  return code ? CORRIDORS[code].locale : CORRIDORS[DEFAULT_CORRIDOR_CODE].locale;
}

export const SG_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Work passes",
    url: "https://www.mom.gov.sg/passes-and-permits",
    publisher: "Ministry of Manpower",
    country: "Singapore",
    summary:
      "Which work pass applies to a role: Employment Pass, S Pass, and Work Permit.",
    reviewed: "November 2026",
  },
  {
    title: "Salary payment rules",
    url: "https://www.mom.gov.sg/employment-practices/salary/paying-salary",
    publisher: "Ministry of Manpower",
    country: "Singapore",
    summary:
      "Pay timing, payslips, and where salary disputes go (TADM mediation).",
    reviewed: "November 2026",
  },
  {
    title: "Employment agency fees",
    url: "https://www.mom.gov.sg/faq/employment-agencies/are-eas-allowed-to-charge-foreign-workers-fees-for-work-pass-renewals",
    publisher: "Ministry of Manpower",
    country: "Singapore",
    summary:
      "What agencies may charge, who bears pass and levy costs, and how to report overcharging.",
    reviewed: "November 2026",
  },
  {
    title: "Report an infringement",
    url: "https://www.mom.gov.sg/eservices/services/report-an-infringement",
    publisher: "Ministry of Manpower",
    country: "Singapore",
    summary:
      "Official channel for reporting employment violations, including migrant-worker cases.",
    reviewed: "November 2026",
  },
];

export const ID_GUIDANCE: GuidanceEntry[] = [
  {
    title: "SISKOP2MI migrant-worker portal",
    url: "https://siskop2mi.bp2mi.go.id/",
    publisher: "KP2MI/BP2MI",
    country: "Indonesia",
    summary:
      "Placement services, procedures, and contract information for Indonesian migrant workers.",
    reviewed: "November 2026",
  },
  {
    title: "Placement actor directory (P3MI)",
    url: "https://siskop2mi.bp2mi.go.id/profil/lembaga/list",
    publisher: "KP2MI/BP2MI",
    country: "Indonesia",
    summary: "Check whether a recruitment agency is a licensed placement actor.",
    reviewed: "November 2026",
  },
  {
    title: "Peduli WNI case complaints",
    url: "https://peduliwni.kemlu.go.id/pengaduan.html",
    publisher: "Ministry of Foreign Affairs",
    country: "Indonesia",
    summary:
      "File and track protection cases for Indonesians abroad, including migrant workers.",
    reviewed: "November 2026",
  },
  {
    title: "Migrant worker protection law (UU 18/2017, English)",
    url: "https://peraturan.go.id/files2/uu-no-18-tahun-2017_terjemah.pdf",
    publisher: "Ministry of Law",
    country: "Indonesia",
    summary:
      "Official English translation of the law on protecting Indonesian migrant workers.",
    reviewed: "November 2026",
  },
];

export const MY_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Immigration Department of Malaysia",
    url: "https://www.imi.gov.my/",
    publisher: "Jabatan Imigresen Malaysia",
    country: "Malaysia",
    summary: "Passports, visas, and foreign-worker pass services.",
    reviewed: "November 2026",
  },
  {
    title: "Expatriate Services Division",
    url: "https://esd.imi.gov.my/portal/",
    publisher: "Jabatan Imigresen Malaysia",
    country: "Malaysia",
    summary: "Employment Pass and Professional Visit Pass applications for hiring companies.",
    reviewed: "November 2026",
  },
  {
    title: "MYFutureJobs",
    url: "https://myfuturejobs.gov.my/",
    publisher: "PERKESO",
    country: "Malaysia",
    summary: "National employment portal used in the foreign-worker hiring process.",
    reviewed: "November 2026",
  },
  {
    title: "Working for Workers grievance channel",
    url: "https://www.workforworkers.com.my/",
    publisher: "Kementerian Sumber Manusia",
    country: "Malaysia",
    summary: "Official grievance channel for local and foreign employees in Malaysia.",
    reviewed: "November 2026",
  },
];

export const JP_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Specified Skilled Worker support site",
    url: "https://www.ssw.go.jp/en/",
    publisher: "Immigration Services Agency",
    country: "Japan",
    summary: "Specified Skilled Worker system, tests, and procedures (multilingual).",
    reviewed: "November 2026",
  },
  {
    title: "Foreign-worker hotlines (Indonesian)",
    url: "https://www.check-roudou.mhlw.go.jp/soudan/foreigner_idn.html",
    publisher: "Ministry of Health, Labour and Welfare",
    country: "Japan",
    summary: "Telephone consultation service for foreign workers, in Bahasa Indonesia.",
    reviewed: "November 2026",
  },
  {
    title: "Technical Intern Training Organization",
    url: "https://www.otit.go.jp/",
    publisher: "OTIT",
    country: "Japan",
    summary: "Technical Intern Training Program administration and trainee consultation.",
    reviewed: "November 2026",
  },
  {
    title: "Employment for Skill Development system",
    url: "https://www.moj.go.jp/isa/applications/index_00005.html",
    publisher: "Immigration Services Agency",
    country: "Japan",
    summary: "Successor framework information alongside SSW and TITP pages.",
    reviewed: "November 2026",
  },
];

export const AU_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Working in Australia (visa hub)",
    url: "https://immi.homeaffairs.gov.au/visas/working-in-australia",
    publisher: "Department of Home Affairs",
    country: "Australia",
    summary: "Which visa suits the work you intend to do in Australia.",
    reviewed: "November 2026",
  },
  {
    title: "Migrant worker help and protections",
    url: "https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/migrant-worker-protections/help-reporting-protections-workplace-justice-visa",
    publisher: "Department of Home Affairs",
    country: "Australia",
    summary: "Advice, reporting options, and protections for migrant workers.",
    reviewed: "November 2026",
  },
  {
    title: "Border Watch reporting",
    url: "https://www.homeaffairs.gov.au/about-us/what-we-do/borderwatch/reporting",
    publisher: "Department of Home Affairs",
    country: "Australia",
    summary: "Report worker exploitation and sponsorship or visa breaches.",
    reviewed: "November 2026",
  },
];

export const NZ_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Accredited Employer Work Visa",
    url: "https://www.immigration.govt.nz/visas/accredited-employer-work-visa/",
    publisher: "Immigration New Zealand",
    country: "New Zealand",
    summary: "Main temporary work visa: accredited employers, hours, and duration.",
    reviewed: "November 2026",
  },
  {
    title: "Migrant Exploitation Protection Work Visa",
    url: "https://www.immigration.govt.nz/visas/migrant-exploitation-protection-work-visa/",
    publisher: "Immigration New Zealand",
    country: "New Zealand",
    summary: "Leave an exploitative job on an open work visa while a report is assessed.",
    reviewed: "November 2026",
  },
  {
    title: "Get Help reporting portal",
    url: "https://gethelp.employment.govt.nz/",
    publisher: "Employment New Zealand",
    country: "New Zealand",
    summary: "Report employment breaches or migrant exploitation, with interpreters.",
    reviewed: "November 2026",
  },
  {
    title: "Minimum rights translations",
    url: "https://www.employment.govt.nz/starting-employment/rights-and-responsibilities/minimum-rights-of-employees-language-translations",
    publisher: "Employment New Zealand",
    country: "New Zealand",
    summary: "Know-your-rights quick guides in several languages (PDF).",
    reviewed: "November 2026",
  },
];

export const TW_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Foreign workers in Taiwan (WDA)",
    url: "https://www.wda.gov.tw/en/cl.aspx?n=205",
    publisher: "Workforce Development Agency",
    country: "Taiwan",
    summary: "Employment information and permits for foreign blue-collar workers.",
    reviewed: "November 2026",
  },
  {
    title: "Employment Service Act",
    url: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090001",
    publisher: "Ministry of Justice Laws Database",
    country: "Taiwan",
    summary: "Governing statute for employment services and foreign-worker hiring.",
    reviewed: "November 2026",
  },
  {
    title: "Agency fee standards",
    url: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090028",
    publisher: "Ministry of Justice Laws Database",
    country: "Taiwan",
    summary: "Caps on registration, placement, and service fees agencies may charge.",
    reviewed: "November 2026",
  },
  {
    title: "1955 labor consultation hotline",
    url: "https://fw.wda.gov.tw/wda-employer/home/lazypg?locale=tl",
    publisher: "Workforce Development Agency",
    country: "Taiwan",
    summary: "24/7 multilingual consultation and complaint referral for foreign workers.",
    reviewed: "November 2026",
  },
];

export const HK_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Standard Employment Contract notes (ID 407)",
    url: "https://www.immd.gov.hk/eng/forms/forms/fdhcontractterms.html",
    publisher: "Immigration Department",
    country: "Hong Kong",
    summary: "Terms of the prescribed domestic helper employment contract.",
    reviewed: "November 2026",
  },
  {
    title: "Employment agency licensing (EAA)",
    url: "https://www.eaa.labour.gov.hk/en/looking.html",
    publisher: "Labour Department",
    country: "Hong Kong",
    summary: "Licensing rules, commission caps, and offence reporting for agencies.",
    reviewed: "November 2026",
  },
  {
    title: "Foreign Domestic Helpers portal",
    url: "https://www.fdh.labour.gov.hk/en/home.html",
    publisher: "Labour Department",
    country: "Hong Kong",
    summary: "Helper policy, rights, and free consultation and conciliation (13 languages).",
    reviewed: "November 2026",
  },
  {
    title: "Comments, enquiries and complaints",
    url: "https://www.labour.gov.hk/eng/tele/content.htm",
    publisher: "Labour Department",
    country: "Hong Kong",
    summary: "Hotlines for helper, wage, insurance, and safety complaints.",
    reviewed: "November 2026",
  },
];

/** Curated guidance lists per profile; empty means link-outs not yet added. */
export const GUIDANCE_BY_PROFILE: Record<CorridorCode, GuidanceEntry[]> = {
  GB: UK_GUIDANCE,
  ID: ID_GUIDANCE,
  MY: MY_GUIDANCE,
  SG: SG_GUIDANCE,
  JP: JP_GUIDANCE,
  AU: AU_GUIDANCE,
  NZ: NZ_GUIDANCE,
  TW: TW_GUIDANCE,
  HK: HK_GUIDANCE,
};
