import PromoCode from "../Models/PromoCode.js";
import {
  PromoCodeError,
  createAdminPromoCode,
  createCoachPromoCode,
  parseUsageLimit,
  resolveExpiresAt,
  serializePromoCode,
} from "../services/promoCodeService.js";

const handlePromoError = (res, error) => {
  if (error instanceof PromoCodeError) {
    return res.status(error.status || 400).json({ message: error.message });
  }
  console.error("PromoCode error:", error);
  return res.status(500).json({
    message: "Promo code request failed",
    error: error?.message,
  });
};

export const coachCreatePromoCode = async (req, res) => {
  try {
    const promo = await createCoachPromoCode({
      coachUserId: req.userId,
      discountPercent: req.body.discountPercent,
      expiresAt: req.body.expiresAt,
      usageLimit: req.body.usageLimit,
    });
    return res.status(201).json({
      message: "Promo code created successfully",
      data: serializePromoCode(promo),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const coachListPromoCodes = async (req, res) => {
  try {
    const rows = await PromoCode.find({
      coachId: req.userId,
      source: "coach",
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "success",
      data: rows.map(serializePromoCode),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const coachUpdatePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findOne({
      _id: req.params.id,
      coachId: req.userId,
      source: "coach",
      deletedAt: null,
    });

    if (!promo) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    if (req.body.isActive !== undefined) {
      promo.isActive = Boolean(req.body.isActive);
    }
    if (req.body.expiresAt !== undefined) {
      promo.expiresAt = resolveExpiresAt(req.body.expiresAt);
    }
    if (req.body.usageLimit !== undefined) {
      promo.usageLimit = parseUsageLimit(req.body.usageLimit);
    }

    await promo.save();
    return res.status(200).json({
      message: "Promo code updated successfully",
      data: serializePromoCode(promo),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const coachDeletePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findOne({
      _id: req.params.id,
      coachId: req.userId,
      source: "coach",
      deletedAt: null,
    });

    if (!promo) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    promo.isActive = false;
    promo.deletedAt = new Date();
    await promo.save();

    return res.status(200).json({
      message: "Promo code deactivated successfully",
      data: serializePromoCode(promo),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const adminCreatePromoCode = async (req, res) => {
  try {
    const promo = await createAdminPromoCode({
      adminUserId: req.userId,
      code: req.body.code,
      discountPercent: req.body.discountPercent,
      expiresAt: req.body.expiresAt,
      usageLimit: req.body.usageLimit,
    });
    return res.status(201).json({
      message: "Promo code created successfully",
      data: serializePromoCode(promo),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const adminListPromoCodes = async (req, res) => {
  try {
    const filter = { deletedAt: null };
    if (req.query.source === "coach" || req.query.source === "admin") {
      filter.source = req.query.source;
    }

    const rows = await PromoCode.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      message: "success",
      data: rows.map(serializePromoCode),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const adminUpdatePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!promo) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    if (req.body.isActive !== undefined) {
      promo.isActive = Boolean(req.body.isActive);
    }
    if (req.body.expiresAt !== undefined) {
      promo.expiresAt = resolveExpiresAt(req.body.expiresAt);
    }
    if (req.body.usageLimit !== undefined) {
      promo.usageLimit = parseUsageLimit(req.body.usageLimit);
    }

    await promo.save();
    return res.status(200).json({
      message: "Promo code updated successfully",
      data: serializePromoCode(promo),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};

export const adminDeletePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!promo) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    promo.isActive = false;
    promo.deletedAt = new Date();
    await promo.save();

    return res.status(200).json({
      message: "Promo code deactivated successfully",
      data: serializePromoCode(promo),
    });
  } catch (error) {
    return handlePromoError(res, error);
  }
};
