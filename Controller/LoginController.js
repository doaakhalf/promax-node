

import User from "../Models/User.js";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcrypt";
import Role from "../Models/Role.js";
import Coach from "../Models/Coach.js";
import CoachResource from "../config/Resources/CoachResource.js";
import Athlete from "../Models/Athlete.js";
import AthleteResource from "../config/Resources/AthleteResource.js";


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
            const coach = await Coach.findOne({ userId: user._id.toString() }).populate('userId').lean();
            


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
export async function EditCoachProfile(req, res) {
    try {
        const body = req.body;
        const user_type=req.user.role_id.name;
        const userUpdate= {}
        if (body.firstName) userUpdate.firstName = body.firstName;
        if (body.lastName) userUpdate.lastName = body.lastName;
        if (body.email) userUpdate.email = body.email;
        if (body.phoneNumber) userUpdate.phoneNumber = body.phoneNumber;
        if (req.files?.profileImage?.[0]) {
            userUpdate.profileImage = `/images/users/${req.files.profileImage[0].filename}`;
        }
        //update user
        await User.findByIdAndUpdate(req.user._id, userUpdate);
        //update coach
        if(user_type === "coach") {
            const coachUpdate = {};
            if (body.headline) coachUpdate.headline = body.headline;
            if (body.instapayLink) coachUpdate.instapayLink = body.instapayLink;
            if (body.introduction) coachUpdate.introduction = body.introduction;
            if (body.monthlyPriceEgp) coachUpdate.monthlyPriceEgp = body.monthlyPriceEgp;
            if (body.motivation) coachUpdate.motivation = body.motivation;
            if (body.sport) coachUpdate.sport = body.sport;
            if (body.trainingExperience) coachUpdate.trainingExperience = body.trainingExperience;
            if (body.videoUrl) coachUpdate.videoUrl = body.videoUrl;
            if (body.bestRecord) coachUpdate.bestRecord = body.bestRecord;
            if (body.certificates) coachUpdate.certificates = body.certificates;
            

 
            await Coach.findOneAndUpdate({ userId: req.user._id }, coachUpdate);
        }
       

        return res.status(200).json({ 
            message: "Profile updated successfully",
           
        });
        
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error?.message || error });
    }
}
export async function EditAthleteProfile(req, res) {
    try {
        const body = req.body;
        const user_type=req.user.role_id.name;
        const userUpdate= {}
        if (body.firstName) userUpdate.firstName = body.firstName;
        if (body.lastName) userUpdate.lastName = body.lastName;
        if (body.email) userUpdate.email = body.email;
        if (body.phoneNumber) userUpdate.phoneNumber = body.phoneNumber;
        if (req.files?.profileImage?.[0]) {
            userUpdate.profileImage = `/images/users/${req.files.profileImage[0].filename}`;
        }
        //update user
        await User.findByIdAndUpdate(req.user._id, userUpdate);
        //update athlete
        if(user_type === "athlete") {
            const athleteUpdate = {};
            if (body.dateOfBirth) athleteUpdate.dateOfBirth = new Date(body.dateOfBirth); 
            if (body.gender) athleteUpdate.gender = body.gender; 
            if (body.weight) athleteUpdate.weight = body.weight; 
            if (body.height) athleteUpdate.height = body.height; 

            if (body.trainingFrequency) athleteUpdate.trainingFrequency = body.trainingFrequency; 
              if (req.files?.inbodyFile?.[0]) {
            athleteUpdate.inbodyFile = `/images/athletes/${req.files.inbodyFile[0].filename}`;
        }

           
 
            await Athlete.findOneAndUpdate({ userId: req.user._id }, athleteUpdate);
        }
       

        return res.status(200).json({ 
            message: "Profile updated successfully",
           
        });
        
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error?.message || error });
    }
}
