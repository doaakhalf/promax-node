import { Schema, model } from "mongoose";

const coachRatingSchema = new Schema(
  {
    athleteId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

coachRatingSchema.index({ athleteId: 1, coachId: 1 }, { unique: true });
coachRatingSchema.index({ coachId: 1, createdAt: -1 });

export default model("CoachRating", coachRatingSchema);
