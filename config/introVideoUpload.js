import fs from "fs";
import multer from "multer";
import {
  INTRO_VIDEO_DIR,
  INTRO_VIDEO_ERRORS,
  MAX_INTRO_VIDEO_BYTES,
  isAllowedIntroVideo,
  storedExtension,
} from "../utils/coachIntroVideo.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(INTRO_VIDEO_DIR, { recursive: true });
    cb(null, INTRO_VIDEO_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = storedExtension(file.mimetype, file.originalname) || ".mov";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_INTRO_VIDEO_BYTES,
    files: 1,
    parts: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname !== "video") {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    if (!isAllowedIntroVideo(file.mimetype, file.originalname)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    cb(null, true);
  },
});

export const uploadIntroVideo = (req, res, next) => {
  upload.single("video")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          status: "error",
          message: INTRO_VIDEO_ERRORS.tooLarge,
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          status: "error",
          message: INTRO_VIDEO_ERRORS.badType,
        });
      }
      return res.status(400).json({
        success: false,
        status: "error",
        message: "تعذر رفع الفيديو",
      });
    }
    if (err) return next(err);
    next();
  });
};
