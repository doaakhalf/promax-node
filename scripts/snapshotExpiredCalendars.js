/**
 * One-shot: nest workout+exercise snapshots onto already-expired calendars
 * that still only store live workoutId refs.
 *
 *   node ./scripts/snapshotExpiredCalendars.js
 *   node ./scripts/snapshotExpiredCalendars.js --dry-run
 */
import "dotenv/config";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import {
  collectCalendarWorkoutIds,
  snapshotWorkoutsForCalendars,
} from "../services/workoutSnapshotService.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  const calendars = await WorkoutCalendar.find({
    deletedAt: null,
    status: "expired",
    "weeks.trainingDays.workoutId": { $ne: null },
  });

  const needingSnapshot = calendars.filter((calendar) =>
    (calendar.weeks || []).some((week) =>
      (week.trainingDays || []).some(
        (day) => day.workoutId && !day.workoutSnapshot
      )
    )
  );

  if (dryRun) {
    const workoutIds = [
      ...new Set(
        needingSnapshot.flatMap(collectCalendarWorkoutIds).map((id) => id.toString())
      ),
    ];
    console.log("[snapshotExpiredCalendars] dry-run", {
      expiredCalendars: calendars.length,
      calendarsNeedingSnapshot: needingSnapshot.length,
      distinctWorkoutIds: workoutIds.length,
    });
    return;
  }

  const result = await snapshotWorkoutsForCalendars(needingSnapshot, {
    onlyMissing: true,
  });

  console.log("[snapshotExpiredCalendars]", {
    expiredCalendars: calendars.length,
    calendarsNeedingSnapshot: needingSnapshot.length,
    calendarsProcessed: result.calendarsProcessed,
    daysSnapshotted: result.daysSnapshotted,
  });
}

main()
  .catch((err) => {
    console.error("[snapshotExpiredCalendars] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromMongo();
  });
