import { Schema, model } from "mongoose";

const gymWorkoutSetDetailSchema = new Schema(
  {
    setId: {
      type: Schema.Types.ObjectId,
      ref: "GymWorkoutSet",
      required: true,
    },
    durationType: {
      type: String,
      enum: ["time", "reps"],
      required: true,
    },
    durationValue: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    sets: {
      type: Number,
      required: true,
    },
    reps: {
      type: Number,
      required: true,
    },
    restSeconds: {
      type: Number,
      required: true,
    },
    weightType: {
      type: String,
      required: true,
    },
    weightKg: {
      type: Schema.Types.Decimal128,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

gymWorkoutSetDetailSchema.index({ setId: 1, durationType: 1 });

export default model("GymWorkoutSetDetail", gymWorkoutSetDetailSchema);
