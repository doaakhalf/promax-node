import { Schema, model } from "mongoose";

const coachWorkoutStepDetailSchema = new Schema(
  {
    stepId: {
      type: Schema.Types.ObjectId,
      ref: "CoachWorkoutStep",
      required: true,
    },
    durationType: {
      type: String,
      enum: ["time", "distance", "lap", "calories", "heart_rate", "open"],
      required: true,
    },
    durationValue: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    targetType: {
      type: String,
      enum: [
        "none",
        "pace",
        "heart_rate",
        "cadence",
        "speed",
        "power",
        "custom_heart_rate",
      ],
      default: "none",
    },
    targetMin: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    targetMax: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    instructions: {
      type: String,
      default: null,
    },
    repeatCount: {
      type: Number,
      default: null,
    },
    stepCategory: {
      type: String,
      enum: ["run", "recovery"],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

coachWorkoutStepDetailSchema.index({ stepId: 1, durationType: 1 });

export default model("CoachWorkoutStepDetail", coachWorkoutStepDetailSchema);
