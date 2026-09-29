import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../Models/User.js";
import Role from "../Models/Role.js";
import Athlete from "../Models/Athlete.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import { generateTokenPair } from "../utils/jwt.js";
import {
  verifyGoogleIdToken,
  issueGoogleSignupToken,
  verifyGoogleSignupToken,
} from "../utils/googleAuth.js";
import { ensureUniqueSlug, buildShareProfileUrl } from "../utils/userSlug.js";
import { displayName } from "../utils/displayName.js";
import NotificationService from "../services/NotificationService.js";

function mapGoogleAuthError(err, res) {
  const code = err?.code;
  if (code === "GOOGLE_NOT_CONFIGURED" || code === "JWT_SECRET_MISSING") {
    return res.status(500).json({
      status: "error",
      message: "Google Sign-In is not configured on the server",
    });
  }
  if (
    code === "INVALID_GOOGLE_TOKEN" ||
    code === "GOOGLE_EMAIL_MISSING" ||
    code === "GOOGLE_EMAIL_UNVERIFIED" ||
    err?.message?.includes("Wrong number of segments") ||
    err?.message?.includes("Invalid token signature") ||
    err?.message?.includes("Token used too late") ||
    err?.message?.includes("audience")
  ) {
    return res.status(401).json({
      status: "error",
      message: err.message || "Invalid Google ID token",
    });
  }
  if (code === "GOOGLE_SIGNUP_TOKEN_EXPIRED") {
    return res.status(401).json({
      status: "error",
      message: err.message,
    });
  }
  if (code === "INVALID_GOOGLE_SIGNUP_TOKEN") {
    return res.status(401).json({
      status: "error",
      message: err.message || "Invalid Google signup token",
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

async function fillMissingProfileFromGoogle(userDoc, profile) {
  const updates = {};
  if (!userDoc.firstName && profile.firstName) updates.firstName = profile.firstName;
  if (!userDoc.lastName && profile.lastName) updates.lastName = profile.lastName;
  if (!userDoc.profileImage && profile.profileImage) {
    updates.profileImage = profile.profileImage;
  }
  if (Object.keys(updates).length === 0) return userDoc;

  Object.assign(userDoc, updates);
  await userDoc.save();
  return userDoc;
}

/**
 * POST /api/auth/google
 * Existing athlete → JWT. New user → needsProfileCompletion (no JWT yet).
 */
export async function googleAuth(req, res) {
  try {
    const profile = await verifyGoogleIdToken(req.body.idToken);

    let user = await User.findOne({
      googleId: profile.googleId,
      deletedAt: null,
      status: { $nin: ["rejected", "deleted"] },
    });

    if (!user) {
      user = await User.findOne({
        email: profile.email,
        deletedAt: null,
        status: { $nin: ["rejected", "deleted"] },
      });
    }

    if (user) {
      const role = await Role.findById(user.role_id).lean();
      if (role?.name !== "athlete") {
        return res.status(403).json({
          status: "error",
          message: "Google Sign-In is available for athletes only",
        });
      }

      // Link Google identity and revoke any local password so an email squatter
      // cannot keep logging in after the real owner signs in with Google.
      if (!user.googleId || user.authProvider !== "google") {
        const randomPassword = crypto.randomBytes(32).toString("hex");
        user.googleId = profile.googleId;
        user.authProvider = "google";
        user.password = await bcrypt.hash(randomPassword, 10);
        await user.save();
      }

      user = await fillMissingProfileFromGoogle(user, profile);

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

    const googleSignupToken = issueGoogleSignupToken(profile);

    return res.status(200).json({
      needsProfileCompletion: true,
      googleSignupToken,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImage: profile.profileImage,
    });
  } catch (err) {
    const mapped = mapGoogleAuthError(err, res);
    if (mapped) return mapped;
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}

/**
 * POST /api/auth/google/complete
 * Create athlete user + profile, then return JWT.
 */
export async function completeGoogleAthlete(req, res) {
  let createdUser = null;

  try {
    const googleProfile = verifyGoogleSignupToken(req.body.googleSignupToken);
    // Re-verify a live Google ID token so a leaked signup JWT alone cannot complete signup.
    const liveProfile = await verifyGoogleIdToken(req.body.idToken);
    if (
      liveProfile.googleId !== googleProfile.googleId ||
      liveProfile.email !== googleProfile.email
    ) {
      return res.status(401).json({
        status: "error",
        message: "Google identity does not match signup token",
      });
    }

    const existingByGoogle = await User.findOne({
      googleId: googleProfile.googleId,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (existingByGoogle) {
      return res.status(422).json({
        message: "Validation error",
        errors: { email: "Account already exists. Please sign in with Google." },
      });
    }

    const existingByEmail = await User.findOne({
      email: googleProfile.email,
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

    let profileImage = googleProfile.profileImage || null;
    if (req.files?.profileImage?.[0]?.filename) {
      profileImage = `images/users/${req.files.profileImage[0].filename}`;
    }

    const user = new User({
      email: googleProfile.email,
      password: hashedPassword,
      googleId: googleProfile.googleId,
      authProvider: "google",
      role_id: athleteRole._id,
      status: "active",
      firstName: googleProfile.firstName,
      lastName: googleProfile.lastName,
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
      message: "تم تسجيل رياضي عبر Google. يرجى المراجعة.",
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
        console.error("Google complete rollback error:", rollbackErr);
      }
    }

    const mapped = mapGoogleAuthError(err, res);
    if (mapped) return mapped;

    if (err?.code === 11000) {
      const field = err.keyPattern?.phoneNumber
        ? "phoneNumber"
        : err.keyPattern?.googleId
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
