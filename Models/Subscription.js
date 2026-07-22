import { Schema, model } from "mongoose";
import { resetTime } from "../utils/resetTime.js";


const subscriptionSchema = new Schema(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    athleteId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionPlan: {
      type: String,
      required: true,
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    currency: {
      type: String,
      default: "EGP",
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      default: "pending",
    },
    transactionId: {
      type: String,
      default: null,
    },
    startDate: {
      type: Date,
      required: true,
      get: resetTime,
    },
    endDate: {
      type: Date,
      required: true,
      get: resetTime,
    },
    renewalDate: {
      type: Date,
      default: null,
      get: resetTime,
    },
    status: {
      type: String,
      enum: ["active", "pending", "expired", "cancelled", "paused",'rejected','refunded'],
      default: "pending",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
     
    },
    nutritionFile: {
      type: String,
      default: null,
    },
    nutritionText: {
      type: String,
      content: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

subscriptionSchema.index({ athleteId: 1, status: 1 });
subscriptionSchema.index({ coachId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });

export default model("Subscription", subscriptionSchema);
