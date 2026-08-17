import { Schema, model } from "mongoose";
import { resetTime } from "../utils/resetTime.js";

const lineItemSchema = new Schema(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    athleteId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    athleteName: { type: String, required: true },
    athleteInitials: { type: String, default: null },
    subscriptionPlan: { type: String, default: "monthly" },
    subscriptionStartDate: { type: Date, required: true, get: resetTime },
    subscriptionEndDate: { type: Date, required: true, get: resetTime },
    billingWeekStart: { type: Date, required: true, get: resetTime },
    billingWeekEnd: { type: Date, required: true, get: resetTime },
    weekIndex: { type: Number, required: true },
    grossAmount: { type: Schema.Types.Decimal128, required: true },
    platformFee: { type: Schema.Types.Decimal128, required: true },
    weeklyRate: { type: Schema.Types.Decimal128, required: true },
    allocatedAmount: { type: Schema.Types.Decimal128, required: true },
    isEligible: { type: Boolean, default: false },
    ineligibleReason: {
      type: String,
      enum: ["partial_week", "no_assignment", "pending_payment", "already_paid", null],
      default: null,
    },
    isPartialNew: { type: Boolean, default: false },
    assignedDaysCount: { type: Number, default: 0 },
    requiredDaysCount: { type: Number, default: 0 },
  },
  { _id: false, toJSON: { getters: true }, toObject: { getters: true } }
);

const coachPayoutSchema = new Schema(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
    periodStart: {
      type: Date,
      required: true,
      get: resetTime,
    },
    periodEnd: {
      type: Date,
      required: true,
      get: resetTime,
    },
    scheduledDate: {
      type: Date,
      required: true,
      get: resetTime,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "paid", "failed", "cancelled"],
      default: "pending",
    },
    paidAt: { type: Date, default: null },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paymentReference: { type: String, default: null },
    notes: { type: String, default: null },
    lineItems: [lineItemSchema],
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

coachPayoutSchema.index(
  { coachId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
coachPayoutSchema.index({ coachId: 1, status: 1, scheduledDate: -1 });
coachPayoutSchema.index({ scheduledDate: 1, status: 1 });

export default model("CoachPayout", coachPayoutSchema);
