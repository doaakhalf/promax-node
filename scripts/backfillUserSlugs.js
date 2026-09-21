/**
 * One-shot: backfill random unique 8-char slugs for users missing them.
 *
 *   node ./scripts/backfillUserSlugs.js
 *   node ./scripts/backfillUserSlugs.js --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import User from "../Models/User.js";
import { ensureUniqueSlug } from "../utils/userSlug.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  const users = await User.find({
    $or: [{ slug: null }, { slug: { $exists: false } }],
  })
    .select("_id firstName lastName slug")
    .lean();

  if (dryRun) {
    console.log("[backfillUserSlugs] dry-run", {
      missingSlugCount: users.length,
      sampleUserIds: users.slice(0, 20).map((u) => u._id.toString()),
    });
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const slug = await ensureUniqueSlug({ excludeUserId: user._id });
      await User.updateOne({ _id: user._id }, { $set: { slug } });
      updated += 1;
    } catch (err) {
      failed += 1;
      console.error("[backfillUserSlugs] failed for user", user._id.toString(), err.message);
    }
  }

  console.log("[backfillUserSlugs]", {
    found: users.length,
    updated,
    failed,
  });
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[backfillUserSlugs] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
