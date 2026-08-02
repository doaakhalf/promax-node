import mongoose from "mongoose";

// Ensures a file was actually attached before hitting the service layer.
export const requireGalleryFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "An image file is required.",
    });
  }
  next();
};

// Validates :galleryId is a well-formed Mongo ObjectId before querying,
// avoiding an unnecessary DB round-trip / CastError for malformed input.
export const validateGalleryId = (req, res, next) => {
  const { galleryId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(galleryId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid gallery image id.",
    });
  }
  next();
};
