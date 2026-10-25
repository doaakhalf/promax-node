import Subscription from "../Models/Subscription.js";
import SubscriptionSettings, {
  DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS
} from "../Models/SubscriptionSettings.js";

const OCCUPIED_STATUSES = ["active", "pending"];

export const isOccupiedSubscription = (sub) => {
  if (!sub) return false;
  if (sub.deletedAt != null) return false;
  return OCCUPIED_STATUSES.includes(sub.status);
};

export const countOccupiedFromList = (subscriptions = []) =>
  subscriptions.filter(isOccupiedSubscription).length;

export const getMaxActiveSubscriptionsPerCoach = async () => {
  const settings = await SubscriptionSettings.findOne({})
    .select("maxActiveSubscriptionsPerCoach")
    .lean();
  const limit = settings?.maxActiveSubscriptionsPerCoach;
  return Number.isInteger(limit) && limit >= 1
    ? limit
    : DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS;
};

export const countCoachOccupiedSlots = async (coachId) => {
  return Subscription.countDocuments({
    coachId,
    status: { $in: OCCUPIED_STATUSES },
    deletedAt: null
  });
};

export const athleteHasOccupiedSlot = async (coachId, athleteId) => {
  if (!athleteId) return false;
  const existing = await Subscription.findOne({
    coachId,
    athleteId,
    status: { $in: OCCUPIED_STATUSES },
    deletedAt: null
  }).select("_id");
  return Boolean(existing);
};

/**
 * @param {string|import("mongoose").Types.ObjectId} coachId
 * @param {{
 *   athleteId?: string|import("mongoose").Types.ObjectId,
 *   occupiedCount?: number,
 *   max?: number,
 *   viewerAlreadySubscribed?: boolean
 * }} [options]
 */
export const canSubscribeToCoach = async (coachId, options = {}) => {
  const max =
    Number.isInteger(options.max) && options.max >= 1
      ? options.max
      : await getMaxActiveSubscriptionsPerCoach();

  const occupied =
    typeof options.occupiedCount === "number"
      ? options.occupiedCount
      : await countCoachOccupiedSlots(coachId);

  let viewerAlreadySubscribed = options.viewerAlreadySubscribed;
  if (viewerAlreadySubscribed === undefined && options.athleteId) {
    viewerAlreadySubscribed = await athleteHasOccupiedSlot(
      coachId,
      options.athleteId
    );
  }

  return occupied < max && !viewerAlreadySubscribed;
};

export { DEFAULT_MAX_ACTIVE_SUBSCRIPTIONS, OCCUPIED_STATUSES };
