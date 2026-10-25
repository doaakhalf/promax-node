import Coach from "../Models/Coach.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import AthleteProgress from "../Models/AthleteProgress.js";
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

/**
 * Athletes who logged weight more than once in AthleteProgress
 * (signup baseline counts as one; only those with entriesCount > 1).
 */
export const getWeightTrackers = async (req, res) => {
  try {
    const pageNum = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [result] = await AthleteProgress.aggregate([
      {
        $match: {
          deletedAt: null,
          weight: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$athleteId",
          entriesCount: { $sum: 1 },
          lastRecordedAt: { $max: "$recordedAt" },
        },
      },
      { $match: { entriesCount: { $gt: 1 } } },
      {
        $facet: {
          meta: [{ $count: "total" }],
          items: [
            { $sort: { lastRecordedAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                id: { $toString: "$_id" },
                name: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ["$user.firstName", ""] },
                        " ",
                        { $ifNull: ["$user.lastName", ""] },
                      ],
                    },
                  },
                },
                email: { $ifNull: ["$user.email", null] },
                entriesCount: 1,
                lastRecordedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result?.meta?.[0]?.total || 0;
    const data = (result?.items || []).map((row) => ({
      ...row,
      name: row.name?.trim() || "Unknown",
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
