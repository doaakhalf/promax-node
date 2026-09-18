/**
 * One-shot: hard-delete gallery images whose userId no longer exists in users.
 * Removes both MongoDB documents and files from the gallery volume/dir.
 *
 *   node ./scripts/cleanupOrphanedGallery.js
 *   node ./scripts/cleanupOrphanedGallery.js --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import Gallery from "../Models/Gallery.js";
import FileService from "../services/file.service.js";
import { getGalleryFilePath } from "../config/galleryStorage.js";

const dryRun = process.argv.includes("--dry-run");

async function findOrphanedGallery() {
  return Gallery.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $match: {
        user: { $size: 0 },
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        fileName: 1,
        imageUrl: 1,
      },
    },
  ]);
}

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  const orphaned = await findOrphanedGallery();

  if (dryRun) {
    console.log("[cleanupOrphanedGallery] dry-run", {
      orphanedCount: orphaned.length,
      sample: orphaned.slice(0, 20).map((doc) => ({
        id: doc._id.toString(),
        userId: doc.userId?.toString(),
        fileName: doc.fileName,
      })),
    });
    return;
  }

  if (!orphaned.length) {
    console.log("[cleanupOrphanedGallery]", {
      deletedCount: 0,
      filesAttempted: 0,
    });
    return;
  }

  const filePaths = orphaned.map((doc) => getGalleryFilePath(doc.fileName));
  await FileService.deleteMultipleFiles(filePaths);

  const result = await Gallery.deleteMany({
    _id: { $in: orphaned.map((doc) => doc._id) },
  });

  console.log("[cleanupOrphanedGallery]", {
    deletedCount: result.deletedCount,
    filesAttempted: filePaths.length,
  });
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[cleanupOrphanedGallery] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
