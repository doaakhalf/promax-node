/**
 * One-shot: hard-delete documents from domain collections only,
 * plus users with status "deleted" and their Athlete/Coach profiles,
 * plus conversations/messages except one preserved conversation.
 * Does not modify model files/schemas.
 * Does not touch any other collections or non-deleted users.
 *
 *   node ./scripts/wipeDomainData.js --dry-run
 *   node ./scripts/wipeDomainData.js --confirm
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import GymWorkoutSetDetail from "../Models/GymWorkoutSetDetail.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Workout from "../Models/Workout.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import CoachPayout from "../Models/CoachPayout.js";
import Notification from "../Models/Notification.js";
import AuditLog from "../Models/AuditLog.js";
import Subscription from "../Models/Subscription.js";
import Message from "../Models/Message.js";
import Conversation from "../Models/Conversation.js";
import Athlete from "../Models/Athlete.js";
import Coach from "../Models/Coach.js";
import User from "../Models/User.js";

const dryRun = process.argv.includes("--dry-run");
const confirm = process.argv.includes("--confirm");

/** Keep this conversation and its messages. */
const PRESERVED_CONVERSATION_ID = new mongoose.Types.ObjectId(
  "6a9f7039e6d067d4a7d54cba"
);

/** Child-first order among the listed models only. Optional `filter` scopes delete/count. */
function buildTargets(deletedUserIds) {
  return [
    { name: "GymWorkoutSetDetail", model: GymWorkoutSetDetail },
    { name: "GymWorkoutSet", model: GymWorkoutSet },
    { name: "WorkoutAssignment", model: WorkoutAssignment },
    { name: "WorkoutCalendar", model: WorkoutCalendar },
    { name: "Workout", model: Workout },
    { name: "SubscriptionPayment", model: SubscriptionPayment },
    { name: "CoachPayout", model: CoachPayout },
    { name: "Notification", model: Notification },
    { name: "AuditLog", model: AuditLog },
    { name: "Subscription", model: Subscription },
    {
      name: "Message (except preserved)",
      model: Message,
      filter: { conversationId: { $ne: PRESERVED_CONVERSATION_ID } },
    },
    {
      name: "Conversation (except preserved)",
      model: Conversation,
      filter: { _id: { $ne: PRESERVED_CONVERSATION_ID } },
    },
    {
      name: "Athlete (user status:deleted)",
      model: Athlete,
      filter: { userId: { $in: deletedUserIds } },
    },
    {
      name: "Coach (user status:deleted)",
      model: Coach,
      filter: { userId: { $in: deletedUserIds } },
    },
    { name: "User (status:deleted)", model: User, filter: { status: "deleted" } },
  ];
}

async function main() {
  if (!dryRun && !confirm) {
    console.error(
      "[wipeDomainData] Refusing to run without --dry-run or --confirm.\n" +
        "  node ./scripts/wipeDomainData.js --dry-run\n" +
        "  node ./scripts/wipeDomainData.js --confirm"
    );
    process.exit(1);
  }

  const connection = await connectToMongo();
  if (!connection) {
    throw new Error("MongoDB connection failed");
  }

  registerModels();

  const deletedUserIds = (
    await User.find({ status: "deleted" }).select("_id").lean()
  ).map((u) => u._id);

  const summary = [];

  for (const { name, model, filter = {} } of buildTargets(deletedUserIds)) {
    const count = await model.countDocuments(filter);
    if (dryRun) {
      summary.push({ name, count, deleted: 0 });
      continue;
    }

    const result = await model.deleteMany(filter);
    summary.push({ name, count, deleted: result.deletedCount ?? 0 });
  }

  console.log("[wipeDomainData]", dryRun ? "dry-run" : "deleted", {
    deletedUserIds: deletedUserIds.length,
    collections: summary,
    totalWouldDelete: summary.reduce((sum, row) => sum + row.count, 0),
    totalDeleted: summary.reduce((sum, row) => sum + row.deleted, 0),
  });
}

main()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[wipeDomainData] failed", err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
