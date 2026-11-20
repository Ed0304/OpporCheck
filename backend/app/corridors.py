"""Per-corridor official-source registry (Phase B internationalization).

Each corridor profile owns its display name, allowed hosts, and approved
source catalog. Only URLs verified with HTTP 200 on 2026-11-19 are listed;
see INTERNATIONALIZATION_RESEARCH_REPORT.md for the verification record.
Retrieval stays HTML-only, so PDF sources (e.g. the UU 18/2017 translation)
are link-out references for the frontend, never retrieval entries here.

The GB profile reuses the original UK constants from official_sources so
existing behavior and tests are unchanged; every other profile adds new
coverage without touching GB.
"""

from __future__ import annotations

from dataclasses import dataclass

from .official_sources import ALLOWLIST, CORRIDOR, ApprovedSource

DEFAULT_PROFILE = "GB"


@dataclass(frozen=True)
class CorridorProfile:
    code: str
    display_name: str
    kind: str  # origin | destination | jurisdiction
    status: str  # sources_verified | partial
    last_reviewed: str | None  # YYYY-MM-DD, None when never live-verified
    languages: tuple[str, ...]
    hosts: tuple[str, ...]
    sources: tuple[ApprovedSource, ...]


def _src(source_id: str, label: str, url: str, category: str) -> ApprovedSource:
    return ApprovedSource(id=source_id, label=label, url=url, category=category)


PROFILES: dict[str, CorridorProfile] = {
    "GB": CorridorProfile(
        code="GB",
        display_name=CORRIDOR,
        kind="destination",
        status="partial",  # code-complete; live page contents never fetched
        last_reviewed=None,
        languages=("en-GB",),
        hosts=("www.gov.uk",),
        sources=tuple(ALLOWLIST),
    ),
    "ID": CorridorProfile(
        code="ID",
        display_name="Indonesia",
        kind="origin",
        status="sources_verified",
        last_reviewed="2026-11-19",
        languages=("id", "en"),
        hosts=(
            "siskop2mi.bp2mi.go.id",
            "jdih.bp2mi.go.id",
            "peraturan.go.id",
            "kemnaker.go.id",
            "kemlu.go.id",
            "peduliwni.kemlu.go.id",
            "safetravel.kemlu.go.id",
            "www.imigrasi.go.id",
            "www.bpjsketenagakerjaan.go.id",
        ),
        sources=(
            _src("id-siskop2mi-portal", "SISKOP2MI migrant-worker portal",
                 "https://siskop2mi.bp2mi.go.id/", "recruitment-rules"),
            _src("id-placement-directory", "Placement actor directory (P3MI)",
                 "https://siskop2mi.bp2mi.go.id/profil/lembaga/list", "recruitment-rules"),
            _src("id-jdih-p2mi", "KP2MI/BP2MI legal library (JDIH)",
                 "https://jdih.bp2mi.go.id/", "origin-protection"),
            _src("id-regulation-database", "National regulation database",
                 "https://peraturan.go.id/", "origin-protection"),
            _src("id-kemnaker", "Ministry of Manpower (Kemnaker)",
                 "https://kemnaker.go.id/", "recruitment-rules"),
            _src("id-kemlu", "Ministry of Foreign Affairs (Kemlu)",
                 "https://kemlu.go.id/", "complaint-channels"),
            _src("id-peduli-wni", "Peduli WNI protection portal",
                 "https://peduliwni.kemlu.go.id/beranda.html", "complaint-channels"),
            _src("id-peduli-wni-complaints", "Peduli WNI case complaints",
                 "https://peduliwni.kemlu.go.id/pengaduan.html", "complaint-channels"),
            _src("id-safe-travel", "Safe Travel (Kemlu)",
                 "https://safetravel.kemlu.go.id/", "origin-protection"),
            _src("id-immigration-passport", "Immigration passport services",
                 "https://www.imigrasi.go.id/", "origin-protection"),
            _src("id-bpjs-pmi", "BPJS employment insurance for PMI",
                 "https://www.bpjsketenagakerjaan.go.id/pekerja-migran-indonesia.html",
                 "origin-protection"),
        ),
    ),
    "MY": CorridorProfile(
        code="MY",
        display_name="Malaysia",
        kind="destination",
        status="partial",  # ministry homepages unreachable; roles cross-verified
        last_reviewed="2026-11-19",
        languages=("ms", "en"),
        hosts=(
            "www.imi.gov.my",
            "imigresen-online.imi.gov.my",
            "esd.imi.gov.my",
            "malaysiavisa.imi.gov.my",
            "xpatsgateway.com.my",
            "fwcms.com.my",
            "myfuturejobs.gov.my",
            "www.workforworkers.com.my",
        ),
        sources=(
            _src("my-immigration", "Immigration Department of Malaysia",
                 "https://www.imi.gov.my/", "work-authorization"),
            _src("my-mypass", "MyPass foreign-worker pass services",
                 "https://imigresen-online.imi.gov.my/", "work-authorization"),
            _src("my-esd", "Expatriate Services Division",
                 "https://esd.imi.gov.my/portal/", "work-authorization"),
            _src("my-esd-approval-rule", "ESD hiring approval requirements",
                 "https://esd.imi.gov.my/portal/latest-news/announcement/announcement-252-eppax-mfj/",
                 "recruitment-rules"),
            _src("my-myvisa", "MYVISA visa facilitation",
                 "https://malaysiavisa.imi.gov.my/", "work-authorization"),
            _src("my-xpats-gateway", "Xpats Gateway hiring platform",
                 "https://xpatsgateway.com.my/", "work-authorization"),
            _src("my-fwcms", "Foreign Workers Centralized Management System",
                 "https://fwcms.com.my/", "recruitment-rules"),
            _src("my-myfuturejobs", "MYFutureJobs employment portal",
                 "https://myfuturejobs.gov.my/", "recruitment-rules"),
            _src("my-workforworkers", "Working for Workers grievance channel",
                 "https://www.workforworkers.com.my/", "complaint-channels"),
        ),
    ),
    "SG": CorridorProfile(
        code="SG",
        display_name="Singapore",
        kind="destination",
        status="sources_verified",
        last_reviewed="2026-11-19",
        languages=("en",),
        hosts=("www.mom.gov.sg", "www.tal.sg"),
        sources=(
            _src("sg-mom", "Ministry of Manpower",
                 "https://www.mom.gov.sg/", "work-authorization"),
            _src("sg-passes-hub", "Work passes overview",
                 "https://www.mom.gov.sg/passes-and-permits", "work-authorization"),
            _src("sg-employment-pass", "Employment Pass key facts",
                 "https://www.mom.gov.sg/passes-and-permits/employment-pass/key-facts",
                 "work-authorization"),
            _src("sg-s-pass", "S Pass key facts",
                 "https://www.mom.gov.sg/passes-and-permits/s-pass/key-facts",
                 "work-authorization"),
            _src("sg-work-permit", "Work Permit key facts",
                 "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/key-facts",
                 "work-authorization"),
            _src("sg-paying-salary", "Salary payment rules",
                 "https://www.mom.gov.sg/employment-practices/salary/paying-salary",
                 "salary-protection"),
            _src("sg-employment-act", "Employment Act",
                 "https://www.mom.gov.sg/employment-practices/employment-act",
                 "salary-protection"),
            _src("sg-ea-licence", "Employment agency licensing",
                 "https://www.mom.gov.sg/employment-agencies/apply-for-a-licence",
                 "recruitment-rules"),
            _src("sg-ea-fee-faq", "Agency fee rules (FAQ)",
                 "https://www.mom.gov.sg/faq/employment-agencies/are-eas-allowed-to-charge-foreign-workers-fees-for-work-pass-renewals",
                 "recruitment-rules"),
            _src("sg-ea-directory", "Agency and personnel search",
                 "https://www.mom.gov.sg/eservices/services/employment-agencies-and-personnel-search",
                 "recruitment-rules"),
            _src("sg-contact", "MOM feedback and enquiries",
                 "https://www.mom.gov.sg/contact-us/", "complaint-channels"),
            _src("sg-contact-phone", "MOM contact numbers",
                 "https://www.mom.gov.sg/contact-us/phone", "complaint-channels"),
            _src("sg-report-infringement", "Report an infringement",
                 "https://www.mom.gov.sg/eservices/services/report-an-infringement",
                 "complaint-channels"),
            _src("sg-tadm-about", "Dispute management (TADM)",
                 "https://www.tal.sg/tadm/about", "complaint-channels"),
            _src("sg-tadm-contact", "TADM contact",
                 "https://www.tal.sg/tadm/contact-us", "complaint-channels"),
        ),
    ),
    "JP": CorridorProfile(
        code="JP",
        display_name="Japan",
        kind="destination",
        status="sources_verified",
        last_reviewed="2026-11-19",
        languages=("ja", "en", "id"),
        hosts=(
            "www.moj.go.jp",
            "www.mhlw.go.jp",
            "www.check-roudou.mhlw.go.jp",
            "www.ssw.go.jp",
            "www.otit.go.jp",
        ),
        sources=(
            _src("jp-isa", "Immigration Services Agency",
                 "https://www.moj.go.jp/isa/", "work-authorization"),
            _src("jp-isa-about", "ISA organization",
                 "https://www.moj.go.jp/isa/about/organization/index.html",
                 "work-authorization"),
            _src("jp-skill-development", "Employment for Skill Development system",
                 "https://www.moj.go.jp/isa/applications/index_00005.html",
                 "work-authorization"),
            _src("jp-fresc", "Residence Support Center (FRESC)",
                 "https://www.moj.go.jp/isa/support/fresc/fresc01.html",
                 "complaint-channels"),
            _src("jp-isa-languages", "ISA multi-language portal",
                 "https://www.moj.go.jp/isa/other_languages.html", "work-authorization"),
            _src("jp-mhlw", "Ministry of Health, Labour and Welfare",
                 "https://www.mhlw.go.jp/", "salary-protection"),
            _src("jp-mhlw-foreign-employment", "Employment policy for foreign workers",
                 "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/gaikokujin/index.html",
                 "salary-protection"),
            _src("jp-mhlw-hotline-en", "Foreign-worker hotlines (English)",
                 "https://www.check-roudou.mhlw.go.jp/soudan/foreigner_eng.html",
                 "complaint-channels"),
            _src("jp-mhlw-hotline-id", "Foreign-worker hotlines (Indonesian)",
                 "https://www.check-roudou.mhlw.go.jp/soudan/foreigner_idn.html",
                 "complaint-channels"),
            _src("jp-ssw-en", "SSW support site (English)",
                 "https://www.ssw.go.jp/en/", "work-authorization"),
            _src("jp-ssw-id", "SSW support site (Indonesian)",
                 "https://www.ssw.go.jp/id/", "work-authorization"),
            _src("jp-ssw-support-center", "Immigration Information Center",
                 "https://www.ssw.go.jp/en/supportcenter/", "complaint-channels"),
            _src("jp-otit", "Technical Intern Training Organization",
                 "https://www.otit.go.jp/", "recruitment-rules"),
            _src("jp-otit-about-en", "About OTIT and TITP (English)",
                 "https://www.otit.go.jp/about_en/index.html", "recruitment-rules"),
            _src("jp-otit-trainee-id", "TITP trainee guidance (Indonesian)",
                 "https://www.otit.go.jp/trainee/btk/", "complaint-channels"),
        ),
    ),
    "AU": CorridorProfile(
        code="AU",
        display_name="Australia",
        kind="destination",
        status="partial",  # FWO/FWC/PALM unverified
        last_reviewed="2026-11-19",
        languages=("en",),
        hosts=(
            "immi.homeaffairs.gov.au",
            "www.abf.gov.au",
            "www.homeaffairs.gov.au",
        ),
        sources=(
            _src("au-work-visas", "Working in Australia (visa hub)",
                 "https://immi.homeaffairs.gov.au/visas/working-in-australia",
                 "work-authorization"),
            _src("au-migrant-help", "Migrant worker help and protections",
                 "https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/migrant-worker-protections/help-reporting-protections-workplace-justice-visa",
                 "complaint-channels"),
            _src("au-migrant-info", "Information for migrant workers",
                 "https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/migrant-worker-protections/information-for-migrant-workers",
                 "complaint-channels"),
            _src("au-sponsor-obligations", "Sponsorship obligations",
                 "https://www.abf.gov.au/about-us/what-we-do/sponsor-sanctions/sponsorship-obligations",
                 "recruitment-rules"),
            _src("au-border-watch", "Border Watch reporting",
                 "https://www.homeaffairs.gov.au/about-us/what-we-do/borderwatch/reporting",
                 "complaint-channels"),
        ),
    ),
    "NZ": CorridorProfile(
        code="NZ",
        display_name="New Zealand",
        kind="destination",
        status="sources_verified",
        last_reviewed="2026-11-19",
        languages=("en", "mi"),
        hosts=(
            "www.immigration.govt.nz",
            "www.employment.govt.nz",
            "gethelp.employment.govt.nz",
        ),
        sources=(
            _src("nz-inz", "Immigration New Zealand",
                 "https://www.immigration.govt.nz/", "work-authorization"),
            _src("nz-employment-nz", "Employment New Zealand",
                 "https://www.employment.govt.nz/", "salary-protection"),
            _src("nz-aewv", "Accredited Employer Work Visa",
                 "https://www.immigration.govt.nz/visas/accredited-employer-work-visa/",
                 "work-authorization"),
            _src("nz-employee-rights", "Employee rights and responsibilities",
                 "https://www.employment.govt.nz/starting-employment/rights-and-responsibilities/employee-rights-and-responsibilities",
                 "salary-protection"),
            _src("nz-exploitation", "Migrant exploitation",
                 "https://www.employment.govt.nz/resolving-problems/migrant-exploitation",
                 "complaint-channels"),
            _src("nz-get-help", "Get Help reporting portal",
                 "https://gethelp.employment.govt.nz/", "complaint-channels"),
            _src("nz-mepv", "Migrant Exploitation Protection Work Visa",
                 "https://www.immigration.govt.nz/visas/migrant-exploitation-protection-work-visa/",
                 "work-authorization"),
            _src("nz-worker-rights", "Rights as a worker from overseas",
                 "https://www.immigration.govt.nz/work/worker-rights/your-rights-as-a-worker-from-overseas/",
                 "salary-protection"),
            _src("nz-rights-translations", "Minimum rights translations",
                 "https://www.employment.govt.nz/starting-employment/rights-and-responsibilities/minimum-rights-of-employees-language-translations",
                 "salary-protection"),
        ),
    ),
    "TW": CorridorProfile(
        code="TW",
        display_name="Taiwan",
        kind="destination",
        status="sources_verified",
        last_reviewed="2026-11-19",
        languages=("en", "zh-Hant", "id", "vi", "th"),
        hosts=(
            "english.mol.gov.tw",
            "www.mol.gov.tw",
            "www.wda.gov.tw",
            "law.moj.gov.tw",
            "fw.wda.gov.tw",
            "www.osha.gov.tw",
        ),
        sources=(
            _src("tw-mol-en", "Ministry of Labor (English)",
                 "https://english.mol.gov.tw/", "salary-protection"),
            _src("tw-mol", "Ministry of Labor (Chinese)",
                 "https://www.mol.gov.tw/", "salary-protection"),
            _src("tw-wda-en", "Workforce Development Agency",
                 "https://www.wda.gov.tw/en/default.aspx", "work-authorization"),
            _src("tw-wda-foreign-workers", "Foreign workers in Taiwan (WDA)",
                 "https://www.wda.gov.tw/en/cl.aspx?n=205", "work-authorization"),
            _src("tw-employment-service-act", "Employment Service Act",
                 "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090001",
                 "work-authorization"),
            _src("tw-permission-regs", "Foreign worker permission regulations",
                 "https://www.wda.gov.tw/en/News_Content.aspx?n=180&s=13928",
                 "work-authorization"),
            _src("tw-fee-standards", "Agency fee standards",
                 "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090028",
                 "recruitment-rules"),
            _src("tw-wage-news", "Wage protection enforcement (WDA)",
                 "https://www.wda.gov.tw/en/News_Content.aspx?n=179&sms=10373&s=13644",
                 "complaint-channels"),
            _src("tw-1955", "1955 labor consultation hotline",
                 "https://fw.wda.gov.tw/wda-employer/home/lazypg?locale=tl",
                 "complaint-channels"),
            _src("tw-osha", "Occupational safety and inspection (OSHA)",
                 "https://www.osha.gov.tw/48783/48784/48785/48789/60957/",
                 "salary-protection"),
        ),
    ),
    "HK": CorridorProfile(
        code="HK",
        display_name="Hong Kong",
        kind="jurisdiction",
        status="sources_verified",
        last_reviewed="2026-11-19",
        languages=("en", "zh-Hant", "zh-Hans", "id"),
        hosts=(
            "www.immd.gov.hk",
            "www.labour.gov.hk",
            "www.eaa.labour.gov.hk",
            "www.fdh.labour.gov.hk",
            "www.gov.hk",
        ),
        sources=(
            _src("hk-immd", "Immigration Department",
                 "https://www.immd.gov.hk/eng/index.html", "work-authorization"),
            _src("hk-id407", "Standard Employment Contract notes (ID 407)",
                 "https://www.immd.gov.hk/eng/forms/forms/fdhcontractterms.html",
                 "salary-protection"),
            _src("hk-fdh-visa", "Foreign domestic helper visa services",
                 "https://www.immd.gov.hk/eng/fdh.html", "work-authorization"),
            _src("hk-labour", "Labour Department",
                 "https://www.labour.gov.hk/eng/index.htm", "salary-protection"),
            _src("hk-eaa", "Employment agency licensing (EAA)",
                 "https://www.eaa.labour.gov.hk/en/looking.html", "recruitment-rules"),
            _src("hk-ea-notes", "Using employment agencies",
                 "https://www.labour.gov.hk/eng/service/content4_5.htm",
                 "recruitment-rules"),
            _src("hk-fdh-portal", "Foreign Domestic Helpers portal",
                 "https://www.fdh.labour.gov.hk/en/home.html", "salary-protection"),
            _src("hk-fdh-guidebook", "Hiring domestic helpers guidebook",
                 "https://www.gov.hk/en/theme/guidebook/employment/family/foreigndomestichelper.htm",
                 "salary-protection"),
            _src("hk-labour-relations", "Labour Relations Division offices",
                 "https://www.labour.gov.hk/eng/tele/lr1.htm", "complaint-channels"),
            _src("hk-complaints", "Comments, enquiries and complaints",
                 "https://www.labour.gov.hk/eng/tele/content.htm", "complaint-channels"),
        ),
    ),
}


def get_profile(code: str | None) -> CorridorProfile:
    """Resolve a corridor code (case-insensitive, None means the GB default).

    Raises ValueError for unknown codes; callers turn that into a 400.
    """
    normalized = (code or DEFAULT_PROFILE).strip().upper()
    try:
        return PROFILES[normalized]
    except KeyError:
        valid = ", ".join(sorted(PROFILES))
        raise ValueError(
            f"Unknown corridor code: {code!r}. Valid: {valid}."
        ) from None


def profile_catalog(code: str | None) -> dict[str, ApprovedSource]:
    """Approved sources for one corridor, keyed by source id."""
    return {source.id: source for source in get_profile(code).sources}


def profile_urls(code: str | None) -> list[str]:
    """Approved source URLs for one corridor (validation set)."""
    return [source.url for source in get_profile(code).sources]


def list_profiles() -> list[dict[str, object]]:
    """Public corridor metadata for GET /api/v1/corridors (no URLs needed)."""
    return [
        {
            "code": profile.code,
            "display_name": profile.display_name,
            "kind": profile.kind,
            "status": profile.status,
            "last_reviewed": profile.last_reviewed,
            "languages": list(profile.languages),
            "source_count": len(profile.sources),
        }
        for profile in PROFILES.values()
    ]


__all__ = [
    "DEFAULT_PROFILE",
    "PROFILES",
    "CorridorProfile",
    "get_profile",
    "list_profiles",
    "profile_catalog",
    "profile_urls",
]
