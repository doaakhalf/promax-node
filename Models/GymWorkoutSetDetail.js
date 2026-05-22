import { Schema, model } from "mongoose";

const gymWorkoutSetDetailSchema = new Schema(
  {
    setId: {
      type: Schema.Types.ObjectId,
      ref: "GymWorkoutSet",
      required: true,
    },
    durationType: {
      type: String,
      enum: ["time", "reps"],
      required: true,
    },
    durationValue: {
      type: Schema.Types.Decimal128,
      required: function() {
        return this.durationType === 'time';
      },
    },
    sets: {
      type: Number,
      required: function() {
        return this.durationType === 'reps';
      },
    },
    reps: {
      type: Number,
      required: function() {
        return this.durationType === 'reps';
      },
    },
    restSeconds: {
      type: Number,
      default: 30
    },
    weightType: {
      type: String,
      enum: ['custom', 'body'],
      default: 'custom'
    },
    weight: {
      type: Schema.Types.Decimal128,
      required: function() {
        return this.weightType === 'custom';
      },
    },
  },
  {
    timestamps: true,
  }
);

gymWorkoutSetDetailSchema.index({ setId: 1, durationType: 1 });

export default model("GymWorkoutSetDetail", gymWorkoutSetDetailSchema);
