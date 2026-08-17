import {
  getDashboard,
  getNextPayoutDetails,
  getPaymentHistory,
  getPayoutDetails,
} from "../services/earningsService.js";

export const getCoachEarnings = async (req, res) => {
  try {
    const filter = req.query.filter || "this_month";
    const data = await getDashboard(req.userId, filter);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCoachNextPayoutDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const data = await getNextPayoutDetails(req.userId, { page, limit });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCoachPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const { year } = req.query;
    const data = await getPaymentHistory(req.userId, { year, page, limit });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCoachPayoutDetails = async (req, res) => {
  try {
    const data = await getPayoutDetails(req.userId, req.params.payoutId);
    if (!data) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
