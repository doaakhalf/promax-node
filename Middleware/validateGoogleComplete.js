import User from "../Models/User.js";

const VALID_GENDERS = ["male", "female", "other"];
const VALID_TRAINING_FREQUENCY = ["1", "2", "3", "4", "5", "6", "7"];

export default async function validateGoogleComplete(req, res, next) {
  try {
    const errors = {};

    const googleSignupToken =
      typeof req.body?.googleSignupToken === "string" ? req.body.googleSignupToken.trim() : "";
    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
    const gender = typeof req.body?.gender === "string" ? req.body.gender.trim().toLowerCase() : "";
    const phoneNumber =
      typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
    const dateOfBirth =
      typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth.trim() : "";
    const weight = req.body?.weight;
    const height = req.body?.height;
    const trainingFrequency =
      typeof req.body?.trainingFrequency === "string"
        ? req.body.trainingFrequency.trim()
        : req.body?.trainingFrequency != null
          ? String(req.body.trainingFrequency).trim()
          : "";

    if (!googleSignupToken) {
      errors.googleSignupToken = "googleSignupToken is required";
    }

    if (!idToken) {
      errors.idToken = "idToken is required";
    }

    if (!gender) {
      errors.gender = "Gender is required";
    } else if (!VALID_GENDERS.includes(gender)) {
      errors.gender = `Gender must be one of: ${VALID_GENDERS.join(", ")}`;
    } else {
      req.body.gender = gender;
    }

    if (!phoneNumber) {
      errors.phoneNumber = "Phone number is required";
    } else if (!/^01[0125]\d{8}$/.test(phoneNumber)) {
      errors.phoneNumber =
        "Phone number must be a valid Egyptian mobile number (11 digits)";
    } else {
      const existing = await User.findOne({ phoneNumber }).select("_id").lean();
      if (existing) {
        errors.phoneNumber = "Phone number already exists";
      } else {
        req.body.phoneNumber = phoneNumber;
      }
    }

    if (!dateOfBirth) {
      errors.dateOfBirth = "Date of birth is required";
    } else {
      const date = new Date(dateOfBirth);
      if (Number.isNaN(date.getTime())) {
        errors.dateOfBirth = "Invalid date format. Expected format: YYYY-MM-DD or ISO 8601";
      }
    }

    if (weight === undefined || weight === null || weight === "") {
      errors.weight = "Weight is required";
    } else if (Number.isNaN(Number(weight))) {
      errors.weight = "Weight must be a number";
    }

    if (height === undefined || height === null || height === "") {
      errors.height = "Height is required";
    } else if (Number.isNaN(Number(height))) {
      errors.height = "Height must be a number";
    }

    if (!trainingFrequency) {
      errors.trainingFrequency = "Training frequency is required";
    } else if (!VALID_TRAINING_FREQUENCY.includes(trainingFrequency)) {
      errors.trainingFrequency = `Training frequency must be one of: ${VALID_TRAINING_FREQUENCY.join(", ")}`;
    } else {
      req.body.trainingFrequency = trainingFrequency;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({
        message: "Validation error",
        errors,
      });
    }

    req.body.googleSignupToken = googleSignupToken;
    req.body.idToken = idToken;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}
