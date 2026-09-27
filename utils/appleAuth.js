import crypto from "crypto";
import jwt from "jsonwebtoken";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_SIGNUP_EXPIRES_IN = process.env.APPLE_SIGNUP_TOKEN_EXPIRES_IN || "15m";
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache = { keys: [], fetchedAt: 0 };

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is not configured");
    err.code = "JWT_SECRET_MISSING";
    throw err;
  }
  return secret;
}

/**
 * Comma-separated iOS bundle IDs (the identity token audience).
 * @returns {string[]}
 */
export function getAppleClientIds() {
  const raw = process.env.APPLE_CLIENT_IDS || "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function getAppleJwks(force = false) {
  const now = Date.now();
  if (!force && jwksCache.keys.length > 0 && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const response = await fetch(APPLE_JWKS_URL);
  if (!response.ok) {
    const err = new Error("Unable to fetch Apple public keys");
    err.code = "APPLE_KEYS_UNAVAILABLE";
    throw err;
  }

  const body = await response.json();
  if (!Array.isArray(body?.keys) || body.keys.length === 0) {
    const err = new Error("Apple public keys response was empty");
    err.code = "APPLE_KEYS_UNAVAILABLE";
    throw err;
  }

  jwksCache = { keys: body.keys, fetchedAt: now };
  return body.keys;
}

function publicKeyForKid(keys, kid) {
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) return null;
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

/**
 * Verify an Apple identity token.
 * Name is not in the token; email may be absent on later sign-ins.
 * @param {string} identityToken
 * @returns {Promise<{ appleId: string, email: string|null, emailVerified: boolean }>}
 */
export async function verifyAppleIdentityToken(identityToken) {
  const audiences = getAppleClientIds();
  if (audiences.length === 0) {
    const err = new Error("APPLE_CLIENT_IDS is not configured");
    err.code = "APPLE_NOT_CONFIGURED";
    throw err;
  }

  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded?.header?.kid || decoded.header.alg !== "RS256" || !decoded.payload) {
    const err = new Error("Invalid Apple identity token");
    err.code = "INVALID_APPLE_TOKEN";
    throw err;
  }

  let keys = await getAppleJwks();
  let publicKey = publicKeyForKid(keys, decoded.header.kid);
  if (!publicKey) {
    keys = await getAppleJwks(true);
    publicKey = publicKeyForKid(keys, decoded.header.kid);
  }
  if (!publicKey) {
    const err = new Error("Invalid Apple identity token");
    err.code = "INVALID_APPLE_TOKEN";
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(identityToken, publicKey, {
      algorithms: ["RS256"],
      issuer: APPLE_ISSUER,
      audience: audiences,
    });
  } catch (err) {
    const e = new Error("Invalid Apple identity token");
    e.code = "INVALID_APPLE_TOKEN";
    e.cause = err;
    throw e;
  }

  if (!payload?.sub) {
    const err = new Error("Invalid Apple identity token");
    err.code = "INVALID_APPLE_TOKEN";
    throw err;
  }

  const email = payload.email ? String(payload.email).trim().toLowerCase() : null;
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";

  if (email && !emailVerified) {
    const err = new Error("Apple email is not verified");
    err.code = "APPLE_EMAIL_UNVERIFIED";
    throw err;
  }

  return {
    appleId: payload.sub,
    email,
    emailVerified: email ? emailVerified : false,
  };
}

/**
 * Short-lived token used only between /auth/apple and /auth/apple/complete.
 * Not an access token — must not pass auth middleware.
 */
export function issueAppleSignupToken(profile) {
  return jwt.sign(
    {
      type: "apple_signup",
      appleId: profile.appleId,
      email: profile.email,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
    },
    requireJwtSecret(),
    { expiresIn: APPLE_SIGNUP_EXPIRES_IN }
  );
}

/**
 * @param {string} token
 * @returns {{ appleId: string, email: string, firstName: string|null, lastName: string|null }}
 */
export function verifyAppleSignupToken(token) {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());
    if (decoded.type !== "apple_signup" || !decoded.appleId || !decoded.email) {
      const err = new Error("Invalid Apple signup token");
      err.code = "INVALID_APPLE_SIGNUP_TOKEN";
      throw err;
    }
    return {
      appleId: decoded.appleId,
      email: String(decoded.email).trim().toLowerCase(),
      firstName: decoded.firstName || null,
      lastName: decoded.lastName || null,
    };
  } catch (err) {
    if (err.code === "INVALID_APPLE_SIGNUP_TOKEN" || err.code === "JWT_SECRET_MISSING") {
      throw err;
    }
    if (err.name === "TokenExpiredError") {
      const e = new Error("Apple signup token expired. Please sign in with Apple again.");
      e.code = "APPLE_SIGNUP_TOKEN_EXPIRED";
      throw e;
    }
    const e = new Error("Invalid Apple signup token");
    e.code = "INVALID_APPLE_SIGNUP_TOKEN";
    throw e;
  }
}
