import Conversation from "../Models/Conversation.js";
import Message from "../Models/Message.js";

export const computeUnreadMessagesCount = async (userId) => {
  const conversations = await Conversation.find({
    $or: [{ athleteId: userId }, { coachId: userId }]
  }).select("athleteId coachId athleteLastReadAt coachLastReadAt").lean();

  const counts = await Promise.all(conversations.map((conv) => {
    const viewerIsAthlete = conv.athleteId.toString() === userId.toString();
    const lastReadAt = viewerIsAthlete ? conv.athleteLastReadAt : conv.coachLastReadAt;
    return Message.countDocuments({
      conversationId: conv._id,
      senderRole: viewerIsAthlete ? "coach" : "athlete",
      createdAt: { $gt: lastReadAt || new Date(0) }
    });
  }));

  return counts.reduce((sum, c) => sum + c, 0);
};