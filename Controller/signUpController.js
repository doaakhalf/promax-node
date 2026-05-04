import bcrypt from "bcrypt";
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Athlete from "../Models/Athlete.js";
import { generateToken } from "../utils/jwt.js";
import CoachResource from "../config/Resources/CoachResource.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import mongoose from "mongoose";


export default async function signUpController(req, res) {

  try {
     const { 
          email,
          password, 
          user_type,
          firstName, 
          lastName, 
          phoneNumber,
           type ,
              headline,
              instapayLink,
              introduction ,
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
      return res.status(500).json({ message: "Server error", error: "Role missing from request context" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    

    const user = new User({
      email,
      password: hashedPassword,
      role_id: role._id,
      status: user_type === "coach" ? "pending" : "active",
      firstName,
      lastName,
      phoneNumber,
      profileImage:'public/images/users/' + req.files?.profileImage?.[0]?.filename || null,
    });
 
    try {
      const data = await user.save();
      
      if(user_type === "coach") {
        const coach = new Coach({
          userId: new mongoose.Types.ObjectId(data._id),
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

      await coachData.populate('userId')
     // Generate JWT token
      const token = generateToken({ userId: data._id, email: data.email });

      return res.json({ 
        message: "User created successfully", 
        token ,
        token_type: "Bearer",
        userData: new CoachResource(coachData)
      });
    }
    else {
      // Generate JWT token
      const token = generateToken({ userId: data._id, email: data.email });
      const AthleteData = new Athlete({
        userId: new mongoose.Types.ObjectId(data._id),
        height,
        weight,
        dateOfBirth,
        gender,
        trainingFrequency,
        inbodyFile
      });
      
      const athleteData = await AthleteData.save();
      await athleteData.populate('userId')

      return res.json({ 
        message: "User created successfully", 
        token ,
        token_type: "Bearer",
        userData: new AthleteResource(athleteData)
      });
    }
   
     
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(422).json({
        message: "Validation error",
        errors: { message: err.message },
      });
    }
    console.error(err);
    
   
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  } 
  }catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err?.message || err });
  }
  }
