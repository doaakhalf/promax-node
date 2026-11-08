/**
 * Railway Cron Job (one-shot). Do not run this inside the web service.
 *
 * Runs subscription expiry and general/old notification cleanup.
 *
 * Railway setup:
 * - Add a Cron Job service in the same project / same repo
 * - Start command: npm run expire:subscriptions
 * - Schedule: 5 0 * * *  (daily 00:05 UTC)
 * - Copy MONGO_URI from the API service
 *
 * Local:
 *   npm run expire:subscriptions
 *   npm run expire:subscriptions -- --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import { expireEndedSubscriptions } from "../services/subscriptionExpiryService.js";
import { deleteExpiredNotifications } from "../services/notificationCleanupService.js";

const dryRun = process.argv.includes("--dry-run");

async function runStep(label, task) {
  try {
    await task();
    return null;
  } catch (err) {
    console.error(`[expireSubscriptions] ${label} failed`, err);
    return err;
  }
}

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();
  const failures = [
    await runStep("expire subscriptions", () => expireEndedSubscriptions({ dryRun })),
    await runStep("cleanup notifications", () => deleteExpiredNotifications({ dryRun })),
  ].filter(Boolean);

  if (failures.length) {
    throw new Error(`${failures.length} daily cron step(s) failed`);
  }
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[expireSubscriptions] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
