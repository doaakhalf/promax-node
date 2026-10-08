import User from "../Models/User.js";

const VALID_GENDERS = ["male", "female", "other"];
const VALID_TRAINING_FREQUENCY = ["1", "2", "3", "4", "5", "6", "7"];
const VALID_COACH_TYPES = ["normal", "gym"];
const EGYPT_MOBILE = /^01[0125]\d{8}$/;
const INSTAPAY_PATTERN = /^https:\/\/ipn\.eg\/S\/[a-zA-Z0-9_-]+\/instapay\/[a-zA-Z0-9_-]+$/;

function trimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function validatePhoneNumber(phoneNumber, errors) {
  if (!phoneNumber) {
    errors.phoneNumber = "Phone number is required";
    return null;
  }
  if (!EGYPT_MOBILE.test(phoneNumber)) {
    errors.phoneNumber = "Phone number must be a valid Egyptian mobile number (11 digits)";
    return null;
  }
  const existing = await User.findOne({ phoneNumber }).select("_id").lean();
  if (existing) {
    errors.phoneNumber = "Phone number already exists";
    return null;
  }
  return phoneNumber;
}

function validateGender(raw, errors) {
  const gender = trimmedString(raw).toLowerCase();
  if (!gender) {
    errors.gender = "Gender is required";
    return null;
  }
  if (!VALID_GENDERS.includes(gender)) {
    errors.gender = `Gender must be one of: ${VALID_GENDERS.join(", ")}`;
    return null;
  }
  return gender;
}

export async function applyAthleteSocialValidation(req) {
  const errors = {};
  const gender = validateGender(req.body?.gender, errors);
  const phoneNumber = await validatePhoneNumber(trimmedString(req.body?.phoneNumber), errors);
  const dateOfBirth = trimmedString(req.body?.dateOfBirth);
  const weight = req.body?.weight;
  const height = req.body?.height;
  const trainingFrequency =
    typeof req.body?.trainingFrequency === "string"
      ? req.body.trainingFrequency.trim()
      : req.body?.trainingFrequency != null
        ? String(req.body.trainingFrequency).trim()
        : "";

  if (!dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required";
  } else if (Number.isNaN(new Date(dateOfBirth).getTime())) {
    errors.dateOfBirth = "Invalid date format. Expected format: YYYY-MM-DD or ISO 8601";
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
  }

  if (Object.keys(errors).length === 0) {
    req.body.gender = gender;
    req.body.phoneNumber = phoneNumber;
    req.body.trainingFrequency = trainingFrequency;
  }

  return errors;
}

function requireText(body, field, label, errors, max = 5000) {
  const value = trimmedString(body?.[field]);
  if (!value) {
    errors[field] = `${label} is required`;
    return null;
  }
  if (value.length > max) {
    errors[field] = `${label} must not exceed ${max} characters`;
    return null;
  }
  return value;
}

/**
 * Coach complete-profile fields. Name falls back to the body only when the
 * provider did not send it. Gender is required because User.gender is required.
 * sport, headline, motivation, trainingExperience, and yearOfExperience are
 * required by the Coach schema.
 */
export async function applyCoachSocialValidation(req, profile) {
  const errors = {};
  const body = req.body || {};

  const firstName = profile.firstName || trimmedString(body.firstName);
  const lastName = profile.lastName || trimmedString(body.lastName);
  if (!firstName) {
    errors.firstName = "First name is required";
  } else if (firstName.length > 255) {
    errors.firstName = "First name must not exceed 255 characters";
  }
  if (!lastName) {
    errors.lastName = "Last name is required";
  } else if (lastName.length > 255) {
    errors.lastName = "Last name must not exceed 255 characters";
  }

  const type = trimmedString(body.type);
  if (!type) {
    errors.type = "Type is required";
  } else if (!VALID_COACH_TYPES.includes(type)) {
    errors.type = `Type must be one of: ${VALID_COACH_TYPES.join(", ")}`;
  }

  const gender = validateGender(body.gender, errors);
  const phoneNumber = await validatePhoneNumber(trimmedString(body.phoneNumber), errors);

  let monthlyPriceEgp = null;
  if (!body.monthlyPriceEgp && body.monthlyPriceEgp !== 0) {
    errors.monthlyPriceEgp = "Monthly price is required";
  } else {
    const price = parseFloat(body.monthlyPriceEgp);
    if (Number.isNaN(price) || price < 0) {
      errors.monthlyPriceEgp = "Monthly price must be a positive number";
    } else {
      monthlyPriceEgp = price;
    }
  }

  const instapayLink = trimmedString(body.instapayLink);
  const walletNumber = trimmedString(body.walletNumber);
  if (!instapayLink && !walletNumber) {
    errors.instapayLink = "Either Instapay link or wallet number is required";
    errors.walletNumber = "Either Instapay link or wallet number is required";
  }
  if (instapayLink) {
    if (!INSTAPAY_PATTERN.test(instapayLink)) {
      errors.instapayLink = "Instapay link must be a valid Instapay URL";
    } else if (instapayLink.length > 1000) {
      errors.instapayLink = "Instapay link must not exceed 1000 characters";
    }
  }
  if (walletNumber && !EGYPT_MOBILE.test(walletNumber)) {
    errors.walletNumber = "Wallet number must be a valid Egyptian mobile number";
  }

  const sport = requireText(body, "sport", "Sport", errors, 255);
  const headline = requireText(body, "headline", "Headline", errors, 255);
  const motivation = requireText(body, "motivation", "Motivation", errors);
  const trainingExperience = requireText(body, "trainingExperience", "Training experience", errors);

  let yearOfExperience = null;
  if (body.yearOfExperience === undefined || body.yearOfExperience === null || body.yearOfExperience === "") {
    errors.yearOfExperience = "Year of experience is required";
  } else if (Number.isNaN(Number(body.yearOfExperience)) || Number(body.yearOfExperience) < 0) {
    errors.yearOfExperience = "Year of experience must be a number";
  } else {
    yearOfExperience = Number(body.yearOfExperience);
  }

  if (Object.keys(errors).length === 0) {
    req.body.firstName = firstName;
    req.body.lastName = lastName;
    req.body.type = type;
    req.body.gender = gender;
    req.body.phoneNumber = phoneNumber;
    req.body.monthlyPriceEgp = monthlyPriceEgp;
    req.body.instapayLink = instapayLink || undefined;
    req.body.walletNumber = walletNumber || undefined;
    req.body.sport = sport;
    req.body.headline = headline;
    req.body.motivation = motivation;
    req.body.trainingExperience = trainingExperience;
    req.body.yearOfExperience = yearOfExperience;
  }

  return errors;
}
