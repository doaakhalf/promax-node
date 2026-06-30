import { Schema, model } from "mongoose";

const AchievementSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true
  },
  rank: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

AchievementSchema.index({ userId: 1 });

export default model("Achievement", AchievementSchema);