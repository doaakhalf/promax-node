import Notification from "../Models/Notification.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export const deleteExpiredNotifications = async ({
  asOf = new Date(),
  dryRun = false,
} = {}) => {
  const weekAgo = new Date(asOf.getTime() - WEEK_MS);
  const twoWeeksAgo = new Date(asOf.getTime() - TWO_WEEKS_MS);

  const generalQuery = { type: "general", createdAt: { $lt: weekAgo } };
  const readOtherQuery = {
    type: { $ne: "general" },
    isRead: true,
    createdAt: { $lt: weekAgo },
  };
  const unreadOtherQuery = {
    type: { $ne: "general" },
    isRead: false,
    createdAt: { $lt: twoWeeksAgo },
  };

  const query = { $or: [generalQuery, readOtherQuery, unreadOtherQuery] };

  if (dryRun) {
    const [general, readOther, unreadOther] = await Promise.all([
      Notification.countDocuments(generalQuery),
      Notification.countDocuments(readOtherQuery),
      Notification.countDocuments(unreadOtherQuery),
    ]);
    const summary = {
      dryRun: true,
      weekAgo,
      twoWeeksAgo,
      general,
      readOther,
      unreadOther,
      total: general + readOther + unreadOther,
    };
    console.log("[cleanupNotifications]", summary);
    return summary;
  }

  const result = await Notification.deleteMany(query);
  const summary = {
    dryRun: false,
    weekAgo,
    twoWeeksAgo,
    deletedCount: result.deletedCount,
  };
  console.log("[cleanupNotifications]", summary);
  return summary;
};
