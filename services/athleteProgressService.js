import Athlete from "../Models/Athlete.js";
import AthleteProgress, { MEASUREMENT_FIELDS } from "../Models/AthleteProgress.js";

export { MEASUREMENT_FIELDS };

export function decimalToNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value?.$numberDecimal ?? value.toString?.() ?? value);
  return Number.isFinite(num) ? num : null;
}

export function measurementsToNumbers(measurements) {
  const result = {};
  for (const field of MEASUREMENT_FIELDS) {
    result[field] = decimalToNumberOrNull(measurements?.[field]);
  }
  return result;
}

export function snapshotFromAthlete(athlete) {
  return {
    weight: decimalToNumberOrNull(athlete?.weight),
    measurements: measurementsToNumbers(athlete?.measurements),
  };
}

function hasAnySnapshotValue(snapshot) {
  if (snapshot.weight !== null) return true;
  return MEASUREMENT_FIELDS.some((field) => snapshot.measurements[field] !== null);
}

function activeFilter(athleteId) {
  return {
    athleteId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

/**
 * Guarantees the athlete's pre-history current values are never lost:
 * if they have no progress entries yet (e.g. registered before this
 * feature), their current Athlete snapshot is saved as a legacy entry
 * dated at their registration (Athlete.createdAt) before any update.
 */
export async function ensureLegacyProgressEntry(athlete) {
  if (!athlete) return null;

  const existingCount = await AthleteProgress.countDocuments(activeFilter(athlete.userId));
  if (existingCount > 0) return null;

  const snapshot = snapshotFromAthlete(athlete);
  if (!hasAnySnapshotValue(snapshot)) return null;

  return AthleteProgress.create({
    athleteId: athlete.userId,
    weight: snapshot.weight,
    measurements: snapshot.measurements,
    recordedAt: athlete.createdAt || new Date(),
  });
}

export async function createInitialProgressEntry(athlete, recordedAt) {
  if (!athlete) return null;
  const snapshot = snapshotFromAthlete(athlete);
  if (!hasAnySnapshotValue(snapshot)) return null;

  return AthleteProgress.create({
    athleteId: athlete.userId,
    weight: snapshot.weight,
    measurements: snapshot.measurements,
    recordedAt: recordedAt || athlete.createdAt || new Date(),
  });
}

/**
 * Rebuilds Athlete.weight / Athlete.measurements from history: for each
 * field independently, the newest non-empty value wins. Editing an old
 * entry therefore never clobbers current values, and deleting the newest
 * entry automatically restores the previous value.
 */
export async function recomputeCurrentSnapshot(athleteId) {
  const entries = await AthleteProgress.find(activeFilter(athleteId))
    .sort({ recordedAt: -1, createdAt: -1 })
    .lean();

  if (!entries.length) return null;

  let weight = null;
  const measurements = {};
  const pendingMeasurements = new Set(MEASUREMENT_FIELDS);

  for (const entry of entries) {
    if (weight === null) {
      weight = decimalToNumberOrNull(entry.weight);
    }
    if (pendingMeasurements.size) {
      const entryMeasurements = measurementsToNumbers(entry.measurements);
      for (const field of [...pendingMeasurements]) {
        if (entryMeasurements[field] !== null) {
          measurements[field] = entryMeasurements[field];
          pendingMeasurements.delete(field);
        }
      }
    }
    if (weight !== null && pendingMeasurements.size === 0) break;
  }

  for (const field of pendingMeasurements) measurements[field] = null;

  const update = {};
  if (weight !== null) update.weight = weight;
  for (const field of MEASUREMENT_FIELDS) {
    update[`measurements.${field}`] = measurements[field];
  }

  await Athlete.updateOne({ userId: athleteId }, { $set: update });

  return { weight, measurements };
}

/**
 * Main write path for a new measurement: preserve the old values in
 * history first, save the new entry dated today, then refresh the
 * Athlete model so it always carries the current values.
 */
export async function recordProgress(athlete, { weight, measurements, note } = {}) {
  await ensureLegacyProgressEntry(athlete);

  const entry = await AthleteProgress.create({
    athleteId: athlete.userId,
    weight: weight ?? null,
    measurements: measurements || {},
    note: note || null,
    recordedAt: new Date(),
  });

  const current = await recomputeCurrentSnapshot(athlete.userId);

  return { entry, current };
}
