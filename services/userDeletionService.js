import User from "../Models/User.js";
import Athlete from "../Models/Athlete.js";
import Subscription from "../Models/Subscription.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import GalleryService from "./GalleryService.js";

/**
 * Soft-deletes an athlete and all directly related operational data.
 * Financial records (SubscriptionPayment, CoachPayout) are preserved.
 */
export async function softDeleteAthlete(userId) {
  const deletedAt = new Date();

  const user = await User.findById(userId).populate("role_id").lean();
  if (!user) {
    return { ok: false, status: 404, message: "User not found" };
  }
  if (user.deletedAt) {
    return { ok: false, status: 400, message: "Account already deleted" };
  }
  if (user.role_id?.name !== "athlete") {
    return { ok: false, status: 400, message: "User is not an athlete" };
  }

  await Promise.all([
    Athlete.updateOne({ userId, deletedAt: null }, { deletedAt }),
    Subscription.updateMany(
      { athleteId: userId, deletedAt: null, status: { $in: ["active", "pending"] } },
      { deletedAt, status: "cancelled" }
    ),
    WorkoutCalendar.updateMany({ athleteId: userId, deletedAt: null }, { deletedAt }),
    WorkoutAssignment.updateMany({ athleteId: userId, deletedAt: null }, { deletedAt }),
  ]);

  await Subscription.updateMany(
    { athleteId: userId, deletedAt: null },
    { deletedAt }
  );

  await User.findByIdAndUpdate(userId, {
    deletedAt,
    status: "deleted",
    fcmTokens: [],
  });

  await GalleryService.deleteAllForUser(userId).catch(() => {});

  return { ok: true };
}

/**
 * Soft-deletes athlete profiles whose user is missing or already deleted.
 */
export async function cleanupOrphanedAthletes() {
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
    { $project: { _id: 1 } },
  ]);

  const ids = orphaned.map((athlete) => athlete._id);
  if (!ids.length) {
    return { modifiedCount: 0 };
  }

  const result = await Athlete.updateMany({ _id: { $in: ids } }, { deletedAt });
  return { modifiedCount: result.modifiedCount };
}
