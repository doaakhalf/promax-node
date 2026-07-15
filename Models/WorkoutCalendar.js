import { Schema, model } from "mongoose";
import { resetTime } from "../utils/resetTime.js";

const trainingDaySchema = new Schema({
  dayNumber: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    get: resetTime
  },
  workoutId: {
    type: Schema.Types.ObjectId,
    ref: "Workout",
    default: null
  },
  isAssigned: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, { _id: false, toJSON: { getters: true }, toObject: { getters: true } });

const weekSchema = new Schema({
  weekNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 4
  },
  startDate: {
    type: Date,
    required: true,
    get: resetTime
  },
  endDate: {
    type: Date,
    required: true,
    get: resetTime
  },
  isOpen: {
    type: Boolean,
    default: false
  },
  trainingDays: [trainingDaySchema]
}, { _id: false, toJSON: { getters: true }, toObject: { getters: true } });

const workoutCalendarSchema = new Schema({
  athleteId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  coachId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: "Subscription",
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  trainingFrequency: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  weeks: [weekSchema],
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active"
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

workoutCalendarSchema.index({ athleteId: 1, month: 1, year: 1 });
workoutCalendarSchema.index({ coachId: 1, status: 1 });
workoutCalendarSchema.index({ subscriptionId: 1 });

export default model("WorkoutCalendar", workoutCalendarSchema);