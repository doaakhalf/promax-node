/**
 * One-shot: reset chat trial counters for pairs that already have an expired subscription.
 *
 *   node ./scripts/resetExpiredChatCounts.js
 *   node ./scripts/resetExpiredChatCounts.js --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import Subscription from "../Models/Subscription.js";
import { resetConversationMessageCountsForPairs } from "../utils/resetConversationMessageCounts.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  const expired = await Subscription.find({
    deletedAt: null,
    status: "expired",
  })
    .select("coachId athleteId")
    .lean();

  const pairs = expired.map((sub) => ({
    coachId: sub.coachId,
    athleteId: sub.athleteId,
  }));

  const uniqueKeys = new Set(
    pairs
      .filter((p) => p.coachId && p.athleteId)
      .map((p) => `${p.coachId.toString()}:${p.athleteId.toString()}`)
  );

  if (dryRun) {
    console.log("[resetExpiredChatCounts] dry-run", {
      expiredSubscriptions: expired.length,
      uniquePairs: uniqueKeys.size,
    });
    return;
  }

  const result = await resetConversationMessageCountsForPairs(pairs);
  console.log("[resetExpiredChatCounts]", {
    expiredSubscriptions: expired.length,
    uniquePairs: result.pairsReset,
    conversationsModified: result.modifiedCount,
  });
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[resetExpiredChatCounts] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
