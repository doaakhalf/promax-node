import { Schema, model } from "mongoose";

export const MEASUREMENT_FIELDS = [
  "chest",
  "waist",
  "hips",
  "armRight",
  "armLeft",
  "thighRight",
  "thighLeft",
  "calf",
  "neck",
  "shoulders",
];

const measurementFields = Object.fromEntries(
  MEASUREMENT_FIELDS.map((field) => [
    field,
    { type: Schema.Types.Decimal128, default: null },
  ])
);

const measurementsSchema = new Schema(measurementFields, { _id: false });

const athleteProgressSchema = new Schema(
  {
    athleteId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    weight: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    measurements: {
      type: measurementsSchema,
      default: () => ({}),
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

athleteProgressSchema.index({ athleteId: 1, recordedAt: -1, createdAt: -1 });
athleteProgressSchema.index({ athleteId: 1, deletedAt: 1 });

export { measurementsSchema };
export default model("AthleteProgress", athleteProgressSchema);
