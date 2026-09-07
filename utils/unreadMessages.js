import { Types } from "mongoose";
import Conversation from "../Models/Conversation.js";

export const computeUnreadMessagesCount = async (userId) => {
  const userObjectId = new Types.ObjectId(userId);
  const oldestDate = new Date(0);

  const [result] = await Conversation.aggregate([
    {
      $match: {
        $or: [
          { athleteId: userObjectId },
          { coachId: userObjectId },
          { adminId: userObjectId }
        ]
      }
    },
    {
      $addFields: {
        viewerSide: {
          $switch: {
            branches: [
              { case: { $eq: ["$adminId", userObjectId] }, then: "admin" },
              { case: { $eq: ["$athleteId", userObjectId] }, then: "athlete" },
              { case: { $eq: ["$coachId", userObjectId] }, then: "coach" }
            ],
            default: null
          }
        }
      }
    },
    {
      $addFields: {
        lastReadAt: {
          $switch: {
            branches: [
              {
                case: { $eq: ["$viewerSide", "admin"] },
                then: { $ifNull: ["$adminLastReadAt", oldestDate] }
              },
              {
                case: { $eq: ["$viewerSide", "athlete"] },
                then: { $ifNull: ["$athleteLastReadAt", oldestDate] }
              },
              {
                case: { $eq: ["$viewerSide", "coach"] },
                then: { $ifNull: ["$coachLastReadAt", oldestDate] }
              }
            ],
            default: oldestDate
          }
        }
      }
    },
    {
      $lookup: {
        from: "messages",
        let: {
          conversationId: "$_id",
          viewerSide: "$viewerSide",
          lastReadAt: "$lastReadAt"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$conversationId"] },
                  { $ne: ["$senderRole", "$$viewerSide"] },
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
