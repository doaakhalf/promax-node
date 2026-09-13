import { getFirebaseAdmin } from "../config/firebase.js";
import ApiError from "./ApiError.js";

/**
 * Strip non-digits so body phones (digits-only) can match Firebase E.164.
 * @param {string} phone
 * @returns {string}
 */
export const normalizePhoneDigits = (phone) => {
  if (typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
};

/**
 * Verify a Firebase ID token from Phone Auth and return uid + phone.
 * @param {string} idToken
 * @returns {Promise<{ firebaseUid: string, phoneNumber: string }>}
 */
export const verifyFirebasePhoneToken = async (idToken) => {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new ApiError(503, "Phone verification is temporarily unavailable");
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new ApiError(401, "Invalid or expired phone verification");
  }

  if (!decoded?.phone_number) {
    throw new ApiError(401, "Invalid or expired phone verification");
  }

  return {
    firebaseUid: decoded.uid,
    phoneNumber: decoded.phone_number,
  };
};

/**
 * True when normalized digit forms of both phones match.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const phonesMatch = (a, b) => {
  const digitsA = normalizePhoneDigits(a);
  const digitsB = normalizePhoneDigits(b);
  if (!digitsA || !digitsB) return false;
  return digitsA === digitsB || digitsA.endsWith(digitsB) || digitsB.endsWith(digitsA);
};
