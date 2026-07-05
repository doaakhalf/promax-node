

import User from "../Models/User.js";
import { generateTokenPair ,verifyRefreshToken} from "../utils/jwt.js";
import bcrypt from "bcrypt";
import Role from "../Models/Role.js";
import Coach from "../Models/Coach.js";
import CoachResource from "../config/Resources/CoachResource.js";
import Athlete from "../Models/Athlete.js";
import AthleteResource from "../config/Resources/AthleteResource.js";
import Certificate from "../Models/Certificate.js";
import Achievement from "../Models/Achievement.js";
import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import { ObjectId } from "mongodb";


export default async function LoginController(req, res) {
    try {
        const { email, password } = req.body;
     
        
        
        const user = await User.findOne({ 
            email,
            deletedAt: null
        }).lean();
        
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

        // const token = generateToken({ userId: user._id.toString(), email: user.email });
        // In the login function:
        const tokens = generateTokenPair({ 
        userId: user._id, 
        email: user.email 
        });
        if(user.status === "pending"&&role?.name !== "athlete") {
            const coach = await Coach.findOne({ userId: user._id.toString() }).populate('userId').lean();
            


            return res.status(200).json({ 
                message: "Login successful",
                token: tokens.token,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn,
                token_type: "Bearer",
              
               user: new CoachResource(coach,role)
            });
        }
      
        return res.status(200).json({ 
            message: "Login successful",
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            token_type: "Bearer",
            status: "success",
          
            user:{
                    "id": user._id.toString(),
                    "name": user.firstName + " " + user.lastName.charAt(0).toUpperCase(),
                    "email": user.email,
                    "role": role?.name,
                    "profileImage": user?.profileImage || null,
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
        console.log(req.files,body.achievements,body.certificates);
        const user_type=req.user.role_id.name;
        const userUpdate= {}
        if (body.firstName) userUpdate.firstName = body.firstName;
        if (body.lastName) userUpdate.lastName = body.lastName;
        if (body.email) userUpdate.email = body.email;
        if (body.gender) userUpdate.gender = body.gender.toLowerCase();
        if (body.phoneNumber) userUpdate.phoneNumber = body.phoneNumber;
        if (req.files?.profileImage?.[0]) {
            userUpdate.profileImage = `images/users/${req.files.profileImage[0].filename}`;
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
            if (body.yearOfExperience) coachUpdate.yearOfExperience = body.yearOfExperience;
           
            await Coach.findOneAndUpdate({ userId: req.user._id }, coachUpdate);

            // Handle certificates update
            if (body.certificates) {
                let parsedCertificates;
                try {
                    parsedCertificates = typeof body.certificates === 'string' 
                        ? JSON.parse(body.certificates) 
                        : (Array.isArray(body.certificates) ? body.certificates : []);
                        console.log(parsedCertificates,typeof body.certificates);
                        
                } catch (e) {
                    console.error('Failed to parse certificates:', e);
                    parsedCertificates = [];
                }
                
                const certificateFiles = req.files?.certificates || [];
                
                // Get IDs of certificates being kept/updated
                const keptCertificateIds = parsedCertificates
                    .filter(cert => cert.id)
                    .map(cert => cert.id);
                
                console.log(keptCertificateIds,'keptCertificateIds');
             
                // Delete certificates not in the request
                await Certificate.deleteMany({
                    userId: req.userId,
                    _id: { $nin: keptCertificateIds }
                });
              
                
                // Process each certificate
                const certificatePromises = parsedCertificates.map((cert, index) => {
                    const uploadedFile = certificateFiles[index];
                    
                    if (cert.id) {
                        // Update existing certificate
                        const updateData = {
                            certificateName: cert.name,
                            year: parseInt(cert.year)
                        };
                        
                        // Only update image if new file uploaded
                        if (uploadedFile?.filename) {
                            updateData.certificateImage = `images/users/${uploadedFile.filename}`;
                        }
                        
                        return Certificate.findByIdAndUpdate(cert.id, updateData);
                    } else {
                        // Create new certificate
                        if (!uploadedFile?.filename) {
                            console.warn(`Certificate file missing for ${cert.name} at index ${index}`);
                            return null;
                        }
                        
                        return Certificate.create({
                            userId: req.user._id,
                            certificateName: cert.name,
                            year: parseInt(cert.year),
                            certificateImage: `images/users/${uploadedFile.filename}`
                        });
                    }
                });
                
                await Promise.all(certificatePromises.filter(p => p !== null));
            }

            // Handle achievements update
            if (body.achievements) {
                let parsedAchievements;
                try {
                    parsedAchievements = typeof body.achievements === 'string' 
                        ? JSON.parse(body.achievements) 
                        : (Array.isArray(body.achievements) ? body.achievements : []);
                        console.log(parsedAchievements,typeof body.achievements);

                } catch (e) {
                    console.error('Failed to parse achievements:', e);
                    parsedAchievements = [];
                }
                
                const achievementFiles = req.files?.achievements || [];
                
                // Get IDs of achievements being kept/updated
                const keptAchievementIds = parsedAchievements
                    .filter(ach => ach.id)
                    .map(ach => ach.id);
                console.log(keptAchievementIds,'keptAchievementIds');
                
        
                    // Delete achievements not in the request
                    await Achievement.deleteMany({
                        userId: req.user._id,
                        _id: { $nin: keptAchievementIds }
                    });
                
                
                // Process each achievement
                const achievementPromises = parsedAchievements.map((ach, index) => {
                    const uploadedFile = achievementFiles[index];
                    
                    if (ach.id) {
                        // Update existing achievement
                        const updateData = {
                            name: ach.name,
                            rank: parseInt(ach.rank)
                        };
                        
                        // Only update image if new file uploaded
                        if (uploadedFile?.filename) {
                            updateData.image = `images/users/${uploadedFile.filename}`;
                        }
                        
                        return Achievement.findByIdAndUpdate(ach.id, updateData);
                    } else {
                        // Create new achievement
                        if (!uploadedFile?.filename) {
                            console.warn(`Achievement file missing for ${ach.name} at index ${index}`);
                            return null;
                        }
                        
                        return Achievement.create({
                            userId: req.user._id,
                            name: ach.name,
                            rank: parseInt(ach.rank),
                            image: `images/users/${uploadedFile.filename}`
                        });
                    }
                });
                
                await Promise.all(achievementPromises.filter(p => p !== null));
            }
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
        if (body.gender) userUpdate.gender = body.gender; 
        if (req.files?.profileImage?.[0]) {
            userUpdate.profileImage = `images/users/${req.files.profileImage[0].filename}`;
        }
        //update user
        await User.findByIdAndUpdate(req.user._id, userUpdate);
        //update athlete
        if(user_type === "athlete") {
            const athleteUpdate = {};
            if (body.dateOfBirth) athleteUpdate.dateOfBirth = new Date(body.dateOfBirth); 
           
            if (body.weight) athleteUpdate.weight = body.weight; 
            if (body.height) athleteUpdate.height = body.height; 
            if(body.goals) athleteUpdate.goals = body.goals;
            if(body.injuries) athleteUpdate.injuries = body.injuries;

            if (body.trainingFrequency) athleteUpdate.trainingFrequency = body.trainingFrequency; 
              if (req.files?.inbodyFile?.[0]) {
            athleteUpdate.inbodyFile = `images/athletes/${req.files.inbodyFile[0].filename}`;
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



export async function refreshTokenController(req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        status: "error",
        message: "Refresh token is required"
      });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error.message === 'REFRESH_TOKEN_EXPIRED') {
        return res.status(401).json({
          status: "error",
          message: "Refresh token expired",
          code: "REFRESH_TOKEN_EXPIRED"
        });
      }
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token"
      });
    }
    
    // Get user from database
    const user = await User.findById(decoded.userId)
      .populate("role_id")
      .lean();
    
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found"
      });
    }
    
    // Generate new token pair
    const tokens = generateTokenPair({ 
      userId: user._id, 
      email: user.email 
    });
    
    return res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ 
      status: "error",
      message: "Server error", 
      error: error?.message || error 
    });
  }
}
  export async function deleteAccount(req, res) {
    try {
      const userId = req.userId; // From auth middleware
      const deletedAt = new Date();
      
      // Find user and get role
      const user = await User.findById(userId).populate('role_id').lean();
      
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found"
        });
      }
      
      if (user.deletedAt) {
        return res.status(400).json({
          status: "error",
          message: "Account already deleted"
        });
      }
      
      const roleName = user.role_id?.name;
      
      // Soft delete related data based on role
      if (roleName === 'coach') {
        // Soft delete coach-related data
        await Certificate.updateMany({ userId: userId }, { deletedAt });
        await Achievement.updateMany({ userId: userId }, { deletedAt });
        await Coach.updateOne({ userId: userId }, { deletedAt });
        await Subscription.updateMany({ coachId: userId }, { deletedAt });
        await WorkoutCalendar.updateMany({ coachId: userId }, { deletedAt });
      } else if (roleName === 'athlete') {
        // Soft delete athlete-related data
      
        await Athlete.updateOne({ userId: userId }, { deletedAt });
        await Subscription.updateMany({ athleteId: userId }, { deletedAt });
      }
      
      // Soft delete the user
      await User.findByIdAndUpdate(userId, { 
        deletedAt,
        status: 'deleted'
      });
      
      return res.status(200).json({
        status: "success",
        message: "Account deleted successfully"
      });
      
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(500).json({
        status: "error",
        message: "Server error",
        error: error?.message || error
      });
    }
  }

  export async function deletePending(req, res) {
    try {
     
      
      // Find user and get role
      const users = await User.find({role_id: new ObjectId('6a12fc760882ad22a09df8a3'),_id:{ $nin:  new ObjectId('6a2eafd39ab897efa197b64a') }}).lean();
      const usersids=users.map(user => user._id);

      // Get all subscriptions for these users
      const subscriptions = await Subscription.find({ 
        $or: [
          { athleteId: { $in: usersids } },
          { coachId: { $in: usersids } }
        ]
      }).lean();
      const subscriptionIds = subscriptions.map(sub => sub._id);

      // Get all workout calendars for these users
      const workoutCalendars = await WorkoutCalendar.find({
        $or: [
          { athleteId: { $in: usersids } },
          { coachId: { $in: usersids } },
          { subscriptionId: { $in: subscriptionIds } }
        ]
      }).lean();
      const calendarIds = workoutCalendars.map(cal => cal._id);

      // Delete workout assignments related to these calendars and users
      await WorkoutAssignment.deleteMany({
        $or: [
          { calendarId: { $in: calendarIds } },
          { athleteId: { $in: usersids } },
          { coachId: { $in: usersids } }
        ]
      });

      // Delete workout calendars
      await WorkoutCalendar.deleteMany({
        $or: [
          { athleteId: { $in: usersids } },
          { coachId: { $in: usersids } },
          { subscriptionId: { $in: subscriptionIds } }
        ]
      });

      // Delete subscription payments related to these subscriptions
      await SubscriptionPayment.deleteMany({ subscriptionId: { $in: subscriptionIds } });

      // Delete athletes
      await Athlete.deleteMany({ userId: { $in: usersids } });
      
      // Delete subscriptions
      await Subscription.deleteMany({ 
        $or: [
          { athleteId: { $in: usersids } },
          { coachId: { $in: usersids } }
        ]
      });
      
      // Delete users
      await User.deleteMany({ _id: { $in: usersids } });
      
      return res.status(200).json({
        status: "success",
        message: "Pending accounts deleted successfully",
        deletedCount: {
          users: usersids.length,
          subscriptions: subscriptionIds.length
        }
      });
      
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(500).json({
        status: "error",
        message: "Server error",
        error: error?.message || error
      });
    }
  }