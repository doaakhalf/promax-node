import {Schema,model} from "mongoose";


const userSchema = new Schema({
    
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        firstName:{type:String, default:null},
        lastName:{type:String, default:null},
        phoneNumber:{
            type:String,
            default:null
        },
        role_id:{
            type:Schema.Types.ObjectId,
            ref:"Role",
            required:true,
        },
        status:{
            type:String,
           enum: ['incomplete', 'pending', 'approved','active','deleted'],
            default:"incomplete"
        },
        profileImage: {
            type: String,
            default: null
        },
        fcmTokens: [{
                        token: {
                            type: String,
                            required: true
                        },
                        deviceId: {
                            type: String,
                            default: null
                        },
                        platform: {
                            type: String,
                            enum: ['ios', 'android', 'web'],
                            default: 'android'
                        },
                        addedAt: {
                            type: Date,
                            default: Date.now
                        }
                    }],
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
            required: true
        },

        resetPasswordToken: {
            type: String,
            default: null
        },
        resetPasswordExpires: {
            type: Date,
            default: null
        },
        deletedAt: {
            type: Date,
            default: null
        }
    
},{
    timestamps:true
})

userSchema.index({ role_id: 1 });

export default model("User", userSchema);