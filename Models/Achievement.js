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
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

AchievementSchema.index({ userId: 1 });

export default model("Achievement", AchievementSchema);