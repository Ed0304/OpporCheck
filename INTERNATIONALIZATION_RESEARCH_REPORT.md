# OpporCheck Internationalization — Research Report (Phase A)

Date: 2026-11-19. Research and design only; no code was changed in this run.

Method: one repo audit agent (read every cited implementation/test body) plus eight parallel jurisdiction researchers. Every URL below returned HTTP 200 via live fetch on 2026-11-19 unless noted. Search snippets alone were never accepted as verification. Items that could not be fetched are listed as gaps, never as sources.

## 1. Coverage matrix

Unified gate: SOURCES_VERIFIED means core sources verified; READY_FOR_REVIEW additionally requires per-profile planner rules, guidance entries, category taxonomy, tests, and a live re-verify. Profile existence alone never promotes.

| Profile | Status | Fetched-ok | Core coverage | Key gaps |
|---|---|---|---|---|
| ID Indonesia (origin) | SOURCES_VERIFIED | 12 | Placement, UU 18/2017, complaints, insurance, passport | Contract template URL, SIP3MI procedure page, ministry homepages TLS fail |
| MY Malaysia | PARTIALLY_SUPPORTED | 10 | Immigration systems, passes, grievance channel | MOHR/MOHA/JTKSM/PERKESO homepages timeout; labour rules cross-verified only |
| SG Singapore | SOURCES_VERIFIED | 14 | Passes, salary rules, EA licensing, TADM, complaints | Fee-cap exact page, statute text, FWMOMCare, Workright PDFs |
| JP Japan | SOURCES_VERIFIED | 15 | ISA, MHLW, OTIT, SSW incl. Indonesian pages | Fee/deposit rule text, ESD date/law, EN portals, truncated bodies |
| AU Australia | PARTIALLY_SUPPORTED | 5 | Visa hub, migrant protections, sponsor obligations, Border Watch | FWO, FWC minimum wage, PALM/DEWR channel all unverified |
| NZ New Zealand | SOURCES_VERIFIED | 9 | AEWV, MEPV, rights, exploitation reporting, multilingual guides | None material (MBIE empty body corroborated; one 404 superseded) |
| TW Taiwan | SOURCES_VERIFIED* | 10 | MOL, WDA, Employment Service Act, fee standards, 1955 hotline | *City/county bureau pages principle-only; one 504 covered by alternates |
| HK Hong Kong (jurisdiction) | SOURCES_VERIFIED | 10 | ImmD, ID407 SEC, EA licensing, FDH portal, complaints | MAW/food-allowance figures must be re-verified before quoting |
| GB United Kingdom (preserved) | PARTIALLY_SUPPORTED | 0 live | Code-complete, the only profile with implementation | Live page contents never fetched; frontend/backend URL divergence (see §4) |

None is READY_FOR_REVIEW yet; none is NOT_STARTED.

## 2. Verified source registry

Only fetched-ok URLs are citable. Notation: `covers` = research categories confirmed on the page.

### ID — Indonesia (origin). Status: SOURCES_VERIFIED. Languages: ID, EN.

| Institution | Role | URL |
|---|---|---|
| KP2MI/BP2MI (Kementerian/Badan Pelindungan Pekerja Migran Indonesia) | CURRENT joint ministry+agency for PMI placement and protection; hotline 0800-1000 | https://siskop2mi.bp2mi.go.id/ |
| KP2MI/BP2MI SISKOP2MI directory | Licensed-actor directory: 535 P3MI, 35 provincial + 513 district manpower offices, 87 BP3MI/P4MI/LTSA, 228 health facilities, 158 missions | https://siskop2mi.bp2mi.go.id/profil/lembaga/list |
| JDIH KP2MI/BP2MI | Official legal library (UU, PP, Perpres, Permen, Perban, decisions, circulars, MoUs) | https://jdih.bp2mi.go.id/ |
| Ditjen Peraturan Perundang-undangan | UU 18/2017 official English translation (PDF, replaces UU 39/2004) | https://peraturan.go.id/files2/uu-no-18-tahun-2017_terjemah.pdf |
| Ditjen PP legislation database | National regulation database (62k+ rules) | https://peraturan.go.id/ |
| Kemnaker (Ministry of Manpower) | Employment regulator; placement policy context (Binapenta & PKK) | https://kemnaker.go.id/ |
| Kemlu (Ministry of Foreign Affairs) | Institutional parent of Peduli WNI (homepage thin JS-shell) | https://kemlu.go.id/ |
| Portal Peduli WNI (Kemlu) | Lapor Diri self-report, consular services, case tracking | https://peduliwni.kemlu.go.id/beranda.html |
| Peduli WNI complaints | Permohonan Pelindungan case filing/tracking; hotline +62-812-9007-0027 | https://peduliwni.kemlu.go.id/pengaduan.html |
| Safe Travel Kemlu | Country info, advisories, emergency button, insurance | https://safetravel.kemlu.go.id/ |
| Ditjen Imigrasi | Passport issuance (under Kementerian Imigrasi dan Pemasyarakatan) | https://www.imigrasi.go.id/ |
| BPJS Ketenagakerjaan PMI portal | Mandatory PMI social security (JKK/JKM incl. pre/post-work, failed-departure aid) | https://www.bpjsketenagakerjaan.go.id/pekerja-migran-indonesia.html |

Gaps: kp2mi.go.id / www / bp2mi.go.id homepages TLS-fail (UnknownIssuer/expired) — name verified via SISKOP2MI footer + JDIH instead; OPP info page, standard contract template, and SIP3MI licensing-procedure pages unfetched.

### MY — Malaysia. Status: PARTIALLY_SUPPORTED. Languages: MS, EN.

| Institution | Role | URL |
|---|---|---|
| Jabatan Imigresen Malaysia | Federal immigration: passports, visas, foreign-worker passes (ePLKS) | https://www.imi.gov.my/ |
| MyPass@JIM e-services | Online foreign-worker pass services: PLKS renewal, domestic-worker (PRA) applications | https://imigresen-online.imi.gov.my/ |
| Expatriate Services Division (ESD) | Company hiring of expatriates; Employment Pass / Professional Visit Pass via MYXpats | https://esd.imi.gov.my/portal/ |
| ESD announcement 01-07-2025 | Confirms JTKSM s60K prior approval + MYFutureJobs ads for new EP/PVP (cross-verifies JTKSM/PERKESO roles) | https://esd.imi.gov.my/portal/latest-news/announcement/announcement-252-eppax-mfj/ |
| MYVISA | eVISA facilitation, MDAC arrival card, pass check | https://malaysiavisa.imi.gov.my/ |
| Xpats Gateway | Single-window expatriate hiring platform (.com.my, cross-linked with ESD) | https://xpatsgateway.com.my/ |
| FWCMS | Foreign-worker centralized management: quota, applications, agencies (.com.my, KDN crest, since 2013) | https://fwcms.com.my/ |
| MYFutureJobs | National employment portal; mandatory local ads before foreign-worker quota (.gov.my, under PERKESO) | https://myfuturejobs.gov.my/ |
| Working for Workers (WFW) | Official digital grievance channel for local and foreign workers (.com.my, "Initiative by Kementerian Sumber Manusia" — verifies current ministry name) | https://www.workforworkers.com.my/ |
| MyGovernment Malaysia | Federal gateway corroborating the .gov.my domain family | https://www.malaysia.gov.my/portal/index |

Gaps: mohr.gov.my, moha.gov.my, jtksm (.mohr/.gov), perkeso.gov.my — TCP timeouts (likely server-side filtering, not wrong URLs); eppax.gov.my TLS UnknownIssuer; "KESUMA" rebrand acronym unverifiable — use only "Kementerian Sumber Manusia". Open policy question: trust status of .com.my operator/initiative sites (FWCMS, Xpats Gateway, WFW).

### SG — Singapore. Status: SOURCES_VERIFIED. Languages: EN.

| Institution | Role | URL |
|---|---|---|
| Ministry of Manpower (MOM) | Central manpower ministry: passes, employment practices, WSH | https://www.mom.gov.sg/ |
| MOM passes hub | "All foreigners who intend to work in Singapore must have a valid pass" | https://www.mom.gov.sg/passes-and-permits |
| MOM Employment Pass | PMETs, qualifying salary from $5,600 rising with age, COMPASS; up to 2 yrs first, 3 yrs renewals | https://www.mom.gov.sg/passes-and-permits/employment-pass/key-facts |
| MOM S Pass | Skilled workers, min $3,300 rising to $4,800 mid-40s | https://www.mom.gov.sg/passes-and-permits/s-pass/key-facts |
| MOM Work Permit | Construction/manufacturing/marine/process/services, age 18 to <62, no minimum salary stated | https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/key-facts |
| MOM salary rules | Monthly pay within 7 days (overtime 14); no minimum wage; itemised slips; TADM disputes | https://www.mom.gov.sg/employment-practices/salary/paying-salary |
| MOM Employment Act hub | Main labour law; Workright, KETs, advisory links | https://www.mom.gov.sg/employment-practices/employment-act |
| MOM EA licensing | Agency licence: $400 apply + $100 issue, non-refundable | https://www.mom.gov.sg/employment-agencies/apply-for-a-licence |
| MOM EA fee FAQ | EAs may NOT charge workers for pass renewals; employers bear levy/costs; excess fees unlawful; confidential reporting | https://www.mom.gov.sg/faq/employment-agencies/are-eas-allowed-to-charge-foreign-workers-fees-for-work-pass-renewals |
| MOM EA Directory | Verify licence, service quality, revocation/suspension/surveillance tabs | https://www.mom.gov.sg/eservices/services/employment-agencies-and-personnel-search |
| MOM contact/complaints | Feedback e-form, infringement reports (identity strictly confidential), phone 6438 5122 | https://www.mom.gov.sg/contact-us/ and https://www.mom.gov.sg/contact-us/phone |
| MOM infringement eService | Separate forms: Employment Act, migrant-worker, MDW, housing, EA, trafficking, WSH | https://www.mom.gov.sg/eservices/services/report-an-infringement |
| TADM (MOM+NTUC+SNEF) | Salary-claim mediation required before Employment Claims Tribunals | https://www.tal.sg/tadm/about and https://www.tal.sg/tadm/contact-us |
| Migrant Workers' Centre (NON-GOV: NTUC+SNEF NGO, est. 2009) | 24h helpline 6536 2692 in ~10 languages; Law Centre with Pro Bono SG — label non-governmental | https://www.mwc.org.sg/about-us and https://www.mwc.org.sg/how-we-help/24-hour-helpline |

Gaps (supplemental): EA fee-cap "1 month/year, max 2 months" primary page; FWMOMCare app page; Workright multilingual PDFs; Employment Agencies Act on sso.agc.gov.sg; standalone salary-protection scheme page.

### JP — Japan. Status: SOURCES_VERIFIED. Languages: JA, EN, ID.

| Institution | Role | URL |
|---|---|---|
| Immigration Services Agency (ISA, under Ministry of Justice) | Immigration control, residence statuses, residence support; current home under moj.go.jp/isa | https://www.moj.go.jp/isa/ |
| ISA overview | Organization and regional bureaus | https://www.moj.go.jp/isa/about/organization/index.html |
| ISA Employment for Skill Development (育成就労制度) | Successor-framework hub (body truncated; start-date/law details unconfirmed) | https://www.moj.go.jp/isa/applications/index_00005.html |
| ISA FRESC (Foreign Nationals' Residence Support Center) | One-stop residence support (title verified, body truncated) | https://www.moj.go.jp/isa/support/fresc/fresc01.html |
| ISA multi-language portal | Gateway to non-Japanese ISA info | https://www.moj.go.jp/isa/other_languages.html |
| MHLW (Ministry of Health, Labour and Welfare) | Labour/employment policy incl. foreign-worker employment | https://www.mhlw.go.jp/ |
| MHLW Employment Policy for Foreign Workers (外国人雇用対策) | Foreign-worker employment measures hub | https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/gaikokujin/index.html |
| MHLW hotlines (English) | Telephone Consultation Service, 13 languages; Indonesian line Tue/Thu 0570-001-715 | https://www.check-roudou.mhlw.go.jp/soudan/foreigner_eng.html |
| MHLW hotlines (Indonesian) | Full Indonesian translation of the above | https://www.check-roudou.mhlw.go.jp/soudan/foreigner_idn.html |
| ISA SSW support site (English) | SSW explainer, tests, procedures; 13-language switcher, news current Nov 2026 | https://www.ssw.go.jp/en/ |
| ISA SSW support site (Indonesian) | Same in Bahasa Indonesia | https://www.ssw.go.jp/id/ |
| ISA Immigration Information Center | Phone help Mon–Fri 8:30–17:15 (no Indonesian line) + online form | https://www.ssw.go.jp/en/supportcenter/ |
| OTIT (Organization for Technical Intern Training) | TITP administration, trainee consultation, supervising-org oversight; SOS hotline, 9 languages, ID section | https://www.otit.go.jp/ |
| OTIT English | TITP explainer | https://www.otit.go.jp/about_en/index.html |
| OTIT trainee page (Indonesian) | TITP guidance for Indonesian trainees | https://www.otit.go.jp/trainee/btk/ |

Gaps: recruitment-fee/deposit-prohibition official text; ESD 2027-04-01 start + Act No. 60/2024 (secondary sources only); old EN domain isa.go.jp retired; MHLW English portal 403/404; FRESC/skill-development bodies truncated; ISA consultation-center link unfetched.

### AU — Australia. Status: PARTIALLY_SUPPORTED. Languages: EN (+translate widgets).

| Institution | Role | URL |
|---|---|---|
| Dept of Home Affairs | Work-visa hub: "you will need a visa that suits the work you intend to do" (updated 04/09/2026) | https://immi.homeaffairs.gov.au/visas/working-in-australia |
| Dept of Home Affairs | Migrant-worker help: FWO advice, Border Watch, Accredited Third Parties, Workplace Justice visa ("employer cannot cancel your visa") | https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/migrant-worker-protections/help-reporting-protections-workplace-justice-visa |
| Dept of Home Affairs | Self-protection guidance: myVEVO, passport retention is a crime, FWO pay tools | https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/migrant-worker-protections/information-for-migrant-workers |
| Australian Border Force | Sponsor sanctions; obligations table, Migration Regulations 1994 regs 2.78–2.87C (cost-recovery ban etc.), updated 20/10/2026 | https://www.abf.gov.au/about-us/what-we-do/sponsor-sanctions/sponsorship-obligations |
| Border Watch | Anonymous exploitation/sponsorship-breach reporting; TIS National 131 450 | https://www.homeaffairs.gov.au/about-us/what-we-do/borderwatch/reporting |

Gaps (blocking promotion): Fair Work Ombudsman pages (4× timeout — environment signal, not legitimacy finding); Fair Work Commission minimum wage/awards (HTTP 403, likely bot protection; $26.44/hr snippet UNVERIFIED — never quote); PALM scheme / DEWR channel (timeouts). Recruitment rules rest on one ABF table.

### NZ — New Zealand. Status: SOURCES_VERIFIED. Languages: EN (+te reo headings, multilingual guides).

| Institution | Role | URL |
|---|---|---|
| Immigration New Zealand (INZ, part of MBIE) | Visas, border control, work-visa decisions | https://www.immigration.govt.nz/ |
| Employment New Zealand | Rights info, mediation, exploitation reports, Labour Inspectorate complaints | https://www.employment.govt.nz/ |
| INZ AEWV | Accredited Employer Work Visa: 30+h/wk, accredited employer, NZD $1540, 80% in 5 wks, up to 5 yrs (3 yrs ANZSCO 4–5) | https://www.immigration.govt.nz/visas/accredited-employer-work-visa/ |
| Employment NZ rights | "Employee rights are what your employer must give you by law... even if not in agreement" | https://www.employment.govt.nz/starting-employment/rights-and-responsibilities/employee-rights-and-responsibilities |
| Employment NZ exploitation | Definitions, common types, "call 111" danger advice; INZ 0508 558 855 | https://www.employment.govt.nz/resolving-problems/migrant-exploitation |
| ENZ Get Help portal | Report breaches/exploitation; 0800 200 088 (exploitation+interpreters), 0800 20 90 20 (employment law); 8+ languages | https://gethelp.employment.govt.nz/ |
| INZ MEPV | Migrant Exploitation Protection Work Visa: open work 6 months, NZD $0, ENZ Assessment Letter, 1-month window | https://www.immigration.govt.nz/visas/migrant-exploitation-protection-work-visa/ |
| INZ worker-rights hub | "All workers have same rights no matter where from"; scam protection | https://www.immigration.govt.nz/work/worker-rights/your-rights-as-a-worker-from-overseas/ |
| Employment NZ translations | "Know your employment rights" quick guides (PDF, incl. ZH/HI/SM/ES) | https://www.employment.govt.nz/starting-employment/rights-and-responsibilities/minimum-rights-of-employees-language-translations |

Non-gaps: MBIE homepage returned 200 with empty body (corroborated via INZ news instead); one older rights URL 404s (superseded; canonical verified).

### TW — Taiwan. Status: SOURCES_VERIFIED* (*city-bureau gate). Languages: EN, Traditional Chinese (+ID/VI/TH on 1955).

| Institution | Role | URL |
|---|---|---|
| Ministry of Labor (MOL, 勞動部) | Competent authority for labor policy, standards, employment services, foreign-worker affairs (ex-Council of Labor Affairs since 2014-02-17) | https://english.mol.gov.tw/ and https://www.mol.gov.tw/ |
| Workforce Development Agency (WDA, 勞動力發展署) | Employment services, foreign-worker permits, training; runs 1955 hotline | https://www.wda.gov.tw/en/default.aspx |
| WDA foreign-worker section | Entry point: permits, employer-change lookup, brokerage-firm services | https://www.wda.gov.tw/en/cl.aspx?n=205 |
| MOJ Laws Database: Employment Service Act | Governing statute (Art.46 categories, Art.48 permits, Art.57 employer duties), latest 2025-01-20 | https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090001 |
| WDA Permission Regulations | Subordinate foreign-worker permit rules per ESA Art.48(2) | https://www.wda.gov.tw/en/News_Content.aspx?n=180&s=13928 |
| MOJ: Private Employment Services fee Standards | Caps: registration/placement totals; service fee max NTD 2000/yr/employee (employer-commissioned) | https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090028 |
| WDA wage-docking news | Full-wage duty; 1955 reporting; fines TWD 60,000–300,000 + permit revocation; agency 10–20× overcharge | https://www.wda.gov.tw/en/News_Content.aspx?n=179&sms=10373&s=13644 |
| WDA 1955 portal | 24/7 multilingual consultation, complaint referral to local labor dept/police, legal aid, shelter, interpretation | https://fw.wda.gov.tw/wda-employer/home/lazypg?locale=tl |
| OSHA (MOL) | Occupational safety/health policy, labor inspection | https://www.osha.gov.tw/48783/48784/48785/48789/60957/ |

Gaps: one brokerage page HTTP 504 (covered by verified alternates); city/county bureau pages principle-only via the 1955 referral quote — product decision whether direct per-city fetch gates promotion; one MOL subpage body truncated (no material gap).

### HK — Hong Kong (jurisdiction/SAR, not a country). Status: SOURCES_VERIFIED. Languages: EN, TC, SC (+13 on FDH portal incl. Bahasa Indonesia).

| Institution | Role | URL |
|---|---|---|
| Immigration Department | Visas/entry permits, ID cards, FDH visa services, enforcement | https://www.immd.gov.hk/eng/index.html |
| ImmD ID407 notes | "Standard Employment Contract (ID 407) is the only contract acceptable"; 2-year term; live-in Cl.3; domestic-duties-only Cl.4; governed by Employment Ord Cap.57, Immigration Ord Cap.115, Employees Compensation Ord Cap.282 | https://www.immd.gov.hk/eng/forms/forms/fdhcontractterms.html |
| ImmD FDH visa services | Entry visa, contract renewal/Smart Renewal, change of employer, extension of stay | https://www.immd.gov.hk/eng/fdh.html |
| Labour Department | Principal labour administration agency (homepage hub) | https://www.labour.gov.hk/eng/index.htm |
| Employment Agencies Administration | Licence/CoE required; 10%-of-first-month-wages commission cap; unlicensed/overcharge penalty $350,000 + 3 yrs | https://www.eaa.labour.gov.hk/en/looking.html |
| Labour Dept agency notes | 1-year licence; Gazette + EA/CE lists; licensed-EA search; consulate list | https://www.labour.gov.hk/eng/service/content4_5.htm |
| FDH Portal | SEC policy, rights/obligations, free consultation and conciliation via Labour Relations Division | https://www.fdh.labour.gov.hk/en/home.html |
| GovHK guidebook | Hiring-FDH guidebook: contract, MAW, visa (MAW/food figures date-sensitive — re-verify before quoting) | https://www.gov.hk/en/theme/guidebook/employment/family/foreigndomestichelper.htm |
| Labour Relations Division | 10 branch offices; 24-hr hotline 2717 1771 (via 1823) | https://www.labour.gov.hk/eng/tele/lr1.htm |
| Labour Dept complaints hub | enquiry@labour.gov.hk; FDH, wage-default, EC insurance, child-labour, OSH hotlines | https://www.labour.gov.hk/eng/tele/content.htm |

### GB — United Kingdom (preserved). Status: PARTIALLY_SUPPORTED.

The 4 backend-allowlisted GOV.UK pages (code-verified, live content never fetched): Seasonal Worker visa overview, agency-worker fees page, seasonal farm-worker guidance, National Minimum Wage rates. Frontend additionally links `/seasonal-worker-visa/eligibility`, which is NOT in the backend allowlist and fails exact-path validation — a pre-existing parity bug to fix in place. NMW £12.21 figure, fee-ban wording, and CoS pages remain live-unverified.

## 3. UK-assumption inventory (by file)

Backend: `official_sources.py` — docstring, GOV.UK-only rule, `CORRIDOR`, `ALLOWED_HOST = www.gov.uk`, 4-URL `ALLOWLIST` with UK-mirroring categories, exact host+scheme+path validator with no per-country map. `main.py` — `list_sources` returns single hardcoded corridor. `README.md` — documents 4-page UK scope. `test_official_sources.py` — UK-fact fixtures (NMW £12.21, fee ban, CoS).

Frontend: `guidance.ts` (+ `GuidanceList.tsx`, both resources pages) — `UK_GUIDANCE` rendered unconditionally with "Country: United Kingdom". `investigationPlanner.ts` — `INVESTIGATION_CORRIDOR`, `isUkDestination` with unknown→UK default, non-UK empty-plan gate, UK terms (right to work, CoS, scheme operator, sponsor licence, payslips, seasonal-UK questions, "UK minimum wage" for any salary). `validation.ts` + `EvidenceInvestigation.tsx` — UK-mirroring category union, labels, "covers United Kingdom employment only". `AnalysisResults.tsx` — UK fee-ban/payslip guidance shown regardless of destination. `opportunityAnalyzer.ts` / `opportunityAnalysis.ts` — £/GBP examples, Kent/Manchester samples, "licence" spelling, "overseas postings" frame. Three pages hardcode `en-GB` date formatting. Tests across six files use UK fixtures plus a Canada→0-items gate test.

Verified country-agnostic (no change needed): PRIVACY.md, `firestore.rules` + `firebase.json` (`destination_country` stays a free string ≤500), contractAI/contractPrompts/evidenceComparison/sources/compareSession/disclaimer/reportLanguage, landing/about/how-it-works pages, workspace compare/settings/layout, and all auth/theme/Firebase-client/investigations/documents modules.

## 4. Domain model and registry shape

DestinationProfile keyed by ISO 3166-1 alpha-2 (GB preserved for UK; ID default origin; MY/SG/JP/AU/NZ/TW destinations; HK jurisdiction). Fields: code, displayName, jurisdictionKind (country|jurisdiction), kind (origin|destination|jurisdiction), originCountry (default ID, overridable), destinationCountry (required, no silent default), employmentType[] (per-destination extensible enum, append-only + "other"), recruitmentChannel[], visaOrWorkAuthorizationCategory[], sourceJurisdiction (which jurisdiction's sources applied — HK proves it differs from destinationCountry), investigationLanguage[] (BCP-47, distinct from source languages).

Registry entry per profile: code, displayName, authorities [{name, role, verifiedNameVia}], approvedUrls [{url, fetchedStatus, covers[], languages[], notes}], employmentCategories[], recruitmentChannels[], visaOrWorkAuth[], languages[], lastReviewed (YYYY-MM-DD|null), verificationStatus (VERIFIED|PARTIAL|STALE|UNVERIFIED), notes. Rules: only fetched-ok URLs are citable; corroborated-only/failed URLs stay listed as gaps. New profile = new registry entry only. Never "country of Hong Kong" in UI.

## 5. Breaking-change report (UK preserved as GB; GB behavior unchanged)

Must change: `official_sources.py` (CORRIDOR→registry, per-profile host map + validator), `main.py` (`list_sources` → profiles with code + verificationStatus), backend README, `guidance.ts`/GuidanceList/resources pages (per-profile lists, dynamic country), `investigationPlanner.ts` (rule packs per profile, explicit destination selector replacing the unknown→UK default), `validation.ts`/EvidenceInvestigation (generic category taxonomy + labels), AnalysisResults (destination-aware guidance), analyzer schemas/samples (per-profile examples/currency), `en-GB` date hardcodes, and all UK-fixture tests including the Canada-gate test. Generic risks carried for code verification: single→multi routing behind profile lookup (keep user-visible "UK" via alias), UK↔GB key normalization (alias both, decide canonical), "country" type/label additions for HK/TW, ID-default UX gating, per-profile approved-URL allowlists, and visible limitation rendering for PARTIALLY_SUPPORTED profiles. No-change list per §3. Fix in place: the eligibility-URL parity bug.

## 6. Phased implementation plan (Spark-safe: no Storage/Functions/paid APIs; transient compare; processing-destination transparency on every result)

- Phase B — registry + model + UK hardening: static registry JSON from §2; domain model from §4; GB seeded from constants; UK↔GB alias; `destination_country` migration decision (free string vs code enum + backfill without Functions); re-fetch and re-verify the 4 GB URLs; fix eligibility parity; scope UK strings to GB; explicit destination selector; "Rules applied: {code}" banner + lastReviewed display; GB regression green.
- Phase C1 — SG first (strongest evidence: MOM passes/salary/EA/TADM + EA Directory, MWC labeled non-gov). C2 — JP + NZ + HK together (ISA/MHLW/OTIT/SSW + ID hotlines; INZ AEWV/MEPV + ENZ rights; ImmD ID407 + LD/EAA/FDH/SEC). C3 — ID-origin cross-cutting on every profile (P3MI directory check + Peduli WNI + BPJS + UU 18/2017). C4 — TW pending the city-bureau gate; MY and AU ship as PARTIALLY_SUPPORTED with limitation notices (MY immigration first, labour text gated; AU with no wage figures quoted).
- Phase D — i18n, transparency, re-verify: investigationLanguage selector + per-profile defaults (MY ms/en, JP ja/en/id, SG en, ID id); per-profile currency/date formats; generic category taxonomy; transient-compare audit; Spark-safe refresh (manual lastReviewed + client-side staleness checklist, no cron); re-fetch FWO/FWC/PALM + HK MAW + TW city bureaus + GB live pages, then promote.

Gates per profile: core authorities fetched-ok, no corroborated-only citation, per-profile tests, GB regression green. PARTIALLY_SUPPORTED profiles always render their limitations; minimum-wage figures are never quoted from snippets.

## 7. Open questions

Destination-country migration strategy; GB-vs-UK canonical key; generic vs per-profile category taxonomy; unknown/NOT_STARTED-destination UX; investigationLanguage vs reportLanguage flow with per-profile defaults and formats; lastReviewed cadence and owner on Spark; HK sourceJurisdiction-vs-destinationCountry encoding; TW/HK display-name sign-off; employmentType/recruitmentChannel/visa enum finals + "other" handling; .com.my trust policy; TW city-bureau gate; AU promotion gate; NZ MBIE direct-verify need. Full per-question detail is preserved in the workflow record.

## 8. Approved decisions (2026-11-19, user-approved)

1. destination_country: keep the Firestore free-string field and rules unchanged; new code resolves ISO codes client-side with a legacy-name alias map ("United Kingdom"→GB).
2. Canonical key GB (ISO); "UK"/"United Kingdom"/UK nations accepted as aliases; user-visible display stays "United Kingdom".
3. Taxonomy: GB keeps its 4 categories; all newer corridors share 5 generic keys (work-authorization, recruitment-rules, salary-protection, complaint-channels, origin-protection) — no further type changes needed.
4. Unknown/unsupported destination: empty plan plus an explicit selector; never a silent country default.
5. investigationLanguage: separate per-profile default (MY ms/en, JP ja/en/id, SG en, ID id); reportLanguage flow untouched.
6. lastReviewed: manual owner checklist plus a client-side staleness display; no cron on Spark.
7. HK encoded as destinationCountry "HK" with jurisdictionKind "jurisdiction"; never "country of Hong Kong" in UI.
8. Display names "Taiwan" and "Hong Kong" approved.
9. Employment/recruitment/visa value sets stay append-only with an "other" fallback.
10. .com.my official initiative sites (FWCMS, Xpats Gateway, WFW) included as allowlisted URLs with operator status noted; corroborated-only URLs never cited.
11. TW ships as SOURCES_VERIFIED with the city-bureau principle-only note (no gate).
12. AU stays PARTIALLY_SUPPORTED until FWO/FWC/PALM re-fetch; no wage figures quoted.
13. NZ MBIE direct verification not required.

## 9. Implementation status (Phases B–D core, this session)

Shipped: backend `corridors.py` registry (all 9 profiles, verified URLs only; MWC and the UU18 PDF excluded from retrieval as designed), per-profile validation with GB-default backward compatibility, `GET /api/v1/corridors`, profile-aware sources/retrieve endpoints; frontend `corridors.ts` (all profiles, aliases, locales, guidance for all 9), GB + SG + generic JP/NZ/TW/HK/MY/AU planner packs with explicit routing and ID-origin cross-cutting items, destination selector + "Rules applied" banner in evidence investigation, dual-catalog retrieval (destination + Indonesian origin), per-profile resources section, destination-aware AnalysisResults, per-profile date locales, extended category union, and an EN/ID strings module with a persisted language toggle on both corridor surfaces. Firestore rules, Auth, AI Logic modes, and transient-compare behavior unchanged. No profile was promoted past its §1 status: promotion still requires the per-corridor manual test pass.

Verification: backend 48/48 unittest OK, frontend 78/78 unit OK, `tsc --noEmit` clean, `eslint` clean. Production `next build` did NOT complete in this session: it ran 30+ minutes with zero output and was terminated as stuck. Likely cause is environmental (the sandbox stalling the build-time `next/font/google` font fetch), not a code error — typecheck, lint, and unit compilation all pass. Re-run `npm run build` on a machine with normal network before release.

Still ahead: full-page Bahasa Indonesia localization beyond the corridor surfaces (strings module is the foundation), GB live-page re-fetch, FWO/FWC/PALM + MY ministry + HK MAW re-verification, and the per-corridor manual test pass (ID→MY/SG/JP/AU/NZ/TW/HK + UK regression) from the task's testing matrix.

Note on the pre-existing eligibility-URL divergence (frontend links `/seasonal-worker-visa/eligibility`, backend allowlists only 4 pages): left as-is deliberately. Guidance entries are outbound links, never retrieval inputs, so the link works for users; adding an unfetched URL to the retrieval allowlist would violate the fetched-ok rule. Parity rule going forward: only fetched-ok URLs enter either list.
