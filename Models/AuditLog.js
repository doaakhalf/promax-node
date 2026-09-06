import { Schema, model } from 'mongoose';

const auditLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetRole: {
    type: String,
    enum: ['athlete', 'coach'],
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: ['user', 'athlete', 'coach', 'certificate', 'achievement', 'gallery'],
    required: true,
    index: true
  },
  entityId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  fieldName: {
    type: String,
    required: true
  },
  oldValue: {
    type: Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: Schema.Types.Mixed,
    default: null
  },
  action: {
    type: String,
    enum: ['update', 'create', 'delete'],
    required: true
  },
  ipAddress: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 7776000 // 90 days in seconds (90 * 24 * 60 * 60)
  }
}, {
  timestamps: false
});

// Compound indexes for efficient queries
auditLogSchema.index({ targetUserId: 1, timestamp: -1 });
auditLogSchema.index({ targetRole: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, timestamp: -1 });

export default model("AuditLog", auditLogSchema);
