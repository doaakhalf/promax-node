const ARABIC_INDIC = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9"
};

const LONG_KEYWORDS = [
  "instagram",
  "facebook",
  "whatsapp",
  "telegram",
  "snapchat",
  "tiktok",
  "youtube",
  "linkedin",
  "discord",
  "linktree",
  "انستجرام",
  "انستغرام",
  "انستقرام",
  "انستاجرام",
  "فيسبوك",
  "واتساب",
  "وتساب",
  "تيليجرام",
  "تليجرام",
  "تلغرام",
  "تلجرام",
  "سنابشات",
  "تيكتوك",
  "يوتيوب"
];

const SHORT_KEYWORDS = new Set([
  "insta",
  "ig",
  "fb",
  "snap",
  "واتس",
  "وتس",
  "انستا",
  "سناب",
  "فيس"
]);

/** Maps a normalized word token to one or more digit characters. */
const DIGIT_WORDS = {
  zero: "0",
  oh: "0",
  nought: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  صفر: "0",
  زيرو: "0",
  زيورو: "0",
  واحد: "1",
  واحده: "1",
  اثنين: "2",
  اتنين: "2",
  اثنان: "2",
  ثنين: "2",
  ثلاثه: "3",
  تلاته: "3",
  تلات: "3",
  اربعه: "4",
  اربع: "4",
  خمسه: "5",
  خمس: "5",
  سته: "6",
  ست: "6",
  سبعه: "7",
  سبع: "7",
  ثمانيه: "8",
  تمانيه: "8",
  تمان: "8",
  تسعه: "9",
  تسع: "9",
  عشره: "10",
  عشر: "10",
  // 11–19 (MSA + Egyptian spoken / clipped)
  احداشر: "11",
  احدعشر: "11",
  حداشر: "11",
  حداش: "11",
  اتناشر: "12",
  اثناشر: "12",
  اثنعشر: "12",
  اتناش: "12",
  اتنشر: "12",
  تلتاشر: "13",
  تلتاش: "13",
  ثلاثتاشر: "13",
  تلاتاشر: "13",
  اربعتاشر: "14",
  اربعتاش: "14",
  ربعتاشر: "14",
  ربعتاش: "14",
  خمستاشر: "15",
  خمستاش: "15",
  ستاشر: "16",
  ستاش: "16",
  ستعشر: "16",
  سبعاشر: "17",
  سبعاش: "17",
  سبعشر: "17",
  تمنتاشر: "18",
  تمنتاش: "18",
  تمانتاشر: "18",
  تمانتاش: "18",
  ثمنتاشر: "18",
  ثمنتاش: "18",
  تسعتاشر: "19",
  تسعتاش: "19",
  // 20–29 (common when reading phone chunks)
  twenty: "20",
  عشرين: "20",
  واحدوعشرين: "21",
  واحدعشرين: "21",
  اتنينوعشرين: "22",
  اتنينعشرين: "22",
  تلاتهوعشرين: "23",
  تلاتوعشرين: "23",
  تلاتعشرين: "23",
  اربعهوعشرين: "24",
  اربعوعشرين: "24",
  اربعشرين: "24",
  خمسهوعشرين: "25",
  خمسوعشرين: "25",
  خمسعشرين: "25",
  ستهوعشرين: "26",
  ستوعشرين: "26",
  ستعشرين: "26",
  سبعهوعشرين: "27",
  سبعوعشرين: "27",
  سبععشرين: "27",
  تمانيهوعشرين: "28",
  تمانوعشرين: "28",
  تمانعشرين: "28",
  ثمانيهوعشرين: "28",
  تسعهوعشرين: "29",
  تسعوعشرين: "29",
  تسععشرين: "29"
};

const CONNECTORS = new Set(["و", "and"]);

const DOMAIN_SOURCE = [
  "instagram.com",
  "instagr.am",
  "ig.me",
  "facebook.com",
  "fb.com",
  "fb.me",
  "m.me",
  "tiktok.com",
  "snapchat.com",
  "telegram.me",
  "telegram.org",
  "wa.me",
  "whatsapp.com",
  "discord.gg",
  "discord.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "threads.net",
  "linktr.ee",
  "t.me"
]
  .map((domain) => domain.replace(/\./g, "\\."))
  .join("|");

const DOMAIN_RE = new RegExp(
  `(?:https?:\\/\\/|www\\.)\\S+|(?:^|[^a-z0-9])(?:${DOMAIN_SOURCE})(?:[^a-z0-9]|$)`,
  "i"
);

/** OCR-only: listed social hosts (not every www./http URL — body-comp receipts print brand sites). */
const OCR_SOCIAL_DOMAIN_RE = new RegExp(
  `(?:https?:\\/\\/|www\\.)?(?:${DOMAIN_SOURCE})(?:[^a-z0-9]|$)`,
  "i"
);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const HANDLE_RE = /(^|[^\w])@[a-z0-9._]{3,30}\b/i;

export const CONTACT_SHARING_BLOCKED_RESPONSE = {
  status: "error",
  code: "CONTACT_SHARING_BLOCKED",
  message: "You can't share phone numbers, social media, or other contact details in chat."
};

export const normalizeContactText = (input) => {
  let text = String(input || "").normalize("NFKC");
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  text = text.replace(/[\u064B-\u0652\u0670\u0640]/g, "");
  text = text.replace(/[أإآ]/g, "ا");
  text = text.replace(/ى/g, "ي");
  text = text.replace(/ة/g, "ه");
  text = text.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_INDIC[ch] || ch);
  return text.toLowerCase();
};

const letterTokens = (text) => text.match(/[a-z]+|[\u0600-\u06FF]+/g) || [];

/** Digits runs and letter words, so "زيرو 1 0" chains into one phone candidate. */
const phoneTokens = (text) => text.match(/\d+|[a-z]+|[\u0600-\u06FF]+/g) || [];

const leetFold = (token) =>
  token.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");

const findSocial = (normalized, { ocr = false } = {}) => {
  const dotted = normalized.replace(/\s*\.\s*/g, ".");
  if (ocr) {
    if (OCR_SOCIAL_DOMAIN_RE.test(dotted) || OCR_SOCIAL_DOMAIN_RE.test(normalized)) {
      return "social";
    }
  } else if (DOMAIN_RE.test(dotted) || DOMAIN_RE.test(normalized)) {
    return "social";
  }

  const tokens = letterTokens(normalized).map(leetFold);
  for (let i = 0; i < tokens.length; i += 1) {
    let acc = "";
    for (let j = i; j < Math.min(tokens.length, i + 12); j += 1) {
      acc += tokens[j];
      if (acc.length > 40) break;
      // Skip 2–4 letter shortcuts in OCR — noise like "ig:" on receipts false-triggers.
      if (!ocr && SHORT_KEYWORDS.has(acc)) return "social";
      if (LONG_KEYWORDS.some((keyword) => acc.includes(keyword))) return "social";
    }
  }
  return null;
};

/** Egyptian mobile (010/011/012/015 + 8 digits), possibly embedded in a longer OCR digit run. */
const EGYPTIAN_MOBILE_DIGITS_RE = /01[0125]\d{8}/;
/** Spaced/dashed Egyptian mobile in OCR (dot is NOT a separator — keeps 181.5 intact). */
const EGYPTIAN_MOBILE_FLEX_RE = /0[\s\-–—/]*1[\s\-–—/]*[0125](?:[\s\-–—/]*\d){8}/;
/** Clear international form: +… or 00… then 10–14 digits with optional separators. */
const INTL_PHONE_FLEX_RE = /(?:\+|00)(?:[\s\-–—/]*\d){10,14}/;

const looksLikePhoneDigits = (digits, { ocr = false } = {}) => {
  if (ocr) {
    if (EGYPTIAN_MOBILE_DIGITS_RE.test(digits)) return true;
    if (/^00\d{10,13}$/.test(digits)) return true;
    return false;
  }
  if (digits.length >= 10 && digits.length <= 15) return true;
  // Egyptian mobiles are 01 + 9 digits. Block once an 01… prefix reaches 9+ digits
  // so split sends (0 then 10 then 1 then …) get caught before the last chunks.
  if (/^01\d{7,}$/.test(digits) && digits.length <= 15) return true;
  return false;
};

const findPhoneDigits = (normalized, { ocr = false } = {}) => {
  if (ocr) {
    // No bare \d{10,} — body-comp OCR glues height/weight/BMI into long digit runs.
    if (EGYPTIAN_MOBILE_FLEX_RE.test(normalized) || INTL_PHONE_FLEX_RE.test(normalized)) {
      return "phone";
    }

    const separated = /(?<!\d)\d{1,9}(?:[ \t\-–—/]+\d{1,9})+(?!\d)/g;
    for (const match of normalized.matchAll(separated)) {
      const groups = match[0].split(/[ \t\-–—/]+/).filter(Boolean);
      const digits = groups.join("");
      if (looksLikePhoneDigits(digits, { ocr: true })) return "phone";
    }

    for (const run of normalized.match(/\d+/g) || []) {
      if (looksLikePhoneDigits(run, { ocr: true })) return "phone";
    }
  } else {
    if (/\d{10,}/.test(normalized)) return "phone";

    const separated = /(?<!\d)\d{1,9}(?:[ \t.\-–—/]+\d{1,9})+(?!\d)/g;
    for (const match of normalized.matchAll(separated)) {
      const groups = match[0].split(/[ \t.\-–—/]+/).filter(Boolean);
      const digits = groups.join("");
      if (digits.length < 10 || digits.length > 15) continue;
      const allSingleDigits = groups.every((group) => group.length === 1);
      if (allSingleDigits || groups.length <= 4) return "phone";
    }
  }

  const tokens = phoneTokens(normalized);
  let spelled = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      spelled += token;
    } else if (DIGIT_WORDS[token]) {
      spelled += DIGIT_WORDS[token];
    } else if (CONNECTORS.has(token)) {
      continue;
    } else {
      spelled = "";
      continue;
    }
    if (looksLikePhoneDigits(spelled, { ocr })) return "phone";
    if (spelled.length > 15) spelled = "";
  }
  return null;
};

const scanText = (text, { ocr = false } = {}) => {
  const normalized = normalizeContactText(text);
  if (!normalized.trim()) return null;
  const social = findSocial(normalized, { ocr });
  if (social) return { reason: social };
  if (EMAIL_RE.test(normalized)) return { reason: "email" };
  if (HANDLE_RE.test(normalized)) return { reason: "handle" };
  const phone = findPhoneDigits(normalized, { ocr });
  if (phone) return { reason: phone };
  return null;
};

const isPhoneFragment = (text) => {
  const normalized = normalizeContactText(text).trim();
  if (!normalized) return false;
  const tokens = phoneTokens(normalized);
  if (!tokens.length) return false;

  // Pure numeric bubbles (including a single "0" / "1") — used to split phones across messages.
  if (tokens.every((token) => /^\d+$/.test(token)) && /^[\d\s.\-+()]+$/.test(normalized)) {
    return true;
  }

  const allPhoneTokens = tokens.every(
    (token) => /^\d+$/.test(token) || DIGIT_WORDS[token] || CONNECTORS.has(token)
  );
  if (!allPhoneTokens) return false;
  return tokens.some((token) => /^\d+$/.test(token) || DIGIT_WORDS[token]);
};

/**
 * @param {string} text
 * @param {string[]} priorTexts Newest first. Only digit fragments are joined, so workout lines stay separate.
 * @param {{ source?: "ocr" }} [options] Use `source: "ocr"` for noisy image text (stricter phone rules).
 * @returns {{ reason: "social" | "email" | "handle" | "phone" } | null}
 */
const fragmentDigits = (text) => {
  const normalized = normalizeContactText(text);
  const fromNumerals = normalized.replace(/\D/g, "");
  if (fromNumerals.length) return fromNumerals;
  const tokens = phoneTokens(normalized);
  let digits = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) digits += token;
    else if (DIGIT_WORDS[token]) digits += DIGIT_WORDS[token];
    else if (CONNECTORS.has(token)) continue;
    else break;
  }
  return digits;
};

const chainLooksLikePhone = (parts) => {
  const total = parts.map(fragmentDigits).join("");
  // Egyptian mobiles start with 01; keep chaining once that prefix appears.
  if (/^01/.test(total) && total.length >= 3) return true;
  if (total.length >= 6) return true;
  const spelledOnly = parts.every((part) => normalizeContactText(part).replace(/\D/g, "").length === 0);
  return spelledOnly;
};

export const detectContactLeak = (text, priorTexts = [], options = {}) => {
  const ocr = options?.source === "ocr";
  const direct = scanText(text, { ocr });
  if (direct) return direct;
  if (!isPhoneFragment(text)) return null;

  const fragments = [];
  for (const prior of priorTexts) {
    if (!isPhoneFragment(prior)) break;
    fragments.push(prior);
  }
  if (!fragments.length) return null;

  const chain = [...fragments.reverse(), text];
  if (!chainLooksLikePhone(chain)) return null;

  const phone = findPhoneDigits(normalizeContactText(chain.join(" ")), { ocr });
  return phone ? { reason: phone } : null;
};
