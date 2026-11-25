import CoachIntroVideoService from "../services/CoachIntroVideoService.js";
import CoachIntroVideoSessionService from "../services/CoachIntroVideoSessionService.js";
import { INTRO_VIDEO_ERRORS } from "../utils/coachIntroVideo.js";

export const getCoachIntroVideo = async (req, res, next) => {
  try {
    const data = await CoachIntroVideoService.getForCoach(req.userId);
    return res.status(200).json({
      status: "success",
      message: "Retrieved intro video",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const submitCoachIntroVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        status: "error",
        message: INTRO_VIDEO_ERRORS.missing,
      });
    }
    const data = await CoachIntroVideoService.submit(req.userId, req.file);
    return res.status(200).json({
      status: "success",
      message: "تم إرسال الفيديو للمراجعة",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const createCoachIntroVideoSession = async (req, res, next) => {
  try {
    const data = await CoachIntroVideoSessionService.create(req.userId, req.body);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const prepareIntroVideoChunk = async (req, res, next) => {
  try {
    req.introSession = await CoachIntroVideoSessionService.openChunk(
      req.userId,
      req.params.uploadId,
      req.params.index
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

export const receiveCoachIntroVideoChunk = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        status: "error",
        message: INTRO_VIDEO_ERRORS.missing,
      });
    }
    const data = await CoachIntroVideoSessionService.acceptChunk(req.introSession);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const completeCoachIntroVideoSession = async (req, res, next) => {
  try {
    const data = await CoachIntroVideoSessionService.complete(req.userId, req.params.uploadId);
    return res.status(200).json({
      status: "success",
      message: "تم إرسال الفيديو للمراجعة",
      data,
    });
  } catch (error) {
    if (Array.isArray(error?.missing)) {
      return res.status(400).json({
        success: false,
        status: "error",
        message: error.message,
        data: { missing: error.missing },
      });
    }
    return next(error);
  }
};

export const deleteCoachIntroVideo = async (req, res, next) => {
  try {
    const data = await CoachIntroVideoService.removeForCoach(req.userId);
    return res.status(200).json({
      status: "success",
      message: "تم حذف فيديو التعريف",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const listCoachIntroVideos = async (req, res, next) => {
  try {
    const result = await CoachIntroVideoService.listForAdmin({
      status: req.query.status || "pending",
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

export const getCoachIntroVideoForAdmin = async (req, res, next) => {
  try {
    const data = await CoachIntroVideoService.getForAdmin(req.params.id);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const approveCoachIntroVideo = async (req, res, next) => {
  try {
    await CoachIntroVideoService.approve(req.params.id, req.user._id);
    return res.status(200).json({
      status: "success",
      message: "Intro video approved",
    });
  } catch (error) {
    return next(error);
  }
};

export const rejectCoachIntroVideo = async (req, res, next) => {
  try {
    await CoachIntroVideoService.reject(req.params.id, {
      actorId: req.user._id,
      reason: req.body?.reason,
    });
    return res.status(200).json({
      status: "success",
      message: "Intro video rejected",
    });
  } catch (error) {
    return next(error);
  }
};

export const requestCoachIntroVideoChanges = async (req, res, next) => {
  try {
    await CoachIntroVideoService.requestChanges(req.params.id, {
      actorId: req.user._id,
      reason: req.body?.reason,
    });
    return res.status(200).json({
      status: "success",
      message: "Changes requested",
    });
  } catch (error) {
    return next(error);
  }
};
