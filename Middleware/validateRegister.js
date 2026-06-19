import User from "../Models/User.js";
import Role from "../Models/Role.js";
import { log } from "console";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function validateRegister(req, res, next) {

  try {
    const errors = {};

   
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
    const user_type = typeof req.body?.user_type === "string" ? req.body.user_type.trim() : "";
    const dateOfBirth = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth : "";

    // email
    if (!email) {
      errors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "Email is invalid";
    } else {
      const existing = await User.findOne({ email }).select("_id").lean();
      if (existing) {
        errors.email = "Email already exists";
      }
    }

    // password
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    } else if (password.length > 72) {
      // bcrypt has a 72 byte limit
      errors.password = "Password is too long";
    }
     // password confirmation
    if (!confirmPassword) {
      errors.confirmPassword = "Password confirmation is required";
    } else if (confirmPassword !== password) {
      errors.confirmPassword = "Password confirmation does not match password";
    } 

    // user_type
    if (!user_type) {
      errors.user_type = "user_type is required";
    } else {
      const allowed = ["admin", "coach", "athlete"];
      if (!allowed.includes(user_type)) {
        errors.user_type = `user_type must be one of: ${allowed.join(", ")}`;
      } else {
        const role = await Role.findOne({ name: user_type }).lean();
       
        if (!role) {
          errors.user_type = "Role not found in database. Seed roles first.";
        } else {
          req.role = role;
        }
      }
    }
    if(dateOfBirth) {
      if (typeof dateOfBirth !== "string" || dateOfBirth.trim().length === 0) {
        errors.dateOfBirth = "Date of birth is required";
      } else {
        const date = new Date(dateOfBirth);
        if (isNaN(date.getTime())) {
          errors.dateOfBirth = "Invalid date format. Expected format: YYYY-MM-DD or ISO 8601" ;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({
        message: "Validation error",
        errors,
      });
    }

    req.body.email = email;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
}


