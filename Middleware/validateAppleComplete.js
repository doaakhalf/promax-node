import { verifyAppleSignupToken } from "../utils/appleAuth.js";
import {
  applyAthleteSocialValidation,
  applyCoachSocialValidation,
} from "./validateSocialProfile.js";

function signupTokenError(err, res) {
  if (err?.code === "JWT_SECRET_MISSING") {
    return res.status(500).json({
      status: "error",
      message: "Apple Sign-In is not configured on the server",
    });
  }
  if (err?.code === "APPLE_SIGNUP_TOKEN_EXPIRED" || err?.code === "INVALID_APPLE_SIGNUP_TOKEN") {
    return res.status(401).json({
      status: "error",
      message: err.message || "Invalid Apple signup token",
    });
  }
  return res.status(401).json({
    status: "error",
    message: "Invalid Apple signup token",
  });
}

export default async function validateAppleComplete(req, res, next) {
  try {
    const errors = {};
    const appleSignupToken =
      typeof req.body?.appleSignupToken === "string" ? req.body.appleSignupToken.trim() : "";
    const identityToken =
      typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";

    if (!appleSignupToken) {
      errors.appleSignupToken = "appleSignupToken is required";
    }
    if (!identityToken) {
      errors.identityToken = "identityToken is required";
    }
    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ message: "Validation error", errors });
    }

    let profile;
    try {
      profile = verifyAppleSignupToken(appleSignupToken);
    } catch (err) {
      return signupTokenError(err, res);
    }

    req.body.appleSignupToken = appleSignupToken;
    req.body.identityToken = identityToken;

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
