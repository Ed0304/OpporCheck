// Privacy detection tests (node:test, no extra framework).
//
// Run: npm run test:unit  (from frontend/my-app.)
// Covers every detector category, overlap resolution, conservative
// confidence, and — critically — that employment evidence (salaries,
// deductions, dates, employer names) is never flagged.

import assert from "node:assert/strict";
import test from "node:test";
import {
  DETECTOR_VERSION,
  detectSensitiveInfo,
  lineNumberOf,
  resolveOverlaps,
} from "../../src/lib/privacyDetection";

function labels(text: string): string[] {
  return detectSensitiveInfo(text).detections.map((d) => d.label);
}

test("Indonesian NIK is detected with context and validated bare", () => {
  const withLabel = detectSensitiveInfo("NIK: 3174051209900001").detections;
  assert.equal(withLabel.length, 1);
  assert.equal(withLabel[0]?.label, "National ID number");
  assert.equal(withLabel[0]?.confidence, "high");
  assert.equal(withLabel[0]?.excerpt, "3174051209900001");

  // Bare 16 digits with a plausible NIK date embedding: medium, uncertain.
  const bare = detectSensitiveInfo("3174051209900001").detections;
  assert.equal(bare.length, 1);
  assert.equal(bare[0]?.confidence, "medium");
  assert.equal(bare[0]?.uncertain, true);
});

test("bare random 16-digit runs are low-confidence, never high", () => {
  const found = detectSensitiveInfo("ref 9999888877776666 ok").detections;
  assert.equal(found.length, 1);
  assert.equal(found[0]?.label, "Long number (unclassified)");
  assert.equal(found[0]?.confidence, "low");
  assert.equal(found[0]?.uncertain, true);
});

test("passport numbers need context; the word pass inside passport is safe", () => {
  const explicit = detectSensitiveInfo("Passport number AB1234567.").detections;
  assert.equal(explicit.length, 1);
  assert.equal(explicit[0]?.label, "Passport number");
  assert.equal(explicit[0]?.confidence, "high");
  assert.equal(explicit[0]?.excerpt, "AB1234567");

  const mention = detectSensitiveInfo("passport XY987654").detections;
  assert.equal(mention[0]?.confidence, "medium");

  // No credential false positive from "pass" inside "passport".
  assert.ok(explicit.every((d) => d.category !== "credential"));
});

test("phone numbers are detected with context and bare international format", () => {
  const contextual = detectSensitiveInfo("WhatsApp: +6281234567890").detections;
  assert.equal(contextual.length, 1);
  assert.equal(contextual[0]?.label, "Phone number");

  const bare = detectSensitiveInfo("call +441234567890 please").detections;
  assert.equal(bare.length, 1);
  assert.equal(bare[0]?.confidence, "medium");
});

test("email addresses are high confidence", () => {
  const found = detectSensitiveInfo("Write to amina.khan90@example.com soon.").detections;
  assert.equal(found.length, 1);
  assert.equal(found[0]?.label, "Email address");
  assert.equal(found[0]?.confidence, "high");
});

test("addresses match residential keywords, never workplace labels", () => {
  const home = detectSensitiveInfo("Home address: Jl. Merdeka No. 12, Jakarta").detections;
  assert.equal(home.length, 1);
  assert.equal(home[0]?.label, "Residential address");

  const rtRw = detectSensitiveInfo("RT 05/RW 03, Kel. Sukamaju").detections;
  assert.equal(rtRw.length, 1);
  assert.equal(rtRw[0]?.label, "Residential address");

  // "kecil" (small) must not match the "kec." abbreviation keyword.
  assert.deepEqual(labels("Perusahaan kecil di Jakarta."), []);

  const workplace = detectSensitiveInfo("Work location: Maidstone, United Kingdom");
  assert.deepEqual(workplace.detections, []);
});

test("bank accounts and IBAN-shaped tokens are flagged", () => {
  const account = detectSensitiveInfo("Transfer to account number 1234567890.").detections;
  assert.equal(account.length, 1);
  assert.equal(account[0]?.label, "Bank account number");

  const iban = detectSensitiveInfo("IBAN DE89370400440532013000 here.").detections;
  assert.ok(iban.some((d) => d.label === "Bank account number"));
});

test("payment cards use keyword context or Luhn plausibility", () => {
  const keyword = detectSensitiveInfo("card: 4111 1111 1111 1111").detections;
  assert.equal(keyword[0]?.confidence, "high");

  // Luhn-valid but NIK-date-invalid, so only the card detector claims it.
  const bare = detectSensitiveInfo("4111119911111116").detections;
  assert.equal(bare.length, 1);
  assert.equal(bare[0]?.label, "Payment card number");
  assert.equal(bare[0]?.uncertain, true);
});

test("passwords, PINs, and bare key prefixes are high confidence", () => {
  const password = detectSensitiveInfo("password: s3cr3t-value here").detections;
  assert.equal(password[0]?.label, "Password or secret");
  assert.equal(password[0]?.excerpt, "s3cr3t-value");

  const pin = detectSensitiveInfo("PIN: 4821").detections;
  assert.equal(pin[0]?.label, "PIN code");

  const key = detectSensitiveInfo("token ghp_abcdefghijklmnopqrstuv ok").detections;
  assert.equal(key[0]?.label, "API key or token");
});

test("dates of birth need a birth context; bare dates stay clean", () => {
  const dob = detectSensitiveInfo("Date of birth: 15/06/1990").detections;
  assert.equal(dob.length, 1);
  assert.equal(dob[0]?.label, "Date of birth");

  const id = detectSensitiveInfo("tanggal lahir 12 Mei 1995").detections;
  assert.equal(id.length, 1);

  assert.deepEqual(labels("Start date: 15 June 2026, end 30 June 2026."), []);
  assert.deepEqual(labels("Contract signed on 2027-02-01."), []);
});

test("signature fields are low-confidence label matches", () => {
  const found = detectSensitiveInfo("Signed: ________________").detections;
  assert.equal(found.length, 1);
  assert.equal(found[0]?.label, "Signature field");
  assert.equal(found[0]?.confidence, "low");
  assert.match(found[0]?.reason ?? "", /cannot be detected in text/);
});

test("salary amounts, currencies, and payment terms are never flagged", () => {
  const evidence = [
    "Basic pay: GBP 11.50 per hour, overtime GBP 17.25.",
    "Gaji pokok: Rp 4.500.000 per bulan, lembur Rp 35.000.",
    "Basic salary GBP 1,840.00 monthly, net GBP 1,692.50.",
    "Salary ¥220,000 monthly, accommodation deduction ¥15,000.",
    "Transport deduction: 5% of gross pay.",
    "Working hours: 40 hours per week, 8 hours per day.",
    "Contract duration: 24 months, 14 days notice.",
    "Leave: 12 days annual leave, plus sick leave.",
  ];
  for (const line of evidence) {
    assert.deepEqual(labels(line), [], `falsely flagged: ${line}`);
  }
});

test("employer and agency names are preserved by default", () => {
  assert.deepEqual(labels("Employer: Kent Valley Farms Ltd"), []);
  assert.deepEqual(labels("PT Nusantara Agro Lestari mempekerjakan staf."), []);
  assert.deepEqual(labels("Agency: Maju Jaya Sdn. Bhd., Shah Alam."), []);
});

test("overlaps resolve to the higher-confidence detector", () => {
  // Contextual phone (medium) must beat the low long-number catch-all.
  const phone = detectSensitiveInfo("call 08123456789012 now").detections;
  assert.equal(phone.length, 1);
  assert.equal(phone[0]?.label, "Phone number");

  // NIK (high) must beat card/low overlaps on the same digits.
  const nik = detectSensitiveInfo("NIK 3174051209900001").detections;
  assert.equal(nik.length, 1);
  assert.equal(nik[0]?.label, "National ID number");
});

test("resolveOverlaps is deterministic: confidence, then length, then offset", () => {
  const low = {
    category: "identity" as const,
    label: "Long number (unclassified)",
    start: 0,
    end: 16,
    confidence: "low" as const,
    reason: "x",
    uncertain: true,
    placeholder: "[NUMBER]",
  };
  const high = { ...low, label: "National ID number", start: 2, end: 10, confidence: "high" as const };
  assert.deepEqual(
    resolveOverlaps([low, high]).map((d) => d.label),
    ["National ID number"],
  );
  assert.deepEqual(
    resolveOverlaps([high, low]).map((d) => d.label),
    ["National ID number"],
  );
});

test("bare ID needs a digit-bearing value; TLDs never match", () => {
  const bare = detectSensitiveInfo("ID 12345678 on file.").detections;
  assert.equal(bare.length, 1);
  assert.equal(bare[0]?.excerpt, "12345678");

  // "id" inside "co.id" must not seed an identity match.
  const email = detectSensitiveInfo("mail a@example.co.id now.").detections;
  assert.equal(email.length, 1);
  assert.equal(email[0]?.label, "Email address");
});

test("passport value is never the label word itself", () => {
  assert.deepEqual(detectSensitiveInfo("Passport number AB12.").detections, []);
  const split = detectSensitiveInfo("Passport number AB12\n34567.").detections;
  assert.equal(split.length, 1);
  assert.equal(split[0]?.excerpt, "AB12\n34567");
});

test("bank spans stay exact and never eat following words", () => {
  const found = detectSensitiveInfo("sort code 12-34-56. Signed.").detections;
  const bank = found.find((d) => d.label === "Bank account number")!;
  assert.equal(bank.excerpt, "12-34-56");
  assert.ok(found.some((d) => d.label === "Signature field"));
});

test("CJK contextual detectors cover phone, ID, address, and birth dates", () => {
  const phone = detectSensitiveInfo("電話 03-1234-5678").detections;
  assert.equal(phone[0]?.label, "Phone number");

  const id = detectSensitiveInfo("身份证 11010519900101234X").detections;
  assert.equal(id.length, 1);
  assert.equal(id[0]?.confidence, "high");

  const address = detectSensitiveInfo("地址 北京市朝阳区").detections;
  assert.equal(address[0]?.label, "Residential address");

  const dob = detectSensitiveInfo("生年月日 1990年5月12日").detections;
  assert.equal(dob.length, 1);
  assert.equal(dob[0]?.excerpt, "1990年5月12日");
});

test("line numbers, versions, and empty input behave", () => {
  assert.equal(lineNumberOf("a\nb\nc", 4), 3);
  assert.equal(lineNumberOf("abc", 99), 1);
  const empty = detectSensitiveInfo("");
  assert.deepEqual(empty.detections, []);
  assert.equal(empty.scannedChars, 0);
  assert.equal(empty.detectorVersion, DETECTOR_VERSION);
  assert.ok(DETECTOR_VERSION.length > 0);
});
