import crypto from "crypto";
import User from "../Models/User.js";

const SLUG_LENGTH = 8;
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const MAX_SLUG_RETRIES = 10;
const DEFAULT_SHARE_BASE = "https://trainifypro.com/coaches";

/**
 * Generate a random alphanumeric slug of fixed length.
 * @param {number} [length=8]
 * @returns {string}
 */
export function generateSlug(length = SLUG_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return slug;
}

/**
 * Generate a slug that does not collide with an existing User.slug.
 * @param {{ excludeUserId?: import("mongoose").Types.ObjectId | string }} [options]
 * @returns {Promise<string>}
 */
export async function ensureUniqueSlug({ excludeUserId } = {}) {
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug();
    const query = { slug };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }
    const exists = await User.exists(query);
    if (!exists) return slug;
  }
  throw new Error("Failed to generate a unique user slug");
}

/**
 * Keep letters/numbers only (Latin, Arabic, etc.), drop spaces & punctuation.
 * @param {string} value
 * @returns {string}
 */
function stripNonAlphanumeric(value) {
  return value.replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Title-case Latin names; leave Arabic (and other scripts) unchanged.
 * @param {string} name
 * @returns {string}
 */
function formatFirstName(name) {
  if (/^[a-zA-Z]/.test(name)) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return name;
}

/**
 * Uppercase Latin initials; leave Arabic letters as-is.
 * @param {string} char
 * @returns {string}
 */
function formatInitial(char) {
  return /[a-zA-Z]/.test(char) ? char.toUpperCase() : char;
}

/**
 * Build name prefix: FirstName-L (e.g. Medo-Z or أحمد-م).
 * Falls back to null when no letters/numbers are available.
 * @param {{ firstName?: string, lastName?: string } | null | undefined} user
 * @returns {string | null}
 */
export function buildNamePrefix(user) {
  if (!user) return null;

  const firstRaw = (user.firstName || "").trim();
  const lastRaw = (user.lastName || "").trim();

  const firstClean = stripNonAlphanumeric(firstRaw);
  if (!firstClean) return null;

  const first = formatFirstName(firstClean);

  const lastInitialSource = stripNonAlphanumeric(lastRaw);
  if (!lastInitialSource) return first;

  const initial = formatInitial(lastInitialSource.charAt(0));
  return `${first}-${initial}`;
}

/**
 * Path segment for share URLs: Medo-Z-k7m2xq9p or Coach-k7m2xq9p.
 * @param {{ firstName?: string, lastName?: string, slug?: string } | null | undefined} user
 * @returns {string | null}
 */
export function buildSharePath(user) {
  if (!user?.slug) return null;
  const prefix = buildNamePrefix(user) || "Coach";
  return `${prefix}-${user.slug}`;
}

/**
 * Full share profile URL.
 * @param {{ firstName?: string, lastName?: string, slug?: string } | null | undefined} user
 * @returns {string | null}
 */
export function buildShareProfileUrl(user) {
  const path = buildSharePath(user);
  if (!path) return null;
  const base = (
    process.env.SHARE_PROFILE_BASE_URL || DEFAULT_SHARE_BASE
  ).replace(/\/$/, "");
  return `${base}/${path}`;
}

/**
 * Extract the trailing 8-char slug from a share path param.
 * @param {string | null | undefined} param
 * @returns {string | null}
 */
export function parseSlugFromParam(param) {
  if (!param || typeof param !== "string") return null;
  const match = param.match(/-([a-z0-9]{8})$/i);
  return match ? match[1].toLowerCase() : null;
}
