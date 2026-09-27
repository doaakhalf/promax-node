import User from "../Models/User.js";

const VALID_GENDERS = ["male", "female", "other"];
const VALID_TRAINING_FREQUENCY = ["1", "2", "3", "4", "5", "6", "7"];

export default async function validateAppleComplete(req, res, next) {
  try {
    const errors = {};

    const appleSignupToken =
      typeof req.body?.appleSignupToken === "string" ? req.body.appleSignupToken.trim() : "";
    const identityToken =
      typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";
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

    if (!appleSignupToken) {
      errors.appleSignupToken = "appleSignupToken is required";
    }

    if (!identityToken) {
      errors.identityToken = "identityToken is required";
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

    req.body.appleSignupToken = appleSignupToken;
    req.body.identityToken = identityToken;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}
