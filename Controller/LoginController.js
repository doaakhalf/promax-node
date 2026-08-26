

import User from "../Models/User.js";
import { generateTokenPair, verifyRefreshToken } from "../utils/jwt.js";
import bcrypt from "bcrypt";
import Role from "../Models/Role.js";
import Coach from "../Models/Coach.js";
import CoachResource from "../config/Resources/CoachResource.js";
import Athlete from "../Models/Athlete.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import Certificate from "../Models/Certificate.js";
import Achievement from "../Models/Achievement.js";
import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import { ObjectId } from "mongodb";
import GalleryService from "../services/GalleryService.js";
import ApiError from "../utils/ApiError.js";
import FileService from "../services/file.service.js";


export default async function LoginController(req, res) {
  try {
    const { email, password } = req.body;



    const user = await User.findOne({
      email,
      deletedAt: null,
      status: { $nin: ["rejected", "deleted"] }
    }).lean();

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password"
      });
    }

    const role = await Role.findById(user.role_id).lean();

    // const token = generateToken({ userId: user._id.toString(), email: user.email });
    // In the login function:
    const tokens = generateTokenPair({
      userId: user._id,
      email: user.email
    });
    if (user.status === "pending" && role?.name !== "athlete") {
      const coach = await Coach.findOne({ userId: user._id.toString() }).populate('userId').lean();



      return res.status(200).json({
        message: "Login successful",
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        token_type: "Bearer",

        user: new CoachResource(coach, role)
      });
    }

    return res.status(200).json({
      message: "Login successful",
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      token_type: "Bearer",
      status: "success",

      user: {
        "id": user._id.toString(),
        "name": user.firstName + " " + user.lastName.charAt(0).toUpperCase(),
        "email": user.email,
        "role": role?.name,
        "profileImage": user?.profileImage || null,
        "status": user.status
      }

    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}
export async function EditCoachProfile(req, res) {
  try {
    const body = req.body;
console.log(body,'body in edit coach profile');

    const user_type = req.user.role_id.name;
    const userUpdate = {}
    if (body.firstName) userUpdate.firstName = body.firstName;
    if (body.lastName) userUpdate.lastName = body.lastName;
    if (body.email) userUpdate.email = body.email;
    if (body.gender) userUpdate.gender = body.gender.toLowerCase();
    if (body.phoneNumber) userUpdate.phoneNumber = body.phoneNumber;

    // Capture the old profile image before it's overwritten, so it can be
    // removed from the Railway Volume once the replacement is confirmed saved.
    let oldProfileImage = null;
   
    
    if (req.files?.profileImage?.[0]) {
      const existingUser = await User.findById(req.user._id).select('profileImage').lean();
      oldProfileImage = existingUser?.profileImage || null;
      userUpdate.profileImage = `images/${req.uploadFolder}/${req.files.profileImage[0].filename}`;
    }
   
    //update user
    await User.findByIdAndUpdate(req.user._id, userUpdate);

    // Only delete the old physical file after the DB update has succeeded.
    if (oldProfileImage) {
      await FileService.deleteFile(FileService.resolvePublicPath(oldProfileImage));
    }


    //update coach§
    if (user_type === "coach") {
      const coachUpdate = {};
      if (body.headline) coachUpdate.headline = body.headline;
      if (body.instapayLink)
        {
          coachUpdate.instapayLink = body.instapayLink.trim();
          coachUpdate.walletNumber=null;
        } 
        if (body.walletNumber)
        {
          coachUpdate.walletNumber = body.walletNumber.trim();
          coachUpdate.instapayLink=null;
        }
      if (body.introduction) coachUpdate.introduction = body.introduction;
      if (body.monthlyPriceEgp) coachUpdate.monthlyPriceEgp = body.monthlyPriceEgp;
      if (body.motivation) coachUpdate.motivation = body.motivation;
      if (body.sport) coachUpdate.sport = body.sport;
      if (body.trainingExperience) coachUpdate.trainingExperience = body.trainingExperience;
      if (body.videoUrl) coachUpdate.videoUrl = body.videoUrl;
      if (body.yearOfExperience) coachUpdate.yearOfExperience = body.yearOfExperience;

      await Coach.findOneAndUpdate({ userId: req.user._id }, coachUpdate);


      // Handle certificates update
      if (body.certificates) {
        let parsedCertificates;
        try {
          // Handle different formats from frontend
          if (typeof body.certificates === 'string') {
            parsedCertificates = JSON.parse(body.certificates);
          } else if (Array.isArray(body.certificates)) {
            // Check if it's an array with JSON string at index 0
            if (body.certificates.length > 0 && typeof body.certificates[0] === 'string') {
              parsedCertificates = JSON.parse(body.certificates[0]);
            } else {
              parsedCertificates = body.certificates;
            }
          } else {
            parsedCertificates = [];
          }


        } catch (e) {
          console.error('Failed to parse certificates:', e);
          parsedCertificates = [];
        }

        const certificateFiles = req.files?.certificates || [];


        // Get IDs of certificates being kept/updated
        const keptCertificateIds = parsedCertificates
          .filter(cert => cert.id)
          .map(cert => cert.id);

        // Capture file paths of certificates about to be removed, and of
        // certificates being updated (in case their image is replaced), so
        // the old physical files can be cleaned up after the DB writes succeed.
        const certificatesToDelete = await Certificate.find({
          userId: req.userId,
          _id: { $nin: keptCertificateIds }
        }).select('certificateImage').lean();

        const oldCertificates = await Certificate.find({
          _id: { $in: keptCertificateIds }
        }).select('certificateImage').lean();
        const oldCertificateImageById = new Map(
          oldCertificates.map(c => [c._id.toString(), c.certificateImage])
        );

        // Delete certificates not in the request
        await Certificate.deleteMany({
          userId: req.userId,
          _id: { $nin: keptCertificateIds }
        });

        // Remove the now-orphaned physical files only after the DB delete succeeded.
        await FileService.deleteMultipleFiles(
          certificatesToDelete.map(c => FileService.resolvePublicPath(c.certificateImage))
        );

        // Process each certificate
        // Multer filters out nulls, so files array only contains actual files
        // Use hasNewImage flag to determine which items should consume files
        let fileIndex = 0;
        const certificatePromises = parsedCertificates.map(async (cert, index) => {
          // Consume file if item has hasNewImage flag set to true
          const uploadedFile = cert.hasNewImage && fileIndex < certificateFiles.length
            ? certificateFiles[fileIndex++]
            : null;

          if (cert.id) {
            // Update existing certificate
            const updateData = {
              certificateName: cert.name,
              year: parseInt(cert.year)
            };

            // Only update image if new file uploaded
            if (uploadedFile?.filename) {
              updateData.certificateImage = `images/users/${uploadedFile.filename}`;
            }

            const updated = await Certificate.findByIdAndUpdate(cert.id, updateData);

            // Image was replaced: delete the old physical file now that the
            // DB update has succeeded.
            if (uploadedFile?.filename) {
              const oldImage = oldCertificateImageById.get(cert.id);
              if (oldImage) {
                await FileService.deleteFile(FileService.resolvePublicPath(oldImage));
              }
            }

            return updated;
          } else {
            // Create new certificate
            if (!uploadedFile?.filename) {
              console.warn(`Certificate file missing for ${cert.name} at index ${index}`);
              return null;
            }

            return Certificate.create({
              userId: req.user._id,
              certificateName: cert.name,
              year: parseInt(cert.year),
              certificateImage: `images/users/${uploadedFile.filename}`
            });
          }
        });

        await Promise.all(certificatePromises.filter(p => p !== null));
      }

      // Handle achievements update
      if (body.achievements) {
        let parsedAchievements;
        try {
          // Handle different formats from frontend
          if (typeof body.achievements === 'string') {
            parsedAchievements = JSON.parse(body.achievements);
          } else if (Array.isArray(body.achievements)) {
            // Check if it's an array with JSON string at index 0
            if (body.achievements.length > 0 && typeof body.achievements[0] === 'string') {
              parsedAchievements = JSON.parse(body.achievements[0]);
            } else {
              parsedAchievements = body.achievements;
            }
          } else {
            parsedAchievements = [];
          }


        } catch (e) {
          console.error('Failed to parse achievements:', e);
          parsedAchievements = [];
        }

        const achievementFiles = req.files?.achievements || [];


        // Get IDs of achievements being kept/updated
        const keptAchievementIds = parsedAchievements
          .filter(ach => ach.id)
          .map(ach => ach.id);

        // Capture file paths of achievements about to be removed, and of
        // achievements being updated (in case their image is replaced), so
        // the old physical files can be cleaned up after the DB writes succeed.
        const achievementsToDelete = await Achievement.find({
          userId: req.user._id,
          _id: { $nin: keptAchievementIds }
        }).select('image').lean();

        const oldAchievements = await Achievement.find({
          _id: { $in: keptAchievementIds }
        }).select('image').lean();
        const oldAchievementImageById = new Map(
          oldAchievements.map(a => [a._id.toString(), a.image])
        );

        // Delete achievements not in the request
        await Achievement.deleteMany({
          userId: req.user._id,
          _id: { $nin: keptAchievementIds }
        });

        // Remove the now-orphaned physical files only after the DB delete succeeded.
        await FileService.deleteMultipleFiles(
          achievementsToDelete.map(a => FileService.resolvePublicPath(a.image))
        );

        // Process each achievement
        // Multer filters out nulls, so files array only contains actual files
        // Use hasNewImage flag to determine which items should consume files
        let achFileIndex = 0;
        const achievementPromises = parsedAchievements.map(async (ach, index) => {
          // Consume file if item has hasNewImage flag set to true
          const uploadedFile = ach.hasNewImage && achFileIndex < achievementFiles.length
            ? achievementFiles[achFileIndex++]
            : null;

          if (ach.id) {
            // Update existing achievement
            const updateData = {
              name: ach.name,
              rank: ach.rank
            };

            // Only update image if new file uploaded
            if (uploadedFile?.filename) {
              updateData.image = `images/users/${uploadedFile.filename}`;
            }

            const updated = await Achievement.findByIdAndUpdate(ach.id, updateData);

            // Image was replaced: delete the old physical file now that the
            // DB update has succeeded.
            if (uploadedFile?.filename) {
              const oldImage = oldAchievementImageById.get(ach.id);
              if (oldImage) {
                await FileService.deleteFile(FileService.resolvePublicPath(oldImage));
              }
            }

            return updated;
          } else {


            return Achievement.create({
              userId: req.user._id,
              name: ach.name,
              rank: ach.rank,
              image: uploadedFile?.filename ? `images/users/${uploadedFile.filename}` : null
            });
          }
        });

        await Promise.all(achievementPromises.filter(p => p !== null));
      }
    }

    // Gallery management: add newly uploaded images and/or remove
    // selected ones. userId always comes from the authenticated
    // request (req.user._id), never from the client body. Images not
    // mentioned are left untouched.
    const galleryFiles = req.files?.galleryImages || [];
    console.log(req.body.removeGalleryImageIds,'removeGalleryImageIds');
    
    const removeGalleryImageIds = GalleryService.parseIdArray(req.body.removeGalleryImageIds);
    if (galleryFiles.length || removeGalleryImageIds.length) {
      await GalleryService.updateGalleryForUser(req.user._id, {
        newFiles: galleryFiles,
        removeGalleryImageIds
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully",

    });

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ message: "Server error", error: error?.message || error });
  }
}
export async function EditAthleteProfile(req, res) {
  try {
    const body = req.body;
    const user_type = req.user.role_id.name;
    const userUpdate = {}
    if (body.firstName) userUpdate.firstName = body.firstName;
    if (body.lastName) userUpdate.lastName = body.lastName;
    if (body.email) userUpdate.email = body.email;
    if (body.phoneNumber) userUpdate.phoneNumber = body.phoneNumber;
    if (body.gender) userUpdate.gender = body.gender;

    // Capture the old profile image before it's overwritten, so it can be
    // removed from the Railway Volume once the replacement is confirmed saved.
    let oldProfileImage = null;
    if (req.files?.profileImage?.[0]) {
      const existingUser = await User.findById(req.user._id).select('profileImage').lean();
      oldProfileImage = existingUser?.profileImage || null;
      userUpdate.profileImage = `images/users/${req.files.profileImage[0].filename}`;
    }
    //update user
    await User.findByIdAndUpdate(req.user._id, userUpdate);

    // Only delete the old physical file after the DB update has succeeded.
    if (oldProfileImage) {
      await FileService.deleteFile(FileService.resolvePublicPath(oldProfileImage));
    }
    //update athlete
    if (user_type === "athlete") {
      const athleteUpdate = {};
      if (body.dateOfBirth) athleteUpdate.dateOfBirth = new Date(body.dateOfBirth);

      if (body.weight) athleteUpdate.weight = body.weight;
      if (body.height) athleteUpdate.height = body.height;
      if (body.goals) athleteUpdate.goals = body.goals;
      if (body.injuries) athleteUpdate.injuries = body.injuries;

      if (body.trainingFrequency) athleteUpdate.trainingFrequency = body.trainingFrequency;
      if (req.files?.inbodyFile?.[0]) {
        athleteUpdate.inbodyFile = `images/athletes/${req.files.inbodyFile[0].filename}`;
      }



      await Athlete.findOneAndUpdate({ userId: req.user._id }, athleteUpdate);
    }

    // Gallery management: add newly uploaded images and/or remove
    // selected ones. userId always comes from the authenticated
    // request (req.user._id), never from the client body. Images not
    // mentioned are left untouched.
    // const galleryFiles = req.files?.galleryImages || [];
    // const removeGalleryImageIds = GalleryService.parseIdArray(req.body.removeGalleryImageIds);
    // if (galleryFiles.length || removeGalleryImageIds.length) {
    //   await GalleryService.updateGalleryForUser(req.user._id, {
    //     newFiles: galleryFiles,
    //     removeGalleryImageIds
    //   });
    // }

    return res.status(200).json({
      message: "Profile updated successfully",

    });

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ message: "Server error", error: error?.message || error });
  }
}



export async function refreshTokenController(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: "error",
        message: "Refresh token is required"
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error.message === 'REFRESH_TOKEN_EXPIRED') {
        return res.status(401).json({
          status: "error",
          message: "Refresh token expired",
          code: "REFRESH_TOKEN_EXPIRED"
        });
      }
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token"
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId)
      .populate("role_id")
      .lean();

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found"
      });
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: user._id,
      email: user.email
    });

    return res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
      error: error?.message || error
    });
  }
}
export async function deleteAccount(req, res) {
  try {
    const userId = req.userId; // From auth middleware
    const deletedAt = new Date();

    // Find user and get role
    const user = await User.findById(userId).populate('role_id').lean();

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    if (user.deletedAt) {
      return res.status(400).json({
        status: "error",
        message: "Account already deleted"
      });
    }

    const roleName = user.role_id?.name;

    // Soft delete related data based on role
    if (roleName === 'coach') {
      // Soft delete coach-related data
      await Certificate.updateMany({ userId: userId }, { deletedAt });
      await Achievement.updateMany({ userId: userId }, { deletedAt });
      await Coach.updateOne({ userId: userId }, { deletedAt });
      await Subscription.updateMany({ coachId: userId }, { deletedAt });
      await WorkoutCalendar.updateMany({ coachId: userId }, { deletedAt });
    } else if (roleName === 'athlete') {
      // Soft delete athlete-related data

      await Athlete.updateOne({ userId: userId }, { deletedAt });
      await Subscription.updateMany({ athleteId: userId }, { deletedAt });
    }

    // Soft delete the user
    await User.findByIdAndUpdate(userId, {
      deletedAt,
      status: 'deleted'
    });

    return res.status(200).json({
      status: "success",
      message: "Account deleted successfully"
    });

  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
      error: error?.message || error
    });
  }
}

export async function deletePending(req, res) {
  try {


    // Find user and get role
    const users = await User.find({ role_id: new ObjectId('6a12fc760882ad22a09df8a3'), _id: { $nin: new ObjectId('6a2eafd39ab897efa197b64a') } }).lean();
    const usersids = users.map(user => user._id);

    // Get all subscriptions for these users
    const subscriptions = await Subscription.find({
      $or: [
        { athleteId: { $in: usersids } },
        { coachId: { $in: usersids } }
      ]
    }).lean();
    const subscriptionIds = subscriptions.map(sub => sub._id);

    // Get all workout calendars for these users
    const workoutCalendars = await WorkoutCalendar.find({
      $or: [
        { athleteId: { $in: usersids } },
        { coachId: { $in: usersids } },
        { subscriptionId: { $in: subscriptionIds } }
      ]
    }).lean();
    const calendarIds = workoutCalendars.map(cal => cal._id);

    // Delete workout assignments related to these calendars and users
    await WorkoutAssignment.deleteMany({
      $or: [
        { calendarId: { $in: calendarIds } },
        { athleteId: { $in: usersids } },
        { coachId: { $in: usersids } }
      ]
    });

    // Delete workout calendars
    await WorkoutCalendar.deleteMany({
      $or: [
        { athleteId: { $in: usersids } },
        { coachId: { $in: usersids } },
        { subscriptionId: { $in: subscriptionIds } }
      ]
    });

    // Delete subscription payments related to these subscriptions
    await SubscriptionPayment.deleteMany({ subscriptionId: { $in: subscriptionIds } });

    // Delete athletes
    await Athlete.deleteMany({ userId: { $in: usersids } });

    // Delete subscriptions
    await Subscription.deleteMany({
      $or: [
        { athleteId: { $in: usersids } },
        { coachId: { $in: usersids } }
      ]
    });

    // Delete users
    await User.deleteMany({ _id: { $in: usersids } });

    return res.status(200).json({
      status: "success",
      message: "Pending accounts deleted successfully",
      deletedCount: {
        users: usersids.length,
        subscriptions: subscriptionIds.length
      }
    });

  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
      error: error?.message || error
    });
  }
}