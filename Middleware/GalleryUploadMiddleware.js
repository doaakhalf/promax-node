import multer from "multer";
import {
  isAllowedGalleryMimeType,
  MAX_IMAGE_SIZE_BYTES,
} from "../utils/galleryConstants.js";

// Memory storage is used (instead of disk storage) because the raw upload
// is never persisted as-is: it is immediately optimized by Sharp and only
// the optimized WebP output is written to the Railway Volume.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!isAllowedGalleryMimeType(file.mimetype)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
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
          message: "Maximum image size is 10 MB.",
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
