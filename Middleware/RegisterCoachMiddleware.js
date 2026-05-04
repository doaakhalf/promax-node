import User from "../Models/User.js";
import { verifyToken } from "../utils/jwt.js";

export const RegisterCoachMiddleware = async (req, res, next) => {
  try {
    const errors = {};
    const body = req.body;
    const files = req.files || {};

    // // Check for Bearer token
    // const header = req.headers.authorization;
    // if (!header) {
    //   return res.status(401).json({ message: "Unauthorized - No token provided" });
    // }

    // const [type, token] = header.split(" ");

    
    // if (type !== "Bearer" || !token) {
    //   return res.status(401).json({ message: "Unauthorized - Invalid token format" });
    // }

    // // Verify JWT token
    // const decoded = verifyToken(token);
    
    // if (!decoded || !decoded.userId) {
    //   return res.status(401).json({ message: "Unauthorized - Invalid or expired token" });
    // }

    // // Fetch user with the decoded userId and populate role
    // const user = await User.findById(decoded.userId).populate("role_id").lean();
    // if (!user) {
    //   return res.status(401).json({ message: "Unauthorized - User not found" });
    // }

    // // Attach user to request for downstream use
    // req.user = user;
    // req.userId = user._id;

    // // Check user role (must be coach or gym_coach)
    // const userRole = user.role_id?.name;
    // if (!["coach"].includes(userRole)) {
    //   return res.status(403).json({ message: "Only coaches can complete this profile" });
    // }

    // first_name
    if (!body.firstName || typeof body.firstName !== "string" || body.firstName.trim().length === 0) {
      errors.firstName = "First name is required";
    } else if (body.firstName.trim().length > 255) {
      errors.firstName = "First name must not exceed 255 characters";
    }

    // last_name
    if (!body.lastName || typeof body.lastName !== "string" || body.lastName.trim().length === 0) {
      errors.lastName = "Last name is required";
    } else if (body.lastName.trim().length > 255) {
      errors.lastName = "Last name must not exceed 255 characters";
    }

    // type
    if (!body.type || typeof body.type !== "string" || body.type.trim().length === 0) {
      errors.type = "Type is required";
    } else if (body.type.trim().length > 255) {
      errors.type = "Type must not exceed 255 characters";
    }
    else {
      const allowed = ["normal", "gym"];
      if (!allowed.includes(body.type)) {
        errors.type = `Type must be one of: ${allowed.join(", ")}`;
      }
    }

    // phone_number
    if (!body.phoneNumber || typeof body.phoneNumber !== "string" || body.phoneNumber.trim().length === 0) {
      errors.phoneNumber = "Phone number is required";
    } else if (body.phoneNumber.trim().length > 20) {
      errors.phoneNumber = "Phone number must not exceed 20 characters";
    } else {
      // Check uniqueness
      const existingUser = await User.findOne({ 
        phoneNumber: body.phoneNumber.trim(),
      }).select("_id").lean();
      
      if (existingUser) {
        errors.phoneNumber = "Phone number already exists";
      }
    }

    // // sport
    // if (!body.sport || typeof body.sport !== "string" || body.sport.trim().length === 0) {
    //   errors.sport = "Sport is required";
    // } else if (body.sport.trim().length > 255) {
    //   errors.sport = "Sport must not exceed 255 characters";
    // }

    // introduction
    // if (!body.introduction || typeof body.introduction !== "string" || body.introduction.trim().length === 0) {
    //   errors.introduction = "Introduction is required";
    // } else if (body.introduction.trim().length < 100) {
    //   errors.introduction = "Introduction must be at least 100 characters";
    // } else if (body.introduction.trim().length > 5000) {
    //   errors.introduction = "Introduction must not exceed 5000 characters";
    // }

    // // training_experience
    // if (!body.training_experience || typeof body.training_experience !== "string" || body.training_experience.trim().length === 0) {
    //   errors.training_experience = "Training experience is required";
    // } else if (body.training_experience.trim().length < 100) {
    //   errors.training_experience = "Training experience must be at least 100 characters";
    // } else if (body.training_experience.trim().length > 5000) {
    //   errors.training_experience = "Training experience must not exceed 5000 characters";
    // }

    // motivation
    // if (!body.motivation || typeof body.motivation !== "string" || body.motivation.trim().length === 0) {
    //   errors.motivation = "Motivation is required";
    // } else if (body.motivation.trim().length < 50) {
    //   errors.motivation = "Motivation must be at least 50 characters";
    // } else if (body.motivation.trim().length > 1000) {
    //   errors.motivation = "Motivation must not exceed 1000 characters";
    // }

    // headline
    // if (!body.headline || typeof body.headline !== "string" || body.headline.trim().length === 0) {
    //   errors.headline = "Headline is required";
    // } else if (body.headline.trim().length > 255) {
    //   errors.headline = "Headline must not exceed 255 characters";
    // }

    // profileImage (file upload)
    // if (!files.profileImage || !files.profileImage[0]) {
    //   errors.profileImage = "Profile image is required";
    // }

    // video_url (optional)
    // if (body.video_url && body.video_url.trim().length > 0) {
    //   const urlPattern = /^https?:\/\/.+/i;
    //   if (!urlPattern.test(body.video_url.trim())) {
    //     errors.video_url = "Video URL must be a valid URL";
    //   } else if (body.video_url.trim().length > 1000) {
    //     errors.video_url = "Video URL must not exceed 1000 characters";
    //   }
    // }

    // monthly_price_egp
    if (!body.monthlyPriceEgp) {
      errors.monthlyPriceEgp = "Monthly price is required";
    } else {
      const price = parseFloat(body.monthlyPriceEgp);
      if (isNaN(price) || price < 0) {
        errors.monthlyPriceEgp = "Monthly price must be a positive number";
      }
    }

    // instapay_link
    if (!body.instapayLink || typeof body.instapayLink !== "string" || body.instapayLink.trim().length === 0) {
      errors.instapayLink = "Instapay link is required";
    } else {
      // const urlPattern = /^https?:\/\/.+/i;
       const urlPattern = /^https:\/\/ipn\.eg\/S\/[a-zA-Z0-9_-]+\/instapay\/[a-zA-Z0-9_-]+$/;
      if (!urlPattern.test(body.instapayLink.trim())) {
        errors.instapayLink = "Instapay link must be a valid URL";
      } else if (body.instapayLink.trim().length > 1000) {
        errors.instapayLink = "Instapay link must not exceed 1000 characters";
      }
    }

    // certificates (optional array)
    // if (body.certificates) {
    //   try {
    //     const certs = typeof body.certificates === "string" 
    //       ? JSON.parse(body.certificates) 
    //       : body.certificates;
        
    //     if (Array.isArray(certs)) {
    //       certs.forEach((cert, index) => {
    //         if (!cert.name || typeof cert.name !== "string" || cert.name.trim().length === 0) {
    //           errors[`certificates[${index}].name`] = "Certificate name is required";
    //         }
    //         if (!cert.year) {
    //           errors[`certificates[${index}].year`] = "Year is required";
    //         } else {
    //           const year = parseInt(cert.year);
    //           const currentYear = new Date().getFullYear();
    //           if (isNaN(year) || year < 1900 || year > currentYear + 1) {
    //             errors[`certificates[${index}].year`] = `Year must be between 1900 and ${currentYear + 1}`;
    //           }
    //         }
    //       });
    //       req.body.certificates = certs;
    //     }
    //   } catch (e) {
    //     errors.certificates = "Invalid certificates format";
    //   }
    // }

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