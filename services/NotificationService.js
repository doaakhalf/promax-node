import Notification from "../Models/Notification.js";
import User from "../Models/User.js";
import { getIO } from "../config/socket.js";
import { getFirebaseMessaging } from "../config/firebase.js";

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

      await notification.populate('senderId', 'firstName lastName profileImage');

      const notificationPayload = {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        sender: notification.senderId ? {
          id: notification.senderId._id,
          name: `${notification.senderId.firstName} ${notification.senderId.lastName}`,
          profileImage: notification.senderId.profileImage
        } : null,
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

      // 3. Send push notification via Firebase (if user is offline or app is closed)
      try {
        await this.sendPushNotification(recipientId, title, message, data);
      } catch (fcmError) {
        console.log("FCM notification failed:", fcmError.message);
      }

      return notification;
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
        return;
      }
      
      console.log('Attempting to send FCM notification for user:', userId);

      // Get user's FCM tokens
      const user = await User.findById(userId).select('fcmTokens').lean();
      
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        console.log(`No FCM tokens found for user ${userId}`);
        return;
      }

      const tokens = user.fcmTokens.map(t => t.token);
      console.log('FCM tokens to send to:', tokens.map(t => ({
        length: t.length,
        preview: t.substring(0, 20) + '...',
        looksValid: t.length > 100 && t.includes(':')
      })));

      // Convert all data values to strings (FCM requirement)
      const stringifiedData = {};
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = String(value);
      }

      // Prepare FCM message
      const fcmMessage = {
        notification: {
          title: title,
          body: message
        },
        data: {
          ...stringifiedData,
          type: data.type || 'general',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens: tokens
      };

      // Send to all user's devices
      const response = await messaging.sendEachForMulticast(fcmMessage);
      
      console.log(`Push notification sent: ${response.successCount} success, ${response.failureCount} failed`);

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`FCM token ${idx} failed:`, {
              errorCode: resp.error?.code,
              errorMessage: resp.error?.message,
              token: tokens[idx].substring(0, 30) + '...'
            });
            tokensToRemove.push(tokens[idx]);
          }
        });

        if (tokensToRemove.length > 0) {
          await User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: { token: { $in: tokensToRemove } } }
          });
          console.log(`Removed ${tokensToRemove.length} invalid FCM tokens`);
        }
      }

      return response;
    } catch (error) {
      console.error("FCM send error:", error);
      throw error;
    }
  }

  // Send notification to multiple users
  static async sendBulkNotification(recipients, { senderId = null, type, title, message, data = {} }) {
    const promises = recipients.map(recipientId =>
      this.sendNotification({ recipientId, senderId, type, title, message, data })
    );

    return Promise.allSettled(promises);
  }
}

export default NotificationService;