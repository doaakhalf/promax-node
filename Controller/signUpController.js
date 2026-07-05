import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Athlete from "../Models/Athlete.js";
import { generateTokenPair } from "../utils/jwt.js";
import CoachResource from "../config/Resources/CoachResource.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Certificate from "../Models/Certificate.js";
import Achievement from "../Models/Achievement.js";

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
      yearOfExperience,
      videoUrl,
      certificates,
      weight,
      height,
      gender,
      trainingFrequency,
      inbodyFile,
      dateOfBirth,
      achievements,
      goals,
      injuries
    } = req.body;

    const role = req.role;
    
    if (!role?._id) {
      return res.status(500).json({ 
        message: "Server error", 
        error: "Role missing from request context" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
     const normalizedGender = gender?.toLowerCase();
            
    // Create user document
    const user = new User({
      email,
      password: hashedPassword,
      role_id: role._id,
      status: user_type === "coach" ? "pending" : "active",
      firstName,
      lastName,
      phoneNumber,
      gender: normalizedGender,
      profileImage:'images/users/' + req.files?.profileImage?.[0]?.filename || null,
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
        yearOfExperience,
        videoUrl,
       
        
      });
      
      const coachData = await coach.save();
      await coachData.populate('userId');
      
      
// Handle certificates
      // certificates is a JSON string: [{"name":"...", "year":"...", "image":"."}]
      // req.files.certificates contains the actual uploaded files
      if (certificates) {
        let parsedCertificates;
        try {
          parsedCertificates = typeof certificates === 'string' 
            ? JSON.parse(certificates) 
            : (Array.isArray(certificates) ? certificates : []);
        } catch (e) {
          console.error('Failed to parse certificates:', e);
          parsedCertificates = [];
        }
        
        const certificateFiles = req.files?.certificates || [];
        
        if (parsedCertificates.length > 0 && certificateFiles.length > 0) {
          const certificatePromises = parsedCertificates.map((cert, index) => {
            // Match certificate metadata with uploaded file by index
            const uploadedFile = certificateFiles[index];
            
            if (!uploadedFile?.filename) {
              console.warn(`Certificate file missing for ${cert.name} at index ${index}`);
              return null;
            }
            
            return Certificate.create({
              userId: createdUser._id,
              certificateName: cert.name,
              year: parseInt(cert.year),
              certificateImage: `images/users/${uploadedFile.filename}`
            });
          });
          
          await Promise.all(certificatePromises.filter(p => p !== null));
        }
      }
      
      
      // Handle achievements
      if (achievements) {
        let parsedAchievements;
        try {
          parsedAchievements = typeof achievements === 'string' 
            ? JSON.parse(achievements) 
            : (Array.isArray(achievements) ? achievements : []);
        } catch (e) {
          console.error('Failed to parse achievements:', e);
          parsedAchievements = [];
        }
        
        const achievementFiles = req.files?.achievements || [];
        
        if (parsedAchievements.length > 0 && achievementFiles.length > 0) {
          const achievementPromises = parsedAchievements.map((ach, index) => {
            // Match achievement metadata with uploaded file by index
            const uploadedFile = achievementFiles[index];
            
            if (!uploadedFile?.filename) {
              console.warn(`Achievement file missing for ${ach.name} at index ${index}`);
              return null;
            }
            
            return Achievement.create({
              userId: createdUser._id,
              name: ach.name,
              rank: parseInt(ach.rank),
              image: `images/users/${uploadedFile.filename}`
            });
          });
          
          await Promise.all(achievementPromises.filter(p => p !== null));
        }
      }
      
      
      // Generate JWT token
      // const token = generateToken({ userId: createdUser._id, email: createdUser.email });
      const tokens = generateTokenPair({ 
        userId: createdUser._id, 
        email: createdUser.email 
      });
      return res.status(201).json({ 
        message: "Coach registered successfully. Awaiting admin approval.", 
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        token_type: "Bearer",
        userData: {
          status: coachData.userId.status,
          role: role.name
        }
      });
      
    } else {
     
      
      // Create athlete profile
      const athlete = new Athlete({
        userId: createdUser._id,
        height,
        weight,
        dateOfBirth: new Date(dateOfBirth),
        trainingFrequency,
        inbodyFile: req.files?.inbodyFile?.[0]?.filename 
          ? `images/athletes/${req.files.inbodyFile[0].filename}` 
          : null,
        goals,
        injuries
      });
      
      const athleteData = await athlete.save();
      await athleteData.populate('userId');
      
      // Generate JWT token
      // const token = generateToken({ userId: createdUser._id, email: createdUser.email });
      const tokens = generateTokenPair({ 
        userId: createdUser._id, 
        email: createdUser.email 
      });
      return res.status(201).json({ 
        message: "Athlete registered successfully", 
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
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