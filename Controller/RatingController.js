import mongoose from "mongoose";
import Coach from "../Models/Coach.js";
import CoachRating from "../Models/CoachRating.js";
import Subscription from "../Models/Subscription.js";
import asyncHandler from "../utils/asyncHandler.js";
import { displayName } from "../utils/displayName.js";

const COMMENT_MAX = 1000;
const ELIGIBLE_STATUSES = ["active", "expired"];

function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObjectId(value) {
  if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value)) return false;
  return String(new mongoose.Types.ObjectId(value)) === value.toLowerCase();
}

function readStars(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

function presentOwnRating(rating) {
  return {
    id: rating._id.toString(),
    coachId: rating.coachId.toString(),
    stars: rating.stars,
    comment: rating.comment,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
  };
}

function presentAthlete(user) {
  if (!user) return null;
  return {
    id: user._id?.toString?.() ?? user._id,
    name: displayName(user) || null,
  };
}

function pageQuery(query) {
  const pageNum = Math.max(parseInt(query?.page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(query?.limit, 10) || 20, 1), 100);
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
}

async function findCoach(coachUserId) {
  if (!isObjectId(coachUserId)) return { error: "invalid" };
  const coach = await Coach.findOne({ userId: coachUserId, deletedAt: null }).select("_id userId").lean();
  if (!coach) return { error: "missing" };
  return { coach };
}

async function refreshCoachRating(coachUserId) {
  const [stats] = await CoachRating.aggregate([
    { $match: { coachId: new mongoose.Types.ObjectId(coachUserId) } },
    { $group: { _id: null, avg: { $avg: "$stars" }, count: { $sum: 1 } } },
  ]);

  const ratingCount = stats?.count || 0;
  const ratingAverage = ratingCount ? Math.round(stats.avg * 10) / 10 : 0;

  await Coach.updateOne(
    { userId: coachUserId },
    { $set: { ratingAverage, ratingCount } }
  );
}

export async function findMyRating(athleteId, coachUserId) {
  if (!athleteId || !coachUserId) return null;
  const rating = await CoachRating.findOne({
    athleteId,
    coachId: coachUserId,
  }).lean();
  return rating ? presentOwnRating(rating) : null;
}

export const upsertRating = asyncHandler(async (req, res) => {
  const coachUserId = req.params.coachId;
  const found = await findCoach(coachUserId);
  if (found.error === "invalid") {
    return res.status(400).json({
      status: "error",
      message: "Coach id is invalid",
    });
  }
  if (found.error === "missing") {
    return res.status(404).json({
      status: "error",
      message: "Coach not found",
    });
  }

  const stars = readStars(req.body?.stars);
  const comment = readText(req.body?.comment);

  if (stars == null) {
    return res.status(400).json({
      status: "error",
      message: "Stars must be an integer from 1 to 5",
    });
  }

  if (!comment || comment.length > COMMENT_MAX) {
    return res.status(400).json({
      status: "error",
      message: `Comment is required and must be at most ${COMMENT_MAX} characters`,
    });
  }

  const subscription = await Subscription.findOne({
    athleteId: req.userId,
    coachId: coachUserId,
    deletedAt: null,
    status: { $in: ELIGIBLE_STATUSES },
  })
    .select("_id")
    .lean();

  if (!subscription) {
    return res.status(403).json({
      status: "error",
      message: "You can rate this coach only with an active or expired subscription",
    });
  }

  let created = false;
  let rating = await CoachRating.findOne({
    athleteId: req.userId,
    coachId: coachUserId,
  });

  if (rating) {
    rating.stars = stars;
    rating.comment = comment;
    await rating.save();
  } else {
    try {
      rating = await CoachRating.create({
        athleteId: req.userId,
        coachId: coachUserId,
        stars,
        comment,
      });
      created = true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      rating = await CoachRating.findOneAndUpdate(
        { athleteId: req.userId, coachId: coachUserId },
        { stars, comment },
        { new: true }
      );
    }
  }

  await refreshCoachRating(coachUserId);

  res.status(created ? 201 : 200).json({
    status: "success",
    message: created ? "Rating submitted successfully" : "Rating updated successfully",
    data: presentOwnRating(rating),
  });
});

export const getMyRating = asyncHandler(async (req, res) => {
  const coachUserId = req.params.coachId;
  const found = await findCoach(coachUserId);
  if (found.error === "invalid") {
    return res.status(400).json({
      status: "error",
      message: "Coach id is invalid",
    });
  }
  if (found.error === "missing") {
    return res.status(404).json({
      status: "error",
      message: "Coach not found",
    });
  }

  const data = await findMyRating(req.userId, coachUserId);

  res.status(200).json({
    status: "success",
    message: "Rating retrieved successfully",
    data,
  });
});

export const listCoachRatings = asyncHandler(async (req, res) => {
  const coachUserId = req.params.coachId;
  const found = await findCoach(coachUserId);
  if (found.error === "invalid") {
    return res.status(400).json({
      status: "error",
      message: "Coach id is invalid",
    });
  }
  if (found.error === "missing") {
    return res.status(404).json({
      status: "error",
      message: "Coach not found",
    });
  }

  const { pageNum, limitNum, skip } = pageQuery(req.query);

  const [items, total] = await Promise.all([
    CoachRating.find({ coachId: coachUserId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({ path: "athleteId", select: "firstName lastName" })
      .lean(),
    CoachRating.countDocuments({ coachId: coachUserId }),
  ]);

  const data = items.map((item) => ({
    id: item._id.toString(),
    stars: item.stars,
    comment: item.comment,
    createdAt: item.createdAt,
    athlete: presentAthlete(item.athleteId),
  }));

  res.status(200).json({
    status: "success",
    message: "Ratings retrieved successfully",
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    },
  });
});

export const adminListRatings = asyncHandler(async (req, res) => {
  const starsRaw = readText(req.query?.stars);
  const coachId = readText(req.query?.coachId);
  const filter = {};

  if (starsRaw) {
    const stars = Number(starsRaw);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({
        status: "error",
        message: "Stars must be an integer from 1 to 5",
      });
    }
    filter.stars = stars;
  }

  if (coachId) {
    if (!isObjectId(coachId)) {
      return res.status(400).json({
        status: "error",
        message: "Coach id is invalid",
      });
    }
    filter.coachId = coachId;
  }

  const { pageNum, limitNum, skip } = pageQuery(req.query);

  const [items, total] = await Promise.all([
    CoachRating.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({ path: "athleteId", select: "firstName lastName" })
      .populate({ path: "coachId", select: "firstName lastName" })
      .lean(),
    CoachRating.countDocuments(filter),
  ]);

  const data = items.map((item) => ({
    id: item._id.toString(),
    stars: item.stars,
    comment: item.comment,
    createdAt: item.createdAt,
    athlete: presentAthlete(item.athleteId),
    coach: item.coachId
      ? {
          id: item.coachId._id?.toString?.() ?? item.coachId._id,
          name: displayName(item.coachId, { full: true }) || null,
        }
      : null,
  }));

  res.status(200).json({
    status: "success",
    message: "Ratings retrieved successfully",
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    },
  });
});
