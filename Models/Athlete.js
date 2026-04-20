import {Schema,model} from 'mongoose';

const athleteSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  profileImage: {
    type: String,
    default: null
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
  trainingFrequency: {
    type: String,
    enum: ['2', '3', '4', '5', '6', '7'],
    required: true
  },
  inbodyFile: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

athleteSchema.index({ userId: 1 });

export default model("Athlete", athleteSchema);