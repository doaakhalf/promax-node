import CoachProfileReviewService from "../services/CoachProfileReviewService.js";
import { extractIpAddress } from "../utils/auditLogger.js";

export const listCoachProfileReviews = async (req, res, next) => {
  try {
    const result = await CoachProfileReviewService.listForAdmin({
      status: req.query.status || "in_review",
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({
      status: "success",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCoachProfileReview = async (req, res, next) => {
  try {
    const data = await CoachProfileReviewService.getForAdmin(req.params.id);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const approveCoachProfileReview = async (req, res, next) => {
  try {
    await CoachProfileReviewService.approve(req.params.id, {
      actorId: req.user._id,
      ipAddress: extractIpAddress(req),
    });
    return res.status(200).json({
      status: "success",
      message: "Profile changes approved",
    });
  } catch (error) {
    return next(error);
  }
};

export const rejectCoachProfileReview = async (req, res, next) => {
  try {
    await CoachProfileReviewService.reject(req.params.id, {
      actorId: req.user._id,
      rejectionReason: req.body?.rejectionReason,
    });
    return res.status(200).json({
      status: "success",
      message: "Profile changes rejected",
    });
  } catch (error) {
    return next(error);
  }
};
