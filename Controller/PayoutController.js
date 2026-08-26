import {
  generatePayouts,
  getNextPayoutDetails,
  listPayouts,
  listUpcomingPayouts,
  markPayoutPaid,
} from "../services/earningsService.js";
import { decimalToNumber } from "../utils/coachNetAmount.js";
import User from "../Models/User.js";

export const adminListPayouts = async (req, res) => {
  try {
    const payouts = await listPayouts({
      coachId: req.query.coachId,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
    });

    const data = payouts.map((payout) => ({
      ...payout,
      amount: decimalToNumber(payout.amount),
    }));

    return res.status(200).json({ success: true, data });
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
    const coach = await User.findById(coachId).select("firstName lastName email").lean();
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const details = await getNextPayoutDetails(coachId, { page, limit });

    return res.status(200).json({
      success: true,
      data: {
        coach: {
          id: coach._id,
          firstName: coach.firstName,
          lastName: coach.lastName,
          email: coach.email,
          name: `${coach.firstName || ""} ${coach.lastName || ""}`.trim(),
        },
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

    const payout = await markPayoutPaid(req.params.id, {
      paidBy: req.userId,
      paymentReference: req.body.paymentReference,
      paymentProofImage,
      notes: req.body.notes,
    });

    if (!payout) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...payout.toObject(),
        amount: decimalToNumber(payout.amount),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
