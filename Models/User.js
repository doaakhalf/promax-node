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
        slug: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
            minlength: 8,
            maxlength: 8,
            match: /^[a-z0-9]{8}$/,
        },
        phoneNumber:{
            type:String,
            unique:true,
            default:null
        },
        role_id:{
            type:Schema.Types.ObjectId,
            ref:"Role",
            required:true,
        },
        status:{
            type:String,
           enum: ['incomplete', 'pending','active','deleted','rejected','inactive'],
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
        },
        lastSeenAt: {
            type: Date,
            default: null
        }
    
},{
    timestamps:true
})

userSchema.index({ role_id: 1 });

// Block creating users with the admin role via normal app/API code.
// Scripts that intentionally seed admins must set: user.$locals.allowAdminCreate = true
userSchema.pre("validate", async function () {
  if (!this.isNew || this.$locals?.allowAdminCreate) return;

  const roleId = this.role_id;
  if (!roleId) return;

  const Role = model("Role");
  const role = await Role.findById(roleId).select("name").lean();
  if (role?.name === "admin") {
    this.invalidate(
      "role_id",
      "Admin accounts cannot be created via registration or application APIs"
    );
  }
});

export default model("User", userSchema);