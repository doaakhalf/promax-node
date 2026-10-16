import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import { resetTime } from "../utils/resetTime.js";
import { resetConversationMessageCountsForPairs } from "../utils/resetConversationMessageCounts.js";

const TERMINAL_SUBSCRIPTION_STATUSES = ["expired", "cancelled", "rejected", "refunded"];

export const expireEndedSubscriptions = async ({ asOf = new Date(), dryRun = false } = {}) => {
  const today = resetTime(asOf);

  const query = {
    deletedAt: null,
    status: { $nin: TERMINAL_SUBSCRIPTION_STATUSES },
    endDate: { $lt: today },
  };

  const subscriptions = await Subscription.find(query)
    .select("_id paymentStatus coachId athleteId")
    .lean();
  const subscriptionIds = subscriptions.map((sub) => sub._id);
  const paidSubscriptionIds = subscriptions
    .filter((sub) => sub.paymentStatus === "active")
    .map((sub) => sub._id);

  const calendarQuery = {
    subscriptionId: { $in: subscriptionIds },
    deletedAt: null,
    status: "active",
  };

  if (dryRun) {
    const paymentsToExpire = paidSubscriptionIds.length
      ? await SubscriptionPayment.countDocuments({
          subscriptionId: { $in: paidSubscriptionIds },
          deletedAt: null,
          status: "active",
        })
      : 0;

    const calendarsToExpire = subscriptionIds.length
      ? await WorkoutCalendar.countDocuments(calendarQuery)
      : 0;

    const summary = {
      checked: subscriptions.length,
      subscriptionsExpired: subscriptions.length,
      paymentsExpired: paymentsToExpire,
      calendarsExpired: calendarsToExpire,
      dryRun: true,
    };
    console.log("[expireSubscriptions]", summary);
    return summary;
  }

  if (subscriptionIds.length === 0) {
    const summary = {
      checked: 0,
      subscriptionsExpired: 0,
      paymentsExpired: 0,
      calendarsExpired: 0,
    };
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

  const calendarResult = await WorkoutCalendar.updateMany(calendarQuery, {
    $set: { status: "expired" },
  });

  // Reopen free-trial chat (5 messages) for expired coach/athlete pairs
  const conversationReset = await resetConversationMessageCountsForPairs(
    subscriptions.map((sub) => ({
      coachId: sub.coachId,
      athleteId: sub.athleteId,
    }))
  );

  const summary = {
    checked: subscriptions.length,
    subscriptionsExpired: subscriptionResult.modifiedCount ?? subscriptions.length,
    paymentsExpired: paymentResult.modifiedCount ?? 0,
    calendarsExpired: calendarResult.modifiedCount ?? 0,
    conversationsReset: conversationReset.pairsReset,
  };
  console.log("[expireSubscriptions]", summary);
  return summary;
};
