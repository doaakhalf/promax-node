import {Schema,model} from 'mongoose';
import { measurementsSchema } from './AthleteProgress.js';

const athleteSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
 

  weight: {
    type: Schema.Types.Decimal128,
    required: true
  },
  height: {
    type: Schema.Types.Decimal128,
    required: true
  },
  // Current body measurements (cm). Latest values only — full history
  // lives in AthleteProgress; this snapshot mirrors the newest entry.
  measurements: {
    type: measurementsSchema,
    default: () => ({})
  },
  trainingFrequency: {
    type: String,
    enum: ['1','2', '3', '4', '5','6','7'],
    required: true
  },
  inbodyFile: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  goals: {
    type: String,
    default: null
  },
  injuries: {
    type: String,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

athleteSchema.index({ userId: 1 });

export default model("Athlete", athleteSchema);