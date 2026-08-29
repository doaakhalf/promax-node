import fs from "fs/promises";
import crypto from "crypto";
import Gallery from "../Models/Gallery.js";
import ApiError from "../utils/ApiError.js";
import FileService from "./file.service.js";
import { optimizeImageToWebp } from "../utils/imageOptimizer.js";
import {
  ensureGalleryDir,
  getGalleryFilePath,
  buildGalleryImageUrl,
} from "../config/galleryStorage.js";
import {
  isAllowedGalleryMimeType,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
} from "../utils/galleryConstants.js";

class GalleryService {
  // Uploads + optimizes an image and persists the Gallery document.
  // Business rules enforced here (not in the controller):
  //   1. Max images per user.
  //   2. Optimize with Sharp before ever touching disk.
  //   3. No duplicate images per user (checked via DB unique index).
  static async uploadImage(userId, file) {
    // Rule: maximum 10 images per user, counted before upload.
    const existingCount = await Gallery.countDocuments({ userId });
    if (existingCount >= MAX_GALLERY_IMAGES) {
      throw new ApiError(400, "Maximum 10 images are allowed.");
    }

    ensureGalleryDir();

    const fileName = `${userId}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.webp`;
    const filePath = getGalleryFilePath(fileName);

    // Resize to <=1080px longest side, convert to WebP q80, strip metadata.
    await optimizeImageToWebp(file.buffer, filePath);

    const stats = await fs.stat(filePath);
    const imageUrl = buildGalleryImageUrl(fileName);

    try {
      const gallery = await Gallery.create({
        userId,
        imageUrl,
        fileName,
        fileSize: stats.size,
        mimeType: "image/webp",
      });
      return gallery;
    } catch (err) {
      // Roll back the optimized file if the DB insert failed so we never
      // leak orphaned files on the Volume.
      await FileService.deleteFile(filePath);
      if (err.code === 11000) {
        throw new ApiError(409, "This image already exists in your gallery.");
      }
      throw err;
    }
  }

  // Paginated, newest-first list of a user's own gallery.
  static async listImages(userId, { page = 1, limit = 10 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      Gallery.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Gallery.countDocuments({ userId }),
    ]);

    return {
      items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // Deletes a gallery image after verifying ownership; removes both the
  // file on the Volume and the Gallery document.
  static async deleteImage(userId, galleryId) {
    const gallery = await Gallery.findOne({ _id: galleryId, userId });
    if (!gallery) {
      throw new ApiError(404, "Gallery image not found.");
    }

    const filePath = getGalleryFilePath(gallery.fileName);
    await FileService.deleteFile(filePath);

    await gallery.deleteOne();
    return gallery;
  }

  // ---------------------------------------------------------------------
  // Integration helpers for the existing signup / edit-profile flows.
  // Those flows already parse multipart requests with the shared
  // config/upload.js disk-storage uploader (not the memory-storage
  // middleware used by the dedicated /users/gallery endpoint above), so
  // these methods accept disk-based multer file objects (`file.path`)
  // instead of buffers, validate them against the same gallery rules, and
  // funnel them through the same Sharp optimization + storage pipeline.
  // ---------------------------------------------------------------------

  // Rejects (and cleans up) any file that doesn't satisfy the gallery's
  // mime-type/size rules. The shared uploader already ran a looser filter
  // (it also accepts pdf, and has a higher size limit for other fields),
  // so gallery-specific constraints are enforced here.
  static async _validateDiskFiles(files) {
    for (const file of files) {
      if (!isAllowedGalleryMimeType(file.mimetype)) {
        await GalleryService._cleanupDiskFiles(files);
        throw new ApiError(400, "GIF, HEIC, and HEIF images are not supported.");
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        await GalleryService._cleanupDiskFiles(files);
        throw new ApiError(400, "Maximum image size is 10 MB.");
      }
    }
  }

  static async _cleanupDiskFiles(files) {
    await FileService.deleteMultipleFiles(files.map((file) => file.path));
  }

  // Optimizes one already-uploaded (disk) file into the Gallery volume.
  // Deletes the original raw upload once the optimized copy is written.
  static async _optimizeDiskFileToGallery(userId, file) {
    ensureGalleryDir();

    const fileName = `${userId}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.webp`;
    const filePath = getGalleryFilePath(fileName);

    try {
      const inputBuffer = await fs.readFile(file.path);
      await optimizeImageToWebp(inputBuffer, filePath);

      // Verify the optimized file actually landed on disk before we trust it.
      const existsAfterWrite = await FileService.fileExists(filePath);
      if (!existsAfterWrite) {
        throw new Error(`Gallery file was not written to "${filePath}" after optimization.`);
      }
    } catch (error) {
      // Never leave failed raw uploads or partial optimized files behind.
      await Promise.all([
        FileService.deleteFile(file.path),
        FileService.deleteFile(filePath),
      ]);
      throw error;
    }

    await FileService.deleteFile(file.path);

    const stats = await fs.stat(filePath);
  
    return {
      imageUrl: buildGalleryImageUrl(fileName),
      fileName,
      fileSize: stats.size,
      diskPath: filePath,
    };
  }

  // Used by signup (and available for any "add images" use case) when the
  // raw files already live on disk courtesy of the existing upload
  // middleware. Enforces the max-10 rule before writing anything.
  static async addImagesForUser(userId, files = []) {
    if (!files.length) return [];

    await GalleryService._validateDiskFiles(files);

    const existingCount = await Gallery.countDocuments({ userId });
    if (existingCount + files.length > MAX_GALLERY_IMAGES) {
      await GalleryService._cleanupDiskFiles(files);
      throw new ApiError(400, "Maximum 10 images are allowed.");
    }

    console.log(`[GalleryService] Adding ${files.length} gallery image(s) for user ${userId} (existing: ${existingCount})`);

    const created = [];
    for (const file of files) {
      const optimized = await GalleryService._optimizeDiskFileToGallery(userId, file);

      try {
        const doc = await Gallery.create({
          userId,
          imageUrl: optimized.imageUrl,
          fileName: optimized.fileName,
          fileSize: optimized.fileSize,
          mimeType: "image/webp",
        });
        console.log(`[GalleryService] Created Gallery record ${doc._id} -> ${optimized.imageUrl} (${optimized.fileSize} bytes)`);
        created.push(doc);
      } catch (err) {
        await FileService.deleteFile(optimized.diskPath);
        if (err.code === 11000) {
          throw new ApiError(409, "This image already exists in your gallery.");
        }
        throw err;
      }
    }
    return created;
  }

  // Used by the profile edit controllers: applies additions and/or
  // removals in one call, validating the *final* projected count against
  // the max-10 rule before mutating anything.
  static async updateGalleryForUser(
    userId,
    { newFiles = [], removeGalleryImageIds = [] } = {}
  ) {
    if (!newFiles.length && !removeGalleryImageIds.length) {
      return { added: [], removedCount: 0 };
    }

    if (newFiles.length) {
      await GalleryService._validateDiskFiles(newFiles);
    }

    // Only images the user actually owns count as removable.
    const imagesToRemove = removeGalleryImageIds.length
      ? await Gallery.find({ _id: { $in: removeGalleryImageIds }, userId })
      : [];

    const existingCount = await Gallery.countDocuments({ userId });
    const projectedCount =
      existingCount - imagesToRemove.length + newFiles.length;
    if (projectedCount > MAX_GALLERY_IMAGES) {
      await GalleryService._cleanupDiskFiles(newFiles);
      throw new ApiError(400, "Maximum 10 images are allowed.");
    }

    // Remove first so freed slots are already reflected before adding.
    await FileService.deleteMultipleFiles(
      imagesToRemove.map((doc) => getGalleryFilePath(doc.fileName))
    );
    if (imagesToRemove.length) {
      await Gallery.deleteMany({
        _id: { $in: imagesToRemove.map((doc) => doc._id) },
      });
    }

    const added = newFiles.length
      ? await GalleryService.addImagesForUser(userId, newFiles)
      : [];

    return { added, removedCount: imagesToRemove.length };
  }

  // Deletes every gallery image (files + documents) belonging to a user.
  // Used to roll back signup when user creation must be undone after
  // gallery images were already persisted.
  static async deleteAllForUser(userId) {
    const docs = await Gallery.find({ userId });
    await FileService.deleteMultipleFiles(
      docs.map((doc) => getGalleryFilePath(doc.fileName))
    );
    await Gallery.deleteMany({ userId });
  }

  // Parses a "removeGalleryImageIds" field that may arrive as a JSON
  // string, a plain array, or be absent — mirroring how certificates/
  // achievements arrays are already parsed in the edit controllers.
  static parseIdArray(raw) {
    if (!raw) return [];
    try {
      if (typeof raw === "string") return JSON.parse(raw);
      if (Array.isArray(raw)) {
        if (raw.length > 0 && typeof raw[0] === "string" && raw[0].trim().startsWith("[")) {
          return JSON.parse(raw[0]);
        }
        return raw;
      }
      return [];
    } catch (e) {
      console.error("Failed to parse removeGalleryImageIds:", e);
      return [];
    }
  }
}

export default GalleryService;
