import { Schema, model } from "mongoose";

const workoutMediaSchema = new Schema(
  {
    mediaableType: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref:"User",
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
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

workoutMediaSchema.index({ mediaableId: 1, mediaableType: 1 });

export default model("WorkoutMedia", workoutMediaSchema);
