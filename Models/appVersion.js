import { Schema ,model} from "mongoose";

const appVersionSchema = new Schema({
  latestVersion: {
    type: String,
    required: true
  },

  minimumVersion: {
    type: String,
    required: true
  },

  forceUpdate: {
    type: Boolean,
    default: false
  },

  storeUrls: {
    android: String,
    ios: String
  },

  releaseNotes: String
}, {
  timestamps: true
});

export default model('AppVersion', appVersionSchema);