import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

const GOOGLE_SIGNUP_EXPIRES_IN = process.env.GOOGLE_SIGNUP_TOKEN_EXPIRES_IN || "15m";

const client = new OAuth2Client();

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
 * Comma-separated OAuth client IDs from env (GOOGLE_CLIENT_IDS or legacy GOOGLE_CLIENT_ID).
 * @returns {string[]}
 */
export function getGoogleClientIds() {
  const raw = process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Verify a Google ID token and return normalized profile fields.
 * @param {string} idToken
 * @returns {Promise<{ googleId: string, email: string, emailVerified: boolean, firstName: string|null, lastName: string|null, profileImage: string|null }>}
 */
export async function verifyGoogleIdToken(idToken) {
  const audiences = getGoogleClientIds();
  if (audiences.length === 0) {
    const err = new Error("GOOGLE_CLIENT_IDS is not configured");
    err.code = "GOOGLE_NOT_CONFIGURED";
    throw err;
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    const err = new Error("Invalid Google ID token");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  if (!payload.email) {
    const err = new Error("Google account has no email");
    err.code = "GOOGLE_EMAIL_MISSING";
    throw err;
  }

  if (payload.email_verified !== true) {
    const err = new Error("Google email is not verified");
    err.code = "GOOGLE_EMAIL_UNVERIFIED";
    throw err;
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    emailVerified: true,
    firstName: payload.given_name || null,
    lastName: payload.family_name || null,
    profileImage: payload.picture || null,
  };
}

/**
 * Short-lived token used only between /auth/google and /auth/google/complete.
 * Not an access token — must not pass auth middleware.
 */
export function issueGoogleSignupToken(profile) {
  return jwt.sign(
    {
      type: "google_signup",
      googleId: profile.googleId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImage: profile.profileImage,
    },
    requireJwtSecret(),
    { expiresIn: GOOGLE_SIGNUP_EXPIRES_IN }
  );
}

/**
 * @param {string} token
 * @returns {{ googleId: string, email: string, firstName: string|null, lastName: string|null, profileImage: string|null }}
 */
export function verifyGoogleSignupToken(token) {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());
    if (decoded.type !== "google_signup" || !decoded.googleId || !decoded.email) {
      const err = new Error("Invalid Google signup token");
      err.code = "INVALID_GOOGLE_SIGNUP_TOKEN";
      throw err;
    }
    return {
      googleId: decoded.googleId,
      email: String(decoded.email).trim().toLowerCase(),
      firstName: decoded.firstName || null,
      lastName: decoded.lastName || null,
      profileImage: decoded.profileImage || null,
    };
  } catch (err) {
    if (err.code === "INVALID_GOOGLE_SIGNUP_TOKEN" || err.code === "JWT_SECRET_MISSING") {
      throw err;
    }
    if (err.name === "TokenExpiredError") {
      const e = new Error("Google signup token expired. Please sign in with Google again.");
      e.code = "GOOGLE_SIGNUP_TOKEN_EXPIRED";
      throw e;
    }
    const e = new Error("Invalid Google signup token");
    e.code = "INVALID_GOOGLE_SIGNUP_TOKEN";
    throw e;
  }
}
