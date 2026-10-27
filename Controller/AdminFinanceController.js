import mongoose from "mongoose";
import Subscription from "../Models/Subscription.js";
import CoachPayout from "../Models/CoachPayout.js";
import User from "../Models/User.js";
import { decimalToNumber, toMoney } from "../utils/coachNetAmount.js";

/** Confirmed subscription statuses — money already accepted (excludes pending/rejected/refunded,cancelled). */
const CONFIRMED_STATUSES = ["active", "expired", "paused"];

const toDouble = (field) => ({ $toDouble: { $ifNull: [`$${field}`, 0] } });

/**
 * Read-only finance summary for admin Payments UI.
 * Sums existing stored fields only — does not change fee/payout logic.
 */
export const getPaymentsFinanceSummary = async (req, res) => {
  try {
    const [subByCoach, paidByCoach] = await Promise.all([
      Subscription.aggregate([
        {
          $match: {
            deletedAt: null,
            status: { $in: CONFIRMED_STATUSES },
            coachId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$coachId",
            totalCollected: { $sum: toDouble("amount") },
            platformProfit: { $sum: toDouble("platformFee") },
            coachShare: { $sum: toDouble("coachNetAmount") },
          },
        },
      ]),
      CoachPayout.aggregate([
        {
          $match: {
            deletedAt: null,
            status: "paid",
            coachId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$coachId",
            paid: { $sum: toDouble("amount") },
          },
        },
      ]),
    ]);

    const byCoachMap = new Map();

    for (const row of subByCoach) {
      const coachId = String(row._id);
      byCoachMap.set(coachId, {
        coachId,
        totalCollected: toMoney(decimalToNumber(row.totalCollected)),
        platformProfit: toMoney(decimalToNumber(row.platformProfit)),
        coachShare: toMoney(decimalToNumber(row.coachShare)),
        paid: 0,
      });
    }

    for (const row of paidByCoach) {
      const coachId = String(row._id);
      const paid = toMoney(decimalToNumber(row.paid));
      const existing = byCoachMap.get(coachId);
      if (existing) {
        existing.paid = paid;
      } else {
        byCoachMap.set(coachId, {
          coachId,
          totalCollected: 0,
          platformProfit: 0,
          coachShare: 0,
          paid,
        });
      }
    }

    let totalCollected = 0;
    let platformProfit = 0;
    let paidToCoaches = 0;
    let coachShareTotal = 0;

    const coachIds = [];
    for (const row of byCoachMap.values()) {
      if (row.coachShare <= 0 && row.paid <= 0) continue;
      totalCollected += row.totalCollected;
      platformProfit += row.platformProfit;
      paidToCoaches += row.paid;
      coachShareTotal += row.coachShare;
      coachIds.push(row.coachId);
    }

    const users =
      coachIds.length === 0
        ? []
        : await User.find({
            _id: {
              $in: coachIds
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
                .map((id) => new mongoose.Types.ObjectId(id)),
            },
          })
            .select("firstName lastName email")
            .lean();

    const nameById = new Map(
      users.map((u) => [
        String(u._id),
        {
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "—",
          email: u.email || "",
        },
      ])
    );

    const byCoach = [];
    for (const row of byCoachMap.values()) {
      if (row.coachShare <= 0 && row.paid <= 0) continue;
      const owed = toMoney(Math.max(0, row.coachShare - row.paid));
      const info = nameById.get(row.coachId) || { name: "—", email: "" };
      byCoach.push({
        coachId: row.coachId,
        name: info.name,
        email: info.email,
        totalCollected: row.totalCollected,
        platformProfit: row.platformProfit,
        coachShare: row.coachShare,
        paid: row.paid,
        owed,
      });
    }

    byCoach.sort((a, b) => b.owed - a.owed || b.paid - a.paid || a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      data: {
        totalCollected: toMoney(totalCollected),
        platformProfit: toMoney(platformProfit),
        paidToCoaches: toMoney(paidToCoaches),
        owedToCoaches: toMoney(Math.max(0, coachShareTotal - paidToCoaches)),
        byCoach,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
