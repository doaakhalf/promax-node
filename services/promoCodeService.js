import crypto from "crypto";
import PromoCode from "../Models/PromoCode.js";
import User from "../Models/User.js";
import { getPlatformPercentage } from "../utils/coachNetAmount.js";
import { displayName } from "../utils/displayName.js";

const SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_EXPIRY_DAYS = 30;

export class PromoCodeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PromoCodeError";
    this.status = status;
  }
}

export const normalizePromoCode = (code) =>
  String(code || "")
    .trim()
    .toUpperCase();

export const randomPromoSuffix = (length = 6) => {
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  }
  return out;
};

export const sanitizePromoName = (name) => {
  // Keep Latin + Arabic letters/digits; drop spaces and punctuation.
  // Do not force Latin-only — coach names are often Arabic (e.g. أحمد).
  const cleaned = String(name || "")
    .normalize("NFC")
    .replace(/[\u064B-\u065F\u0670]/g, "") // Arabic diacritics (tashkeel)
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F]+/g, "")
    .toUpperCase();
  return cleaned || "COACH";
};

export const defaultExpiresAt = () => {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
  return d;
};

export const resolveExpiresAt = (input) => {
  if (input === undefined || input === null || input === "") {
    return defaultExpiresAt();
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new PromoCodeError("Invalid expiresAt date");
  }
  if (date.getTime() <= Date.now()) {
    throw new PromoCodeError("expiresAt must be a future date");
  }
  return date;
};

export const assertCoachDiscount = (discountPercent) => {
  const d = Number(discountPercent);
  if (!Number.isFinite(d) || d < 1 || d > 100 || Math.round(d) !== d) {
    throw new PromoCodeError("discountPercent must be an integer between 1 and 100");
  }
  return d;
};

export const assertAdminDiscount = (discountPercent) => {
  const d = assertCoachDiscount(discountPercent);
  const max = getPlatformPercentage();
  if (d > max) {
    throw new PromoCodeError(
      `Admin promo discount cannot exceed platform fee percentage (${max}%)`
    );
  }
  return d;
};

export const parseUsageLimit = (usageLimit) => {
  if (usageLimit === undefined || usageLimit === null || usageLimit === "") {
    return null;
  }
  const n = Number(usageLimit);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new PromoCodeError("usageLimit must be a positive integer");
  }
  return n;
};

export const buildCoachPromoCode = (coachUser, discountPercent) => {
  // Prefer firstName so Arabic names stay natural (أحمد-15-K7X2),
  // not displayName short form which appends a last initial (أحمدم).
  const rawName =
    (coachUser?.firstName || "").trim() ||
    displayName(coachUser, { full: false }) ||
    "COACH";
  const name = sanitizePromoName(rawName);
  return `${name}-${discountPercent}-${randomPromoSuffix(6)}`;
};

export const buildAdminPromoCode = (discountPercent) =>
  `ADMIN-${discountPercent}-${randomPromoSuffix(6)}`;

const isCodeTaken = async (code) => {
  const existing = await PromoCode.findOne({ code }).select("_id").lean();
  return !!existing;
};

export const generateUniqueCoachCode = async (coachUser, discountPercent) => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = buildCoachPromoCode(coachUser, discountPercent);
    if (!(await isCodeTaken(code))) return code;
  }
  throw new PromoCodeError("Failed to generate unique promo code", 500);
};

export const generateUniqueAdminCode = async (discountPercent) => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = buildAdminPromoCode(discountPercent);
    if (!(await isCodeTaken(code))) return code;
  }
  throw new PromoCodeError("Failed to generate unique promo code", 500);
};

export const serializePromoCode = (doc) => {
  if (!doc) return null;
  const row = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: row._id?.toString?.() || row.id,
    code: row.code,
    source: row.source,
    coachId: row.coachId ? row.coachId.toString() : null,
    discountPercent: row.discountPercent,
    createdBy: row.createdBy ? row.createdBy.toString() : null,
    isActive: row.isActive,
    expiresAt: row.expiresAt,
    usageLimit: row.usageLimit ?? null,
    usedCount: row.usedCount || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const assertPromoStillValid = (promo, { coachId } = {}) => {
  if (!promo || promo.deletedAt) {
    throw new PromoCodeError("Invalid promo code");
  }
  if (!promo.isActive) {
    throw new PromoCodeError("Promo code is inactive");
  }
  if (new Date(promo.expiresAt).getTime() <= Date.now()) {
    throw new PromoCodeError("Promo code has expired");
  }
  if (
    promo.usageLimit != null &&
    Number(promo.usedCount || 0) >= Number(promo.usageLimit)
  ) {
    throw new PromoCodeError("Promo code usage limit reached");
  }
  if (promo.source === "coach") {
    if (!promo.coachId || String(promo.coachId) !== String(coachId)) {
      throw new PromoCodeError("Promo code is not valid for this coach");
    }
  }
  if (promo.source === "admin") {
    const max = getPlatformPercentage();
    if (Number(promo.discountPercent) > max) {
      throw new PromoCodeError(
        `Admin promo discount cannot exceed platform fee percentage (${max}%)`
      );
    }
  }
  return promo;
};

export const findValidPromoForSubscribe = async ({ code, coachId }) => {
  const normalized = normalizePromoCode(code);
  if (!normalized) {
    throw new PromoCodeError("promoCode is required");
  }

  const promo = await PromoCode.findOne({
    code: normalized,
    deletedAt: null,
  });

  if (!promo) {
    throw new PromoCodeError("Invalid promo code");
  }

  return assertPromoStillValid(promo, { coachId });
};

export const incrementUsage = async (promoId) => {
  if (!promoId) return;
  await PromoCode.findByIdAndUpdate(promoId, { $inc: { usedCount: 1 } });
};

export const createCoachPromoCode = async ({
  coachUserId,
  discountPercent,
  expiresAt,
  usageLimit,
}) => {
  const d = assertCoachDiscount(discountPercent);
  const coachUser = await User.findById(coachUserId).select("firstName lastName").lean();
  if (!coachUser) {
    throw new PromoCodeError("Coach user not found", 404);
  }

  const code = await generateUniqueCoachCode(coachUser, d);
  const promo = await PromoCode.create({
    code,
    source: "coach",
    coachId: coachUserId,
    discountPercent: d,
    createdBy: coachUserId,
    expiresAt: resolveExpiresAt(expiresAt),
    usageLimit: parseUsageLimit(usageLimit),
    isActive: true,
  });

  return promo;
};

export const createAdminPromoCode = async ({
  adminUserId,
  code,
  discountPercent,
  expiresAt,
  usageLimit,
}) => {
  const d = assertAdminDiscount(discountPercent);
  let finalCode = normalizePromoCode(code);
  if (!finalCode) {
    finalCode = await generateUniqueAdminCode(d);
  } else if (await isCodeTaken(finalCode)) {
    throw new PromoCodeError("Promo code already exists");
  }

  const promo = await PromoCode.create({
    code: finalCode,
    source: "admin",
    coachId: null,
    discountPercent: d,
    createdBy: adminUserId,
    expiresAt: resolveExpiresAt(expiresAt),
    usageLimit: parseUsageLimit(usageLimit),
    isActive: true,
  });

  return promo;
};
