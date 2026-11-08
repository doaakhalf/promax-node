/**
 * One-shot notification cleanup. Do not run this inside the web service.
 *
 * The daily Railway cron already runs this from `npm run expire:subscriptions`
 * (schedule 5 0 * * *). Use this script to run cleanup on its own.
 *
 * Local:
 *   npm run cleanup:notifications
 *   npm run cleanup:notifications -- --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import { deleteExpiredNotifications } from "../services/notificationCleanupService.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();
  await deleteExpiredNotifications({ dryRun });
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[cleanupNotifications] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
