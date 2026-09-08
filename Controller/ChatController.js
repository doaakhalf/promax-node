import Conversation from "../Models/Conversation.js";
import Message from "../Models/Message.js";
import Subscription from "../Models/Subscription.js";
import { getIO } from "../config/socket.js";
import NotificationService from "../services/NotificationService.js";
import User from "../Models/User.js";
import Role from "../Models/Role.js";
import { computeUnreadMessagesCount } from "../utils/unreadMessages.js";
import { displayName } from "../utils/displayName.js";

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

const conversationType = (conversation) => conversation.type || "coach_athlete";

const idStr = (value) => {
  if (!value) return null;
  return (value._id || value).toString();
};

/**
 * Returns "admin" | "coach" | "athlete" | null for the viewer in this conversation.
 */
const getViewerSide = (conversation, viewerId) => {
  const vid = viewerId.toString();
  if (conversation.adminId && idStr(conversation.adminId) === vid) return "admin";
  if (conversation.athleteId && idStr(conversation.athleteId) === vid) return "athlete";
  if (conversation.coachId && idStr(conversation.coachId) === vid) return "coach";
  return null;
};

const lastReadFieldForSide = (side) => {
  if (side === "admin") return "adminLastReadAt";
  if (side === "athlete") return "athleteLastReadAt";
  return "coachLastReadAt";
};

const getPeerUser = (conversation, viewerSide) => {
  const type = conversationType(conversation);
  if (type === "coach_athlete") {
    return viewerSide === "athlete" ? conversation.coachId : conversation.athleteId;
  }
  if (type === "admin_coach") {
    return viewerSide === "admin" ? conversation.coachId : conversation.adminId;
  }
  return viewerSide === "admin" ? conversation.athleteId : conversation.adminId;
};

const getPeerId = (conversation, viewerSide) => idStr(getPeerUser(conversation, viewerSide));

const findUserByRole = async (userId, expectedRole) => {
  const user = await User.findById(userId).populate("role_id", "name").lean();
  if (!user || user.role_id?.name !== expectedRole) return null;
  return user;
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

const computeChatPermission = (viewerRole, subscription, messageCount) => {
  const status = subscription?.status;

  if (status === "active") {
    return { canSend: true, reason: "active", remainingMessages: null };
  }

  // pending, expired, or no subscription: free trial of FREE_TRIAL_LIMIT messages
  // (expired reopens trial so they can chat about renewing)
  const remaining = Math.max(0, FREE_TRIAL_LIMIT - (messageCount || 0));

  if (remaining === 0) {
    return { canSend: false, reason: "limit_reached", remainingMessages: 0 };
  }

  return { canSend: true, reason: "trial", remainingMessages: remaining };
};

const ADMIN_CHAT_PERMISSION = {
  canSend: true,
  reason: "admin",
  remainingMessages: null
};

/**
 * Builds the Conversation payload from the viewer's perspective.
 * For coach_athlete, keeps the existing shape (+ type).
 * `conversation` must have relevant participant fields populated.
 */
const serializeConversation = async (conversation, viewerId, io) => {
  const type = conversationType(conversation);
  const viewerSide = getViewerSide(conversation, viewerId);

  if (!viewerSide) {
    throw new Error("Viewer is not a participant");
  }

  const peerUser = getPeerUser(conversation, viewerSide);
  const lastReadAt = conversation[lastReadFieldForSide(viewerSide)];

  const unreadCount = await Message.countDocuments({
    conversationId: conversation._id,
    senderRole: { $ne: viewerSide },
    createdAt: { $gt: lastReadAt || new Date(0) }
  });

  const base = {
    id: conversation._id.toString(),
    type,
    adminId: conversation.adminId ? idStr(conversation.adminId) : null,
    coachId: conversation.coachId ? idStr(conversation.coachId) : null,
    athleteId: conversation.athleteId ? idStr(conversation.athleteId) : null,
    otherUser: {
      id: idStr(peerUser),
      // coach↔athlete: abbreviated both ways; admin chats: full names
      name: displayName(peerUser, { full: type !== "coach_athlete" }),
      profilePhoto: peerUser?.profileImage || null,
      isOnline: isPeerOnline(io, peerUser?._id || peerUser)
    },
    lastMessage: conversation.lastMessageText
      ? {
          text: conversation.lastMessageText,
          createdAt: conversation.lastMessageAt,
          senderRole: conversation.lastMessageSenderRole
        }
      : null,
    unreadCount,
    startedAt: conversation.createdAt
  };

  if (type === "coach_athlete") {
    const coachUser = conversation.coachId;
    const athleteUser = conversation.athleteId;
    const viewerIsAthlete = viewerSide === "athlete";

    const subscription = await getRelevantSubscription(coachUser._id, athleteUser._id);
    const subscriptionStatus = subscription?.status || null;
    const isExpired = subscriptionStatus === "expired";
    const expiredAt = isExpired ? subscription.endDate : null;

    const chatPermission = computeChatPermission(
      viewerSide,
      subscription,
      viewerIsAthlete ? conversation.athleteMessageCount : conversation.coachMessageCount
    );

    return {
      ...base,
      chatPermission,
      isExpired,
      expiredAt,
      subscriptionStatus
    };
  }

  return {
    ...base,
    chatPermission: ADMIN_CHAT_PERMISSION,
    isExpired: false,
    expiredAt: null,
    subscriptionStatus: null
  };
};

const serializeMessage = (message) => ({
  id: message._id.toString(),
  conversationId: message.conversationId.toString(),
  attachments: message.attachments || [],
  text: message.text,
  senderId: message.senderId.toString(),
  senderRole: message.senderRole,
  createdAt: message.createdAt
});

const findParticipantConversation = async (conversationId, viewerId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { conversation: null, isParticipant: false, viewerSide: null };
  }

  const viewerSide = getViewerSide(conversation, viewerId);
  return {
    conversation,
    isParticipant: !!viewerSide,
    viewerSide,
    // Keep for any callers that still expect this flag (coach_athlete only).
    viewerIsAthlete: viewerSide === "athlete"
  };
};

const findOrCreateConversation = async (query, createPayload) => {
  let conversation = await Conversation.findOne(query);
  let statusCode = 200;

  if (!conversation) {
    try {
      conversation = await Conversation.create(createPayload);
      statusCode = 201;
    } catch (err) {
      if (err.code === 11000) {
        conversation = await Conversation.findOne(query);
      } else {
        throw err;
      }
    }
  }

  return { conversation, statusCode };
};

const populateConversationUsers = async (conversation) => {
  await conversation.populate("coachId", USER_SELECT);
  await conversation.populate("athleteId", USER_SELECT);
  await conversation.populate("adminId", USER_SELECT);
  return conversation;
};

// GET /chat/admins
export const listAdmins = async (req, res) => {
  try {
    const adminRole = await Role.findOne({ name: "admin" }).lean();
    if (!adminRole) {
      return res.status(200).json({ admins: [] });
    }

    const admins = await User.find({ role_id: adminRole._id })
      .select(USER_SELECT)
      .lean();

    return res.status(200).json({
      admins: admins.map((admin) => ({
        id: admin._id.toString(),
        name: displayName(admin, { full: true }),
        profilePhoto: admin.profileImage || null
      }))
    });
  } catch (error) {
    console.error("List admins error:", error);
    return res.status(500).json({ status: "error", message: "Failed to load admins" });
  }
};

// GET /chat/conversations
export const listConversations = async (req, res) => {
  try {
    const viewerId = req.userId;

    const conversations = await Conversation.find({
      $or: [{ athleteId: viewerId }, { coachId: viewerId }, { adminId: viewerId }],
      lastMessage: { $ne: null }
    })
      .populate("coachId", USER_SELECT)
      .populate("athleteId", USER_SELECT)
      .populate("adminId", USER_SELECT)
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

// POST /chat/conversations
export const startConversation = async (req, res) => {
  try {
    const role = req.user?.role_id?.name;
    let query;
    let createPayload;

    if (role === "athlete") {
      const { coachId, adminId } = req.body;

      if (adminId) {
        const admin = await findUserByRole(adminId, "admin");
        if (!admin) {
          return res.status(400).json({ status: "error", message: "Valid adminId is required" });
        }
        query = { type: "admin_athlete", adminId, athleteId: req.userId };
        createPayload = { type: "admin_athlete", adminId, athleteId: req.userId };
      } else if (coachId) {
        // Existing athlete → coach path (unchanged).
        // Match legacy docs that predate the `type` field.
        query = {
          coachId,
          athleteId: req.userId,
          $nor: [{ type: "admin_coach" }, { type: "admin_athlete" }]
        };
        createPayload = { type: "coach_athlete", coachId, athleteId: req.userId };
      } else {
        return res.status(400).json({
          status: "error",
          message: "coachId or adminId is required"
        });
      }
    } else if (role === "coach") {
      const { athleteId, adminId } = req.body;

      if (adminId) {
        const admin = await findUserByRole(adminId, "admin");
        if (!admin) {
          return res.status(400).json({ status: "error", message: "Valid adminId is required" });
        }
        query = { type: "admin_coach", adminId, coachId: req.userId };
        createPayload = { type: "admin_coach", adminId, coachId: req.userId };
      } else if (athleteId) {
        // Existing coach → athlete path (unchanged): requires active subscription.
        const subscription = await getRelevantSubscription(req.userId, athleteId);
        if (subscription?.status !== "active") {
          return res.status(403).json({
            status: "error",
            message: "An active subscription is required to start a conversation with this athlete"
          });
        }
        query = {
          coachId: req.userId,
          athleteId,
          $nor: [{ type: "admin_coach" }, { type: "admin_athlete" }]
        };
        createPayload = { type: "coach_athlete", coachId: req.userId, athleteId };
      } else {
        return res.status(400).json({
          status: "error",
          message: "athleteId or adminId is required"
        });
      }
    } else if (role === "admin") {
      const { coachId, athleteId } = req.body;

      if (coachId && athleteId) {
        return res.status(400).json({
          status: "error",
          message: "Provide either coachId or athleteId, not both"
        });
      }

      if (coachId) {
        const coach = await findUserByRole(coachId, "coach");
        if (!coach) {
          return res.status(400).json({ status: "error", message: "Valid coachId is required" });
        }
        query = { type: "admin_coach", adminId: req.userId, coachId };
        createPayload = { type: "admin_coach", adminId: req.userId, coachId };
      } else if (athleteId) {
        const athlete = await findUserByRole(athleteId, "athlete");
        if (!athlete) {
          return res.status(400).json({ status: "error", message: "Valid athleteId is required" });
        }
        query = { type: "admin_athlete", adminId: req.userId, athleteId };
        createPayload = { type: "admin_athlete", adminId: req.userId, athleteId };
      } else {
        return res.status(400).json({
          status: "error",
          message: "coachId or athleteId is required"
        });
      }
    } else {
      return res.status(403).json({
        status: "error",
        message: "Only athletes, coaches, or admins can start a conversation"
      });
    }

    const { conversation, statusCode } = await findOrCreateConversation(query, createPayload);
    await populateConversationUsers(conversation);

    const io = getIOSafe();
    const payload = await serializeConversation(conversation.toObject(), req.userId, io);

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
      .populate("adminId", USER_SELECT)
      .lean();

    if (!conversation) {
      return res.status(404).json({ status: "error", message: "Conversation not found" });
    }

    const viewerSide = getViewerSide(conversation, viewerId);
    if (!viewerSide) {
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

    const { conversation, isParticipant, viewerSide } = await findParticipantConversation(
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

    conversation[lastReadFieldForSide(viewerSide)] = new Date();
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
    const files = req.files?.attachments || [];

    if (!text && files.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Message text or attachments are required"
      });
    }

    const attachments = files.map((file) => ({
      url: `images/${req.uploadFolder}/${file.filename}`,
      type: file.mimetype.startsWith("image/") ? "image" : "pdf",
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    }));

    const { conversation, isParticipant, viewerSide } = await findParticipantConversation(
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

    const senderRole = viewerSide;
    const type = conversationType(conversation);

    // Trial limit only for coach_athlete athlete sends (existing behavior).
    if (type === "coach_athlete" && senderRole === "athlete") {
      const subscription = await getRelevantSubscription(
        conversation.coachId,
        conversation.athleteId
      );
      const permission = computeChatPermission(
        senderRole,
        subscription,
        conversation.athleteMessageCount
      );

      if (!permission.canSend) {
        return res.status(403).json({
          status: "error",
          code: "MESSAGE_LIMIT_REACHED",
          message: "Free message limit reached"
        });
      }
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId: viewerId,
      senderRole,
      text,
      attachments
    });

    const previewText =
      text ||
      (attachments.length
        ? attachments[0].type === "image"
          ? "📷 Photo"
          : "📎 Attachment"
        : "");

    conversation.lastMessage = newMessage._id;
    conversation.lastMessageText = previewText;
    conversation.lastMessageAt = newMessage.createdAt;
    conversation.lastMessageSenderRole = senderRole;

    if (type === "coach_athlete") {
      if (senderRole === "athlete") {
        conversation.athleteMessageCount = (conversation.athleteMessageCount || 0) + 1;
      } else if (senderRole === "coach") {
        conversation.coachMessageCount = (conversation.coachMessageCount || 0) + 1;
      }
    }

    await conversation.save();
    await populateConversationUsers(conversation);

    const io = getIOSafe();
    const conversationPayload = await serializeConversation(
      conversation.toObject(),
      viewerId,
      io
    );
    const messagePayload = serializeMessage(newMessage);
    const peerId = getPeerId(conversation, viewerSide);

    const senderUser =
      senderRole === "admin"
        ? conversation.adminId
        : senderRole === "athlete"
          ? conversation.athleteId
          : conversation.coachId;

    // Full legal name when notifying admin; abbreviated for coach/athlete peers
    const recipientIsAdmin = type !== "coach_athlete" && viewerSide !== "admin";
    NotificationService.sendNotification({
      recipientId: peerId,
      senderId: viewerId,
      type: "chat_message",
      title: displayName(senderUser, {
        full: recipientIsAdmin || senderRole === "admin"
      }),
      message: previewText.length > 100 ? `${previewText.slice(0, 100)}…` : previewText,
      data: {
        conversationId: conversation._id.toString(),
        messageId: newMessage._id.toString()
      }
    }).catch((err) => console.error("Chat notification failed:", err));

    if (io && peerId) {
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

export const getUnreadMessagesCount = async (req, res) => {
  try {
    const unreadCount = await computeUnreadMessagesCount(req.userId);
    return res.status(200).json({ status: "success", unreadCount });
  } catch (error) {
    console.error("Get unread messages count error:", error);
    return res.status(500).json({ status: "error", message: "Failed to get unread messages count" });
  }
};

const serializeUserBrief = (user, { full = true } = {}) => {
  if (!user) return null;
  return {
    id: idStr(user),
    name: displayName(user, { full }),
    profilePhoto: user.profileImage || null
  };
};

/**
 * Admin revision view of a coach↔athlete conversation (not from a participant perspective).
 */
const serializeCoachAthleteForAdmin = async (conversation) => {
  const coachUser = conversation.coachId;
  const athleteUser = conversation.athleteId;
  const subscription = await getRelevantSubscription(
    coachUser?._id || coachUser,
    athleteUser?._id || athleteUser
  );

  return {
    id: conversation._id.toString(),
    type: "coach_athlete",
    coach: serializeUserBrief(coachUser),
    athlete: serializeUserBrief(athleteUser),
    lastMessage: conversation.lastMessageText
      ? {
          text: conversation.lastMessageText,
          createdAt: conversation.lastMessageAt,
          senderRole: conversation.lastMessageSenderRole
        }
      : null,
    athleteMessageCount: conversation.athleteMessageCount || 0,
    coachMessageCount: conversation.coachMessageCount || 0,
    subscriptionStatus: subscription?.status || null,
    startedAt: conversation.createdAt
  };
};

// GET /chat/admin/coach-athlete — admin-only revision list
export const listCoachAthleteConversationsForAdmin = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    const conversations = await Conversation.find({
      type: "coach_athlete",
      lastMessage: { $ne: null }
    })
      .populate("coachId", USER_SELECT)
      .populate("athleteId", USER_SELECT)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    let result = await Promise.all(conversations.map(serializeCoachAthleteForAdmin));

    if (q) {
      const needle = q.toLowerCase();
      result = result.filter((c) => {
        const coachName = (c.coach?.name || "").toLowerCase();
        const athleteName = (c.athlete?.name || "").toLowerCase();
        return coachName.includes(needle) || athleteName.includes(needle);
      });
    }

    return res.status(200).json({ conversations: result });
  } catch (error) {
    console.error("List coach-athlete conversations (admin) error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to load coach-athlete conversations"
    });
  }
};

// GET /chat/admin/coach-athlete/:id/messages — admin read-only (does not mark read)
export const listCoachAthleteMessagesForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 200);

    const conversation = await Conversation.findById(id)
      .populate("coachId", USER_SELECT)
      .populate("athleteId", USER_SELECT)
      .lean();

    if (!conversation || conversationType(conversation) !== "coach_athlete") {
      return res.status(404).json({ status: "error", message: "Conversation not found" });
    }

    const skip = (page - 1) * limit;
    const messagesDesc = await Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const messages = messagesDesc.reverse().map(serializeMessage);
    const meta = await serializeCoachAthleteForAdmin(conversation);

    return res.status(200).json({ conversation: meta, messages });
  } catch (error) {
    console.error("List coach-athlete messages (admin) error:", error);
    return res.status(500).json({ status: "error", message: "Failed to load messages" });
  }
};

export { getRelevantSubscription, getViewerSide, getPeerId, conversationType };
