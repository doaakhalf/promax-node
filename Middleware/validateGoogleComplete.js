import { verifyGoogleSignupToken } from "../utils/googleAuth.js";
import {
  applyAthleteSocialValidation,
  applyCoachSocialValidation,
} from "./validateSocialProfile.js";

function signupTokenError(err, res) {
  if (err?.code === "JWT_SECRET_MISSING") {
    return res.status(500).json({
      status: "error",
      message: "Google Sign-In is not configured on the server",
    });
  }
  if (err?.code === "GOOGLE_SIGNUP_TOKEN_EXPIRED" || err?.code === "INVALID_GOOGLE_SIGNUP_TOKEN") {
    return res.status(401).json({
      status: "error",
      message: err.message || "Invalid Google signup token",
    });
  }
  return res.status(401).json({
    status: "error",
    message: "Invalid Google signup token",
  });
}

export default async function validateGoogleComplete(req, res, next) {
  try {
    const errors = {};
    const googleSignupToken =
      typeof req.body?.googleSignupToken === "string" ? req.body.googleSignupToken.trim() : "";
    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";

    if (!googleSignupToken) {
      errors.googleSignupToken = "googleSignupToken is required";
    }
    if (!idToken) {
      errors.idToken = "idToken is required";
    }
    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ message: "Validation error", errors });
    }

    let profile;
    try {
      profile = verifyGoogleSignupToken(googleSignupToken);
    } catch (err) {
      return signupTokenError(err, res);
    }

    req.body.googleSignupToken = googleSignupToken;
    req.body.idToken = idToken;

    const fieldErrors = profile.userType === "coach"
      ? await applyCoachSocialValidation(req, profile)
      : await applyAthleteSocialValidation(req);

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(422).json({ message: "Validation error", errors: fieldErrors });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}
