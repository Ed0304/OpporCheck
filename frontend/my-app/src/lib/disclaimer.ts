// Canonical product notices: the full disclaimer and its contextual
// variants. Single source of truth — every placement imports from here so
// the wording cannot drift between pages. The full disclaimer must keep
// its canonical meaning; concise variants link to pages carrying the full
// notice. Dependency-free so unit tests can assert exact wording.
//
// The English constants are canonical and asserted verbatim by
// productTrust.test.ts. The Indonesian variants are WORKING DRAFTS needing
// native-speaker AND legal review before they can be considered final —
// never present them as final. UI code reads notices through the
// get*(language) getters.

import type { UiLanguage } from "./strings";

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

/** Shown before document upload: remove high-risk identifiers first. */
export const UPLOAD_PII_WARNING =
  "Remove highly sensitive identifiers such as ID numbers and bank details before uploading; Privacy Check will help you review the rest.";

/** Review-page processing disclosure: fixed hybrid mode, stated plainly. */
export const REVIEW_PROCESSING_NOTICE =
  "Analysis runs on-device when your browser supports it, otherwise in the cloud via Firebase AI Logic. Your posting text leaves the device only for cloud analysis.";

// ---------------------------------------------------------------------------
// INDONESIAN WORKING DRAFTS — need native-speaker AND legal review.
// ---------------------------------------------------------------------------

export const FULL_DISCLAIMER_PARAGRAPHS_ID: readonly string[] = [
  "OpporCheck adalah alat informasi dan pendukung keputusan. OpporCheck bukan layanan deteksi penipuan, layanan nasihat hukum, atau otoritas verifikasi pekerjaan.",
  "Analisis kami menyoroti potensi masalah, ketentuan yang tidak jelas, informasi yang hilang, dan panduan resmi yang relevan. Temuan ini tidak menyatakan bahwa pemberi kerja, perekrut, iklan lowongan, atau kontrak kerja itu sah, curang, atau patuh hukum.",
  "Selalu verifikasi informasi penting secara independen. Jika Anda mencurigai penipuan, eksploitasi, perekrutan ilegal, atau pelanggaran lain, hubungi otoritas setempat atau instansi pemerintah terkait melalui kanal resmi mereka.",
  "Jangan hanya mengandalkan OpporCheck saat membuat keputusan pekerjaan, keuangan, imigrasi, atau hukum.",
];

export const CONCISE_NOTICE_ID =
  "OpporCheck adalah alat pendukung keputusan, bukan pendeteksi penipuan, penasihat hukum, atau otoritas verifikasi pekerjaan. Selalu verifikasi informasi penting secara independen.";

export const ANALYSIS_CONTEXT_NOTICE_ID =
  "Potensi masalah yang ditandai di sini adalah alasan untuk bertanya, bukan bukti penipuan. Informasi yang hilang berarti belum terverifikasi — bukan salah.";

export const COMPARISON_CONTEXT_NOTICE_ID =
  "Perbedaan antar dokumen adalah perbedaan wording yang perlu diklarifikasi — bukan bukti otomatis kesalahan atau ketidakpatuhan hukum.";

export const INVESTIGATION_CONTEXT_NOTICE_ID =
  "Panduan pemerintah yang dikutip menjelaskan aturan umum. Panduan tersebut tidak memverifikasi secara independen pemberi kerja, perekrut, atau peluang kerja tertentu.";

export const UPLOAD_SENSITIVITY_NOTICE_ID =
  "Dokumen pekerjaan dapat memuat informasi personal yang sensitif seperti nama, alamat, nomor identitas, dan detail bank. Unggah hanya dokumen yang boleh Anda bagikan.";

export const UPLOAD_PII_WARNING_ID =
  "Hapus pengidentifikasi yang sangat sensitif seperti nomor identitas dan detail bank sebelum mengunggah; Periksa Privasi akan membantu Anda meninjau sisanya.";

export const REVIEW_PROCESSING_NOTICE_ID =
  "Analisis berjalan di perangkat bila browser Anda mendukungnya, atau di cloud via Firebase AI Logic. Teks lowongan Anda keluar dari perangkat hanya untuk analisis cloud.";

export function getFullDisclaimerParagraphs(language: UiLanguage): readonly string[] {
  return language === "id" ? FULL_DISCLAIMER_PARAGRAPHS_ID : FULL_DISCLAIMER_PARAGRAPHS;
}

export function getConciseNotice(language: UiLanguage): string {
  return language === "id" ? CONCISE_NOTICE_ID : CONCISE_NOTICE;
}

export function getAnalysisContextNotice(language: UiLanguage): string {
  return language === "id" ? ANALYSIS_CONTEXT_NOTICE_ID : ANALYSIS_CONTEXT_NOTICE;
}

export function getComparisonContextNotice(language: UiLanguage): string {
  return language === "id" ? COMPARISON_CONTEXT_NOTICE_ID : COMPARISON_CONTEXT_NOTICE;
}

export function getInvestigationContextNotice(language: UiLanguage): string {
  return language === "id" ? INVESTIGATION_CONTEXT_NOTICE_ID : INVESTIGATION_CONTEXT_NOTICE;
}

export function getUploadSensitivityNotice(language: UiLanguage): string {
  return language === "id" ? UPLOAD_SENSITIVITY_NOTICE_ID : UPLOAD_SENSITIVITY_NOTICE;
}

export function getUploadPiiWarning(language: UiLanguage): string {
  return language === "id" ? UPLOAD_PII_WARNING_ID : UPLOAD_PII_WARNING;
}

export function getReviewProcessingNotice(language: UiLanguage): string {
  return language === "id" ? REVIEW_PROCESSING_NOTICE_ID : REVIEW_PROCESSING_NOTICE;
}
