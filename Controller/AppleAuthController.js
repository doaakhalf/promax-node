import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../Models/User.js";
import Role from "../Models/Role.js";
import Athlete from "../Models/Athlete.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import { generateTokenPair } from "../utils/jwt.js";
import {
  verifyAppleIdentityToken,
  issueAppleSignupToken,
  verifyAppleSignupToken,
} from "../utils/appleAuth.js";
import { ensureUniqueSlug, buildShareProfileUrl } from "../utils/userSlug.js";
import { displayName } from "../utils/displayName.js";
import NotificationService from "../services/NotificationService.js";
import { registerSocialCoach } from "../services/coachRegistration.js";

function mapAppleAuthError(err, res) {
  const code = err?.code;
  if (code === "APPLE_NOT_CONFIGURED" || code === "JWT_SECRET_MISSING" || code === "APPLE_KEYS_UNAVAILABLE") {
    return res.status(500).json({
      status: "error",
      message: "Apple Sign-In is not configured on the server",
    });
  }
  if (
    code === "INVALID_APPLE_TOKEN" ||
    code === "APPLE_EMAIL_UNVERIFIED" ||
    code === "APPLE_EMAIL_MISSING"
  ) {
    return res.status(401).json({
      status: "error",
      message: err.message || "Invalid Apple identity token",
    });
  }
  if (code === "APPLE_SIGNUP_TOKEN_EXPIRED") {
    return res.status(401).json({
      status: "error",
      message: err.message,
    });
  }
  if (code === "INVALID_APPLE_SIGNUP_TOKEN") {
    return res.status(401).json({
      status: "error",
      message: err.message || "Invalid Apple signup token",
    });
  }
  return null;
}

function buildLoginUserPayload(user, roleName) {
  return {
    id: user._id.toString(),
    name: displayName(user, { full: true }),
    email: user.email,
    role: roleName,
    profileImage: user?.profileImage || null,
    status: user.status,
    slug: user.slug,
    shareProfileUrl: buildShareProfileUrl(user),
  };
}

async function fillMissingNames(userDoc, firstName, lastName) {
  const updates = {};
  if (!userDoc.firstName && firstName) updates.firstName = firstName;
  if (!userDoc.lastName && lastName) updates.lastName = lastName;
  if (Object.keys(updates).length === 0) return userDoc;

  Object.assign(userDoc, updates);
  await userDoc.save();
  return userDoc;
}

/**
 * POST /api/auth/apple
 * Existing coach or athlete → JWT. New user → needsProfileCompletion (no JWT yet).
 */
export async function appleAuth(req, res) {
  try {
    const profile = await verifyAppleIdentityToken(req.body.identityToken);
    const firstName = req.body.firstName || null;
    const lastName = req.body.lastName || null;

    let user = await User.findOne({
      appleId: profile.appleId,
      deletedAt: null,
      status: { $nin: ["rejected", "deleted"] },
    });

    if (!user && profile.email) {
      user = await User.findOne({
        email: profile.email,
        deletedAt: null,
        status: { $nin: ["rejected", "deleted"] },
      });
    }

    if (user) {
      const role = await Role.findById(user.role_id).lean();
      if (role?.name !== "athlete" && role?.name !== "coach") {
        return res.status(403).json({
          status: "error",
          message: "Apple Sign-In is available for athletes and coaches only",
        });
      }

      if (user.appleId && user.appleId !== profile.appleId) {
        return res.status(422).json({
          message: "Validation error",
          errors: { email: "Email already exists" },
        });
      }

      // Link Apple on a local account and revoke the password so the old
      // password cannot keep working after the owner signs in with Apple.
      // A Google account keeps googleId and authProvider so both still work.
      if (!user.appleId) {
        user.appleId = profile.appleId;
      }
      if (user.authProvider === "local") {
        const randomPassword = crypto.randomBytes(32).toString("hex");
        user.authProvider = "apple";
        user.password = await bcrypt.hash(randomPassword, 10);
      }
      if (user.isModified()) {
        await user.save();
      }

      user = await fillMissingNames(user, firstName, lastName);

      const tokens = generateTokenPair({
        userId: user._id,
        email: user.email,
      });

      return res.status(200).json({
        message: "Login successful",
        needsProfileCompletion: false,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        token_type: "Bearer",
        status: "success",
        user: buildLoginUserPayload(user, role.name),
      });
    }

    if (!profile.email) {
      const err = new Error("Apple did not provide an email. Please sign in with Apple again.");
      err.code = "APPLE_EMAIL_MISSING";
      throw err;
    }

    const userType = req.body.user_type === "coach" ? "coach" : "athlete";
    const appleSignupToken = issueAppleSignupToken({
      appleId: profile.appleId,
      email: profile.email,
      firstName,
      lastName,
      userType,
    });

    return res.status(200).json({
      needsProfileCompletion: true,
      appleSignupToken,
      email: profile.email,
      firstName,
      lastName,
      profileImage: null,
      userType,
    });
  } catch (err) {
    const mapped = mapAppleAuthError(err, res);
    if (mapped) return mapped;
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}

/**
 * POST /api/auth/apple/complete
 * Create coach or athlete from the signup token role, then return JWT.
 */
export async function completeAppleSignup(req, res) {
  let createdUser = null;

  try {
    const appleProfile = verifyAppleSignupToken(req.body.appleSignupToken);
    const liveProfile = await verifyAppleIdentityToken(req.body.identityToken);
    if (liveProfile.appleId !== appleProfile.appleId) {
      return res.status(401).json({
        status: "error",
        message: "Apple identity does not match signup token",
      });
    }
    if (liveProfile.email && liveProfile.email !== appleProfile.email) {
      return res.status(401).json({
        status: "error",
        message: "Apple identity does not match signup token",
      });
    }

    const existingByApple = await User.findOne({
      appleId: appleProfile.appleId,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (existingByApple) {
      return res.status(422).json({
        message: "Validation error",
        errors: { email: "Account already exists. Please sign in with Apple." },
      });
    }

    const existingByEmail = await User.findOne({
      email: appleProfile.email,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (existingByEmail) {
      return res.status(422).json({
        message: "Validation error",
        errors: { email: "Email already exists" },
      });
    }

    if (appleProfile.userType === "coach") {
      return registerSocialCoach(req, res, {
        email: appleProfile.email,
        profileImage: null,
        authProvider: "apple",
        appleId: appleProfile.appleId,
        providerLabel: "Apple",
      });
    }

    const athleteRole = await Role.findOne({ name: "athlete" }).lean();
    if (!athleteRole?._id) {
      return res.status(500).json({
        message: "Server error",
        error: "Athlete role not found in database. Seed roles first.",
      });
    }

    const {
      gender,
      phoneNumber,
      dateOfBirth,
      weight,
      height,
      trainingFrequency,
      goals,
      injuries,
    } = req.body;

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const profileImage = req.files?.profileImage?.[0]?.filename
      ? `images/users/${req.files.profileImage[0].filename}`
      : null;

    const user = new User({
      email: appleProfile.email,
      password: hashedPassword,
      appleId: appleProfile.appleId,
      authProvider: "apple",
      role_id: athleteRole._id,
      status: "active",
      firstName: appleProfile.firstName,
      lastName: appleProfile.lastName,
      phoneNumber,
      gender,
      profileImage,
      slug: await ensureUniqueSlug(),
    });

    createdUser = await user.save();

    const athlete = new Athlete({
      userId: createdUser._id,
      height,
      weight,
      dateOfBirth: new Date(dateOfBirth),
      trainingFrequency,
      inbodyFile: req.files?.inbodyFile?.[0]?.filename
        ? `images/users/${req.files.inbodyFile[0].filename}`
        : null,
      goals: goals || null,
      injuries: injuries || null,
    });

    const athleteData = await athlete.save();
    await athleteData.populate("userId");

    const tokens = generateTokenPair({
      userId: createdUser._id,
      email: createdUser.email,
    });

    NotificationService.sendNotification({
      recipientId: process.env.ADMIN_USER_ID,
      senderId: createdUser._id,
      type: "coach_registered",
      title: "تم تسجيل رياضي",
      message: "تم تسجيل رياضي عبر Apple. يرجى المراجعة.",
      data: {
        userId: createdUser._id,
        email: createdUser.email,
      },
    });

    return res.status(201).json({
      message: "Athlete registered successfully",
      needsProfileCompletion: false,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      token_type: "Bearer",
      userData: new AthleteResource(athleteData, { fullName: true }),
    });
  } catch (err) {
    if (createdUser) {
      try {
        await Athlete.deleteOne({ userId: createdUser._id }).catch(() => {});
        await User.findByIdAndDelete(createdUser._id);
      } catch (rollbackErr) {
        console.error("Apple complete rollback error:", rollbackErr);
      }
    }

    const mapped = mapAppleAuthError(err, res);
    if (mapped) return mapped;

    if (err?.code === 11000) {
      const field = err.keyPattern?.phoneNumber
        ? "phoneNumber"
        : err.keyPattern?.appleId
          ? "email"
          : "email";
      return res.status(422).json({
        message: "Validation error",
        errors: {
          [field]: field === "phoneNumber" ? "Phone number already exists" : "Email already exists",
        },
      });
    }

    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}
