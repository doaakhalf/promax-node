import { Schema, model } from "mongoose";

const DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS = 5;

const subscriptionSettingsSchema = new Schema(
  {
    maxActiveSubscriptionsPerCoach: {
      type: Number,
      default: DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

export { DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS };
export default model("SubscriptionSettings", subscriptionSettingsSchema);
