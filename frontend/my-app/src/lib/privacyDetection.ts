// Privacy Check detection engine: local, deterministic, dependency-free.
//
// Finds potential sensitive information in user-provided employment text
// WITHOUT sending anything anywhere. Every detector is contextual and
// conservative: bare amounts, dates, and short numbers are never flagged,
// because salary figures, contract dates, and employment terms must survive
// untouched. Results are possibilities ("Review suggested"), never verdicts.
//
// Text matching cannot see visual signatures, photographs, or scanned ID
// images — that limitation is stated in the UI, not solved here.

export type PrivacyCategory =
  | "identity"
  | "contact"
  | "financial"
  | "credential"
  | "signature";

export type PrivacyConfidence = "high" | "medium" | "low";

export interface PrivacyDetection {
  /** Stable within one scan: category + offsets. */
  id: string;
  category: PrivacyCategory;
  /** Short human label, e.g. "Passport number". */
  label: string;
  /** UTF-16 offsets into the scanned source text. */
  start: number;
  end: number;
  /** The exact matched substring (shown for review, never logged). */
  excerpt: string;
  confidence: PrivacyConfidence;
  /** Plain reason, e.g. "16 digits after 'NIK'". */
  reason: string;
  /** True when the match is heuristic and needs human judgment. */
  uncertain: boolean;
  /** Suggested replacement when the user chooses Redact. */
  placeholder: string;
}

export interface DetectionResult {
  detections: PrivacyDetection[];
  scannedChars: number;
  /** Bumped whenever detector behavior changes; bound into approvals. */
  detectorVersion: string;
}

export const DETECTOR_VERSION = "1";

export const CATEGORY_TITLES: Record<PrivacyCategory, string> = {
  identity: "Identity documents and numbers",
  contact: "Contact details",
  financial: "Bank and payment details",
  credential: "Passwords and access keys",
  signature: "Signature fields",
};

const CONFIDENCE_RANK: Record<PrivacyConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

interface Candidate {
  category: PrivacyCategory;
  label: string;
  start: number;
  end: number;
  confidence: PrivacyConfidence;
  reason: string;
  uncertain: boolean;
  placeholder: string;
}

function collect(
  text: string,
  pattern: RegExp,
  make: (match: RegExpExecArray) => Omit<Candidate, "start" | "end"> & {
    start: number;
    end: number;
  },
): Candidate[] {
  const out: Candidate[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  // Defensive cap: pathological inputs must not hang the page.
  for (let guard = 0; guard < 5000 && (match = pattern.exec(text)); guard += 1) {
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    out.push(make(match));
  }
  return out;
}

/** Luhn checksum for payment-card plausibility (never a verdict alone). */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let doubleUp = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (doubleUp) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    doubleUp = !doubleUp;
  }
  return sum % 10 === 0;
}

/** Indonesian NIK embeds a birth date (DDMMYY, day +40 for women) at digits 7-12. */
function nikDatePlausible(nik: string): boolean {
  const day = Number(nik.slice(6, 8));
  const month = Number(nik.slice(8, 10));
  const dayOk = (day >= 1 && day <= 31) || (day >= 41 && day <= 71);
  return dayOk && month >= 1 && month <= 12;
}

function isEmail(text: string): Candidate[] {
  return collect(
    text,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    (match) => ({
      category: "contact",
      label: "Email address",
      start: match.index,
      end: match.index + match[0].length,
      confidence: "high",
      reason: "Email-shaped text",
      uncertain: false,
      placeholder: "[EMAIL]",
    }),
  );
}

function isPassport(text: string): Candidate[] {
  // Long label first, and the value must not be the label word itself
  // (otherwise "number" in "Passport number" matches as the value).
  // A single embedded newline covers identifiers wrapped across lines.
  const found = collect(
    text,
    /(passport\s+(?:number|no\.?|#)|no\.\s*paspor|nomor\s*paspor|paspor|passport)\s*[:.\-]?\s*(?!number\b|no\b)([A-Z0-9]{6,12}|[A-Z0-9]{2,11}\n[A-Z0-9]{1,11})/gi,
    (match) => {
      const value = match[2] ?? "";
      const start = match.index + match[0].lastIndexOf(value);
      const explicit = /number|no\.?|#|nomor/i.test(match[1] ?? "");
      return {
        category: "identity" as const,
        label: "Passport number",
        start,
        end: start + value.length,
        confidence: (explicit ? "high" : "medium") as PrivacyConfidence,
        reason: explicit
          ? "Identifier after an explicit passport label"
          : "Identifier after a passport mention",
        uncertain: !explicit,
        placeholder: "[PASSPORT]",
      };
    },
  );
  // Split form must still carry at least 6 identifier characters.
  return found.filter((candidate) => {
    const compact = text
      .slice(candidate.start, candidate.end)
      .replace(/\n/g, "");
    return compact.length >= 6;
  });
}

function isNationalId(text: string): Candidate[] {
  // Values never span spaces (that ate trailing words like "dan n");
  // a single embedded newline covers wrapped identifiers. Bare "ID"
  // needs its own digit-bearing value so TLDs like "co.id" cannot match.
  const out: Candidate[] = collect(
    text,
    /\b(NIK|nomor\s*induk(?:\s*kependudukan)?|KTP|national\s*id(?:entity)?(?:\s*number)?|ID\s*(?:number|no\.?|#)|identity\s*(?:number|card)|MyKad|NRIC)\b\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-.]{4,19}[A-Z0-9]|[A-Z0-9]{2,19}\n[A-Z0-9]{1,19})/gi,
    (match) => {
      const value = (match[2] ?? "").trim();
      const start = match.index + match[0].lastIndexOf(match[2] ?? "");
      return {
        category: "identity" as const,
        label: "National ID number",
        start,
        end: start + value.length,
        confidence: "high" as const,
        reason: `Number after an identity label ("${(match[1] ?? "").trim()}")`,
        uncertain: false,
        placeholder: "[ID_NUMBER]",
      };
    },
  ).filter((candidate) => {
    const compact = text
      .slice(candidate.start, candidate.end)
      .replace(/\n/g, "");
    return compact.length >= 6 && /\d/.test(compact);
  });
  for (const candidate of collect(
    text,
    /\bID\b\s*[:.\-]?\s*(\d[A-Z0-9\-.]{4,18}[A-Z0-9]|\d{2,17}\n[A-Z0-9]{1,17})/gi,
    (match) => {
      const value = match[1] ?? "";
      const start = match.index + match[0].lastIndexOf(value);
      return {
        category: "identity" as const,
        label: "National ID number",
        start,
        end: start + value.length,
        confidence: "high" as const,
        reason: 'Digit-bearing value after "ID"',
        uncertain: false,
        placeholder: "[ID_NUMBER]",
      };
    },
  )) {
    const compact = text
      .slice(candidate.start, candidate.end)
      .replace(/\n/g, "");
    if (compact.length >= 6 && /\d/.test(compact)) {
      out.push(candidate);
    }
  }
  // Bare 16-digit runs: only medium when the NIK date-embedding checks
  // out, otherwise they fall through to the low-confidence long-number
  // catch-all below.
  for (const candidate of collect(text, /\b\d{16}\b/g, (match) => ({
    category: "identity" as const,
    label: "National ID number",
    start: match.index,
    end: match.index + 16,
    confidence: "medium" as const,
    reason: "16 digits with a plausible NIK birth-date embedding",
    uncertain: true,
    placeholder: "[ID_NUMBER]",
  }))) {
    if (nikDatePlausible(text.slice(candidate.start, candidate.end))) {
      out.push(candidate);
    }
  }
  return out;
}

const MONTHS =
  "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|" +
  "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember";

function isDateOfBirth(text: string): Candidate[] {
  // Dates are employment evidence (contract dates, start dates), so bare
  // dates are NEVER flagged — only dates with a birth context.
  const date = String.raw`(?:\d{1,2}[\/.\- ]\d{1,2}[\/.\- ]\d{2,4}|\d{1,2}\s+(?:${MONTHS})\s+\d{4}|(?:${MONTHS})\s+\d{1,2},?\s+\d{4})`;
  const pattern = new RegExp(
    String.raw`(?:date\s*of\s*birth|\bDOB\b|\bborn\b|birth\s*date|tanggal\s*lahir|tempat(?:\s*dan)?\s*tanggal\s*lahir|\bTTL\b|生年月日|出生日期|出生年月日)\s*[:：.\-]?\s*(${date}|\d{4}年\d{1,2}月\d{1,2}日)`,
    "gi",
  );
  return collect(text, pattern, (match) => {
    const value = match[1] ?? "";
    const start = match.index + match[0].lastIndexOf(value);
    return {
      category: "identity",
      label: "Date of birth",
      start,
      end: start + value.length,
      confidence: "medium",
      reason: "Date with a birth context",
      uncertain: true,
      placeholder: "[DATE_OF_BIRTH]",
    };
  });
}

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function isPhone(text: string): Candidate[] {
  const out = collect(
    text,
    /(phone|telephone|tel\.?|mobile|handphone|\bHP\b|WhatsApp|\bWA\b|call|contact|hubungi|kontak|nomor\s*(?:telepon|hp|handphone)?)\s*[:.\-]?\s*(\+?[\d][\d\s().\-]{5,22}\d)/gi,
    (match) => {
      const value = (match[2] ?? "").trim();
      const start = match.index + match[0].lastIndexOf(match[2] ?? "");
      const digits = countDigits(value);
      const strong = /whatsapp|phone|hubungi/i.test(match[1] ?? "");
      return {
        category: "contact",
        label: "Phone number",
        start,
        end: start + value.length,
        confidence: strong && digits >= 7 && digits <= 15 ? "high" : "medium",
        reason: `Number after "${(match[1] ?? "").trim()}"`,
        uncertain: digits < 7 || digits > 15,
        placeholder: "[PHONE]",
      };
    },
  );
  // Bare international-format numbers are distinctive enough for medium.
  for (const candidate of collect(text, /(?<!\d)\+[1-9]\d{7,14}\b/g, (match) => ({
    category: "contact" as const,
    label: "Phone number",
    start: match.index,
    end: match.index + match[0].length,
    confidence: "medium" as const,
    reason: "International-format number without a label",
    uncertain: true,
    placeholder: "[PHONE]",
  }))) {
    out.push(candidate);
  }
  return out;
}

/**
 * Trims a line-anchored span at the first sentence boundary (period +
 * space + letter) so one keyword cannot swallow later sentences on
 * single-line pastes. Short tokens (No./Jl./St./e.g.) never end a span.
 */
function trimToSentence(text: string, start: number, end: number): number {
  const slice = text.slice(start, end);
  const boundary = /\.\s+(?=[A-Za-z])/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(slice)) !== null) {
    const token =
      slice
        .slice(0, match.index)
        .split(/[\s.,;:!?()]+/)
        .filter(Boolean)
        .pop() ?? "";
    if (token.length > 3) {
      return start + match.index + 1;
    }
  }
  return end;
}

function isAddress(text: string): Candidate[] {
  // Line-anchored: flags the address portion of the line, capped so one
  // keyword cannot swallow the rest of the document. Workplace labels
  // such as "work location" are deliberately NOT keywords.
  const out = collect(
    text,
    /\b(addresses|address|alamat|perumahan|rumah|jalan|jl\.?|streets|street|resides?\s+at|lives?\s+at|tinggal\s+di|tempat\s+tinggal|kecamatan|kec\.?|kelurahan|kel\.?|desa|postal(?:\s*code)?|postcode|kode\s*pos|RT\s*\d{0,3}\s*\/?\s*RW(?:\s*\d{1,3})?)\b[^\n]{0,160}/gi,
    (match) => ({
      category: "contact",
      label: "Residential address",
      start: match.index,
      end: trimToSentence(text, match.index, match.index + match[0].trimEnd().length),
      confidence: "medium",
      reason: `Address keyword ("${(match[1] ?? "").trim()}") with following text`,
      uncertain: true,
      placeholder: "[ADDRESS]",
    }),
  );
  return out;
}

function isBankAccount(text: string): Candidate[] {
  // Values are digit-led with no letters, so spans stay exact ("sort code
  // 12-34-56" no longer eats following words) and mismatched labels such
  // as "transfer to <words>" fall through to the right keyword.
  const out = collect(
    text,
    /(bank\s*account|account\s*number|no\.?\s*(?:rek(?:ening)?|account)|rekening|a\/n|atas\s*nama|transfer\s*to|sort\s*code|IBAN)\s*[:.\-]?\s*(\d[\d\s\-.]{6,25}\d|[A-Z]{2}\d{2}[A-Z0-9]{11,26})/gi,
    (match) => {
      const value = (match[2] ?? "").trim();
      const start = match.index + match[0].lastIndexOf(match[2] ?? "");
      const strong = /account\s*number|rekening|\bIBAN\b/i.test(match[1] ?? "");
      return {
        category: "financial",
        label: "Bank account number",
        start,
        end: start + value.length,
        confidence: strong ? "high" : "medium",
        reason: `Number after "${(match[1] ?? "").trim()}"`,
        uncertain: !strong,
        placeholder: "[BANK_ACCOUNT]",
      };
    },
  );
  // Bare IBAN-shaped tokens are distinctive; still medium, not high.
  for (const candidate of collect(text, /\b[A-Z]{2}\d{2}[A-Z0-9]{11,26}\b/g, (match) => ({
    category: "financial" as const,
    label: "Bank account number",
    start: match.index,
    end: match.index + match[0].length,
    confidence: "medium" as const,
    reason: "IBAN-shaped token without a label",
    uncertain: true,
    placeholder: "[BANK_ACCOUNT]",
  }))) {
    out.push(candidate);
  }
  return out;
}

function isPaymentCard(text: string): Candidate[] {
  const out = collect(
    text,
    /(credit\s*card|debit\s*card|\bcard\b|kartu\s*(?:kredit|debit)?|\bCC\b|CVV)\s*[:.\-]?\s*(\d[\d\s\-.]{11,24}\d)/gi,
    (match) => {
      const value = (match[2] ?? "").trim();
      const start = match.index + match[0].lastIndexOf(match[2] ?? "");
      return {
        category: "financial",
        label: "Payment card number",
        start,
        end: start + value.length,
        confidence: "high",
        reason: `Number after "${(match[1] ?? "").trim()}"`,
        uncertain: false,
        placeholder: "[CARD]",
      };
    },
  );
  // Bare contiguous digit runs that pass Luhn: medium at most. Amounts
  // with separators (4.500.000 / 220,000) can never match this pattern.
  for (const candidate of collect(text, /\b\d{13,19}\b/g, (match) => ({
    category: "financial" as const,
    label: "Payment card number",
    start: match.index,
    end: match.index + match[0].length,
    confidence: "medium" as const,
    reason: "Digit run that passes the card checksum (verify before redacting)",
    uncertain: true,
    placeholder: "[CARD]",
  }))) {
    if (luhnValid(text.slice(candidate.start, candidate.end))) {
      out.push(candidate);
    }
  }
  return out;
}

function isCredential(text: string): Candidate[] {
  const out = collect(
    text,
    /(password|sandi|passwd|pwd|\bPIN\b|token|api[_ \-]?key|apikey|secret|credential|auth(?:entication)?\s*key)\s*[:=]\s*(\S{4,80})/gi,
    (match) => {
      const value = match[2] ?? "";
      const start = match.index + match[0].lastIndexOf(value);
      return {
        category: "credential",
        label: /pin/i.test(match[1] ?? "") ? "PIN code" : "Password or secret",
        start,
        end: start + value.length,
        confidence: "high",
        reason: `Value after "${(match[1] ?? "").trim()}"`,
        uncertain: false,
        placeholder: "[CREDENTIAL]",
      };
    },
  );
  // Well-known bare key prefixes have almost no legitimate in-text use.
  for (const candidate of collect(
    text,
    /\b(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    (match) => ({
      category: "credential" as const,
      label: "API key or token",
      start: match.index,
      end: match.index + match[0].length,
      confidence: "high" as const,
      reason: "Known access-key prefix",
      uncertain: false,
      placeholder: "[CREDENTIAL]",
    }),
  )) {
    out.push(candidate);
  }
  return out;
}

function isSignatureField(text: string): Candidate[] {
  // Label-only: text matching cannot see ink signatures or photos. The
  // span covers the label plus the rest of its line (often the name).
  return collect(
    text,
    // A label followed only by "on <date>" carries no identity content
    // (the date is employment evidence), so it is not flagged.
    /\b(signature|signed(\s+by)?|\bsign\s+here\b|\btanda\s+tangan\b|\bttd\b)(?!\s+on\b)[^\n]{0,80}/gi,
    (match) => ({
      category: "signature",
      label: "Signature field",
      start: match.index,
      end: trimToSentence(text, match.index, match.index + match[0].trimEnd().length),
      confidence: "low",
      reason: "Signature label (images and ink cannot be detected in text)",
      uncertain: true,
      placeholder: "[SIGNATURE]",
    }),
  );
}

function isLongNumber(text: string): Candidate[] {
  // Catch-all for bare contiguous digit runs nothing else claimed.
  // Deliberately low confidence: amounts use separators and cannot match,
  // but short references and years below 10 digits are left alone too.
  // A single embedded newline covers runs wrapped across lines.
  return collect(text, /\b\d{10,19}\b|\b\d{4,18}\n\d{1,14}\b/g, (match) => ({
    category: "identity",
    label: "Long number (unclassified)",
    start: match.index,
    end: match.index + match[0].length,
    confidence: "low",
    reason: "Long digit run without identifying context — check what it is",
    uncertain: true,
    placeholder: "[NUMBER]",
  })).filter((candidate) => {
    const compact = text
      .slice(candidate.start, candidate.end)
      .replace(/\n/g, "");
    return compact.length >= 10;
  });
}

function isPhoneCJK(text: string): Candidate[] {
  return collect(
    text,
    /(電話|电话|携帯|手机)\s*[:：.\-]?\s*(\+?[\d][\d\s().\-]{5,22}\d)/g,
    (match) => {
      const value = (match[2] ?? "").trim();
      const start = match.index + match[0].lastIndexOf(match[2] ?? "");
      return {
        category: "contact",
        label: "Phone number",
        start,
        end: start + value.length,
        confidence: "medium",
        reason: `Number after "${match[1] ?? ""}"`,
        uncertain: true,
        placeholder: "[PHONE]",
      };
    },
  );
}

function isNationalIdCJK(text: string): Candidate[] {
  return collect(
    text,
    /(身分證|身份证)(?:\s*(?:號碼|号码|字號|号))?\s*[:：.\-]?\s*([A-Z0-9][A-Z0-9\-.]{4,19}[A-Z0-9])/g,
    (match) => {
      const value = match[2] ?? "";
      const start = match.index + match[0].lastIndexOf(value);
      return {
        category: "identity",
        label: "National ID number",
        start,
        end: start + value.length,
        confidence: "high",
        reason: `Number after "${match[1] ?? ""}"`,
        uncertain: false,
        placeholder: "[ID_NUMBER]",
      };
    },
  ).filter(
    (candidate) => /\d/.test(text.slice(candidate.start, candidate.end)),
  );
}

function isAddressCJK(text: string): Candidate[] {
  return collect(text, /(地址|住址|住所|郵便番号)[^\n]{0,160}/g, (match) => ({
    category: "contact",
    label: "Residential address",
    start: match.index,
    end: match.index + match[0].trimEnd().length,
    confidence: "medium",
    reason: `Address keyword ("${match[1] ?? ""}") with following text`,
    uncertain: true,
    placeholder: "[ADDRESS]",
  }));
}

function overlaps(a: Candidate, b: Candidate): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Resolves overlaps deterministically: higher confidence wins, then the
 * longer span, then the earlier offset. Lower-confidence overlaps are
 * dropped (the catch-all never survives against a real detector).
 */
export function resolveOverlaps(candidates: Candidate[]): Candidate[] {
  const ranked = [...candidates].sort(
    (a, b) =>
      CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  );
  const accepted: Candidate[] = [];
  for (const candidate of ranked) {
    if (!accepted.some((kept) => overlaps(kept, candidate))) {
      accepted.push(candidate);
    }
  }
  return accepted.sort((a, b) => a.start - b.start);
}

const DETECTORS: Array<(text: string) => Candidate[]> = [
  isEmail,
  isPassport,
  isNationalId,
  isDateOfBirth,
  isPhone,
  isAddress,
  isBankAccount,
  isPaymentCard,
  isCredential,
  isSignatureField,
  isPhoneCJK,
  isNationalIdCJK,
  isAddressCJK,
  isLongNumber,
];

/** Scans text locally. Pure: no network, no storage, no logging. */
export function detectSensitiveInfo(text: string): DetectionResult {
  const source = text ?? "";
  const candidates = DETECTORS.flatMap((detect) => detect(source));
  const detections = resolveOverlaps(candidates).map(
    (candidate, index): PrivacyDetection => ({
      id: `${candidate.category}:${candidate.start}:${candidate.end}:${index}`,
      category: candidate.category,
      label: candidate.label,
      start: candidate.start,
      end: candidate.end,
      excerpt: source.slice(candidate.start, candidate.end),
      confidence: candidate.confidence,
      reason: candidate.reason,
      uncertain: candidate.uncertain,
      placeholder: candidate.placeholder,
    }),
  );
  return { detections, scannedChars: source.length, detectorVersion: DETECTOR_VERSION };
}

/** 1-based line number of an offset (for review display). */
export function lineNumberOf(text: string, offset: number): number {
  let line = 1;
  const clamped = Math.max(0, Math.min(offset, text.length));
  for (let i = 0; i < clamped; i += 1) {
    if (text[i] === "\n") {
      line += 1;
    }
  }
  return line;
}
