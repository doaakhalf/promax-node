import path from "path";
import mongoose from "mongoose";
import Coach from "../Models/Coach.js";
import CoachIntroVideo from "../Models/CoachIntroVideo.js";
import User from "../Models/User.js";
import ApiError from "../utils/ApiError.js";
import { displayName } from "../utils/displayName.js";
import NotificationService from "./NotificationService.js";
import { queueIntroVideoTranscode } from "./introVideoTranscode.js";
import {
  INTRO_VIDEO_ERRORS,
  INTRO_VIDEO_PUBLIC_PREFIX,
  deleteIntroVideoFile,
  durationExceedsLimit,
  readVideoDurationSeconds,
} from "../utils/coachIntroVideo.js";

const REVIEW_STATUSES = ["pending", "approved", "rejected", "changes_requested"];

const roundDuration = (seconds) => Math.round(seconds * 100) / 100;

const presentPublished = (media) => {
  if (!media?.url) return null;
  return {
    url: media.url,
    durationSeconds: media.durationSeconds,
    sizeBytes: media.sizeBytes,
    approvedAt: media.approvedAt || null,
  };
};

const presentSubmission = (submission) => {
  if (!submission?.url) return null;
  return {
    status: submission.status,
    url: submission.url,
    durationSeconds: submission.durationSeconds,
    sizeBytes: submission.sizeBytes,
    submittedAt: submission.submittedAt || null,
    reviewedAt: submission.reviewedAt || null,
    reason: submission.reason || null,
  };
};

const present = (doc) => ({
  published: presentPublished(doc?.published),
  submission: presentSubmission(doc?.submission),
});

const presentPublic = (doc) => presentPublished(doc?.published);

const requireReason = (reason) => {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!text) throw new ApiError(400, "A reason is required");
  if (text.length > 500) throw new ApiError(400, "Reason is too long");
  return text;
};

const assertId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Intro video id is invalid");
  }
};

const notifyCoach = async ({ recipientId, senderId, type, title, message, status, reason }) => {
  try {
    await NotificationService.sendNotification({
      recipientId,
      senderId,
      type,
      title,
      message,
      data: {
        status,
        ...(reason ? { reason } : {}),
      },
    });
  } catch (error) {
    console.error("Intro video notification failed:", error);
  }
};

const notifyAdminOfUpload = async (userId) => {
  if (!process.env.ADMIN_USER_ID) return;
  const user = await User.findById(userId).select("firstName lastName email").lean();
  try {
    await NotificationService.sendNotification({
      recipientId: process.env.ADMIN_USER_ID,
      senderId: userId,
      type: "intro_video_submitted",
      title: "فيديو تعريف جديد",
      message: `الكوتش ${displayName(user, { full: true }) || "مدرب"} رفع فيديو تعريف. يرجى المراجعة.`,
      data: {
        userId: userId.toString(),
        email: user?.email || null,
      },
    });
  } catch (error) {
    console.error("Intro video admin notification failed:", error);
  }
};

const toAdminItem = (doc) => {
  const user = doc.userId && typeof doc.userId === "object" ? doc.userId : null;
  return {
    id: doc._id.toString(),
    status: doc.submission?.status || null,
    submittedAt: doc.submission?.submittedAt || null,
    reviewedAt: doc.submission?.reviewedAt || null,
    reason: doc.submission?.reason || null,
    url: doc.submission?.url || null,
    durationSeconds: doc.submission?.durationSeconds ?? null,
    sizeBytes: doc.submission?.sizeBytes ?? null,
    published: presentPublished(doc.published),
    coach: {
      name: displayName(user, { full: true }) || null,
      email: user?.email || null,
      phone: user?.phoneNumber || null,
      profileImage: user?.profileImage || null,
    },
  };
};

class CoachIntroVideoService {
  static async getForCoach(userId) {
    const doc = await CoachIntroVideo.findOne({ userId }).lean();
    return present(doc);
  }

  static async getForProfile(userId, { isOwner }) {
    const doc = await CoachIntroVideo.findOne({ userId }).lean();
    if (isOwner) return present(doc);
    return presentPublic(doc);
  }

  static async getPublishedByUserIds(userIds) {
    const ids = [...new Set(
      (userIds || []).filter(Boolean).map((id) => id.toString())
    )];
    const map = new Map();
    if (!ids.length) return map;

    const docs = await CoachIntroVideo.find({ userId: { $in: ids } })
      .select("userId published")
      .lean();

    for (const doc of docs) {
      map.set(doc.userId.toString(), presentPublic(doc));
    }
    return map;
  }

  static async removeForCoach(userId) {
    const previous = await CoachIntroVideo.findOneAndDelete({ userId }).lean();
    const urls = new Set(
      [previous?.published?.url, previous?.submission?.url].filter(Boolean)
    );
    await Promise.all([...urls].map((url) => deleteIntroVideoFile(url)));
    return present(null);
  }

  static async submit(userId, file) {
    const coach = await Coach.findOne({ userId }).select("_id deletedAt");
    if (!coach || coach.deletedAt) {
      await deleteIntroVideoFile(`${INTRO_VIDEO_PUBLIC_PREFIX}${path.basename(file.filename)}`);
      throw new ApiError(404, "لم يتم العثور على حساب الكوتش");
    }

    let duration = null;
    try {
      duration = readVideoDurationSeconds(file.path);
    } catch (error) {
      console.error("Intro video duration read failed:", error);
      duration = null;
    }

    const relativeUrl = `${INTRO_VIDEO_PUBLIC_PREFIX}${path.basename(file.filename)}`;
    if (duration == null) {
      await deleteIntroVideoFile(relativeUrl);
      throw new ApiError(400, INTRO_VIDEO_ERRORS.unreadable);
    }
    if (durationExceedsLimit(duration)) {
      await deleteIntroVideoFile(relativeUrl);
      throw new ApiError(400, INTRO_VIDEO_ERRORS.tooLong);
    }

    const submission = {
      status: "pending",
      url: relativeUrl,
      fileName: path.basename(file.filename),
      durationSeconds: roundDuration(duration),
      sizeBytes: file.size,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      reason: null,
      needsTranscode: true,
      transcodeAttempts: 0,
    };

    const previous = await CoachIntroVideo.findOne({ userId }).lean();
    let saved;
    try {
      saved = await CoachIntroVideo.findOneAndUpdate(
        { userId },
        {
          $set: { coachId: coach._id, submission },
          $setOnInsert: { userId },
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch (error) {
      await deleteIntroVideoFile(relativeUrl);
      throw error;
    }

    const previousUrl = previous?.submission?.url;
    const publishedUrl = previous?.published?.url;
    if (previousUrl && previousUrl !== relativeUrl && previousUrl !== publishedUrl) {
      await deleteIntroVideoFile(previousUrl);
    }

    await notifyAdminOfUpload(userId);
    queueIntroVideoTranscode(relativeUrl);
    return present(saved);
  }

  static async listForAdmin({ status = "pending", page = 1, limit = 20 } = {}) {
    if (status && !REVIEW_STATUSES.includes(status)) {
      throw new ApiError(400, "Invalid status");
    }
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const filter = { "submission.status": status };
    const [rows, total] = await Promise.all([
      CoachIntroVideo.find(filter)
        .sort({ "submission.submittedAt": -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate("userId", "firstName lastName email phoneNumber profileImage")
        .lean(),
      CoachIntroVideo.countDocuments(filter),
    ]);

    return {
      data: rows.map(toAdminItem),
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
      throw new ApiError(400, "Intro video id is invalid");
    }
    const doc = await CoachIntroVideo.findById(id)
      .populate("userId", "firstName lastName email phoneNumber profileImage")
      .lean();
    if (!doc || !doc.submission?.url) throw new ApiError(404, "Intro video not found");
    return toAdminItem(doc);
  }

  static async approve(id, actorId) {
    assertId(id);
    const current = await CoachIntroVideo.findOne({ _id: id, "submission.status": "pending" }).lean();
    if (!current?.submission?.url) {
      throw new ApiError(409, "This intro video is no longer pending review");
    }
    const now = new Date();
    const updated = await CoachIntroVideo.findOneAndUpdate(
      { _id: id, "submission.status": "pending" },
      {
        $set: {
          published: {
            url: current.submission.url,
            fileName: current.submission.fileName,
            durationSeconds: current.submission.durationSeconds,
            sizeBytes: current.submission.sizeBytes,
            approvedAt: now,
          },
          "submission.status": "approved",
          "submission.reviewedAt": now,
          "submission.reviewedBy": actorId,
          "submission.reason": null,
        },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updated) throw new ApiError(409, "This intro video is no longer pending review");

    const previousPublished = current.published?.url || null;
    if (previousPublished && previousPublished !== updated.published?.url) {
      await deleteIntroVideoFile(previousPublished);
    }

    await notifyCoach({
      recipientId: updated.userId,
      senderId: actorId,
      type: "intro_video_approved",
      title: "تم قبول فيديو التعريف",
      message: "تمت الموافقة على فيديو التعريف .",
      status: "approved",
    });
    return { status: "approved" };
  }

  static async reject(id, { actorId, reason }) {
    const text = requireReason(reason);
    assertId(id);
    const now = new Date();
    const updated = await CoachIntroVideo.findOneAndUpdate(
      { _id: id, "submission.status": "pending" },
      {
        $set: {
          "submission.status": "rejected",
          "submission.reason": text,
          "submission.reviewedAt": now,
          "submission.reviewedBy": actorId,
        },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updated) throw new ApiError(409, "This intro video is no longer pending review");

    await notifyCoach({
      recipientId: updated.userId,
      senderId: actorId,
      type: "intro_video_rejected",
      title: "تم رفض فيديو التعريف",
      message: `تم رفض فيديو التعريف. السبب: ${text}`,
      status: "rejected",
      reason: text,
    });
    return { status: "rejected" };
  }

  static async requestChanges(id, { actorId, reason }) {
    const text = requireReason(reason);
    assertId(id);
    const now = new Date();
    const updated = await CoachIntroVideo.findOneAndUpdate(
      { _id: id, "submission.status": "pending" },
      {
        $set: {
          "submission.status": "changes_requested",
          "submission.reason": text,
          "submission.reviewedAt": now,
          "submission.reviewedBy": actorId,
        },
      },
      { returnDocument: "after" }
    ).lean();
    if (!updated) throw new ApiError(409, "This intro video is no longer pending review");

    await notifyCoach({
      recipientId: updated.userId,
      senderId: actorId,
      type: "intro_video_changes_requested",
      title: "فيديو التعريف يحتاج تعديل",
      message: `يرجى تعديل فيديو التعريف. السبب: ${text}`,
      status: "changes_requested",
      reason: text,
    });
    return { status: "changes_requested" };
  }
}

export default CoachIntroVideoService;
