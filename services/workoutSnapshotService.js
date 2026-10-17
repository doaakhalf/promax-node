import Workout from "../Models/Workout.js";
import GymWorkoutSet from "../Models/GymWorkoutSet.js";
import GymWorkoutSetDetail from "../Models/GymWorkoutSetDetail.js";

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  return parseFloat(value.toString());
};

/**
 * Build a nested workout+exercises snapshot matching getWorkout response shape.
 * Returns null if the workout cannot be loaded.
 */
export const buildWorkoutSnapshot = async (workoutId, { snappedAt = new Date() } = {}) => {
  if (!workoutId) return null;

  const workout = await Workout.findById(workoutId).lean();
  if (!workout) return null;

  const gymWorkoutSets = await GymWorkoutSet.find({ workoutId })
    .populate("exerciseId")
    .sort({ order: 1 })
    .lean();

  const setIds = gymWorkoutSets.map((set) => set._id);
  const setDetails = setIds.length
    ? await GymWorkoutSetDetail.find({ setId: { $in: setIds } }).lean()
    : [];

  const exercisesMap = new Map();

  gymWorkoutSets.forEach((gymSet) => {
    if (!gymSet.exerciseId?._id) return;

    const exerciseId = gymSet.exerciseId._id.toString();
    const setsForThisExercise = setDetails.filter(
      (detail) => detail.setId.toString() === gymSet._id.toString()
    );

    if (!exercisesMap.has(exerciseId)) {
      const exercise = gymSet.exerciseId;
      exercisesMap.set(exerciseId, {
        exercise: {
          _id: exercise._id,
          userId: exercise.userId,
          nameEn: exercise.nameEn ?? null,
          nameAr: exercise.nameAr ?? null,
          type: exercise.type ?? null,
          targetBodyParts: exercise.targetBodyParts ?? [],
          descriptionEn: exercise.descriptionEn ?? null,
          descriptionAr: exercise.descriptionAr ?? null,
          image: exercise.image ?? null,
          videoUrl: exercise.videoUrl ?? null,
          source: exercise.source ?? null,
          externalId: exercise.externalId ?? undefined,
        },
        order: gymSet.order,
        notes: gymSet.notes,
        sets: [],
      });
    }

    exercisesMap.get(exerciseId).sets.push({
      gymWorkoutSetId: gymSet._id,
      order: gymSet.order,
      notes: gymSet.notes,
      setDetails: setsForThisExercise.map((detail) => ({
        id: detail._id,
        durationType: detail.durationType,
        durationValue: toNumberOrNull(detail.durationValue),
        sets: detail.sets ?? null,
        reps: detail.reps ?? null,
        restSeconds: detail.restSeconds ?? null,
        weightType: detail.weightType ?? null,
        weight: toNumberOrNull(detail.weight),
      })),
    });
  });

  const exercises = Array.from(exercisesMap.values()).sort(
    (a, b) => a.order - b.order
  );

  return {
    sourceWorkoutId: workout._id,
    name: workout.name,
    description: workout.description ?? null,
    workoutType: workout.workoutType,
    instructions: workout.instructions ?? null,
    exercises,
    snappedAt,
  };
};

/**
 * Build snapshots for many workout IDs (deduped). Returns Map<string, snapshot>.
 */
export const buildWorkoutSnapshotsByIds = async (workoutIds) => {
  const uniqueIds = [
    ...new Set(
      (workoutIds || [])
        .filter(Boolean)
        .map((id) => id.toString())
    ),
  ];

  const snappedAt = new Date();
  const snapshotsById = new Map();

  await Promise.all(
    uniqueIds.map(async (id) => {
      const snapshot = await buildWorkoutSnapshot(id, { snappedAt });
      if (snapshot) {
        snapshotsById.set(id, snapshot);
      }
    })
  );

  return snapshotsById;
};

/**
 * Collect distinct workoutIds from a calendar document.
 */
export const collectCalendarWorkoutIds = (calendar) => {
  const ids = [];
  for (const week of calendar?.weeks || []) {
    for (const day of week.trainingDays || []) {
      if (day.workoutId) {
        ids.push(day.workoutId);
      }
    }
  }
  return ids;
};

/**
 * Stamp workoutSnapshot onto each assigned training day using a prebuilt map.
 * Mutates the calendar document in memory; caller must save.
 * @returns {number} daysUpdated
 */
export const stampCalendarWorkoutSnapshots = (calendar, snapshotsById, { onlyMissing = false } = {}) => {
  let daysUpdated = 0;

  for (const week of calendar.weeks || []) {
    for (const day of week.trainingDays || []) {
      if (!day.workoutId) continue;
      if (onlyMissing && day.workoutSnapshot) continue;

      const key = day.workoutId.toString();
      const snapshot = snapshotsById.get(key);
      if (!snapshot) continue;

      day.workoutSnapshot = { ...snapshot };
      daysUpdated += 1;
    }
  }

  return daysUpdated;
};

/**
 * Load calendars, build snapshots, stamp days, and save.
 * @returns {{ calendarsProcessed, daysSnapshotted }}
 */
export const snapshotWorkoutsForCalendars = async (
  calendars,
  { onlyMissing = false } = {}
) => {
  if (!calendars?.length) {
    return { calendarsProcessed: 0, daysSnapshotted: 0 };
  }

  const allWorkoutIds = calendars.flatMap(collectCalendarWorkoutIds);
  const snapshotsById = await buildWorkoutSnapshotsByIds(allWorkoutIds);

  let daysSnapshotted = 0;
  let calendarsProcessed = 0;

  for (const calendar of calendars) {
    const updated = stampCalendarWorkoutSnapshots(calendar, snapshotsById, {
      onlyMissing,
    });
    if (updated > 0) {
      calendar.markModified("weeks");
      await calendar.save();
      calendarsProcessed += 1;
      daysSnapshotted += updated;
    }
  }

  return { calendarsProcessed, daysSnapshotted };
};

/**
 * Format a training day's workout for calendar API responses.
 * Prefers workoutSnapshot when present; falls back to populated workoutId.
 */
export const resolveDayWorkoutShell = (day) => {
  if (day?.workoutSnapshot) {
    return {
      id: day.workoutSnapshot.sourceWorkoutId,
      name: day.workoutSnapshot.name,
      description: day.workoutSnapshot.description,
      type: day.workoutSnapshot.workoutType,
    };
  }

  if (day?.workoutId) {
    return {
      id: day.workoutId._id ?? day.workoutId,
      name: day.workoutId.name,
      description: day.workoutId.description,
      type: day.workoutId.workoutType,
    };
  }

  return null;
};

/**
 * Convert a stored workoutSnapshot into the getWorkout response payload.
 */
export const snapshotToGetWorkoutData = (snapshot) => {
  if (!snapshot) return null;

  return {
    workoutId: snapshot.sourceWorkoutId?.toString?.() ?? snapshot.sourceWorkoutId,
    workout: {
      _id: snapshot.sourceWorkoutId,
      name: snapshot.name,
      description: snapshot.description,
      workoutType: snapshot.workoutType,
      instructions: snapshot.instructions,
    },
    exercises: snapshot.exercises || [],
  };
};

/**
 * Find a matching workoutSnapshot on an expired calendar for a workoutId.
 */
export const findSnapshotOnCalendar = (calendar, workoutId) => {
  if (!calendar || !workoutId) return null;
  const target = workoutId.toString();

  for (const week of calendar.weeks || []) {
    for (const day of week.trainingDays || []) {
      const snap = day.workoutSnapshot;
      if (!snap) continue;

      const sourceId =
        snap.sourceWorkoutId?.toString?.() ?? String(snap.sourceWorkoutId);
      const dayWorkoutId =
        day.workoutId?._id?.toString?.() ?? day.workoutId?.toString?.() ?? null;

      if (sourceId === target || dayWorkoutId === target) {
        return snap;
      }
    }
  }

  return null;
};
