/**
 * Railway Cron Job (one-shot). Do not run this inside the web service.
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

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();
  await expireEndedSubscriptions({ dryRun });
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
