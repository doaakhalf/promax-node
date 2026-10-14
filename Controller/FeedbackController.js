import Feedback from "../Models/Feedback.js";
import asyncHandler from "../utils/asyncHandler.js";
import { displayName } from "../utils/displayName.js";

const TYPES = new Set(["complaint", "suggestion"]);
const TITLE_MAX = 120;
const BODY_MAX = 2000;

function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const createFeedback = asyncHandler(async (req, res) => {
  const title = readText(req.body?.title);
  const type = readText(req.body?.type);
  const body = readText(req.body?.body);

  if (!title || title.length > TITLE_MAX) {
    return res.status(400).json({
      status: "error",
      message: `Title is required and must be at most ${TITLE_MAX} characters`,
    });
  }

  if (!TYPES.has(type)) {
    return res.status(400).json({
      status: "error",
      message: "Type must be complaint or suggestion",
    });
  }

  if (!body || body.length > BODY_MAX) {
    return res.status(400).json({
      status: "error",
      message: `Body is required and must be at most ${BODY_MAX} characters`,
    });
  }

  const feedback = await Feedback.create({
    title,
    type,
    body,
    userId: req.userId,
  });

  res.status(201).json({
    status: "success",
    message: "Feedback submitted successfully",
    data: {
      id: feedback._id.toString(),
      title: feedback.title,
      type: feedback.type,
      body: feedback.body,
      createdAt: feedback.createdAt,
    },
  });
});

export const adminListFeedback = asyncHandler(async (req, res) => {
  const type = readText(req.query?.type);
  const pageNum = Math.max(parseInt(req.query?.page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (type) {
    if (!TYPES.has(type)) {
      return res.status(400).json({
        status: "error",
        message: "Type must be complaint or suggestion",
      });
    }
    filter.type = type;
  }

  const [items, total] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: "userId",
        select: "firstName lastName email role_id",
        populate: { path: "role_id", select: "name" },
      })
      .lean(),
    Feedback.countDocuments(filter),
  ]);

  const data = items.map((item) => {
    const sender = item.userId;
    return {
      id: item._id.toString(),
      title: item.title,
      type: item.type,
      body: item.body,
      createdAt: item.createdAt,
      sender: sender
        ? {
            id: sender._id?.toString?.() ?? sender._id,
            name: displayName(sender, { full: true }) || null,
            email: sender.email || null,
            role: sender.role_id?.name || null,
          }
        : null,
    };
  });

  res.status(200).json({
    status: "success",
    message: "Feedback retrieved successfully",
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    },
  });
});
