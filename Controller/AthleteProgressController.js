import mongoose from "mongoose";
import Athlete from "../Models/Athlete.js";
import AthleteProgress, { MEASUREMENT_FIELDS } from "../Models/AthleteProgress.js";
import AthleteProgressResource from "../config/Resources/AthleteProgressResource.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  decimalToNumberOrNull,
  measurementsToNumbers,
  recordProgress,
  recomputeCurrentSnapshot,
} from "../services/athleteProgressService.js";

const WEIGHT_RANGE = { min: 20, max: 500 };
const MEASUREMENT_RANGE = { min: 10, max: 300 };
const NOTE_MAX = 500;

function isObjectId(value) {
  return (
    typeof value === "string" &&
    mongoose.Types.ObjectId.isValid(value) &&
    String(new mongoose.Types.ObjectId(value)) === value.toLowerCase()
  );
}

function pageQuery(query) {
  const page = Math.max(parseInt(query?.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query?.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

async function findAthlete(userId) {
  return Athlete.findOne({
    userId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });
}

function readNumber(value, { min, max }) {
  if (value === null || value === "") return { value: null };
  const num = Number(value);
  if (!Number.isFinite(num)) return { error: "Must be a number" };
  if (num < min || num > max) return { error: `Must be between ${min} and ${max}` };
  return { value: num };
}

// Parses weight / measurements / note from a request body.
// With `partial: true` (update), only keys actually sent are returned so
// absent fields keep their stored values and explicit null clears a field.
function parsePayload(body, { partial = false } = {}) {
  const errors = {};
  const values = {};
  let providedCount = 0;

  if (!partial || body?.weight !== undefined) {
    if (body?.weight !== undefined && body?.weight !== null && body?.weight !== "") {
      const parsed = readNumber(body.weight, WEIGHT_RANGE);
      if (parsed.error) errors.weight = parsed.error;
      else {
        values.weight = parsed.value;
        providedCount += 1;
      }
    } else if (partial && body?.weight !== undefined) {
      values.weight = null;
      providedCount += 1;
    }
  }

  if (!partial || body?.measurements !== undefined) {
    if (body?.measurements !== undefined && body?.measurements !== null) {
      if (typeof body.measurements !== "object" || Array.isArray(body.measurements)) {
        errors.measurements = "Measurements must be an object";
      } else {
        values.measurements = {};
        for (const field of MEASUREMENT_FIELDS) {
          const raw = body.measurements[field];
          if (raw === undefined) continue;
          if (raw === null || raw === "") {
            if (partial) values.measurements[field] = null;
            continue;
          }
          const parsed = readNumber(raw, MEASUREMENT_RANGE);
          if (parsed.error) errors[`measurements.${field}`] = parsed.error;
          else {
            values.measurements[field] = parsed.value;
            providedCount += 1;
          }
        }
      }
    } else if (partial && body?.measurements !== undefined) {
      values.measurements = Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f, null]));
      providedCount += 1;
    }
  }

  if (body?.note !== undefined) {
    const note = typeof body.note === "string" ? body.note.trim() : body.note;
    if (note !== null && typeof note !== "string") {
      errors.note = "Note must be a string";
    } else if (typeof note === "string" && note.length > NOTE_MAX) {
      errors.note = `Note must not exceed ${NOTE_MAX} characters`;
    } else {
      values.note = note || null;
    }
  }

  if (!partial && providedCount === 0 && !Object.keys(errors).length) {
    errors.weight = "Weight or at least one measurement is required";
  }

  return { errors, values, providedCount };
}

function validationError(res, errors) {
  return res.status(422).json({ message: "Validation error", errors });
}

export const addProgress = asyncHandler(async (req, res) => {
  const athlete = await findAthlete(req.userId);
  if (!athlete) {
    return res.status(404).json({ status: "error", message: "Athlete not found" });
  }

  const { errors, values } = parsePayload(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);

  // Date is always today from the server — any client-sent date is ignored.
  // recordProgress preserves the old values in history before the Athlete
  // model is updated with the new current values.
  const { entry, current } = await recordProgress(athlete, values);

  return res.status(201).json({
    status: "success",
    message: "Progress recorded successfully",
    data: new AthleteProgressResource(entry),
    current,
  });
});

export const getProgressHistory = asyncHandler(async (req, res) => {
  const athlete = await findAthlete(req.userId);
  if (!athlete) {
    return res.status(404).json({ status: "error", message: "Athlete not found" });
  }

  const filter = {
    athleteId: req.userId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };

  const { from, to } = req.query || {};
  if (from || to) {
    const recordedAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ status: "error", message: "Invalid 'from' date" });
      }
      recordedAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ status: "error", message: "Invalid 'to' date" });
      }
      // Include the whole 'to' day.
      toDate.setUTCHours(23, 59, 59, 999);
      recordedAt.$lte = toDate;
    }
    filter.recordedAt = recordedAt;
  }

  const { page, limit, skip } = pageQuery(req.query);

  const [entries, total] = await Promise.all([
    AthleteProgress.find(filter)
      .sort({ recordedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AthleteProgress.countDocuments(filter),
  ]);

  return res.status(200).json({
    status: "success",
    message: "Progress history retrieved successfully",
    data: AthleteProgressResource.collection(entries),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

async function findOwnEntry(req, res) {
  const { entryId } = req.params;
  if (!isObjectId(entryId)) {
    res.status(400).json({ status: "error", message: "Progress entry id is invalid" });
    return null;
  }
  const entry = await AthleteProgress.findOne({
    _id: entryId,
    athleteId: req.userId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });
  if (!entry) {
    res.status(404).json({ status: "error", message: "Progress entry not found" });
    return null;
  }
  return entry;
}

export const updateProgress = asyncHandler(async (req, res) => {
  const athlete = await findAthlete(req.userId);
  if (!athlete) {
    return res.status(404).json({ status: "error", message: "Athlete not found" });
  }

  const entry = await findOwnEntry(req, res);
  if (!entry) return;

  const { errors, values } = parsePayload(req.body, { partial: true });
  if (Object.keys(errors).length) return validationError(res, errors);
  if (!Object.keys(values).length) {
    return validationError(res, { entry: "Nothing to update" });
  }

  if (values.weight !== undefined) entry.weight = values.weight;
  if (values.measurements) {
    for (const [field, value] of Object.entries(values.measurements)) {
      entry.measurements[field] = value;
    }
  }
  if (values.note !== undefined) entry.note = values.note;

  const resultingMeasurements = measurementsToNumbers(entry.measurements);
  const hasValue =
    decimalToNumberOrNull(entry.weight) !== null ||
    MEASUREMENT_FIELDS.some((field) => resultingMeasurements[field] !== null);
  if (!hasValue) {
    return validationError(res, {
      entry: "A progress entry must keep a weight or at least one measurement",
    });
  }

  await entry.save();
  const current = await recomputeCurrentSnapshot(req.userId);

  return res.status(200).json({
    status: "success",
    message: "Progress updated successfully",
    data: new AthleteProgressResource(entry),
    current,
  });
});

export const deleteProgress = asyncHandler(async (req, res) => {
  const athlete = await findAthlete(req.userId);
  if (!athlete) {
    return res.status(404).json({ status: "error", message: "Athlete not found" });
  }

  const entry = await findOwnEntry(req, res);
  if (!entry) return;

  entry.deletedAt = new Date();
  await entry.save();

  // Current values fall back to the newest remaining entry automatically.
  const current = await recomputeCurrentSnapshot(req.userId);

  return res.status(200).json({
    status: "success",
    message: "Progress deleted successfully",
    data: { id: entry._id.toString() },
    current,
  });
});
