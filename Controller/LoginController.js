

import User from "../Models/User.js";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcrypt";
import Role from "../Models/Role.js";

export default async function LoginController(req, res) {
    try {
        const { email, password } = req.body;
        console.log(email,password);
        
        
        const user = await User.findOne({ email }).lean();
        
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        const role = await Role.findById(user.role_id).lean();
        const token = generateToken({ userId: user._id.toString(), email: user.email });
        
        return res.json({ 
            message: "Login successful",
            token,
            token_type: "Bearer",
            status: user.status,
            role: role?.name,
            user_id: user._id.toString()

        });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err?.message || err });
    }
}