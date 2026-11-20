// Corridor UI strings in English and Bahasa Indonesia. Dependency-free so
// unit tests can assert key parity and wording. This module covers the
// destination-aware surfaces (evidence investigation, resources); page-level
// copy outside those surfaces stays English until the full Phase D pass.
// Placeholders use {name} and are filled with format().

export type UiLanguage = "en" | "id";

export const UI_LANGUAGES: ReadonlyArray<{ code: UiLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
];

interface CorridorStrings {
  languageLabel: string;
  destinationLabel: string;
  rulesApplied: string;
  statusSourcesVerified: string;
  statusPartial: string;
  sourcesVerifiedOn: string;
  rulesNotAdded: string;
  evidenceTitle: string;
  evidenceDescription: string;
  noQuestionsTitle: string;
  noQuestionsDescription: string;
  notCoveredTitle: string;
  notCoveredDescription: string;
  noLinksTitle: string;
  noLinksDescription: string;
}

const STRINGS: Record<UiLanguage, CorridorStrings> = {
  en: {
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
  },
  id: {
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
  },
};

export function getStrings(language: UiLanguage): CorridorStrings {
  return STRINGS[language];
}

/** Fills {name} placeholders; unknown placeholders are left untouched. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? (values[key] as string) : match,
  );
}
