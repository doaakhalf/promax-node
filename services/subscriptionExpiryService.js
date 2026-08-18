import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import { resetTime } from "../utils/resetTime.js";

const TERMINAL_SUBSCRIPTION_STATUSES = ["expired", "cancelled", "rejected", "refunded"];

export const expireEndedSubscriptions = async ({ asOf = new Date(), dryRun = false } = {}) => {
  const today = resetTime(asOf);

  const query = {
    deletedAt: null,
    status: { $nin: TERMINAL_SUBSCRIPTION_STATUSES },
    endDate: { $lt: today },
  };

  const subscriptions = await Subscription.find(query).select("_id paymentStatus").lean();
  const subscriptionIds = subscriptions.map((sub) => sub._id);
  const paidSubscriptionIds = subscriptions
    .filter((sub) => sub.paymentStatus === "active")
    .map((sub) => sub._id);

  if (dryRun) {
    const paymentsToExpire = paidSubscriptionIds.length
      ? await SubscriptionPayment.countDocuments({
          subscriptionId: { $in: paidSubscriptionIds },
          deletedAt: null,
          status: "active",
        })
      : 0;

    const summary = {
      checked: subscriptions.length,
      subscriptionsExpired: subscriptions.length,
      paymentsExpired: paymentsToExpire,
      dryRun: true,
    };
    console.log("[expireSubscriptions]", summary);
    return summary;
  }

  if (subscriptionIds.length === 0) {
    const summary = { checked: 0, subscriptionsExpired: 0, paymentsExpired: 0 };
    console.log("[expireSubscriptions]", summary);
    return summary;
  }

  const subscriptionResult = await Subscription.updateMany(query, {
    $set: { status: "expired" },
  });

  if (paidSubscriptionIds.length > 0) {
    await Subscription.updateMany(
      { _id: { $in: paidSubscriptionIds }, paymentStatus: "active" },
      { $set: { paymentStatus: "expired" } }
    );
  }

  const paymentResult = paidSubscriptionIds.length
    ? await SubscriptionPayment.updateMany(
        {
          subscriptionId: { $in: paidSubscriptionIds },
          deletedAt: null,
          status: "active",
        },
        { $set: { status: "expired" } }
      )
    : { modifiedCount: 0 };

  const summary = {
    checked: subscriptions.length,
    subscriptionsExpired: subscriptionResult.modifiedCount ?? subscriptions.length,
    paymentsExpired: paymentResult.modifiedCount ?? 0,
  };
  console.log("[expireSubscriptions]", summary);
  return summary;
};
