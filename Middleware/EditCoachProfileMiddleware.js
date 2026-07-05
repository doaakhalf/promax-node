import User from "../Models/User.js";
import { verifyToken } from "../utils/jwt.js";

export const EditCoachProfileMiddleware = async (req, res, next) => {
  try {
    const errors = {};
    const body = req.body;
    const files = req.files || {};
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 

  
// email
    if (body.email) {
      if (!EMAIL_REGEX.test(body.email)) {
        errors.email = "Email is invalid";
      } else {
        const existing = await User.findOne({ email: body.email }).select("_id").lean();
        if (existing && existing._id.toString() !== req.userId.toString()) {
          errors.email = "Email already exists";
        }
      }
    }


    // phone_number
    if (body.phoneNumber) {
      if (typeof body.phoneNumber !== "string" || body.phoneNumber.trim().length === 0) {
        errors.phoneNumber = "Phone number is required";
      } else if (body.phoneNumber.trim().length > 20) {
        errors.phoneNumber = "Phone number must not exceed 20 characters";
      } else {
      // Check uniqueness
      const existingUser = await User.findOne({ 
        phoneNumber: body.phoneNumber.trim(),
        _id: { $ne: req.userId }
      }).select("_id").lean();
      
      if (existingUser) {
        errors.phoneNumber = "Phone number already exists";
      }
    }
}

    // instapay_link validation (optional for edit)
    if (body.instapayLink) {
      if (typeof body.instapayLink !== "string" || body.instapayLink.trim().length === 0) {
        errors.instapayLink = "Instapay link cannot be empty if provided";
      } else {
        const urlPattern = /^https:\/\/ipn\.eg\/S\/[a-zA-Z0-9_-]+\/instapay\/[a-zA-Z0-9_-]+$/;
        if (!urlPattern.test(body.instapayLink.trim())) {
          errors.instapayLink = "Instapay link must be a valid URL";
        } else if (body.instapayLink.trim().length > 1000) {
          errors.instapayLink = "Instapay link must not exceed 1000 characters";
        }
      }
    }
    if(body.gender) {
      const validGenders = ['male', 'female', 'other'];
      if (!validGenders.includes(body.gender.toLowerCase())) {
        errors.gender = "Invalid gender. Must be 'male', 'female', or 'other'";
      }
    }
    

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({
        message: "Validation error",
        errors,
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
};