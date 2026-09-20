import { Schema, model } from "mongoose";

const promoCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["coach", "admin"],
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 1,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

promoCodeSchema.index({ coachId: 1, source: 1, deletedAt: 1 });
promoCodeSchema.index({ source: 1, isActive: 1, deletedAt: 1 });

export default model("PromoCode", promoCodeSchema);
