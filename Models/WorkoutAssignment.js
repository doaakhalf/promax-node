import { Schema, model } from "mongoose";

const workoutAssignmentSchema = new Schema(
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
    workoutId: {
      type: Schema.Types.ObjectId,
      ref: "Workout",
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "skipped"],
      default: "scheduled",
    },
    coachNotes: {
      type: String,
      default: null,
    },
    athleteFeedback: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
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

workoutAssignmentSchema.index({ coachId: 1, status: 1, scheduledDate: 1 });
workoutAssignmentSchema.index({ athleteId: 1, status: 1, scheduledDate: 1 });

export default model("WorkoutAssignment", workoutAssignmentSchema);
