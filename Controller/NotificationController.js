import mongoose from "mongoose";
import Notification from "../Models/Notification.js";
import User from "../Models/User.js";
import Role from "../Models/Role.js";
import { displayName } from "../utils/displayName.js";
import NotificationService from "../services/NotificationService.js";

const ALLOWED_BROADCAST_TOPICS = new Set(["guests"]);
const ALLOWED_USER_AUDIENCES = new Set(["coaches", "athletes", "both"]);

const loadUsersById = async (userIds) => {
  const users = await User.find({ _id: { $in: userIds } })
    .select("firstName lastName email role_id")
    .populate("role_id", "name")
    .lean();

  return new Map(users.map((u) => [u._id.toString(), u]));
};

// Get all notifications for authenticated user
export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const isAdmin = req.user?.role_id?.name === "admin";

    const query = { recipientId: userId, type: { $ne: "chat_message" } };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('senderId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipientId: userId, 
      isRead: false ,
      type: { $ne: "chat_message" }
    });

    const formattedNotifications = notifications.map(notif => ({
      id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: notif.data,
      isRead: notif.isRead,
      sender: notif.senderId ? {
        id: notif.senderId._id,
        name: displayName(notif.senderId, { full: isAdmin }),
        profileImage: notif.senderId.profileImage
      } : null,
      createdAt: notif.createdAt,
      readAt: notif.readAt
    }));

    res.status(200).json({
      status: "success",
      data: formattedNotifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve notifications",
      error: error.message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { isRead: true, readAt: new Date() },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    res.status(200).json({
      status: "success",
      message: "Notification marked as read",
      data: notification
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark notification as read",
      error: error.message
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      status: "success",
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to mark all notifications as read",
      error: error.message
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    res.status(200).json({
      status: "success",
      message: "Notification deleted"
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete notification",
      error: error.message
    });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const count = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
      type: { $ne: "chat_message" }
    });

    res.status(200).json({
      status: "success",
      unreadCount: count
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get unread count",
      error: error.message
    });
  }
};

// Register/Update FCM token
export const registerFCMToken = async (req, res) => {
  try {
    const userId = req.userId;
    const { token, deviceId, platform = 'android' } = req.body;
    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "FCM token is required"
      });
    }

    const keepToken = deviceId
      ? {
          $and: [
            { $ne: ["$$entry.token", { $literal: token }] },
            { $ne: ["$$entry.deviceId", { $literal: deviceId }] }
          ]
        }
      : { $ne: ["$$entry.token", { $literal: token }] };

    // Replace the token for the same device, or deduplicate the token atomically.
    await User.findByIdAndUpdate(userId, [
      {
        $set: {
          fcmTokens: {
            $let: {
              vars: {
                existingTokens: { $ifNull: ["$fcmTokens", []] }
              },
              in: {
                $concatArrays: [
                  {
                    $filter: {
                      input: "$$existingTokens",
                      as: "entry",
                      cond: keepToken
                    }
                  },
                  [{
                    token: { $literal: token },
                    deviceId: { $literal: deviceId || null },
                    platform: { $literal: platform },
                    addedAt: { $literal: new Date() }
                  }]
                ]
              }
            }
          }
        }
      }
    ], { returnDocument: 'after', updatePipeline: true });

    res.status(200).json({
      status: "success",
      message: "FCM token registered successfully"
    });
  } catch (error) {
    console.error("Register FCM token error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to register FCM token",
      error: error.message
    });
  }
};

// Remove FCM token (on logout)
export const removeFCMToken = async (req, res) => {
  try {
    const userId = req.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "FCM token is required"
      });
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { token: token } }
    });

    res.status(200).json({
      status: "success",
      message: "FCM token removed successfully"
    });
  } catch (error) {
    console.error("Remove FCM token error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to remove FCM token",
      error: error.message
    });
  }
};

// Admin: broadcast push to an FCM topic (no per-user DB notifications)
export const broadcastNotification = async (req, res) => {
  try {
    const { title, message, data = {} } = req.body;
    const topic = req.body.topic || "guests";

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({
        status: "error",
        message: "title and message are required"
      });
    }

    if (!ALLOWED_BROADCAST_TOPICS.has(topic)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid topic. Allowed: ${[...ALLOWED_BROADCAST_TOPICS].join(", ")}`
      });
    }

    const payloadData = {
      ...data,
      type: data.type || "broadcast"
    };

    const result = await NotificationService.sendTopicNotification({
      topic,
      title: String(title).trim(),
      message: String(message).trim(),
      data: payloadData
    });

    res.status(200).json({
      status: "success",
      message: "Broadcast sent",
      data: {
        topic,
        messageId: result.messageId
      }
    });
  } catch (error) {
    console.error("Broadcast notification error:", error);

    if (error.code === "FIREBASE_NOT_INITIALIZED") {
      return res.status(503).json({
        status: "error",
        message: "Firebase not initialized"
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to send broadcast",
      error: error.message
    });
  }
};

// Admin: list/search coaches or athletes to pick a notification recipient
export const searchNotificationUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const roleFilter = String(req.query.role || "").toLowerCase();

    const roleNames =
      roleFilter === "coach" || roleFilter === "coaches"
        ? ["coach"]
        : roleFilter === "athlete" || roleFilter === "athletes"
          ? ["athlete"]
          : null;

    if (!roleNames) {
      return res.status(400).json({
        status: "error",
        message: "role is required (coach or athlete)"
      });
    }

    const roles = await Role.find({ name: { $in: roleNames } }).select("_id name").lean();
    if (!roles.length) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const roleIds = roles.map((r) => r._id);
    const filter = {
      role_id: { $in: roleIds },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    };

    // Coaches: only active accounts in the picker list
    if (roleNames.includes("coach") && roleNames.length === 1) {
      filter.status = "active";
    } else {
      filter.status = { $ne: "deleted" };
    }

    if (q.length >= 2) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$and = [
        {
          $or: [
            { email: regex },
            { firstName: regex },
            { lastName: regex },
            { phoneNumber: regex }
          ]
        }
      ];
    }

    let query = User.find(filter)
      .select("firstName lastName email phoneNumber role_id fcmTokens")
      .populate("role_id", "name")
      .sort({ email: 1 });

    // Full role list when no search; keep search results bounded
    if (q.length >= 2) {
      query = query.limit(50);
    }

    const users = await query.lean();

    res.status(200).json({
      status: "success",
      data: users.map((u) => ({
        id: u._id.toString(),
        name: displayName(u, { full: true }),
        email: u.email,
        phone: u.phoneNumber || null,
        role: u.role_id?.name || null,
        tokenCount: Array.isArray(u.fcmTokens) ? u.fcmTokens.length : 0
      }))
    });
  } catch (error) {
    console.error("Search notification users error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to search users",
      error: error.message
    });
  }
};

// Admin: push (+ inbox) to a single registered user
export const sendToUserNotification = async (req, res) => {
  try {
    const { title, message, userId } = req.body;

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({
        status: "error",
        message: "title and message are required"
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: "error",
        message: "Valid userId is required"
      });
    }

    const user = await User.findOne({
      _id: userId,
      status: { $ne: "deleted" },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    })
      .select("firstName lastName email role_id")
      .populate("role_id", "name")
      .lean();

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const roleName = user.role_id?.name;
    if (roleName !== "coach" && roleName !== "athlete") {
      return res.status(400).json({
        status: "error",
        message: "Can only send to coaches or athletes"
      });
    }

    try {
      const { push } = await NotificationService.sendNotification({
        recipientId: user._id,
        senderId: req.userId,
        type: "general",
        title: String(title).trim(),
        message: String(message).trim(),
        data: { type: "admin_direct", audience: "single" }
      });

      const recipient = {
        userId: user._id.toString(),
        name: displayName(user, { full: true }),
        email: user.email,
        role: roleName
      };

      res.status(200).json({
        status: "success",
        message: push.delivered
          ? "Notification sent (push delivered)"
          : "Notification saved to inbox, but push did not deliver",
        data: {
          total: 1,
          sent: push.delivered ? 1 : 0,
          failed: push.delivered ? 0 : 1,
          recipient,
          push,
          succeeded: push.delivered
            ? [
                {
                  ...recipient,
                  inboxSaved: true,
                  pushStatus: push.status,
                  pushSuccessCount: push.successCount,
                  pushFailureCount: push.failureCount,
                  tokenCount: push.tokenCount,
                  reason: push.reason
                }
              ]
            : [],
          failedRecipients: push.delivered
            ? []
            : [
                {
                  ...recipient,
                  inboxSaved: true,
                  pushStatus: push.status,
                  pushSuccessCount: push.successCount,
                  pushFailureCount: push.failureCount,
                  tokenCount: push.tokenCount,
                  reason: push.reason
                }
              ]
        }
      });
    } catch (sendError) {
      return res.status(500).json({
        status: "error",
        message: "Failed to send notification",
        data: {
          total: 1,
          sent: 0,
          failed: 1,
          failedRecipients: [
            {
              userId: user._id.toString(),
              name: displayName(user, { full: true }),
              email: user.email,
              role: roleName,
              inboxSaved: false,
              pushStatus: "failed",
              reason: sendError.message
            }
          ]
        }
      });
    }
  } catch (error) {
    console.error("Send to user notification error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send notification to user",
      error: error.message
    });
  }
};

// Admin: push (+ inbox) to registered coaches and/or athletes via fcmTokens
export const sendToUsersBroadcast = async (req, res) => {
  try {
    const { title, message, audience } = req.body;

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({
        status: "error",
        message: "title and message are required"
      });
    }

    if (!audience || !ALLOWED_USER_AUDIENCES.has(audience)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid audience. Allowed: ${[...ALLOWED_USER_AUDIENCES].join(", ")}`
      });
    }

    const roleNames =
      audience === "both"
        ? ["coach", "athlete"]
        : audience === "coaches"
          ? ["coach"]
          : ["athlete"];

    const roles = await Role.find({ name: { $in: roleNames } }).select("_id").lean();
    if (!roles.length) {
      return res.status(404).json({
        status: "error",
        message: "No matching roles found"
      });
    }

    const roleIds = roles.map((r) => r._id);
    const users = await User.find({
      role_id: { $in: roleIds },
      status: { $ne: "deleted" },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    })
      .select("_id")
      .lean();

    const userIds = users.map((u) => u._id);

    if (userIds.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No recipients found",
        data: {
          audience,
          total: 0,
          sent: 0,
          failed: 0,
          succeeded: [],
          failedRecipients: []
        }
      });
    }

    const results = await NotificationService.sendBulkNotification(userIds, {
      senderId: req.userId,
      type: "general",
      title: String(title).trim(),
      message: String(message).trim(),
      data: { type: "admin_broadcast", audience }
    });

    const usersById = await loadUsersById(userIds);
    const report = NotificationService.buildDeliveryReport(userIds, results, usersById);

    res.status(200).json({
      status: "success",
      message: "Broadcast to users completed",
      data: {
        audience,
        ...report
      }
    });
  } catch (error) {
    console.error("Send to users broadcast error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send broadcast to users",
      error: error.message
    });
  }
};