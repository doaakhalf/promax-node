import { Schema, model } from "mongoose";

const workoutSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workoutType: {
      type: String,
      enum: ["coach", "gym"],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    instructions: {
      type: String,
      default: null,
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

workoutSchema.index({ userId: 1, workoutType: 1 });

export default model("Workout", workoutSchema);
