import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Athlete from "../Models/Athlete.js";
import { generateToken } from "../utils/jwt.js";
import CoachResource from "../config/Resources/CoachResource.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

export default async function signUpController(req, res) {
  let createdUser = null;

  try {
    const { 
      email,
      password, 
      user_type,
      firstName, 
      lastName, 
      phoneNumber,
      type,
      headline,
      instapayLink,
      introduction,
      monthlyPriceEgp,
      motivation,
      sport,
      trainingExperience,
      videoUrl,
      bestRecord,
      certificates,
      weight,
      height,
      dateOfBirth,
      gender,
      trainingFrequency,
      inbodyFile,
    } = req.body;

    const role = req.role;
    
    if (!role?._id) {
      return res.status(500).json({ 
        message: "Server error", 
        error: "Role missing from request context" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user document
    const user = new User({
      email,
      password: hashedPassword,
      role_id: role._id,
      status: user_type === "coach" ? "pending" : "active",
      firstName,
      lastName,
      phoneNumber,
      profileImage: req.files?.profileImage?.[0]?.filename 
        ? `public/images/users/${req.files.profileImage[0].filename}` 
        : null,
    });

    // Save user
    createdUser = await user.save();
    
    if (user_type === "coach") {
      // Create coach profile
      const coach = new Coach({
        userId: createdUser._id,
        type,
        headline,
        instapayLink,
        introduction,
        monthlyPriceEgp,
        motivation,
        sport,
        trainingExperience,
        videoUrl,
        bestRecord,
        certificates,
      });
      
      const coachData = await coach.save();
      await coachData.populate('userId');
      
      // Generate JWT token
      const token = generateToken({ userId: createdUser._id, email: createdUser.email });

      return res.status(201).json({ 
        message: "Coach registered successfully. Awaiting admin approval.", 
        token,
        token_type: "Bearer",
        userData: {
          status: coachData.userId.status,
          role: role.name
        }
      });
      
    } else {
      // Validate gender before creating athlete
      const validGenders = ['male', 'female', 'other'];
      const normalizedGender = gender?.toLowerCase();
      
      if (!normalizedGender || !validGenders.includes(normalizedGender)) {
        // Rollback user creation
        await User.findByIdAndDelete(createdUser._id);
        return res.status(422).json({
          message: "Validation error",
          errors: {
            gender: `Gender must be one of: ${validGenders.join(', ')}`
          }
        });
      }
      
      // Create athlete profile
      const athlete = new Athlete({
        userId: createdUser._id,
        height,
        weight,
        dateOfBirth,
        gender: normalizedGender,
        trainingFrequency,
        inbodyFile: req.files?.inbodyFile?.[0]?.filename 
          ? `public/images/athletes/${req.files.inbodyFile[0].filename}` 
          : null
      });
      
      const athleteData = await athlete.save();
      await athleteData.populate('userId');
      
      // Generate JWT token
      const token = generateToken({ userId: createdUser._id, email: createdUser.email });

      return res.status(201).json({ 
        message: "Athlete registered successfully", 
        token,
        token_type: "Bearer",
        userData: new AthleteResource(athleteData)
      });
    }
   
  } catch (err) {
    // Rollback user creation if it was created but profile creation failed
    if (createdUser) {
      try {
        await User.findByIdAndDelete(createdUser._id);
        console.log(`Rolled back user creation for ${createdUser.email}`);
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }
    
    // Handle duplicate key error (email already exists)
    if (err?.code === 11000) {
      return res.status(422).json({
        message: "Validation error",
        errors: { 
          email: "Email already exists" 
        }
      });
    }
    
    // Handle mongoose validation errors
    if (err?.name === 'ValidationError') {
      const errors = {};
      Object.keys(err.errors).forEach(key => {
        errors[key] = err.errors[key].message;
      });
      
      return res.status(422).json({
        message: "Validation error",
        errors
      });
    }
    
    console.error('SignUp error:', err);
    return res.status(500).json({ 
      message: "Server error", 
      error: err?.message || "An unexpected error occurred" 
    });
  }
}
export const getPriceWithPercentage=async(req,res)=>{
  try {
    let price=req.body.price;
    const percentage=process.env.PERCENTAGE;
    let priceWithPercentage=price+(price*percentage)/100;
    res.status(200).json({
      message:"success",
      price:priceWithPercentage
    })
    
  } catch (error) {
    return res.status(500).json({ 
      message: "Server error", 
      error: error?.message || "An unexpected error occurred" 
    });
  }
}