import Conversation from "../Models/Conversation.js";
import Message from "../Models/Message.js";
import Subscription from "../Models/Subscription.js";
import { getIO } from "../config/socket.js";

const FREE_TRIAL_LIMIT = 5;
const USER_SELECT = "firstName lastName profileImage";

const getIOSafe = () => {
  try {
    return getIO();
  } catch (_err) {
    return null;
  }
};

const isPeerOnline = (io, peerId) => {
  if (!io || !peerId) return false;
  try {
    return (io.sockets.adapter.rooms.get(`user_${peerId}`)?.size || 0) > 0;
  } catch (_err) {
    return false;
  }
};

/**
 * Picks the subscription that best represents the relationship between a
 * coach and an athlete: prefer active, then pending, then the most recent.
 */
const getRelevantSubscription = async (coachId, athleteId) => {
  const subs = await Subscription.find({ coachId, athleteId })
    .sort({ createdAt: -1 })
    .lean();

  if (!subs.length) return null;

  return (
    subs.find((s) => s.status === "active") ||
    subs.find((s) => s.status === "pending") ||
    subs[0]
  );
};

const computeChatPermission = (viewerRole, subscription, athleteMessageCount) => {
  if (viewerRole === "coach") {
    return { canSend: true, reason: "active", remainingMessages: null };
  }

  const status = subscription?.status;

  if (status === "active") {
    return { canSend: true, reason: "active", remainingMessages: null };
  }

  if (status === "expired") {
    return { canSend: false, reason: "expired", remainingMessages: 0 };
  }

  const remaining = Math.max(0, FREE_TRIAL_LIMIT - (athleteMessageCount || 0));

  if (remaining === 0) {
    return { canSend: false, reason: "limit_reached", remainingMessages: 0 };
  }

  return { canSend: true, reason: "trial", remainingMessages: remaining };
};

/**
 * Builds the full Conversation payload from the athlete/coach viewer's
 * perspective, per CHAT_BACKEND_SPEC.md.
 * `conversation` must have coachId/athleteId populated with at least
 * `firstName lastName profileImage`.
 */
const serializeConversation = async (conversation, viewerId, io) => {
  const coachUser = conversation.coachId;
  const athleteUser = conversation.athleteId;

  const viewerIsAthlete = athleteUser._id.toString() === viewerId.toString();
  const viewerRole = viewerIsAthlete ? "athlete" : "coach";
  const peerUser = viewerIsAthlete ? coachUser : athleteUser;

  const subscription = await getRelevantSubscription(coachUser._id, athleteUser._id);
  const subscriptionStatus = subscription?.status || null;
  const isExpired = subscriptionStatus === "expired";
  const expiredAt = isExpired ? subscription.endDate : null;

  const chatPermission = computeChatPermission(
    viewerRole,
    subscription,
    conversation.athleteMessageCount
  );

  const lastReadAt = viewerIsAthlete
    ? conversation.athleteLastReadAt
    : conversation.coachLastReadAt;

  const unreadCount = await Message.countDocuments({
    conversationId: conversation._id,
    senderRole: viewerIsAthlete ? "coach" : "athlete",
    createdAt: { $gt: lastReadAt || new Date(0) }
  });

  return {
    id: conversation._id.toString(),
    coachId: coachUser._id.toString(),
    athleteId: athleteUser._id.toString(),
    otherUser: {
      id: peerUser._id.toString(),
      name: `${peerUser.firstName || ""} ${peerUser.lastName || ""}`.trim(),
      profilePhoto: peerUser.profileImage || null,
      isOnline: isPeerOnline(io, peerUser._id)
    },
    lastMessage: conversation.lastMessageText
      ? {
          text: conversation.lastMessageText,
          createdAt: conversation.lastMessageAt,
          senderRole: conversation.lastMessageSenderRole
        }
      : null,
    unreadCount,
    chatPermission,
    isExpired,
    expiredAt,
    startedAt: conversation.createdAt,
    subscriptionStatus
  };
};

const serializeMessage = (message) => ({
  id: message._id.toString(),
  conversationId: message.conversationId.toString(),
  text: message.text,
  senderId: message.senderId.toString(),
  senderRole: message.senderRole,
  createdAt: message.createdAt
});

const findParticipantConversation = async (conversationId, viewerId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return { conversation: null, isParticipant: false, viewerIsAthlete: false };

  const viewerIsAthlete = conversation.athleteId.toString() === viewerId.toString();
  const viewerIsCoach = conversation.coachId.toString() === viewerId.toString();

  return { conversation, isParticipant: viewerIsAthlete || viewerIsCoach, viewerIsAthlete };
};

// GET /chat/conversations
export const listConversations = async (req, res) => {
  try {
    const viewerId = req.userId;

    const conversations = await Conversation.find({
      $or: [{ athleteId: viewerId }, { coachId: viewerId }]
    })
      .populate("coachId", USER_SELECT)
      .populate("athleteId", USER_SELECT)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    const io = getIOSafe();
    const result = await Promise.all(
      conversations.map((conversation) => serializeConversation(conversation, viewerId, io))
    );

    return res.status(200).json({ conversations: result });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({ status: "error", message: "Failed to load conversations" });
  }
};

// POST /chat/conversations (athlete only)
export const startConversation = async (req, res) => {
  try {
    if (req.user?.role_id?.name !== "athlete") {
      return res.status(403).json({
        status: "error",
        message: "Only athletes can start a conversation"
      });
    }

    const { coachId } = req.body;
    if (!coachId) {
      return res.status(400).json({ status: "error", message: "coachId is required" });
    }

    const athleteId = req.userId;

    let conversation = await Conversation.findOne({ coachId, athleteId });
    let statusCode = 200;

    if (!conversation) {
      try {
        conversation = await Conversation.create({ coachId, athleteId });
        statusCode = 201;
      } catch (err) {
        if (err.code === 11000) {
          // Race condition: another request created it first.
          conversation = await Conversation.findOne({ coachId, athleteId });
        } else {
          throw err;
        }
      }
    }

    await conversation.populate("coachId", USER_SELECT);
    await conversation.populate("athleteId", USER_SELECT);

    const io = getIOSafe();
    const payload = await serializeConversation(conversation.toObject(), athleteId, io);

    return res.status(statusCode).json({ conversation: payload });
  } catch (error) {
    console.error("Start conversation error:", error);
    return res.status(500).json({ status: "error", message: "Failed to start conversation" });
  }
};

// GET /chat/conversations/:id
export const getConversationMeta = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.userId;

    const conversation = await Conversation.findById(id)
      .populate("coachId", USER_SELECT)
      .populate("athleteId", USER_SELECT)
      .lean();

    if (!conversation) {
      return res.status(404).json({ status: "error", message: "Conversation not found" });
    }

    const isParticipant = [
      conversation.coachId._id.toString(),
      conversation.athleteId._id.toString()
    ].includes(viewerId.toString());

    if (!isParticipant) {
      return res.status(403).json({
        status: "error",
        message: "Not a participant of this conversation"
      });
    }

    const io = getIOSafe();
    const payload = await serializeConversation(conversation, viewerId, io);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Get conversation meta error:", error);
    return res.status(500).json({ status: "error", message: "Failed to load conversation" });
  }
};

// GET /chat/conversations/:id/messages
export const listMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.userId;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 50, 1);

    const { conversation, isParticipant, viewerIsAthlete } = await findParticipantConversation(
      id,
      viewerId
    );

    if (!conversation) {
      return res.status(404).json({ status: "error", message: "Conversation not found" });
    }
    if (!isParticipant) {
      return res.status(403).json({
        status: "error",
        message: "Not a participant of this conversation"
      });
    }

    const skip = (page - 1) * limit;
    const messagesDesc = await Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const messages = messagesDesc.reverse().map(serializeMessage);

    // Mark conversation as read up to now for this viewer.
    conversation[viewerIsAthlete ? "athleteLastReadAt" : "coachLastReadAt"] = new Date();
    await conversation.save();

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("List messages error:", error);
    return res.status(500).json({ status: "error", message: "Failed to load messages" });
  }
};

// POST /chat/conversations/:id/messages
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.userId;
    const text = (req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({ status: "error", message: "Message text is required" });
    }

    const { conversation, isParticipant, viewerIsAthlete } = await findParticipantConversation(
      id,
      viewerId
    );

    if (!conversation) {
      return res.status(404).json({ status: "error", message: "Conversation not found" });
    }
    if (!isParticipant) {
      return res.status(403).json({
        status: "error",
        message: "Not a participant of this conversation"
      });
    }

    const senderRole = viewerIsAthlete ? "athlete" : "coach";

    if (senderRole === "athlete") {
      const subscription = await getRelevantSubscription(
        conversation.coachId,
        conversation.athleteId
      );
      const permission = computeChatPermission(
        "athlete",
        subscription,
        conversation.athleteMessageCount
      );

      if (!permission.canSend) {
        const isExpiredReason = permission.reason === "expired";
        return res.status(403).json({
          status: "error",
          code: isExpiredReason ? "SUBSCRIPTION_EXPIRED" : "MESSAGE_LIMIT_REACHED",
          message: isExpiredReason ? "Subscription expired" : "Free message limit reached"
        });
      }
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId: viewerId,
      senderRole,
      text
    });

    conversation.lastMessage = newMessage._id;
    conversation.lastMessageText = newMessage.text;
    conversation.lastMessageAt = newMessage.createdAt;
    conversation.lastMessageSenderRole = senderRole;
    if (senderRole === "athlete") {
      conversation.athleteMessageCount = (conversation.athleteMessageCount || 0) + 1;
    }
    await conversation.save();

    await conversation.populate("coachId", USER_SELECT);
    await conversation.populate("athleteId", USER_SELECT);

    const io = getIOSafe();
    const conversationPayload = await serializeConversation(
      conversation.toObject(),
      viewerId,
      io
    );
    const messagePayload = serializeMessage(newMessage);

    if (io) {
      const peerId = viewerIsAthlete
        ? conversation.coachId._id
        : conversation.athleteId._id;
      io.to(`user_${peerId}`).emit("chat:new_message", {
        message: messagePayload,
        conversationId: conversation._id.toString()
      });
    }

    return res.status(201).json({ message: messagePayload, conversation: conversationPayload });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ status: "error", message: "Failed to send message" });
  }
};

export { getRelevantSubscription };
