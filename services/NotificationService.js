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

class NotificationService {
  // Send notification via all channels
  static async sendNotification({ recipientId, senderId = null, type, title, message, data = {} }) {
    try {
      // 1. Create notification in database
      const notification = await Notification.create({
        recipientId,
        senderId,
        type,
        title,
        message,
        data
      });

      await notification.populate("senderId", "firstName lastName profileImage");

      const recipientIsAdmin = await isAdminRecipient(recipientId);

      const notificationPayload = {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        sender: notification.senderId
          ? {
              id: notification.senderId._id,
              name: displayName(notification.senderId, { full: recipientIsAdmin }),
              profileImage: notification.senderId.profileImage
            }
          : null,
        createdAt: notification.createdAt,
        isRead: false
      };

      // 2. Send real-time notification via Socket.IO (if user is online)
      try {
        const io = getIO();
        io.to(`user_${recipientId}`).emit("notification", notificationPayload);
        console.log(`Socket notification sent to user ${recipientId}`);
      } catch (socketError) {
        console.log("Socket.IO not available or user offline");
      }

      // 3. Send push notification via Firebase
      let push;
      try {
        push = await this.sendPushNotification(recipientId, title, message, data);
      } catch (fcmError) {
        console.log("FCM notification failed:", fcmError.message);
        push = pushResult({
          status: "failed",
          reason: fcmError.message || "FCM send failed"
        });
      }

      return { notification, push };
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
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
