import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../Models/User.js";
import Role from "../Models/Role.js";
import Coach from "../Models/Coach.js";
import Certificate from "../Models/Certificate.js";
import Achievement from "../Models/Achievement.js";
import GalleryService from "./GalleryService.js";
import ApiError from "../utils/ApiError.js";
import { generateTokenPair } from "../utils/jwt.js";
import { ensureUniqueSlug } from "../utils/userSlug.js";
import NotificationService from "./NotificationService.js";

async function saveCertificates(userId, certificates, files) {
  if (!certificates) return;

  let parsedCertificates;
  try {
    parsedCertificates = typeof certificates === "string"
      ? JSON.parse(certificates)
      : (Array.isArray(certificates) ? certificates : []);
  } catch (e) {
    console.error("Failed to parse certificates:", e);
    parsedCertificates = [];
  }

  const certificateFiles = files?.certificates || [];
  if (parsedCertificates.length === 0 || certificateFiles.length === 0) return;

  const certificatePromises = parsedCertificates.map((cert, index) => {
    const uploadedFile = certificateFiles[index];
    if (!uploadedFile?.filename) {
      console.warn(`Certificate file missing for ${cert.name} at index ${index}`);
      return null;
    }

    return Certificate.create({
      userId,
      certificateName: cert.name,
      year: parseInt(cert.year),
      certificateImage: `images/users/${uploadedFile.filename}`,
    });
  });

  await Promise.all(certificatePromises.filter((p) => p !== null));
}

async function saveAchievements(userId, achievements, files) {
  if (!achievements) return;

  let achievementsRaw = achievements;
  if (Array.isArray(achievementsRaw)) {
    achievementsRaw = achievementsRaw.find((v) => v && v !== "null" && v !== "undefined") || "[]";
  }

  let parsedAchievements;
  try {
    parsedAchievements = typeof achievementsRaw === "string"
      ? JSON.parse(achievementsRaw)
      : (Array.isArray(achievementsRaw) ? achievementsRaw : []);
  } catch (e) {
    console.error("Failed to parse achievements:", e);
    parsedAchievements = [];
  }

  if (parsedAchievements.length === 0) return;

  const achievementFiles = files?.achievements || [];
  let fileIndex = 0;

  const achievementPromises = parsedAchievements.map((ach) => {
    let uploadedFile = null;
    if (ach.hasImage) {
      uploadedFile = achievementFiles[fileIndex];
      fileIndex++;
      if (!uploadedFile?.filename) {
        console.warn(`Achievement file missing for ${ach.name} despite hasImage=true`);
      }
    }

    return Achievement.create({
      userId,
      name: ach.name,
      rank: ach.rank,
      image: uploadedFile?.filename ? `images/users/${uploadedFile.filename}` : null,
    });
  });

  await Promise.all(achievementPromises);
}

/**
 * Coach document plus optional gallery, certificates, and achievements.
 * Caller owns the User document and rollback.
 */
export async function createCoachProfile(userId, body, files = {}) {
  const instapayLink = typeof body.instapayLink === "string" ? body.instapayLink.trim() : body.instapayLink;
  const walletNumber = typeof body.walletNumber === "string" ? body.walletNumber.trim() : body.walletNumber;

  const coach = new Coach({
    userId,
    type: body.type,
    headline: body.headline,
    instapayLink,
    introduction: body.introduction,
    monthlyPriceEgp: body.monthlyPriceEgp,
    motivation: body.motivation,
    sport: body.sport,
    trainingExperience: body.trainingExperience,
    yearOfExperience: body.yearOfExperience,
    videoUrl: body.videoUrl,
    walletNumber,
  });

  const coachData = await coach.save();
  await coachData.populate("userId");

  if (files?.galleryImages?.length) {
    await GalleryService.addImagesForUser(userId, files.galleryImages);
  }

  await saveCertificates(userId, body.certificates, files);
  await saveAchievements(userId, body.achievements, files);

  return coachData;
}

export async function deleteCoachArtifacts(userId) {
  await Certificate.deleteMany({ userId }).catch(() => {});
  await Achievement.deleteMany({ userId }).catch(() => {});
  await Coach.deleteOne({ userId }).catch(() => {});
  await GalleryService.deleteAllForUser(userId).catch(() => {});
}

function duplicateKeyResponse(err, res) {
  const field = err.keyPattern?.phoneNumber
    ? "phoneNumber"
    : "email";
  return res.status(422).json({
    message: "Validation error",
    errors: {
      [field]: field === "phoneNumber" ? "Phone number already exists" : "Email already exists",
    },
  });
}

function validationErrorResponse(err, res) {
  const errors = {};
  Object.keys(err.errors || {}).forEach((key) => {
    errors[key] = err.errors[key].message;
  });
  return res.status(422).json({
    message: "Validation error",
    errors,
  });
}

/**
 * Create a pending coach from a verified Google or Apple identity.
 * Sends the HTTP response.
 */
export async function registerSocialCoach(req, res, identity) {
  let createdUser = null;

  try {
    const role = await Role.findOne({ name: "coach" }).lean();
    if (!role?._id) {
      return res.status(500).json({
        message: "Server error",
        error: "Coach role not found in database. Seed roles first.",
      });
    }

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    let profileImage = identity.profileImage || null;
    if (req.files?.profileImage?.[0]?.filename) {
      profileImage = `images/users/${req.files.profileImage[0].filename}`;
    }

    const userFields = {
      email: identity.email,
      password: hashedPassword,
      authProvider: identity.authProvider,
      role_id: role._id,
      status: "pending",
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
      gender: req.body.gender,
      profileImage,
      slug: await ensureUniqueSlug(),
    };
    if (identity.googleId) userFields.googleId = identity.googleId;
    if (identity.appleId) userFields.appleId = identity.appleId;

    const user = new User(userFields);
    createdUser = await user.save();

    const coachData = await createCoachProfile(createdUser._id, req.body, req.files);

    const tokens = generateTokenPair({
      userId: createdUser._id,
      email: createdUser.email,
    });

    NotificationService.sendNotification({
      recipientId: process.env.ADMIN_USER_ID,
      senderId: createdUser._id,
      type: "coach_registered",
      title: "تم تسجيل مدرب",
      message: `تم تسجيل مدرب عبر ${identity.providerLabel}. يرجى المراجعة والموافقة.`,
      data: {
        userId: createdUser._id,
        email: createdUser.email,
      },
    });

    return res.status(201).json({
      message: "Coach registered successfully. Awaiting admin approval.",
      needsProfileCompletion: false,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      token_type: "Bearer",
      userData: {
        status: coachData.userId.status,
        role: role.name,
      },
    });
  } catch (err) {
    if (createdUser) {
      try {
        await deleteCoachArtifacts(createdUser._id);
        await User.findByIdAndDelete(createdUser._id);
      } catch (rollbackErr) {
        console.error("Social coach rollback error:", rollbackErr);
      }
    }

    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }

    if (err?.code === 11000) {
      return duplicateKeyResponse(err, res);
    }

    if (err?.name === "ValidationError") {
      return validationErrorResponse(err, res);
    }

    console.error("Social coach signup error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err?.message || "An unexpected error occurred",
    });
  }
}
