import bcrypt from "bcrypt";
import User from "../Models/User.js";
import { generateToken } from "../utils/jwt.js";

export default async function signUpController(req, res) {

  try {
    const { email, password, user_type } = req.body;

    const role = req.role;
    if (!role?._id) {
      return res.status(500).json({ message: "Server error", error: "Role missing from request context" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
    

    const user = new User({
      email,
      password: hashedPassword,
      role_id: role._id,
      status: "incomplete",
    });

    const data = await user.save();

    // Generate JWT token
    const token = generateToken({ userId: data._id, email: data.email });

    return res.json({ 
      message: "User created successfully", 
      token ,
      token_type: "Bearer"
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(422).json({
        message: "Validation error",
        errors: { email: "Email already exists" },
      });
    }
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}