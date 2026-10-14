import Notification from "../Models/Notification.js";
import User from "../Models/User.js";
import { getIO } from "../config/socket.js";
import { getFirebaseMessaging } from "../config/firebase.js";
import { computeUnreadMessagesCount } from "../utils/unreadMessages.js";
import { displayName } from "../utils/displayName.js";

const isAdminRecipient = async (recipientId) => {
  if (!recipientId) return false;
  const id = recipientId.toString();
  if (process.env.ADMIN_USER_ID && id === process.env.ADMIN_USER_ID.toString()) {
    return true;
  }
  const recipient = await User.findById(recipientId).populate("role_id", "name").lean();
  return recipient?.role_id?.name === "admin";
};

const pushResult = ({
  status,
  successCount = 0,
  failureCount = 0,
  tokenCount = 0,
  reason = null
}) => ({
  status,
  successCount,
  failureCount,
  tokenCount,
  reason,
  delivered: status === "delivered" || status === "partial"
});

// Socket payload sender. Admins see the full name; everyone else sees the short form.
const toSenderPayload = (sender, recipientIsAdmin) => {
  if (!sender) return null;
  return {
    id: sender._id,
    name: displayName(sender, { full: recipientIsAdmin }),
    profileImage: sender.profileImage
  };
};

// Real-time "notification" event. A missing socket server must not block the push.
const emitRealtimeNotification = (recipientId, notificationPayload) => {
  try {
    const io = getIO();
    io.to(`user_${recipientId}`).emit("notification", notificationPayload);
    console.log(`Socket notification sent to user ${recipientId}`);
  } catch (socketError) {
    console.log("Socket.IO not available or user offline");
  }
};

class NotificationService {
  // Every type is delivered by socket and push.
  // chat_message is not stored: the message itself already lives on the conversation.
  static async sendNotification({ recipientId, senderId = null, type, title, message, data = {} }) {
    try {
      const persist = type !== "chat_message";
      let notification = null;
      let sender = null;

      if (persist) {
        // Inbox row. Sender is loaded from the saved document.
        notification = await Notification.create({
          recipientId,
          senderId,
          type,
          title,
          message,
          data
        });
        await notification.populate("senderId", "firstName lastName profileImage");
        sender = notification.senderId;
      } else if (senderId) {
        // No inbox row, so load the sender only to fill the socket payload.
        sender = await User.findById(senderId).select("firstName lastName profileImage").lean();
      }

      const recipientIsAdmin = await isAdminRecipient(recipientId);
      emitRealtimeNotification(recipientId, {
        // null when the notification was not saved (chat_message)
        id: notification ? notification._id.toString() : null,
        type: notification?.type ?? type,
        title: notification?.title ?? title,
        message: notification?.message ?? message,
        data: notification?.data ?? data,
        sender: toSenderPayload(sender, recipientIsAdmin),
        createdAt: notification?.createdAt ?? new Date(),
        isRead: false
      });

      // Push is sent for every type, including chat_message.
      const push = await this.deliverPush(recipientId, title, message, data);
      return { notification, push };
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  }

  // FCM failure is reported on the result; it does not fail the whole send.
  static async deliverPush(recipientId, title, message, data) {
    try {
      return await this.sendPushNotification(recipientId, title, message, data);
    } catch (fcmError) {
      console.log("FCM notification failed:", fcmError.message);
      return pushResult({
        status: "failed",
        reason: fcmError.message || "FCM send failed"
      });
    }
  }

  // Send push notification via Firebase Cloud Messaging
  static async sendPushNotification(userId, title, message, data = {}) {
    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) {
        console.log("Firebase not initialized, skipping push notification");
        return pushResult({
          status: "firebase_unavailable",
          reason: "Firebase not initialized"
        });
      }

      console.log("Attempting to send FCM notification for user:", userId);

      const user = await User.findById(userId).select("fcmTokens").lean();

      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        console.log(`No FCM tokens found for user ${userId}`);
        return pushResult({
          status: "no_tokens",
          reason: "No FCM tokens"
        });
      }

      const tokens = [
        ...new Set(user.fcmTokens.map((tokenEntry) => tokenEntry.token).filter(Boolean))
      ];

      if (tokens.length === 0) {
        console.log(`No valid FCM tokens found for user ${userId}`);
        return pushResult({
          status: "no_tokens",
          reason: "No valid FCM tokens"
        });
      }

      const stringifiedData = {};
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = String(value);
      }

      const [unreadMessages, unreadNotifications] = await Promise.all([
        computeUnreadMessagesCount(userId),
        Notification.countDocuments({
          recipientId: userId,
          isRead: false,
          type: { $ne: "chat_message" }
        })
      ]);

      const badge = unreadMessages + unreadNotifications;

      const fcmMessage = {
        notification: {
          title: title,
          body: message
        },
        data: {
          ...stringifiedData,
          type: stringifiedData.type || "general",
          click_action: "FLUTTER_NOTIFICATION_CLICK"
        },
        apns: {
          payload: {
            aps: { badge }
          }
        },
        tokens: tokens
      };

      const response = await messaging.sendEachForMulticast(fcmMessage);

      console.log(
        `Push notification sent: ${response.successCount} success, ${response.failureCount} failed`
      );

      if (response.failureCount > 0) {
        const tokensToRemove = [];
        const invalidTokenErrorCodes = new Set([
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered"
        ]);

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`FCM token ${idx} failed:`, {
              errorCode: resp.error?.code,
              errorMessage: resp.error?.message
            });

            if (invalidTokenErrorCodes.has(resp.error?.code)) {
              tokensToRemove.push(tokens[idx]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          await User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: { token: { $in: tokensToRemove } } }
          });
          console.log(`Removed ${tokensToRemove.length} invalid FCM tokens`);
        }
      }

      const successCount = response.successCount || 0;
      const failureCount = response.failureCount || 0;

      if (successCount === 0) {
        return pushResult({
          status: "failed",
          successCount,
          failureCount,
          tokenCount: tokens.length,
          reason: "All FCM tokens failed"
        });
      }

      if (failureCount > 0) {
        return pushResult({
          status: "partial",
          successCount,
          failureCount,
          tokenCount: tokens.length,
          reason: `${successCount}/${tokens.length} devices delivered`
        });
      }

      return pushResult({
        status: "delivered",
        successCount,
        failureCount,
        tokenCount: tokens.length
      });
    } catch (error) {
      console.error("FCM send error:", error);
      throw error;
    }
  }

  // Send notification to multiple users
  static async sendBulkNotification(recipients, { senderId = null, type, title, message, data = {} }) {
    const CHUNK_SIZE = 20;
    const results = [];

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.allSettled(
        chunk.map((recipientId) =>
          this.sendNotification({ recipientId, senderId, type, title, message, data })
        )
      );

      results.push(...chunkResults);

      if (i + CHUNK_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    return results;
  }

  // Build per-user delivery report from bulk Promise.allSettled results
  static buildDeliveryReport(userIds, settledResults, usersById = new Map()) {
    const succeeded = [];
    const failed = [];

    settledResults.forEach((result, index) => {
      const userId = userIds[index]?.toString();
      const user = usersById.get(userId) || {};
      const base = {
        userId,
        name: displayName(user, { full: true }) || null,
        email: user.email || null,
        role: user.role_id?.name || null
      };

      if (result.status === "rejected") {
        failed.push({
          ...base,
          inboxSaved: false,
          pushStatus: "failed",
          reason: result.reason?.message || "Failed to create notification"
        });
        return;
      }

      const push = result.value?.push || pushResult({ status: "failed", reason: "Unknown push result" });
      const entry = {
        ...base,
        inboxSaved: true,
        pushStatus: push.status,
        pushSuccessCount: push.successCount,
        pushFailureCount: push.failureCount,
        tokenCount: push.tokenCount,
        reason: push.reason
      };

      if (push.delivered) {
        succeeded.push(entry);
      } else {
        failed.push(entry);
      }
    });

    return {
      total: userIds.length,
      sent: succeeded.length,
      failed: failed.length,
      succeeded,
      failedRecipients: failed
    };
  }

  // Send push to all devices subscribed to an FCM topic (no per-user DB rows)
  static async sendTopicNotification({ topic, title, message, data = {} }) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      const err = new Error("Firebase not initialized");
      err.code = "FIREBASE_NOT_INITIALIZED";
      throw err;
    }

    const stringifiedData = {};
    for (const [key, value] of Object.entries(data)) {
      stringifiedData[key] = String(value);
    }

    const fcmMessage = {
      topic,
      notification: {
        title,
        body: message
      },
      data: {
        ...stringifiedData,
        type: stringifiedData.type || "broadcast",
        click_action: "FLUTTER_NOTIFICATION_CLICK"
      }
    };

    const messageId = await messaging.send(fcmMessage);
    console.log(`Topic push sent to ${topic}: ${messageId}`);
    return { messageId };
  }
}

export default NotificationService;
