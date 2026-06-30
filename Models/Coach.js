import{Schema,model} from "mongoose";


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
   bestRecord:{
    type:Schema.Types.Mixed ,//{name,rank,image}
    default:null
   },
     introduction: {
    type: String,
    default: null
  },
  trainingExperience: {
    type: String,
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
  }
},
{
    timestamps:true
}
)
CoachSchema.index({ userId: 1 });

export default model("Coach", CoachSchema);