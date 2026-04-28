import {Schema,model} from "mongoose";


const roleSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        enum: ['admin', 'coach', 'athlete']
    }
    },
    {
    timestamps: true
}
)

export default model("Role", roleSchema);