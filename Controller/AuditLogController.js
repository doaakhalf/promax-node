import AuditLog from "../Models/AuditLog.js";
import mongoose from "mongoose";

/**
 * Get audit logs with filtering and pagination (Admin only)
 */
export const getAuditLogs = async (req, res) => {
  try {
    const {
      targetUserId,
      targetRole,
      entityType,
      fieldName,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Build match conditions
    const matchConditions = {};

    if (targetUserId) {
      if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid targetUserId'
        });
      }
      matchConditions.targetUserId = new mongoose.Types.ObjectId(targetUserId);
    }

    if (targetRole) {
      matchConditions.targetRole = targetRole;
    }

    if (entityType) {
      matchConditions.entityType = entityType;
    }

    if (fieldName) {
      matchConditions.fieldName = fieldName;
    }

    // Date range filter
    if (startDate || endDate) {
      matchConditions.timestamp = {};
      if (startDate) {
        matchConditions.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        matchConditions.timestamp.$lte = new Date(endDate);
      }
    }

    // Pagination
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Aggregation pipeline for efficient querying
    const pipeline = [
      // Match conditions
      ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),
      
      // Lookup user details for both userId and targetUserId
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'targetUserId',
          foreignField: '_id',
          as: 'targetUser',
          pipeline: [
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1
              }
            }
          ]
        }
      },
      
      // Unwind user arrays (keep logs even if user was deleted)
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$targetUser', preserveNullAndEmptyArrays: true } },
      
      // Sort by timestamp (descending)
      { $sort: { timestamp: -1 } },
      
      // Facet for pagination
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNum }],
          total: [{ $count: 'count' }]
        }
      }
    ];

    const [result] = await AuditLog.aggregate(pipeline);
    const logs = result?.data || [];
    const total = result?.total?.[0]?.count || 0;
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      status: 'success',
      message: 'Audit logs retrieved successfully',
      data: logs,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalLogs: total,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve audit logs',
      error: error?.message
    });
  }
};

/**
 * Get audit log statistics (Admin only)
 */
export const getAuditLogStats = async (req, res) => {
  try {
    const { targetRole, startDate, endDate } = req.query;

    const matchConditions = {};
    if (targetRole) matchConditions.targetRole = targetRole;
    
    if (startDate || endDate) {
      matchConditions.timestamp = {};
      if (startDate) matchConditions.timestamp.$gte = new Date(startDate);
      if (endDate) matchConditions.timestamp.$lte = new Date(endDate);
    }

    const stats = await AuditLog.aggregate([
      ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          updateCount: {
            $sum: { $cond: [{ $eq: ['$action', 'update'] }, 1, 0] }
          },
          createCount: {
            $sum: { $cond: [{ $eq: ['$action', 'create'] }, 1, 0] }
          },
          deleteCount: {
            $sum: { $cond: [{ $eq: ['$action', 'delete'] }, 1, 0] }
          },
          byEntityType: {
            $push: {
              entityType: '$entityType',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalLogs: 1,
          updateCount: 1,
          createCount: 1,
          deleteCount: 1
        }
      }
    ]);

    const entityTypeStats = await AuditLog.aggregate([
      ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),
      {
        $group: {
          _id: '$entityType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    return res.status(200).json({
      status: 'success',
      message: 'Audit log statistics retrieved successfully',
      data: {
        overall: stats[0] || {
          totalLogs: 0,
          updateCount: 0,
          createCount: 0,
          deleteCount: 0
        },
        byEntityType: entityTypeStats
      }
    });

  } catch (error) {
    console.error('Get audit log stats error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve audit log statistics',
      error: error?.message
    });
  }
};
