import {Schema,model} from 'mongoose';

const athleteSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
 
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
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
  trainingFrequency: {
    type: String,
    enum: ['1','2', '3', '4', '5'],
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