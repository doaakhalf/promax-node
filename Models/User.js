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
           enum: ['incomplete', 'pending', 'approved','active'],
            default:"incomplete"
        },
        profileImage: {
            type: String,
            default: null
        }
    
},{
    timestamps:true
})

userSchema.index({ role_id: 1 });

export default model("User", userSchema);