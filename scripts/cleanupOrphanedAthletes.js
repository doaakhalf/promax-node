/**
 * One-shot: soft-delete athlete profiles with missing or deleted users.
 *
 *   node ./scripts/cleanupOrphanedAthletes.js
 *   node ./scripts/cleanupOrphanedAthletes.js --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import Athlete from "../Models/Athlete.js";
import { cleanupOrphanedAthletes } from "../services/userDeletionService.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  if (dryRun) {
    const deletedAt = new Date();
    const orphaned = await Athlete.aggregate([
      {
        $match: {
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $addFields: {
          user: { $arrayElemAt: ["$user", 0] },
        },
      },
      {
        $match: {
          $or: [
            { user: null },
            { "user.deletedAt": { $ne: null } },
            { "user.status": "deleted" },
          ],
        },
      },
      { $project: { _id: 1, userId: 1 } },
    ]);

    console.log("[cleanupOrphanedAthletes] dry-run", {
      orphanedCount: orphaned.length,
      athleteIds: orphaned.map((athlete) => athlete._id.toString()),
      wouldSetDeletedAt: deletedAt.toISOString(),
    });
    return;
  }

  const result = await cleanupOrphanedAthletes();
  console.log("[cleanupOrphanedAthletes]", result);
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[cleanupOrphanedAthletes] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
