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
  صفر: "0",
  واحد: "1",
  واحده: "1",
  اثنين: "2",
  اتنين: "2",
  اثنان: "2",
  ثلاثه: "3",
  تلاته: "3",
  اربعه: "4",
  خمسه: "5",
  سته: "6",
  سبعه: "7",
  ثمانيه: "8",
  تمانيه: "8",
  تسعه: "9"
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

const leetFold = (token) =>
  token.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");

const findSocial = (normalized) => {
  const dotted = normalized.replace(/\s*\.\s*/g, ".");
  if (DOMAIN_RE.test(dotted) || DOMAIN_RE.test(normalized)) return "social";

  const tokens = letterTokens(normalized).map(leetFold);
  for (let i = 0; i < tokens.length; i += 1) {
    let acc = "";
    for (let j = i; j < Math.min(tokens.length, i + 12); j += 1) {
      acc += tokens[j];
      if (acc.length > 40) break;
      if (SHORT_KEYWORDS.has(acc)) return "social";
      if (LONG_KEYWORDS.some((keyword) => acc.includes(keyword))) return "social";
    }
  }
  return null;
};

const findPhoneDigits = (normalized) => {
  if (/\d{10,}/.test(normalized)) return "phone";

  const separated = /(?<!\d)\d{1,9}(?:[ \t.\-–—/]+\d{1,9})+(?!\d)/g;
  for (const match of normalized.matchAll(separated)) {
    const groups = match[0].split(/[ \t.\-–—/]+/).filter(Boolean);
    const digits = groups.join("");
    if (digits.length < 10 || digits.length > 15) continue;
    const allSingleDigits = groups.every((group) => group.length === 1);
    if (allSingleDigits || groups.length <= 4) return "phone";
  }

  const tokens = letterTokens(normalized);
  let spelled = "";
  for (const token of tokens) {
    if (DIGIT_WORDS[token]) {
      spelled += DIGIT_WORDS[token];
      if (spelled.length >= 10) return "phone";
      continue;
    }
    if (CONNECTORS.has(token)) continue;
    spelled = "";
  }
  return null;
};

const scanText = (text) => {
  const normalized = normalizeContactText(text);
  if (!normalized.trim()) return null;
  const social = findSocial(normalized);
  if (social) return { reason: social };
  if (EMAIL_RE.test(normalized)) return { reason: "email" };
  if (HANDLE_RE.test(normalized)) return { reason: "handle" };
  const phone = findPhoneDigits(normalized);
  if (phone) return { reason: phone };
  return null;
};

const isPhoneFragment = (text) => {
  const normalized = normalizeContactText(text).trim();
  if (!normalized) return false;
  const tokens = letterTokens(normalized);
  const digitCount = (normalized.match(/\d/g) || []).length;
  if (tokens.length === 0 && digitCount >= 2 && /^[\d\s.\-+()]+$/.test(normalized)) return true;
  if (digitCount === 0 && tokens.length >= 2 && tokens.every((token) => DIGIT_WORDS[token] || CONNECTORS.has(token))) {
    return tokens.some((token) => DIGIT_WORDS[token]);
  }
  return false;
};

/**
 * @param {string} text
 * @param {string[]} priorTexts Newest first. Only digit fragments are joined, so workout lines stay separate.
 * @returns {{ reason: "social" | "email" | "handle" | "phone" } | null}
 */
const fragmentDigits = (text) => normalizeContactText(text).replace(/\D/g, "");

const chainLooksLikePhone = (parts) => {
  const spelledOnly = parts.every((part) => fragmentDigits(part).length === 0);
  if (spelledOnly) return true;
  return parts.some((part) => {
    const digits = fragmentDigits(part);
    return digits.length >= 6 || /^01/.test(digits);
  });
};

export const detectContactLeak = (text, priorTexts = []) => {
  const direct = scanText(text);
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

  const phone = findPhoneDigits(normalizeContactText(chain.join(" ")));
  return phone ? { reason: phone } : null;
};
