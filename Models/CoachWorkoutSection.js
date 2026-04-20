import { Schema, model } from "mongoose";

const coachWorkoutSectionSchema = new Schema(
  {
    workoutId: {
      type: Schema.Types.ObjectId,
      ref: "Workout",
      required: true,
    },
    sectionType: {
      type: String,
      enum: ["warm_up", "mainset", "cool_down"],
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

coachWorkoutSectionSchema.index({ workoutId: 1, sectionType: 1 });

export default model("CoachWorkoutSection", coachWorkoutSectionSchema);
