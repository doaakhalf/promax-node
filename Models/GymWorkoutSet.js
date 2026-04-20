import { Schema, model } from "mongoose";

const gymWorkoutSetSchema = new Schema(
  {
    workoutId: {
      type: Schema.Types.ObjectId,
      ref: "Workout",
      required: true,
    },
    exerciseId: {
      type: Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

gymWorkoutSetSchema.index({ workoutId: 1, exerciseId: 1 });

export default model("GymWorkoutSet", gymWorkoutSetSchema);
