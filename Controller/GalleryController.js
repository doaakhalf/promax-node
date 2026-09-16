import GalleryService from "../services/GalleryService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { displayName } from "../utils/displayName.js";

// Controllers stay thin: extract request data, delegate to the service
// layer, and shape the HTTP response. No business logic lives here.

export const uploadGalleryImage = asyncHandler(async (req, res) => {
  const gallery = await GalleryService.uploadImage(req.userId, req.file);
  res.status(201).json({
    success: true,
    message: "Image uploaded successfully.",
    data: gallery,
  });
});

export const getGalleryImages = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await GalleryService.listImages(req.userId, { page, limit });
  res.status(200).json({
    success: true,
    message: "Gallery fetched successfully.",
    data: result.items,
    pagination: result.pagination,
  });
});

export const deleteGalleryImage = asyncHandler(async (req, res) => {
  await GalleryService.deleteImage(req.userId, req.params.galleryId);
  res.status(200).json({
    success: true,
    message: "Image deleted successfully.",
  });
});

export const adminListGalleryImages = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await GalleryService.listAllImages({ page, limit });

  const data = result.items.map((item) => ({
    id: item._id.toString(),
    imageUrl: item.imageUrl,
    fileName: item.fileName,
    fileSize: item.fileSize,
    mimeType: item.mimeType,
    createdAt: item.createdAt,
    owner: item.userId
      ? {
          id: item.userId._id?.toString?.() ?? item.userId._id,
          name: displayName(item.userId, { full: true }),
          email: item.userId.email || null,
          profileImage: item.userId.profileImage || null,
        }
      : null,
  }));

  res.status(200).json({
    status: "success",
    message: "Gallery images retrieved successfully",
    data,
    pagination: result.pagination,
  });
});
