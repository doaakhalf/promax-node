import {
  generatePayouts,
  getNextPayoutDetails,
  getAdminPayoutDetails,
  listPayouts,
  listUpcomingPayouts,
  markPayoutPaid,
} from "../services/earningsService.js";
import { decimalToNumber } from "../utils/coachNetAmount.js";
import { formatPeriodLabel } from "../utils/payoutPeriods.js";
import NotificationService from "../services/NotificationService.js";
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";

export const adminListPayouts = async (req, res) => {
  try {
    const result = await listPayouts({
      coachId: req.query.coachId,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    });

    const data = result.payouts.map((payout) => ({
      ...payout,
      amount: decimalToNumber(payout.amount),
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetPayoutDetails = async (req, res) => {
  try {
    const payout = await getAdminPayoutDetails(req.params.id);
    if (!payout) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...payout,
        amount: decimalToNumber(payout.amount),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const adminListUpcomingPayouts = async (req, res) => {
  try {
    const includeZero = req.query.includeZero === "true";
    const data = await listUpcomingPayouts({ includeZero });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetCoachUpcomingPayout = async (req, res) => {
  try {
    const { coachId } = req.params;
    const [coach, coachProfile] = await Promise.all([
      User.findById(coachId).select("firstName lastName email").lean(),
      Coach.findOne({ userId: coachId, deletedAt: null })
        .select("instapayLink walletNumber")
        .lean(),
    ]);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const details = await getNextPayoutDetails(coachId, { page, limit });
    const instapayLink = coachProfile?.instapayLink || null;
    const walletNumber = coachProfile?.walletNumber || null;

    return res.status(200).json({
      success: true,
      data: {
        coach: {
          id: coach._id,
          firstName: coach.firstName,
          lastName: coach.lastName,
          email: coach.email,
          name: `${coach.firstName || ""} ${coach.lastName || ""}`.trim(),
          instapayLink,
          walletNumber,
        },
        instapayLink,
        walletNumber,
        ...details,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGeneratePayouts = async (req, res) => {
  try {
    const { scheduledDate, periodStart, periodEnd, coachId } = req.body;
    const results = await generatePayouts({
      scheduledDate,
      periodStart,
      periodEnd,
      coachId,
    });
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const adminMarkPayoutPaid = async (req, res) => {
  try {
    const file = req.file;
    const paymentProofImage = file
      ? `/images/${req.uploadFolder}/${file.filename}`
      : null;

    const result = await markPayoutPaid(req.params.id, {
      paidBy: req.userId,
      paymentReference: req.body.paymentReference,
      paymentProofImage,
      notes: req.body.notes,
    });

    if (!result?.payout) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }

    const { payout, newlyPaid } = result;
    const amount = decimalToNumber(payout.amount);
    const currency = payout.currency || "EGP";

    if (newlyPaid) {
      const periodLabel = formatPeriodLabel(payout.periodStart, payout.periodEnd);
      const amountLabel = `${amount} ${currency}`;
      NotificationService.sendNotification({
        recipientId: payout.coachId,
        senderId: req.userId,
        type: "payout_paid",
        title: "تم تحويل مستحقاتك 💰",
        message: `تم تحويل مبلغ ${amountLabel} عن الفترة ${periodLabel}`,
        data: {
          type: "payout_paid",
          payoutId: payout._id.toString(),
          amount: String(amount),
          currency,
          paymentReference: payout.paymentReference || "",
          periodStart: payout.periodStart?.toISOString?.() || String(payout.periodStart),
          periodEnd: payout.periodEnd?.toISOString?.() || String(payout.periodEnd),
        },
      }).catch((err) => console.error("Coach payout notification failed:", err));
    }

    return res.status(200).json({
      success: true,
      data: {
        ...payout.toObject(),
        amount,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};
