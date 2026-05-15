

import User from "../Models/User.js";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcrypt";
import Role from "../Models/Role.js";
import Coach from "../Models/Coach.js";
import CoachResource from "../config/Resources/CoachResource.js";


export default async function LoginController(req, res) {
    try {
        const { email, password } = req.body;
     
        
        
        const user = await User.findOne({ email }).lean();
        
        if (!user) {
            return res.status(401).json({ 
                status: "error",
                message: "Invalid email or password"
            });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ 
                status: "error",
                message: "Invalid email or password"
            });
        }
        
        const role = await Role.findById(user.role_id).lean();
        const token = generateToken({ userId: user._id.toString(), email: user.email });
        
        if(user.status === "pending"&&role?.name !== "athlete") {
            const coach = await Coach.findOne({ userId: user._id.toString() }).populate('userId').populate('userId.role').lean();
            


            return res.status(200).json({ 
                message: "Login successful",
                token,
                token_type: "Bearer",
              
               user: new CoachResource(coach,role)
            });
        }
      
        return res.status(200).json({ 
            message: "Login successful",
            token,
            token_type: "Bearer",
            status: "success",
          
            user:{
                    "id": user._id.toString(),
                    "name": user.firstName + " " + user.lastName.charAt(0).toUpperCase() + ".",
                    "email": user.email,
                    "role": role?.name,
                    "profilePhoto": user?.profileImage || null,
                    "status": user.status
            }

        });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err?.message || err });
    }
}