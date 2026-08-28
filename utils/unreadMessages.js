import { Types } from "mongoose";
import Conversation from "../Models/Conversation.js";

export const computeUnreadMessagesCount = async (userId) => {
  const userObjectId = new Types.ObjectId(userId);
  const oldestDate = new Date(0);

  const [result] = await Conversation.aggregate([
    {
      $match: {
        $or: [{ athleteId: userObjectId }, { coachId: userObjectId }]
      }
    },
    {
      $project: {
        unreadSenderRole: {
          $cond: [
            { $eq: ["$athleteId", userObjectId] },
            "coach",
            "athlete"
          ]
        },
        lastReadAt: {
          $ifNull: [
            {
              $cond: [
                { $eq: ["$athleteId", userObjectId] },
                "$athleteLastReadAt",
                "$coachLastReadAt"
              ]
            },
            oldestDate
          ]
        }
      }
    },
    {
      $lookup: {
        from: "messages",
        let: {
          conversationId: "$_id",
          unreadSenderRole: "$unreadSenderRole",
          lastReadAt: "$lastReadAt"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$conversationId"] },
                  { $eq: ["$senderRole", "$$unreadSenderRole"] },
                  { $gt: ["$createdAt", "$$lastReadAt"] }
                ]
              }
            }
          },
          { $count: "count" }
        ],
        as: "unread"
      }
    },
    {
      $project: {
        count: {
          $ifNull: [{ $arrayElemAt: ["$unread.count", 0] }, 0]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$count" }
      }
    }
  ]);

  return result?.total || 0;
};