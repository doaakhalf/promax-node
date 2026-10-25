import{Schema,model} from "mongoose";
import {
  COACH_SPECIALIZATION_VALUES,
  MAX_COACH_SPECIALIZATIONS,
} from "../utils/coachSpecializations.js";


const CoachSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
   type:{
    type:String,
    enum: ['normal', 'gym'],
    default:"normal"
   },
   sport:{
    type:String,
    required:true
   },
  // Multi-select specializations. Only stable English codes are stored
  // (see utils/coachSpecializations.js); Arabic labels are resolved in
  // the API resources, never in the database.
  specializations: {
    type: [
      {
        type: String,
        enum: COACH_SPECIALIZATION_VALUES,
        trim: true,
        lowercase: true,
      },
    ],
    default: [],
    validate: [
      {
        validator: (v) => v.length <= MAX_COACH_SPECIALIZATIONS,
        message: `يمكن اختيار ${MAX_COACH_SPECIALIZATIONS} تخصصات كحد أقصى`,
      },
      {
        validator: (v) => new Set(v).size === v.length,
        message: "لا يمكن تكرار نفس التخصص أكثر من مرة",
      },
    ],
  },
     introduction: {
    type: String,
    default: null
  },
  trainingExperience: {
    type: String,
    required: true
  },
  yearOfExperience: {
    type: Number,
    required: true
  },
  motivation: {
    type: String,
    required: true
  },
  headline: {
    type: String,
    required: true
  },
 
  videoUrl: {
    type: String,
    default: null
  },
  monthlyPriceEgp: {
    type: Schema.Types.Decimal128,
    required: true
  },
  instapayLink: {
    type: String,
    default: null
  },
  walletNumber:{
    type: String,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
  AcceptTermsAndConditions: {
    type: Boolean,
    default: false
  },
  weeklySubscriptionEnabled: {
    type: Boolean,
    default: false
  },
  ratingAverage: {
    type: Number,
    default: 0,
  },
  ratingCount: {
    type: Number,
    default: 0,
  },
},
{
    timestamps:true
}
)
CoachSchema.index({ userId: 1 });

export default model("Coach", CoachSchema);