import Coach from "../Models/Coach.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import { listUpcomingPayouts } from "../services/earningsService.js";

export const getAdminOverviewSummary = async (req, res) => {
  try {
    const [coachCounts, pendingPayments, upcoming] = await Promise.all([
      Coach.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $match: {
            "user.status": { $in: ["pending", "active"] }
          }
        },
        {
          $group: {
            _id: "$user.status",
            count: { $sum: 1 }
          }
        }
      ]),
      SubscriptionPayment.countDocuments({ status: "pending" }),
      listUpcomingPayouts({ summaryOnly: true })
    ]);

    const counts = Object.fromEntries(
      coachCounts.map(({ _id, count }) => [_id, count])
    );

    return res.status(200).json({
      success: true,
      data: {
        pendingCoaches: counts.pending || 0,
        activeCoaches: counts.active || 0,
        pendingPayments,
        upcomingTotal: upcoming.totalAmount,
        upcomingCoaches: upcoming.coachCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
