// Privacy validation corpus: synthetic employment documents with ground truth.
//
// Phase 1.6 §3. Every name, number, and address here is invented. The eval
// harness (privacyCorpus.test.ts) measures recall, precision, and
// employment-term preservation against these annotations.
//
// Annotation rules:
// - expect: substring that MUST be covered by a same-category detection.
// - forbid: substring that must NOT overlap any detection span.
// - allowUncertain: substring allowed to be flagged ONLY low+uncertain.
// - gaps: known detector gaps (asserted as missed; flip to expect when fixed).
// Excerpts must each occur exactly once in their text.

import type { PrivacyCategory, PrivacyConfidence } from "../../src/lib/privacyDetection";

export interface CorpusExpectation {
  excerpt: string;
  category: PrivacyCategory;
  minConfidence?: PrivacyConfidence;
}

export interface CorpusGap {
  /** Probe text scanned independently of the case text. */
  text: string;
  excerpt: string;
  note: string;
}

export interface CorpusCase {
  id: string;
  locale: string;
  text: string;
  expect: CorpusExpectation[];
  forbid: string[];
  allowUncertain?: string[];
  /**
   * Known gaps: no medium-or-higher detection may cover the excerpt (a low
   * uncertain catch-all firing is the conservative design working, not a
   * miss). Flip to expect[] when §4 fixes land.
   */
  gaps?: CorpusGap[];
}

export const PRIVACY_CORPUS: CorpusCase[] = [
  {
    id: "id-posting",
    locale: "id",
    text:
      "Lowongan: Pekerja Perkebunan Kelapa Sawit di Pekanbaru, Riau. " +
      "Gaji pokok Rp 4.500.000 per bulan, tunjangan makan Rp 750.000. " +
      "Jam kerja 8 jam per hari, 6 hari per minggu. Kontrak 24 bulan. " +
      "Pelamar mengirim NIK: 3174051209900001 dan nomor HP 081234567890. " +
      "Perusahaan PT Nusantara Agro Lestari.",
    expect: [
      { excerpt: "3174051209900001", category: "identity", minConfidence: "high" },
      { excerpt: "081234567890", category: "contact" },
    ],
    forbid: [
      "Rp 4.500.000",
      "Rp 750.000",
      "8 jam per hari",
      "24 bulan",
      "PT Nusantara Agro Lestari",
      "Pekanbaru, Riau",
    ],
  },
  {
    id: "id-mixed",
    locale: "id",
    text:
      "Kontrak: Tunjangan lembur Rp 35.000 per jam. Potongan asuransi 3%. " +
      "Email pelamar: budi.santoso99@example.co.id. " +
      "Alamat rumah: Jl. Merdeka No. 12 RT 05/RW 03, Pekanbaru. " +
      "Passport number AB1234567 tercatat.",
    expect: [
      { excerpt: "budi.santoso99@example.co.id", category: "contact", minConfidence: "high" },
      { excerpt: "Jl. Merdeka No. 12 RT 05/RW 03, Pekanbaru", category: "contact" },
      { excerpt: "AB1234567", category: "identity", minConfidence: "high" },
    ],
    forbid: ["Rp 35.000", "3%"],
  },
  {
    id: "my-offer",
    locale: "ms",
    text:
      "Tawaran: Operator Pengeluaran di Shah Alam. Gaji asas RM1,800.00, " +
      "elaun RM200.00, potongan KWSP 11%. Tempoh 12 bulan. " +
      "MyKad 900101-14-5678 diperlukan. Hubungi +60123456789. " +
      "Majikan Kilang Maju Jaya Sdn. Bhd.",
    expect: [
      { excerpt: "900101-14-5678", category: "identity" },
      { excerpt: "+60123456789", category: "contact" },
    ],
    forbid: ["RM1,800.00", "RM200.00", "11%", "12 bulan", "Kilang Maju Jaya Sdn. Bhd.", "Shah Alam"],
  },
  {
    id: "sg-agreement",
    locale: "en-SG",
    text:
      "Employment agreement: Work Permit role, salary SGD 2,100 monthly, " +
      "overtime 1.5x, 44 hours per week. Start date 05 January 2027. " +
      "Employee NRIC S1234567D. Contact sarah.lim@example.sg. " +
      "Employer Straits Marine Pte. Ltd.",
    expect: [
      { excerpt: "S1234567D", category: "identity" },
      { excerpt: "sarah.lim@example.sg", category: "contact", minConfidence: "high" },
    ],
    forbid: ["SGD 2,100", "1.5x", "44 hours", "05 January 2027", "Straits Marine Pte. Ltd."],
  },
  {
    id: "jp-conditions",
    locale: "ja",
    text:
      "職種: 食品加工スタッフ。基本給 月額 220,000円。残業手当 1時間あたり 1,720円。 " +
      "勤務時間 1日8時間、週40時間。契約期間 12か月。雇用開始日 2026年9月1日。 " +
      "会社名 株式会社さくら食品。call +81312345678。電話 03-1234-5678。",
    expect: [
      { excerpt: "+81312345678", category: "contact" },
      { excerpt: "03-1234-5678", category: "contact" },
    ],
    forbid: [
      "220,000円",
      "1,720円",
      "1日8時間",
      "40時間",
      "12か月",
      "2026年9月1日",
      "株式会社さくら食品",
    ],
  },
  {
    id: "en-agreement",
    locale: "en",
    text:
      "Offer of employment: Fruit Picker in Maidstone, United Kingdom. " +
      "Basic pay GBP 11.50 per hour, overtime GBP 17.25. Working hours 40 per week. " +
      "Accommodation deduction GBP 80.00 per week. Start date 15 June 2026. " +
      "Applicant email amina.khan90@example.com, phone +441234567890. " +
      "Bank transfer to account number 87654321, sort code 12-34-56. " +
      "Signed: ________________",
    expect: [
      { excerpt: "amina.khan90@example.com", category: "contact", minConfidence: "high" },
      { excerpt: "+441234567890", category: "contact" },
      { excerpt: "87654321", category: "financial" },
      { excerpt: "12-34-56", category: "financial" },
      { excerpt: "Signed: ________________", category: "signature" },
    ],
    forbid: [
      "GBP 11.50",
      "GBP 17.25",
      "40 per week",
      "GBP 80.00",
      "15 June 2026",
      "Maidstone, United Kingdom",
    ],
  },
  {
    id: "zh-hant-offer",
    locale: "zh-Hant",
    text:
      "職位: 電子廠作業員。基本工資 新台幣 28,000元整。加班費 每小時 175元。 " +
      "工作時間 每日8小時，每週40小時。契約期間 36個月。到職日期 2027年2月1日。 " +
      "雇主 寶島精密工業股份有限公司。聯絡 +886912345678。身分證 A123456789。",
    expect: [
      { excerpt: "+886912345678", category: "contact" },
      { excerpt: "A123456789", category: "identity", minConfidence: "high" },
    ],
    forbid: [
      "28,000元",
      "175元",
      "8小時",
      "40小時",
      "36個月",
      "2027年2月1日",
      "寶島精密工業股份有限公司",
    ],
  },
  {
    id: "zh-hans-offer",
    locale: "zh-Hans",
    text:
      "职位: 电子厂作业员。基本工资 新台币 28,000元整。加班费 每小时 175元。 " +
      "工作时间 每日8小时，每周40小时。契约期间 36个月。到职日期 2027年2月1日。 " +
      "雇主 宝岛精密工业股份有限公司。电话 +8613800138000。" +
      "身份证 11010519900101234X。地址 北京市朝阳区。",
    expect: [
      { excerpt: "+8613800138000", category: "contact" },
      { excerpt: "11010519900101234X", category: "identity", minConfidence: "high" },
      { excerpt: "北京市朝阳区", category: "contact" },
    ],
    forbid: ["28,000元", "175元", "8小时", "40小时", "36个月", "2027年2月1日"],
  },
  {
    id: "credentials-note",
    locale: "en",
    text:
      "Onboarding note: portal password: T3mp-Portal-99. Door PIN: 4821. " +
      "API token ghp_abcdefghijklmnopqrstuv for the rota app. " +
      "Salary GBP 1,840.00 monthly, 14 days notice.",
    expect: [
      { excerpt: "T3mp-Portal-99", category: "credential", minConfidence: "high" },
      { excerpt: "4821", category: "credential", minConfidence: "high" },
      { excerpt: "ghp_abcdefghijklmnopqrstuv", category: "credential", minConfidence: "high" },
    ],
    forbid: ["GBP 1,840.00", "14 days"],
  },
  {
    id: "payment-details",
    locale: "en",
    text:
      "Payroll: IBAN DE89370400440532013000 for salary. " +
      "Card on file, card: 4111 1111 1111 1111. " +
      "Net pay GBP 1,692.50, transport allowance GBP 120.00, leave 12 days.",
    expect: [
      { excerpt: "DE89370400440532013000", category: "financial" },
      { excerpt: "4111 1111 1111 1111", category: "financial", minConfidence: "high" },
    ],
    forbid: ["GBP 1,692.50", "GBP 120.00", "12 days"],
  },
  {
    id: "dob-variants",
    locale: "en",
    text:
      "Applicant date of birth: 15/06/1990. Tanggal lahir 12 Mei 1995 untuk yang kedua. " +
      "Contract signed on 2027-02-01. Review date 01 March 2027. 生年月日 1990年5月12日。",
    expect: [
      { excerpt: "15/06/1990", category: "identity" },
      { excerpt: "12 Mei 1995", category: "identity" },
      { excerpt: "1990年5月12日", category: "identity" },
    ],
    forbid: ["2027-02-01", "01 March 2027"],
  },
  {
    id: "ambiguous-numbers",
    locale: "en",
    text: "Reference 9999888877776666 filed. Year 2026. Code 220000 pending.",
    expect: [],
    forbid: ["2026", "220000"],
    allowUncertain: ["9999888877776666"],
  },
  {
    id: "overlap-single",
    locale: "id",
    text: "Verifikasi NIK 3174051209900001 selesai.",
    expect: [{ excerpt: "3174051209900001", category: "identity", minConfidence: "high" }],
    forbid: [],
  },
  {
    id: "split-identifier",
    locale: "en",
    text: "Passport number AB12\n34567 on file.",
    expect: [{ excerpt: "AB12\n34567", category: "identity", minConfidence: "high" }],
    forbid: [],
  },
];
