import {
  generatePayouts,
  listPayouts,
  markPayoutPaid,
} from "../services/earningsService.js";
import { decimalToNumber } from "../utils/coachNetAmount.js";

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
    const payout = await markPayoutPaid(req.params.id, {
      paidBy: req.userId,
      paymentReference: req.body.paymentReference,
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
