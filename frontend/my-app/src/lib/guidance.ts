// Curated employment guidance links. Every entry is a real GOV.UK page
// verified during development (November 2026). No other countries are
// covered yet; do not add country guidance without verifying the source.

export interface GuidanceEntry {
  title: string;
  url: string;
  publisher: string;
  country: string;
  summary: string;
  /** When OpporCheck last reviewed this entry (not the publisher's date). */
  reviewed: string;
}

export const UK_GUIDANCE: GuidanceEntry[] = [
  {
    title: "Seasonal Worker visa",
    url: "https://www.gov.uk/seasonal-worker-visa",
    publisher: "GOV.UK",
    country: "United Kingdom",
    summary:
      "Who can apply for a Seasonal Worker visa, which farm and poultry work it covers, and how long it lasts.",
    reviewed: "November 2026",
  },
  {
    title: "Seasonal Worker visa: eligibility",
    url: "https://www.gov.uk/seasonal-worker-visa/eligibility",
    publisher: "GOV.UK",
    country: "United Kingdom",
    summary:
      "Eligibility rules: certificate of sponsorship, maintenance funds, and minimum pay requirements.",
    reviewed: "November 2026",
  },
  {
    title: "Seasonal work on farms: guidance for workers",
    url: "https://www.gov.uk/guidance/seasonal-work-on-farms-guidance-for-workers",
    publisher: "GOV.UK",
    country: "United Kingdom",
    summary:
      "Official guidance for workers: approved scheme operators, where to find work, and how to avoid recruitment scams.",
    reviewed: "November 2026",
  },
  {
    title: "National Minimum Wage and National Living Wage rates",
    url: "https://www.gov.uk/national-minimum-wage-rates",
    publisher: "GOV.UK",
    country: "United Kingdom",
    summary: "Current UK minimum hourly pay rates by age and apprentice status.",
    reviewed: "November 2026",
  },
  {
    title: "Employment agencies and businesses",
    url: "https://www.gov.uk/employment-agencies-and-businesses",
    publisher: "GOV.UK",
    country: "United Kingdom",
    summary:
      "Rules agencies must follow, including the ban on charging work-seekers fees for finding work.",
    reviewed: "November 2026",
  },
];
