import AuditLog from "../Models/AuditLog.js";

const MAX_VALUE_LENGTH = 1000;

/**
 * Normalize value for logging (handle Decimal128, Date, and limit length)
 */
function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  // Mongo Extended JSON / lean Decimal128
  if (typeof value === 'object' && value.$numberDecimal != null) {
    return String(value.$numberDecimal);
  }

  // BSON Decimal128 from mongoose documents
  if (
    typeof value === 'object' &&
    (value._bsontype === 'Decimal128' || value.constructor?.name === 'Decimal128')
  ) {
    return value.toString();
  }

  // Already-stringified Extended JSON from older logs / double-encoding
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.includes('$numberDecimal')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.$numberDecimal != null) return String(parsed.$numberDecimal);
      } catch {
        // fall through
      }
    }
  }

  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle objects (convert to string representation)
  if (typeof value === 'object') {
    // Last resort: Decimal128 sometimes only exposes toString()
    if (typeof value.toString === 'function') {
      const asString = value.toString();
      if (asString && asString !== '[object Object]' && !Number.isNaN(Number(asString))) {
        return asString;
      }
    }
    const str = JSON.stringify(value);
    return str.length > MAX_VALUE_LENGTH ? str.substring(0, MAX_VALUE_LENGTH) + '...' : str;
  }

  // Handle strings and other primitives
  const str = String(value);
  return str.length > MAX_VALUE_LENGTH ? str.substring(0, MAX_VALUE_LENGTH) + '...' : str;
}

/**
 * Compare values after normalizing Decimal128 / Date / types so unchanged
 * fields (e.g. weight 155 vs Decimal128 "155") are not logged.
 */
function valuesEqual(a, b) {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);

  if (na === nb) return true;
  if (na == null || nb == null) return false;

  const numA = Number(na);
  const numB = Number(nb);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && String(na).trim() !== '' && String(nb).trim() !== '') {
    // Both look numeric (weight, height, price, …)
    return numA === numB;
  }

  return false;
}

/**
 * Compare old and new values and return changed fields
 */
function getChangedFields(oldData, newData) {
  const changes = [];

  for (const key in newData) {
    if (key === '_id' || key === '__v') continue;

    const oldValue = oldData?.[key];
    const newValue = newData[key];

    if (valuesEqual(oldValue, newValue)) {
      continue;
    }

    changes.push({
      fieldName: key,
      oldValue: normalizeValue(oldValue),
      newValue: normalizeValue(newValue)
    });
  }

  return changes;
}

/**
 * Create audit log entries in batch (non-blocking)
 */
async function createAuditLogs(logs) {
  if (!logs || logs.length === 0) {
    return;
  }

  // Fire-and-forget: don't await, handle errors in background
  AuditLog.insertMany(logs).catch(err => {
    console.error('Failed to create audit logs:', err);
  });
}

/**
 * Log profile update changes
 */
export function logProfileUpdate({
  userId,
  targetUserId,
  targetRole,
  entityType,
  entityId,
  oldData,
  newData,
  ipAddress
}) {
  const changes = getChangedFields(oldData, newData);
  
  if (changes.length === 0) {
    return;
  }

  const logs = changes.map(change => ({
    userId,
    targetUserId,
    targetRole,
    entityType,
    entityId,
    fieldName: change.fieldName,
    oldValue: change.oldValue,
    newValue: change.newValue,
    action: 'update',
    ipAddress
  }));

  createAuditLogs(logs);
}

/**
 * Log entity creation (certificate, achievement, etc.)
 */
export function logEntityCreation({
  userId,
  targetUserId,
  targetRole,
  entityType,
  entityId,
  fieldName,
  data,
  ipAddress
}) {
  const log = {
    userId,
    targetUserId,
    targetRole,
    entityType,
    entityId,
    fieldName: fieldName || 'entity',
    oldValue: null,
    newValue: normalizeValue(data),
    action: 'create',
    ipAddress
  };

  createAuditLogs([log]);
}

/**
 * Log entity deletion
 */
export function logEntityDeletion({
  userId,
  targetUserId,
  targetRole,
  entityType,
  entityId,
  fieldName,
  data,
  ipAddress
}) {
  const log = {
    userId,
    targetUserId,
    targetRole,
    entityType,
    entityId,
    fieldName: fieldName || 'entity',
    oldValue: normalizeValue(data),
    newValue: null,
    action: 'delete',
    ipAddress
  };

  createAuditLogs([log]);
}

/**
 * Log gallery operations (add/remove images)
 */
export function logGalleryOperation({
  userId,
  targetUserId,
  targetRole,
  entityId,
  operation, // 'add' or 'remove'
  count,
  ipAddress
}) {
  const log = {
    userId,
    targetUserId,
    targetRole,
    entityType: 'gallery',
    entityId,
    fieldName: operation,
    oldValue: operation === 'remove' ? count : null,
    newValue: operation === 'add' ? count : null,
    action: operation === 'add' ? 'create' : 'delete',
    ipAddress
  };

  createAuditLogs([log]);
}

/**
 * Extract IP address from request
 */
export function extractIpAddress(req) {
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
}
