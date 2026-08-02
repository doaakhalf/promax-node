import { Router } from "express";
import {
  uploadGalleryImage,
  getGalleryImages,
  deleteGalleryImage,
} from "../Controller/GalleryController.js";
import { uploadGalleryImage as uploadGalleryImageMiddleware } from "../Middleware/GalleryUploadMiddleware.js";
import {
  requireGalleryFile,
  validateGalleryId,
} from "../Middleware/GalleryValidationMiddleware.js";

// Note: `auth` is applied by the parent router (Routes/api.js), so every
// route here already has req.user / req.userId available.
const GalleryRouter = Router();

GalleryRouter.post(
  "/",
  uploadGalleryImageMiddleware,
  requireGalleryFile,
  uploadGalleryImage
);

GalleryRouter.get("/", getGalleryImages);

GalleryRouter.delete("/:galleryId", validateGalleryId, deleteGalleryImage);

export default GalleryRouter;
