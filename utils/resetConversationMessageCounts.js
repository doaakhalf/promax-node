import Conversation from "../Models/Conversation.js";

/**
 * Resets free-trial message counters for a coach/athlete conversation pair
 * so they get a fresh FREE_TRIAL_LIMIT after subscription expiry.
 */
export const resetConversationMessageCounts = async (coachId, athleteId) => {
  if (!coachId || !athleteId) return { modifiedCount: 0 };

  const result = await Conversation.updateMany(
    { coachId, athleteId },
    { $set: { athleteMessageCount: 0, coachMessageCount: 0 } }
  );

  return { modifiedCount: result.modifiedCount ?? 0 };
};

/**
 * Resets counters for many coach/athlete pairs (e.g. after bulk expiry).
 * Deduplicates pairs by coachId+athleteId string.
 */
export const resetConversationMessageCountsForPairs = async (pairs = []) => {
  const unique = new Map();
  for (const pair of pairs) {
    if (!pair?.coachId || !pair?.athleteId) continue;
    const key = `${pair.coachId.toString()}:${pair.athleteId.toString()}`;
    unique.set(key, {
      coachId: pair.coachId,
      athleteId: pair.athleteId,
    });
  }

  let modifiedCount = 0;
  for (const { coachId, athleteId } of unique.values()) {
    const result = await resetConversationMessageCounts(coachId, athleteId);
    modifiedCount += result.modifiedCount;
  }

  return { modifiedCount, pairsReset: unique.size };
};
