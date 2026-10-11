import mongoose from "mongoose";
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Certificate from "../Models/Certificate.js";
import Achievement from "../Models/Achievement.js";
import Gallery from "../Models/Gallery.js";
import CoachProfileReview from "../Models/CoachProfileReview.js";
import GalleryService from "./GalleryService.js";
import FileService from "./file.service.js";
import ApiError from "../utils/ApiError.js";
import { decimalToNumber } from "../utils/coachNetAmount.js";
import { displayName } from "../utils/displayName.js";
import { getGalleryFilePath } from "../config/galleryStorage.js";
import {
  logProfileUpdate,
  logEntityCreation,
  logEntityDeletion,
  logGalleryOperation,
} from "../utils/auditLogger.js";
import NotificationService from "./NotificationService.js";

const USER_FIELDS = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["phoneNumber", "Phone"],
  ["gender", "Gender"],
  ["profileImage", "Profile image"],
];

const COACH_FIELDS = [
  ["headline", "Headline"],
  ["introduction", "Introduction"],
  ["sport", "Sport"],
  ["trainingExperience", "Training experience"],
  ["yearOfExperience", "Years of experience"],
  ["motivation", "Motivation"],
  ["videoUrl", "Video URL"],
  ["monthlyPriceEgp", "Monthly price"],
  ["instapayLink", "Instapay link"],
  ["walletNumber", "Wallet number"],
];

function sameValue(a, b) {
  if (a == null && b == null) return true;
  const left = a == null ? "" : String(a).trim();
  const right = b == null ? "" : String(b).trim();
  if (left === right) return true;
  if (left === "" || right === "") return false;
  const numA = Number(left);
  const numB = Number(right);
  return !Number.isNaN(numA) && !Number.isNaN(numB) && numA === numB;
}

function parseObjectArray(raw) {
  if (raw == null || raw === "") return null;
  try {
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    if (Array.isArray(raw)) {
      if (raw.length > 0 && typeof raw[0] === "string") {
        const parsed = JSON.parse(raw[0]);
        return Array.isArray(parsed) ? parsed : [];
      }
      return raw;
    }
    return [];
  } catch (error) {
    console.error("Failed to parse profile list:", error);
    return [];
  }
}

function hasNewImage(item) {
  return item?.hasNewImage === true || item?.hasNewImage === "true" || item?.hasNewImage === 1 || item?.hasNewImage === "1";
}

function asObjectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} id is invalid`);
  }
  return new mongoose.Types.ObjectId(value);
}

function publicImagePath(uploadFolder, filename) {
  return `images/${uploadFolder}/${filename}`;
}

async function loadLiveProfile(userId) {
  const [user, coach, certificates, achievements, gallery] = await Promise.all([
    User.findById(userId)
      .select("firstName lastName email phoneNumber gender profileImage status")
      .lean(),
    Coach.findOne({ userId })
      .select("headline introduction sport trainingExperience yearOfExperience motivation monthlyPriceEgp instapayLink walletNumber videoUrl")
      .lean(),
    Certificate.find({ userId }).lean(),
    Achievement.find({ userId }).lean(),
    Gallery.find({ userId }).sort({ createdAt: -1 }).lean(),
  ]);

  return { user, coach, certificates, achievements, gallery };
}

function mapLiveCertificates(certificates) {
  return certificates.map((cert) => ({
    existingId: cert._id,
    name: cert.certificateName,
    year: cert.year,
    image: cert.certificateImage || null,
  }));
}

function mapLiveAchievements(achievements) {
  return achievements.map((item) => ({
    existingId: item._id,
    name: item.name,
    rank: item.rank,
    image: item.image || null,
  }));
}

function livePublicPaths(live) {
  return new Set(
    [
      live.user?.profileImage,
      ...mapLiveCertificates(live.certificates).map((item) => item.image),
      ...mapLiveAchievements(live.achievements).map((item) => item.image),
    ].filter(Boolean)
  );
}

function reviewPublicPaths(review) {
  return [
    review.proposedUser?.profileImage,
    ...(review.certificates || []).map((item) => item.image),
    ...(review.achievements || []).map((item) => item.image),
  ].filter(Boolean);
}

async function deleteReviewOnlyFiles(review, live, keepReview = null) {
  if (!review) return;

  const livePaths = livePublicPaths(live);
  const keepPaths = new Set(keepReview ? reviewPublicPaths(keepReview) : []);
  const publicPaths = reviewPublicPaths(review).filter(
    (filePath) => !livePaths.has(filePath) && !keepPaths.has(filePath)
  );

  const keepGallery = new Set((keepReview?.galleryAdds || []).map((item) => item.fileName));
  const galleryPaths = (review.galleryAdds || [])
    .filter((item) => item.fileName && !keepGallery.has(item.fileName))
    .map((item) => getGalleryFilePath(item.fileName));

  await FileService.deleteMultipleFiles([
    ...publicPaths.map((filePath) => FileService.resolvePublicPath(filePath)),
    ...galleryPaths,
  ]);
}

async function deleteUploadedPaths(publicPaths, galleryAdds) {
  await FileService.deleteMultipleFiles([
    ...publicPaths.map((filePath) => FileService.resolvePublicPath(filePath)),
    ...(galleryAdds || []).map((item) => getGalleryFilePath(item.fileName)),
  ]);
}

function buildProposedUser(liveUser, body, files, uploadFolder, uploadedPublicPaths) {
  const proposed = {
    firstName: liveUser.firstName || null,
    lastName: liveUser.lastName || null,
    email: liveUser.email || null,
    gender: liveUser.gender || null,
    phoneNumber: liveUser.phoneNumber || null,
    profileImage: liveUser.profileImage || null,
  };

  if (body.firstName) proposed.firstName = body.firstName;
  if (body.lastName) proposed.lastName = body.lastName;
  if (body.email) proposed.email = String(body.email).trim().toLowerCase();
  if (body.gender) proposed.gender = String(body.gender).toLowerCase();
  if (body.phoneNumber) proposed.phoneNumber = String(body.phoneNumber).trim();

  const profileFile = files?.profileImage?.[0];
  if (profileFile?.filename) {
    proposed.profileImage = publicImagePath(uploadFolder, profileFile.filename);
    uploadedPublicPaths.push(proposed.profileImage);
  }

  return proposed;
}

function buildProposedCoach(liveCoach, body) {
  const proposed = {
    headline: liveCoach.headline || null,
    introduction: liveCoach.introduction || null,
    sport: liveCoach.sport || null,
    trainingExperience: liveCoach.trainingExperience || null,
    yearOfExperience: liveCoach.yearOfExperience ?? null,
    motivation: liveCoach.motivation || null,
    videoUrl: liveCoach.videoUrl || null,
    monthlyPriceEgp: decimalToNumber(liveCoach.monthlyPriceEgp),
    instapayLink: liveCoach.instapayLink || null,
    walletNumber: liveCoach.walletNumber || null,
  };

  if (body.headline) proposed.headline = body.headline;
  if (body.introduction) proposed.introduction = body.introduction;
  if (body.sport) proposed.sport = body.sport;
  if (body.trainingExperience) proposed.trainingExperience = body.trainingExperience;
  if (body.yearOfExperience) proposed.yearOfExperience = Number(body.yearOfExperience);
  if (body.motivation) proposed.motivation = body.motivation;
  if (body.videoUrl) proposed.videoUrl = body.videoUrl;
  if (body.monthlyPriceEgp) proposed.monthlyPriceEgp = decimalToNumber(body.monthlyPriceEgp);
  if (body.instapayLink) {
    proposed.instapayLink = String(body.instapayLink).trim();
    proposed.walletNumber = null;
  }
  if (body.walletNumber) {
    proposed.walletNumber = String(body.walletNumber).trim();
    proposed.instapayLink = null;
  }

  return proposed;
}

function buildCertificateSnapshot(liveCertificates, body, files, uploadFolder, uploadedPublicPaths) {
  if (body.certificates === undefined) return mapLiveCertificates(liveCertificates);

  const parsed = parseObjectArray(body.certificates) || [];
  const liveById = new Map(liveCertificates.map((item) => [item._id.toString(), item]));
  const uploadedFiles = files?.certificates || [];
  let fileIndex = 0;
  const snapshot = [];

  for (const cert of parsed) {
    const rawId = cert.id || cert._id;
    const uploadedFile = hasNewImage(cert) && fileIndex < uploadedFiles.length
      ? uploadedFiles[fileIndex++]
      : null;
    const uploadedPath = uploadedFile?.filename
      ? publicImagePath(uploadFolder, uploadedFile.filename)
      : null;
    if (uploadedPath) uploadedPublicPaths.push(uploadedPath);

    if (rawId) {
      const id = asObjectId(rawId, "Certificate");
      const live = liveById.get(id.toString());
      if (!live) throw new ApiError(400, "Certificate not found");
      snapshot.push({
        existingId: id,
        name: cert.name,
        year: Number.parseInt(cert.year, 10),
        image: uploadedPath || live.certificateImage,
      });
      continue;
    }

    if (!uploadedPath) {
      console.warn(`Certificate file missing for ${cert.name}`);
      continue;
    }

    snapshot.push({
      existingId: null,
      name: cert.name,
      year: Number.parseInt(cert.year, 10),
      image: uploadedPath,
    });
  }

  return snapshot;
}

function buildAchievementSnapshot(liveAchievements, body, files, uploadFolder, uploadedPublicPaths) {
  if (body.achievements === undefined) return mapLiveAchievements(liveAchievements);

  const parsed = parseObjectArray(body.achievements) || [];
  const liveById = new Map(liveAchievements.map((item) => [item._id.toString(), item]));
  const uploadedFiles = files?.achievements || [];
  let fileIndex = 0;
  const snapshot = [];

  for (const item of parsed) {
    const rawId = item.id || item._id;
    const uploadedFile = hasNewImage(item) && fileIndex < uploadedFiles.length
      ? uploadedFiles[fileIndex++]
      : null;
    const uploadedPath = uploadedFile?.filename
      ? publicImagePath(uploadFolder, uploadedFile.filename)
      : null;
    if (uploadedPath) uploadedPublicPaths.push(uploadedPath);

    if (rawId) {
      const id = asObjectId(rawId, "Achievement");
      const live = liveById.get(id.toString());
      if (!live) throw new ApiError(400, "Achievement not found");
      snapshot.push({
        existingId: id,
        name: item.name,
        rank: item.rank,
        image: uploadedPath || live.image || null,
      });
      continue;
    }

    snapshot.push({
      existingId: null,
      name: item.name,
      rank: item.rank,
      image: uploadedPath,
    });
  }

  return snapshot;
}

function certificatesEqual(liveCertificates, proposed) {
  const live = mapLiveCertificates(liveCertificates).map((item) => ({
    id: item.existingId.toString(),
    name: item.name,
    year: item.year,
    image: item.image || null,
  }));
  const next = proposed.map((item) => ({
    id: item.existingId ? item.existingId.toString() : "",
    name: item.name,
    year: item.year,
    image: item.image || null,
  }));
  return JSON.stringify(live) === JSON.stringify(next);
}

function achievementsEqual(liveAchievements, proposed) {
  const live = mapLiveAchievements(liveAchievements).map((item) => ({
    id: item.existingId.toString(),
    name: item.name,
    rank: item.rank,
    image: item.image || null,
  }));
  const next = proposed.map((item) => ({
    id: item.existingId ? item.existingId.toString() : "",
    name: item.name,
    rank: item.rank,
    image: item.image || null,
  }));
  return JSON.stringify(live) === JSON.stringify(next);
}

function snapshotChanged(live, proposedUser, proposedCoach, certificates, achievements, galleryAdds, galleryRemoveIds) {
  const userChanged = USER_FIELDS.some(([key]) => !sameValue(live.user?.[key], proposedUser[key]));
  const coachChanged = COACH_FIELDS.some(([key]) => {
    const current = key === "monthlyPriceEgp"
      ? decimalToNumber(live.coach?.[key])
      : live.coach?.[key];
    return !sameValue(current, proposedCoach[key]);
  });
  return (
    userChanged
    || coachChanged
    || !certificatesEqual(live.certificates, certificates)
    || !achievementsEqual(live.achievements, achievements)
    || galleryAdds.length > 0
    || galleryRemoveIds.length > 0
  );
}

function tagCollection(before, after, compare) {
  const afterById = new Map(
    after.filter((item) => item.id).map((item) => [String(item.id), item])
  );
  const beforeById = new Map(
    before.filter((item) => item.id).map((item) => [String(item.id), item])
  );

  const tag = (item, other, missing) => {
    if (!item.id || !other) return missing;
    return compare(item, other) ? "same" : "updated";
  };

  return {
    before: before.map((item) => ({
      ...item,
      change: tag(item, item.id ? afterById.get(String(item.id)) : null, "removed"),
    })),
    after: after.map((item) => ({
      ...item,
      change: tag(item, item.id ? beforeById.get(String(item.id)) : null, "added"),
    })),
  };
}

function presentComparison(review, live) {
  const beforeUser = {
    firstName: live.user?.firstName || null,
    lastName: live.user?.lastName || null,
    email: live.user?.email || null,
    phoneNumber: live.user?.phoneNumber || null,
    gender: live.user?.gender || null,
    profileImage: live.user?.profileImage || null,
  };
  const beforeCoach = {
    headline: live.coach?.headline || null,
    introduction: live.coach?.introduction || null,
    sport: live.coach?.sport || null,
    trainingExperience: live.coach?.trainingExperience || null,
    yearOfExperience: live.coach?.yearOfExperience ?? null,
    motivation: live.coach?.motivation || null,
    videoUrl: live.coach?.videoUrl || null,
    monthlyPriceEgp: decimalToNumber(live.coach?.monthlyPriceEgp),
    instapayLink: live.coach?.instapayLink || null,
    walletNumber: live.coach?.walletNumber || null,
  };

  const fields = [
    ...USER_FIELDS.map(([key, label]) => ({
      key,
      label,
      before: beforeUser[key] ?? null,
      after: review.proposedUser?.[key] ?? null,
      changed: !sameValue(beforeUser[key], review.proposedUser?.[key]),
    })),
    ...COACH_FIELDS.map(([key, label]) => ({
      key,
      label,
      before: beforeCoach[key] ?? null,
      after: review.proposedCoach?.[key] ?? null,
      changed: !sameValue(beforeCoach[key], review.proposedCoach?.[key]),
    })),
  ];

  const certificates = tagCollection(
    mapLiveCertificates(live.certificates).map((item) => ({
      id: item.existingId.toString(),
      name: item.name,
      year: item.year,
      image: item.image,
    })),
    (review.certificates || []).map((item) => ({
      id: item.existingId ? item.existingId.toString() : null,
      name: item.name,
      year: item.year,
      image: item.image,
    })),
    (left, right) => sameValue(left.name, right.name) && sameValue(left.year, right.year) && sameValue(left.image, right.image)
  );

  const achievements = tagCollection(
    mapLiveAchievements(live.achievements).map((item) => ({
      id: item.existingId.toString(),
      name: item.name,
      rank: item.rank,
      image: item.image,
    })),
    (review.achievements || []).map((item) => ({
      id: item.existingId ? item.existingId.toString() : null,
      name: item.name,
      rank: item.rank,
      image: item.image,
    })),
    (left, right) => sameValue(left.name, right.name) && sameValue(left.rank, right.rank) && sameValue(left.image, right.image)
  );

  const removeIds = new Set((review.galleryRemoveIds || []).map((id) => id.toString()));
  const galleryBefore = (live.gallery || []).map((item) => ({
    id: item._id.toString(),
    imageUrl: item.imageUrl,
    fileName: item.fileName,
    change: removeIds.has(item._id.toString()) ? "removed" : "same",
  }));
  const galleryAfter = [
    ...galleryBefore
      .filter((item) => item.change !== "removed")
      .map((item) => ({ ...item, change: "same" })),
    ...(review.galleryAdds || []).map((item) => ({
      id: null,
      imageUrl: item.imageUrl,
      fileName: item.fileName,
      change: "added",
    })),
  ];

  return {
    id: review._id.toString(),
    status: review.status,
    submittedAt: review.submittedAt,
    reviewedAt: review.reviewedAt,
    rejectionReason: review.rejectionReason,
    coach: {
      id: review.userId.toString(),
      name: displayName(live.user, { full: true }) || review.proposedUser?.firstName || "",
      email: live.user?.email || null,
      phone: live.user?.phoneNumber || null,
      accountStatus: live.user?.status || null,
      sport: live.coach?.sport || null,
      coachPrice: decimalToNumber(live.coach?.monthlyPriceEgp),
      profileImage: live.user?.profileImage || null,
    },
    fields,
    certificates,
    achievements,
    gallery: {
      before: galleryBefore,
      after: galleryAfter,
    },
  };
}

async function assertUniqueContact(userId, proposedUser) {
  if (proposedUser.email) {
    const existing = await User.findOne({
      email: proposedUser.email,
      _id: { $ne: userId },
    }).select("_id").lean();
    if (existing) throw new ApiError(409, "Email already exists");
  }

  if (proposedUser.phoneNumber) {
    const existing = await User.findOne({
      phoneNumber: proposedUser.phoneNumber,
      _id: { $ne: userId },
    }).select("_id").lean();
    if (existing) throw new ApiError(409, "Phone number already exists");
  }
}

async function applySnapshot(review, live, audit) {
  const userId = review.userId;
  const proposedUser = review.proposedUser;
  const oldProfileImage = live.user?.profileImage || null;

  await assertUniqueContact(userId, proposedUser);
  await User.findByIdAndUpdate(userId, {
    firstName: proposedUser.firstName,
    lastName: proposedUser.lastName,
    email: proposedUser.email,
    gender: proposedUser.gender,
    phoneNumber: proposedUser.phoneNumber,
    profileImage: proposedUser.profileImage,
  });

  if (oldProfileImage && oldProfileImage !== proposedUser.profileImage) {
    await FileService.deleteFile(FileService.resolvePublicPath(oldProfileImage));
  }

  await Coach.findOneAndUpdate(
    { userId },
    {
      headline: review.proposedCoach.headline,
      introduction: review.proposedCoach.introduction,
      sport: review.proposedCoach.sport,
      trainingExperience: review.proposedCoach.trainingExperience,
      yearOfExperience: review.proposedCoach.yearOfExperience,
      motivation: review.proposedCoach.motivation,
      videoUrl: review.proposedCoach.videoUrl,
      monthlyPriceEgp: review.proposedCoach.monthlyPriceEgp,
      instapayLink: review.proposedCoach.instapayLink,
      walletNumber: review.proposedCoach.walletNumber,
    }
  );

  logProfileUpdate({
    userId: audit.actorId,
    targetUserId: userId,
    targetRole: "coach",
    entityType: "user",
    entityId: userId,
    oldData: live.user,
    newData: proposedUser,
    ipAddress: audit.ipAddress,
  });
  logProfileUpdate({
    userId: audit.actorId,
    targetUserId: userId,
    targetRole: "coach",
    entityType: "coach",
    entityId: live.coach?._id,
    oldData: {
      ...live.coach,
      monthlyPriceEgp: decimalToNumber(live.coach?.monthlyPriceEgp),
    },
    newData: review.proposedCoach,
    ipAddress: audit.ipAddress,
  });

  await applyCertificates(review, live, audit);
  await applyAchievements(review, live, audit);
  await applyGallery(review, live, audit);
}

async function applyCertificates(review, live, audit) {
  if (certificatesEqual(live.certificates, review.certificates || [])) return;

  const userId = review.userId;
  const keptIds = (review.certificates || [])
    .map((item) => item.existingId)
    .filter(Boolean);
  const toDelete = await Certificate.find({
    userId,
    _id: { $nin: keptIds },
  }).select("certificateImage").lean();

  toDelete.forEach((cert) => {
    logEntityDeletion({
      userId: audit.actorId,
      targetUserId: userId,
      targetRole: "coach",
      entityType: "certificate",
      entityId: cert._id,
      fieldName: "certificate",
      data: { id: cert._id },
      ipAddress: audit.ipAddress,
    });
  });

  const liveById = new Map(live.certificates.map((item) => [item._id.toString(), item]));
  await Certificate.deleteMany({ userId, _id: { $nin: keptIds } });
  await FileService.deleteMultipleFiles(
    toDelete.map((item) => FileService.resolvePublicPath(item.certificateImage))
  );

  for (const cert of review.certificates || []) {
    if (cert.existingId) {
      const previous = liveById.get(cert.existingId.toString());
      await Certificate.findOneAndUpdate(
        { _id: cert.existingId, userId },
        {
          certificateName: cert.name,
          year: cert.year,
          certificateImage: cert.image,
        }
      );
      logEntityCreation({
        userId: audit.actorId,
        targetUserId: userId,
        targetRole: "coach",
        entityType: "certificate",
        entityId: cert.existingId,
        fieldName: "certificate",
        data: { id: cert.existingId, name: cert.name, year: cert.year },
        ipAddress: audit.ipAddress,
      });
      if (previous?.certificateImage && previous.certificateImage !== cert.image) {
        await FileService.deleteFile(FileService.resolvePublicPath(previous.certificateImage));
      }
      continue;
    }

    const created = await Certificate.create({
      userId,
      certificateName: cert.name,
      year: cert.year,
      certificateImage: cert.image,
    });
    logEntityCreation({
      userId: audit.actorId,
      targetUserId: userId,
      targetRole: "coach",
      entityType: "certificate",
      entityId: created._id,
      fieldName: "certificate",
      data: { id: created._id, name: cert.name, year: cert.year },
      ipAddress: audit.ipAddress,
    });
  }
}

async function applyAchievements(review, live, audit) {
  if (achievementsEqual(live.achievements, review.achievements || [])) return;

  const userId = review.userId;
  const keptIds = (review.achievements || [])
    .map((item) => item.existingId)
    .filter(Boolean);
  const toDelete = await Achievement.find({
    userId,
    _id: { $nin: keptIds },
  }).select("image").lean();

  toDelete.forEach((item) => {
    logEntityDeletion({
      userId: audit.actorId,
      targetUserId: userId,
      targetRole: "coach",
      entityType: "achievement",
      entityId: item._id,
      fieldName: "achievement",
      data: { id: item._id },
      ipAddress: audit.ipAddress,
    });
  });

  const liveById = new Map(live.achievements.map((item) => [item._id.toString(), item]));
  await Achievement.deleteMany({ userId, _id: { $nin: keptIds } });
  await FileService.deleteMultipleFiles(
    toDelete.map((item) => FileService.resolvePublicPath(item.image))
  );

  for (const item of review.achievements || []) {
    if (item.existingId) {
      const previous = liveById.get(item.existingId.toString());
      await Achievement.findOneAndUpdate(
        { _id: item.existingId, userId },
        { name: item.name, rank: item.rank, image: item.image }
      );
      logEntityCreation({
        userId: audit.actorId,
        targetUserId: userId,
        targetRole: "coach",
        entityType: "achievement",
        entityId: item.existingId,
        fieldName: "achievement",
        data: { id: item.existingId, name: item.name, rank: item.rank },
        ipAddress: audit.ipAddress,
      });
      if (previous?.image && previous.image !== item.image) {
        await FileService.deleteFile(FileService.resolvePublicPath(previous.image));
      }
      continue;
    }

    const created = await Achievement.create({
      userId,
      name: item.name,
      rank: item.rank,
      image: item.image,
    });
    logEntityCreation({
      userId: audit.actorId,
      targetUserId: userId,
      targetRole: "coach",
      entityType: "achievement",
      entityId: created._id,
      fieldName: "achievement",
      data: { id: created._id, name: item.name, rank: item.rank },
      ipAddress: audit.ipAddress,
    });
  }
}

async function applyGallery(review, live, audit) {
  const removeIds = review.galleryRemoveIds || [];
  const adds = review.galleryAdds || [];
  if (!removeIds.length && !adds.length) return;

  if (adds.length) {
    logGalleryOperation({
      userId: audit.actorId,
      targetUserId: review.userId,
      targetRole: "coach",
      entityId: review.userId,
      operation: "add",
      count: adds.length,
      ipAddress: audit.ipAddress,
    });
  }
  if (removeIds.length) {
    logGalleryOperation({
      userId: audit.actorId,
      targetUserId: review.userId,
      targetRole: "coach",
      entityId: review.userId,
      operation: "remove",
      count: removeIds.length,
      ipAddress: audit.ipAddress,
    });
  }

  await GalleryService.commitStagedGallery(review.userId, {
    stagedAdds: adds,
    removeGalleryImageIds: removeIds,
  });
}

async function notifyCoachOfReview({ recipientId, senderId, approved, reviewId, rejectionReason }) {
  const reason = rejectionReason ? String(rejectionReason).trim() : "";
  const title = approved ? "تم قبول تعديلات البروفايل" : "تم رفض تعديلات البروفايل";
  const message = approved
    ? "تمت الموافقة على تعديلات بروفايلك وهي ظاهرة الآن"
    : reason
      ? `تم رفض تعديلات بروفايلك. السبب: ${reason}`
      : "تم رفض تعديلات بروفايلك، والبروفايل الظاهر لم يتغير";

  try {
    await NotificationService.sendNotification({
      recipientId,
      senderId,
      type: approved ? "profile_review_approved" : "profile_review_rejected",
      title,
      message,
      data: {
        reviewId: reviewId.toString(),
        status: approved ? "approved" : "rejected",
        ...(approved ? {} : { rejectionReason: reason }),
      },
    });
  } catch (error) {
    console.error("Coach profile review notification failed:", error);
  }
}

function toOwnerReview(review) {
  return {
    status: review.status,
    submittedAt: review.submittedAt,
    user: review.proposedUser,
    coach: review.proposedCoach,
    certificates: (review.certificates || []).map((item) => ({
      id: item.existingId ? item.existingId.toString() : null,
      name: item.name,
      year: item.year,
      image: item.image,
    })),
    achievements: (review.achievements || []).map((item) => ({
      id: item.existingId ? item.existingId.toString() : null,
      name: item.name,
      rank: item.rank,
      image: item.image,
    })),
    gallery: {
      add: review.galleryAdds || [],
      removeIds: (review.galleryRemoveIds || []).map((id) => id.toString()),
    },
  };
}

class CoachProfileReviewService {
  static async submitFromRequest(req) {
    const userId = req.user._id;
    const body = req.body || {};
    const files = req.files || {};
    // Profile, certificate, and achievement files are stored by the "users"
    // uploader. Gallery files set req.uploadFolder to "gallery" afterwards,
    // so that value cannot be used for the other paths.
    const uploadFolder = "users";
    const uploadedPublicPaths = [];
    let galleryAdds = [];
    let savedReview = false;

    try {
      const live = await loadLiveProfile(userId);
      if (!live.user || !live.coach) {
        throw new ApiError(404, "Coach not found");
      }

      const proposedUser = buildProposedUser(
        live.user,
        body,
        files,
        uploadFolder,
        uploadedPublicPaths
      );
      const proposedCoach = buildProposedCoach(live.coach, body);
      const certificates = buildCertificateSnapshot(
        live.certificates,
        body,
        files,
        uploadFolder,
        uploadedPublicPaths
      );
      const achievements = buildAchievementSnapshot(
        live.achievements,
        body,
        files,
        uploadFolder,
        uploadedPublicPaths
      );

      const requestedRemoveIds = GalleryService.parseIdArray(body.removeGalleryImageIds)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      const ownedRemovals = requestedRemoveIds.length
        ? await Gallery.find({ _id: { $in: requestedRemoveIds }, userId }).select("_id").lean()
        : [];
      const galleryRemoveIds = ownedRemovals.map((item) => item._id);
      const galleryFiles = files.galleryImages || [];
      if (galleryFiles.length) {
        const existingCount = await Gallery.countDocuments({ userId });
        galleryAdds = await GalleryService.stageDiskFiles(userId, galleryFiles, {
          slotsUsed: existingCount - galleryRemoveIds.length,
        });
      }

      const changed = snapshotChanged(
        live,
        proposedUser,
        proposedCoach,
        certificates,
        achievements,
        galleryAdds,
        galleryRemoveIds
      );

      if (!changed) {
        await deleteUploadedPaths(uploadedPublicPaths, galleryAdds);
        const existing = await CoachProfileReview.findOne({ userId, status: "in_review" })
          .select("status")
          .lean();
        return { changed: false, existingStatus: existing?.status || null };
      }

      const previous = await CoachProfileReview.findOne({ userId, status: "in_review" }).lean();
      const saved = await CoachProfileReview.findOneAndUpdate(
        { userId, status: "in_review" },
        {
          $set: {
            userId,
            coachId: live.coach._id,
            status: "in_review",
            submittedAt: new Date(),
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: null,
            proposedUser,
            proposedCoach,
            certificates,
            achievements,
            galleryAdds,
            galleryRemoveIds,
          },
        },
        { upsert: true, new: true }
      );
      savedReview = true;

      if (previous) {
        await deleteReviewOnlyFiles(previous, live, saved);
      }

      return { changed: true, reviewStatus: "in_review" };
    } catch (error) {
      if (!savedReview) {
        await deleteUploadedPaths(uploadedPublicPaths, galleryAdds);
      }
      throw error;
    }
  }

  static async getOwnerReview(userId) {
    const review = await CoachProfileReview.findOne({ userId, status: "in_review" }).lean();
    return review ? toOwnerReview(review) : null;
  }

  static async listForAdmin({ status = "in_review", page = 1, limit = 10 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const filter = status ? { status } : {};
    const [reviews, total] = await Promise.all([
      CoachProfileReview.find(filter)
        .sort({ submittedAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      CoachProfileReview.countDocuments(filter),
    ]);

    const data = [];
    for (const review of reviews) {
      const live = await loadLiveProfile(review.userId);
      data.push(presentComparison(review, live));
    }

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  static async getForAdmin(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Review id is invalid");
    }
    const review = await CoachProfileReview.findById(id).lean();
    if (!review) throw new ApiError(404, "Profile review not found");
    const live = await loadLiveProfile(review.userId);
    return presentComparison(review, live);
  }

  static async approve(id, { actorId, ipAddress }) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Review id is invalid");
    }

    const reviewDoc = await CoachProfileReview.findOne({ _id: id, status: "in_review" });
    if (!reviewDoc) throw new ApiError(409, "This review is no longer in review");
    const review = reviewDoc.toObject();

    const live = await loadLiveProfile(review.userId);
    if (!live.user || !live.coach) throw new ApiError(404, "Coach not found");

    await applySnapshot(review, live, { actorId, ipAddress });

    const updated = await CoachProfileReview.updateOne(
      { _id: review._id, status: "in_review" },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: actorId,
        },
      }
    );
    if (!updated.modifiedCount) {
      throw new ApiError(409, "This review is no longer in review");
    }

    await notifyCoachOfReview({
      recipientId: review.userId,
      senderId: actorId,
      approved: true,
      reviewId: review._id,
    });

    return { status: "approved" };
  }

  static async reject(id, { actorId, rejectionReason }) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Review id is invalid");
    }

    const review = await CoachProfileReview.findOneAndUpdate(
      { _id: id, status: "in_review" },
      {
        $set: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: actorId,
          rejectionReason: rejectionReason ? String(rejectionReason).trim() : null,
        },
      },
      { new: false }
    ).lean();

    if (!review) throw new ApiError(409, "This review is no longer in review");

    const live = await loadLiveProfile(review.userId);
    await deleteReviewOnlyFiles(review, live);

    const reason = rejectionReason ? String(rejectionReason).trim() : "";
    await notifyCoachOfReview({
      recipientId: review.userId,
      senderId: actorId,
      approved: false,
      reviewId: review._id,
      rejectionReason: reason,
    });

    return { status: "rejected" };
  }
}

export default CoachProfileReviewService;
