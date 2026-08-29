import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import {
  isAllowedGalleryMimeType,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
} from "../utils/galleryConstants.js";

// Keep the raw upload on ephemeral disk instead of retaining the complete
// file as a Buffer in Node's heap while Sharp processes it.
const temporaryUploadDir = path.join(os.tmpdir(), "promax-gallery-uploads");
fs.mkdirSync(temporaryUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: temporaryUploadDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}.upload`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!isAllowedGalleryMimeType(file.mimetype)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

// Single-file upload middleware for the "image" form field, with
// multer-specific errors translated into the API's consistent
// { success, message } response shape instead of leaking multer internals.
export const uploadGalleryImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `Maximum image size is ${MAX_IMAGE_SIZE_MB} MB.`,
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          message: "GIF, HEIC, and HEIF images are not supported.",
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return next(err);
    }
    next();
  });
};
