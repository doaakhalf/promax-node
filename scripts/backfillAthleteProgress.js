/**
 * One-shot: backfill the first AthleteProgress entry for existing athletes
 * from their current Athlete.weight / measurements, dated at registration
 * (Athlete.createdAt) so their pre-feature values become the oldest history.
 *
 *   node ./scripts/backfillAthleteProgress.js
 *   node ./scripts/backfillAthleteProgress.js --dry-run
 *
 * Idempotent: athletes who already have any progress entry are skipped.
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import Athlete from "../Models/Athlete.js";
import AthleteProgress from "../Models/AthleteProgress.js";
import { ensureLegacyProgressEntry } from "../services/athleteProgressService.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  const athletes = await Athlete.find({
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  }).lean();

  if (dryRun) {
    let pending = 0;
    for (const athlete of athletes) {
      const count = await AthleteProgress.countDocuments({ athleteId: athlete.userId });
      if (count === 0) pending += 1;
    }
    console.log("[backfillAthleteProgress] dry-run", {
      totalAthletes: athletes.length,
      needingBackfill: pending,
    });
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const athlete of athletes) {
    try {
      // Idempotent: returns null when the athlete already has entries.
      const entry = await ensureLegacyProgressEntry(athlete);
      if (entry) created += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      console.error(
        "[backfillAthleteProgress] failed for athlete",
        athlete.userId?.toString(),
        err.message
      );
    }
  }

  console.log("[backfillAthleteProgress]", {
    totalAthletes: athletes.length,
    created,
    skipped,
    failed,
  });
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[backfillAthleteProgress] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
