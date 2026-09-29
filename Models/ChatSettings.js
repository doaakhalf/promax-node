import { Schema, model } from "mongoose";

const DEFAULT_FREE_TRIAL_LIMIT = 25;

const chatSettingsSchema = new Schema(
  {
    freeTrialMessageLimit: {
      type: Number,
      default: DEFAULT_FREE_TRIAL_LIMIT,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

export { DEFAULT_FREE_TRIAL_LIMIT };
export default model("ChatSettings", chatSettingsSchema);
