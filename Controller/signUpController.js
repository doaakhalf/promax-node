import User from "../Models/User.js";
import Athlete from "../Models/Athlete.js";
import { generateTokenPair } from "../utils/jwt.js";
import CoachResource from "../config/Resources/CoachResource.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import NotificationService from "../services/NotificationService.js";
import { createCoachProfile, deleteCoachArtifacts } from "../services/coachRegistration.js";
import ApiError from "../utils/ApiError.js";
import { getAthletePrice, getSubscriptionAmounts } from "../utils/coachNetAmount.js";
import { ensureUniqueSlug } from "../utils/userSlug.js";

export default async function signUpController(req, res) {
  let createdUser = null;

  try {
    const {
      email,
      password,
      user_type,
      firstName,
      lastName,
      phoneNumber,
      type,
      headline,
      instapayLink,
      introduction,
      monthlyPriceEgp,
      motivation,
      sport,
      trainingExperience,
      yearOfExperience,
      videoUrl,
      certificates,
      weight,
      height,
      gender,
      trainingFrequency,
      inbodyFile,
      dateOfBirth,
      achievements,
      goals,
      injuries,
      walletNumber
    } = req.body;

    const role = req.role;

    if (!role?._id) {
      return res.status(500).json({
        message: "Server error",
        error: "Role missing from request context"
      });
    }

    // Public signup may only create coach or athlete — never admin (from any client).
    const allowedSignupRoles = new Set(["coach", "athlete"]);
    if (
      !allowedSignupRoles.has(user_type) ||
      !allowedSignupRoles.has(role.name) ||
      user_type === "admin" ||
      role.name === "admin"
    ) {
      return res.status(403).json({
        message: "Admin accounts cannot be created via registration",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedGender = gender?.toLowerCase();

    // Create user document
    const user = new User({
      email,
      password: hashedPassword,
      role_id: role._id,
      status: user_type === "coach" ? "pending" : "active",
      firstName,
      lastName,
      phoneNumber,
      gender: normalizedGender,
      profileImage: 'images/users/' + req.files?.profileImage?.[0]?.filename || null,
      slug: await ensureUniqueSlug(),
    });

    // Save user
    createdUser = await user.save();

    if (user_type === "coach") {
      const coachData = await createCoachProfile(createdUser._id, {
        type,
        headline,
        instapayLink,
        introduction,
        monthlyPriceEgp,
        motivation,
        sport,
        trainingExperience,
        yearOfExperience,
        videoUrl,
        walletNumber,
        certificates,
        achievements,
      }, req.files);


      // Generate JWT token
      // const token = generateToken({ userId: createdUser._id, email: createdUser.email });
      const tokens = generateTokenPair({
        userId: createdUser._id,
        email: createdUser.email
      });

      NotificationService.sendNotification({
        recipientId: process.env.ADMIN_USER_ID,
        senderId: createdUser._id,
        type: "coach_registered",
        title: "تم تسجيل مدرب",
        message: "تم تسجيل مدرب. يرجى المراجعة والموافقة.",
        data: {
          userId: createdUser._id,
          email: createdUser.email
        }
      });
      return res.status(201).json({
        message: "Coach registered successfully. Awaiting admin approval.",
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        token_type: "Bearer",
        userData: {
          status: coachData.userId.status,
          role: role.name
        }
      });

    } else {


      // Create athlete profile
      const athlete = new Athlete({
        userId: createdUser._id,
        height,
        weight,
        dateOfBirth: new Date(dateOfBirth),
        trainingFrequency,
        inbodyFile: 'images/users/' + req.files?.inbodyFile?.[0]?.filename || null,
        goals,
        injuries
      });

      const athleteData = await athlete.save();
      await athleteData.populate('userId');

      // Generate JWT token
      // const token = generateToken({ userId: createdUser._id, email: createdUser.email });
      const tokens = generateTokenPair({
        userId: createdUser._id,
        email: createdUser.email
      });
      NotificationService.sendNotification({
        recipientId: process.env.ADMIN_USER_ID,
        senderId: createdUser._id,
        type: "coach_registered",
        title: "تم تسجيل رياضي",
        message: "تم تسجيل رياضي. يرجى المراجعة والموافقة.",
        data: {
          userId: createdUser._id,
          email: createdUser.email
        }
      });
      return res.status(201).json({
        message: "Athlete registered successfully",
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        token_type: "Bearer",
        userData: new AthleteResource(athleteData, { fullName: true })
      });
    }

  } catch (err) {
    // Rollback user creation if it was created but profile creation failed
    if (createdUser) {
      try {
        await deleteCoachArtifacts(createdUser._id);
        await User.findByIdAndDelete(createdUser._id);
        console.log(`Rolled back user creation for ${createdUser.email}`);
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }

    // Handle gallery validation/business-rule errors (e.g. invalid image
    // type, oversized image, too many images).
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }

    // Handle duplicate key error (email already exists)
    if (err?.code === 11000) {
      return res.status(422).json({
        message: "Validation error",
        errors: {
          email: "Email already exists"
        }
      });
    }

    // Handle mongoose validation errors
    if (err?.name === 'ValidationError') {
      const errors = {};
      Object.keys(err.errors).forEach(key => {
        errors[key] = err.errors[key].message;
      });

      return res.status(422).json({
        message: "Validation error",
        errors
      });
    }

    console.error('SignUp error:', err);
    return res.status(500).json({
      message: "Server error",
      error: err?.message || "An unexpected error occurred"
    });
  }
}
export const getPriceWithPercentage = async (req, res) => {
  try {
    const breakdown = getSubscriptionAmounts(req.body.price);
    res.status(200).json({
      message: "success",
      price: getAthletePrice(req.body.price),
      amount: breakdown.amount,
      platformFee: breakdown.platformFee,
      coachNetAmount: breakdown.coachNetAmount
    })

  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error?.message || "An unexpected error occurred"
    });
  }
}