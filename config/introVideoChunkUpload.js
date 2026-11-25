import fs from "fs";
import multer from "multer";
import {
  INTRO_VIDEO_ERRORS,
  MAX_INTRO_VIDEO_CHUNK_BYTES,
} from "../utils/coachIntroVideo.js";

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = req.introSession?.chunksDir;
    if (!dir) return cb(new Error("Intro video chunk session is missing"));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    cb(null, `${req.introSession.index}.incoming`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_INTRO_VIDEO_CHUNK_BYTES,
    files: 1,
    parts: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname !== "chunk") {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    cb(null, true);
  },
});

export const uploadIntroVideoChunk = (req, res, next) => {
  upload.single("chunk")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          status: "error",
          message: INTRO_VIDEO_ERRORS.chunkTooLarge,
        });
      }
      return res.status(400).json({
        success: false,
        status: "error",
        message: INTRO_VIDEO_ERRORS.badUpload,
      });
    }
    if (err) return next(err);
    next();
  });
};
