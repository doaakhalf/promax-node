import { Schema, model } from "mongoose";

const coachWorkoutStepSchema = new Schema(
  {
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "CoachWorkoutSection",
      required: true,
    },
    stepNumber: {
      type: String,
      required: true,
    },
    stepType: {
      type: String,
      enum: ["step", "repeat"],
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

coachWorkoutStepSchema.index({ sectionId: 1, stepType: 1 });

export default model("CoachWorkoutStep", coachWorkoutStepSchema);
