
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Certificate from "../Models/Certificate.js";
import CoachResource from "../config/Resources/CoachResource.js";
import CoachResourceForAthelete from "../config/Resources/CoachResourceForAthelete.js";
import Subscription from "../Models/Subscription.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Athlete from "../Models/Athlete.js";
import Achievement from "../Models/Achievement.js";
import Conversation from "../Models/Conversation.js";
import { updateOpenWeeks } from "./WorkoutCalendarController.js";
import { fetchAthleteCalendarData } from "./WorkoutCalendarController.js";
import { resetTime } from "../utils/resetTime.js";
 import sanitizeHtml from "sanitize-html";


/**
 * Helper function to check workout assignment status using WorkoutCalendar
 * @param {ObjectId} athleteId - The athlete's user ID
 * @param {ObjectId} coachId - The coach's user ID
 * @param {ObjectId} subscriptionId - The subscription ID
 * @param {Date} subscriptionStart - Subscription start date
 * @param {Date} subscriptionEnd - Subscription end date
 * @returns {Object} - Contains current week info and flags for needed assignments
 */
const checkWorkoutAssignmentStatus = async (athleteId, coachId, subscriptionId, subscriptionStart, subscriptionEnd) => {
  const now = resetTime(new Date());
  const currentMonth = subscriptionStart.getMonth() + 1;
  const currentYear = subscriptionStart.getFullYear();
  const data=await fetchAthleteCalendarData(coachId, athleteId);

  // Find the workout calendar for current month
  let calendar = await WorkoutCalendar.findOne({
    athleteId: athleteId,
    coachId: coachId,
    subscriptionId: subscriptionId,
    month: currentMonth,
    year: currentYear,
    status: "active"
  }).lean();
 
  
  if (!calendar) {
    return {
      hasCalendar: false,
      currentWeek: null,
      nextOpenWeek: null,
      needsAssignment: {
        currentWeek: true,
        nextWeek: true
      }
    };
  }
  
  
  // Find current week based on today's date
  const currentWeek = calendar.weeks.find(week => {
    const weekStart = resetTime(new Date(week.startDate));
    const weekEnd = resetTime(new Date(week.endDate));
    return now >= weekStart && now <= weekEnd;
  });
  
  // Find next open week (isOpen = true and after current week)
  const nextOpenWeek = calendar.weeks.find(week => {
    const weekStart = resetTime(new Date(week.startDate));
    const daysUntilStart = Math.ceil((weekStart - now) / (1000 * 60 * 60 * 24));
    // Include week if:
    // 1. Already open (isOpen = true)
    // 2. OR will open within 2 days (starts in future but within 2 days)
    return (week.isOpen || daysUntilStart <= 2) && weekStart > now;
  });
  
  // Check current week for unassigned days
  let currentWeekUnassignedDays = [];
  let currentWeekNeedsAssignment = false;
  
  if (currentWeek) {
    currentWeekUnassignedDays = currentWeek.trainingDays
      .filter(day => !day.isAssigned)
      .map(day => day.dayNumber);
    currentWeekNeedsAssignment = currentWeekUnassignedDays.length > 0;
  }
  
  // Check next open week for unassigned days
  let nextWeekUnassignedDays = [];
  let nextWeekNeedsAssignment = true;
  
  if (nextOpenWeek) {
    nextWeekUnassignedDays = nextOpenWeek.trainingDays
      .filter(day => !day.isAssigned)
      .map(day => day.dayNumber);
    nextWeekNeedsAssignment = nextWeekUnassignedDays.length > 0;
  } else {
    nextWeekNeedsAssignment = false;
  }
  
  
  return {
    hasCalendar: true,
    currentWeek: currentWeek ? {
      weekNumber: currentWeek.weekNumber,
      startDate: resetTime(currentWeek.startDate),
      endDate: resetTime(currentWeek.endDate),
      isOpen: currentWeek.isOpen,
      totalDays: currentWeek.trainingDays.length,
      assignedDays: currentWeek.trainingDays.filter(d => d.isAssigned).length,
      unassignedDays: currentWeekUnassignedDays,
      hasUnassignedDays: currentWeekNeedsAssignment
    } : null,
    nextOpenWeek: nextOpenWeek ? {
      weekNumber: nextOpenWeek.weekNumber,
      startDate: resetTime(nextOpenWeek.startDate),
      endDate: resetTime(nextOpenWeek.endDate),
      isOpen: nextOpenWeek.isOpen,
      totalDays: nextOpenWeek.trainingDays.length,
      assignedDays: nextOpenWeek.trainingDays.filter(d => d.isAssigned).length,
      unassignedDays: nextWeekUnassignedDays,
      hasUnassignedDays: nextWeekNeedsAssignment
    } : null,
    needsAssignment: {
      currentWeek: currentWeekNeedsAssignment,
      nextWeek: nextWeekNeedsAssignment
    }
  };
};

export const getCoaches = async (req, res, next) => {
  try {
    
    
   const status = req.query?.status || null;
    const page = parseInt(req.query.page) || 1;
   const limit = 10;
   const skip = (page - 1) * limit;

   // Filter parameters
   const gender = req.query?.gender;
   const minPrice = req.query?.minPrice ? parseFloat(req.query.minPrice) : null;
   const maxPrice = req.query?.maxPrice ? parseFloat(req.query.maxPrice) : null;
   const minYearsOfExperience = req.query?.minYearsOfExperience ? parseInt(req.query.minYearsOfExperience) : null;
   const maxYearsOfExperience = req.query?.maxYearsOfExperience ? parseInt(req.query.maxYearsOfExperience) : null;
 
    // const matchStage = { type: "gym" };

    // Build match conditions
    const matchConditions = {};
    if (status) matchConditions["userId.status"] = status;
    if (gender) matchConditions["userId.gender"] = gender.toLowerCase();
    
    const coaches = await Coach.aggregate([
      // { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
      
      { $unwind: "$userId" },
      {
         $lookup: {
          from: "certificates",
          localField: "userId._id",
          foreignField: "userId",
          as: "certificates",
           pipeline: [
            {
              $project: {
                _id: 1,
                name: "$certificateName",
                year: 1,
                image: "$certificateImage"
              }
            }
          ]
        }
      },
      {
         $lookup: {
          from: "achievements",
          localField: "userId._id",
          foreignField: "userId",
          as: "achievements",
           pipeline: [
            {
              $project: {
                _id: 1,
                name : 1,
                rank: 1,
                image: 1
              }
            }
          ]
        }
      },
      
      // Apply filters
      ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),
      
      // Filter by price range
      ...(minPrice !== null || maxPrice !== null ? [{
        $match: {
          $expr: {
            $and: [
              ...(minPrice !== null ? [{
                $gte: [
                  { $toDouble: { $ifNull: ["$monthlyPriceEgp", 0] } },
                  minPrice
                ]
              }] : []),
              ...(maxPrice !== null ? [{
                $lte: [
                  { $toDouble: { $ifNull: ["$monthlyPriceEgp", 0] } },
                  maxPrice
                ]
              }] : [])
            ]
          }
        }
      }] : []),
      
      // Filter by years of experience range
      ...(minYearsOfExperience !== null || maxYearsOfExperience !== null ? [{
        $match: {
          $and: [
            ...(minYearsOfExperience !== null ? [{ yearOfExperience: { $gte: minYearsOfExperience } }] : []),
            ...(maxYearsOfExperience !== null ? [{ yearOfExperience: { $lte: maxYearsOfExperience } }] : [])
          ]
        }
      }] : []),
      
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ]);

    const total = coaches[0]?.metadata[0]?.total || 0;
    const coachesData = coaches[0]?.data || [];
    const totalPages = Math.ceil(total / limit);
    // const coaches = await Coach.find({ type: "gym"}).populate("userId").lean();

    res.status(200).json({
      "status": "success",
      "message": "Retrieved Data successfully.",
      coaches: CoachResource.collection(coachesData,{},req.userId),
     pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCoaches: total,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getCoachesWithSubscription = async (req, res, next) => {
  
  try {
    
   const status = req.query?.status || 'active';
   const editMode = req.query.edit=="true"?true:false;
   const page = parseInt(req.query.page) || 1;
   const limit = 10;
   const skip = (page - 1) * limit;

   // Filter parameters
   const gender = req.query?.gender;
   const minPrice = req.query?.minPrice ? parseFloat(req.query.minPrice) : null;
   const maxPrice = req.query?.maxPrice ? parseFloat(req.query.maxPrice) : null;
   const minYearsOfExperience = req.query?.minYearsOfExperience ? parseInt(req.query.minYearsOfExperience) : null;
   const maxYearsOfExperience = req.query?.maxYearsOfExperience ? parseInt(req.query.maxYearsOfExperience) : null;

  
    // const matchStage = { type: "gym" };

    // Build match conditions
    const matchConditions = {};
    if (status) matchConditions["userId.status"] = status;
    if (gender) matchConditions["userId.gender"] = gender.toLowerCase();
    
    const coaches = await Coach.aggregate([
      // { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
       { $unwind: "$userId" },
      {
        $lookup: {
          from: "subscriptions",
          localField: "userId._id",
          foreignField: "coachId",
          as: "subscriptions"
        }
      },
       {
         $lookup: {
          from: "certificates",
          localField: "userId._id",
          foreignField: "userId",
          as: "certificates",
          pipeline: [
            {
              $project: {
                _id: 1,
                name: "$certificateName",
                year: 1,
                image: "$certificateImage"
              }
            }
          ]
        }
      },
      {
         $lookup: {
          from: "achievements",
          localField: "userId._id",
          foreignField: "userId",
          as: "achievements",
          pipeline: [
            {
              $project: {
                _id: 1,
                name : 1,
                rank: 1,
                image: 1
              }
            }
          ]
        }
      },
    
      // Apply filters
      ...(Object.keys(matchConditions).length > 0 ? [{ $match: matchConditions }] : []),
      
      // Filter by price range
      ...(minPrice !== null || maxPrice !== null ? [{
        $match: {
          $expr: {
            $and: [
              ...(minPrice !== null ? [{
                $gte: [
                  { $toDouble: { $ifNull: ["$monthlyPriceEgp", 0] } },
                  minPrice
                ]
              }] : []),
              ...(maxPrice !== null ? [{
                $lte: [
                  { $toDouble: { $ifNull: ["$monthlyPriceEgp", 0] } },
                  maxPrice
                ]
              }] : [])
            ]
          }
        }
      }] : []),
      
      // Filter by years of experience range
      ...(minYearsOfExperience !== null || maxYearsOfExperience !== null ? [{
        $match: {
          $and: [
            ...(minYearsOfExperience !== null ? [{ yearOfExperience: { $gte: minYearsOfExperience } }] : []),
            ...(maxYearsOfExperience !== null ? [{ yearOfExperience: { $lte: maxYearsOfExperience } }] : [])
          ]
        }
      }] : []),
      
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ]);

    const total = coaches[0]?.metadata[0]?.total || 0;
    const coachesData = coaches[0]?.data || [];
    const totalPages = Math.ceil(total / limit);

    // Enrich with conversationExists/conversationId for the authenticated athlete
    const coachUserIds = coachesData.map((c) => c.userId?._id).filter(Boolean);
    const existingConversations = await Conversation.find({
      athleteId: req.userId,
      coachId: { $in: coachUserIds }
    })
      .select("coachId")
      .lean();
    const conversationMap = new Map(
      existingConversations.map((c) => [c.coachId.toString(), c._id.toString()])
    );

    res.status(200).json({
      "status": "success",
      "message": "Retrieved Data successfully.",
      coaches: CoachResourceForAthelete.collection(coachesData, {}, req.userId, editMode, conversationMap),
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCoaches: total,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    next(err);
  }
};



export const activateCoach = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coach = await Coach.findOne({ userId: id }).populate("userId");
    if (!coach) {
      return res.status(404).json({
        message: "Coach not found",
      });
    }
    coach.userId.status = "active";
    await coach.userId.save();
    res.status(200).json({
      message: "Coach activated successfully",
    });
  } catch (err) {
    next(err);
  }
}


export const getCoachAthletes = async (req, res, next) => {
  try {
    const coachUserId = req.userId;

    // Find active subscriptions for this coach
    const subscriptions = await Subscription.find({
      coachId: coachUserId,
      status: "active"
    })
    .populate({
      path: 'athleteId',
      select: 'firstName lastName email phoneNumber profileImage gender'
    })
    .lean();

    // Get athlete IDs to fetch Athlete model data
    const athleteUserIds = subscriptions.map(sub => sub.athleteId._id);
    
    // Fetch Athlete records for these users
    const athleteRecords = await Athlete.find({
      userId: { $in: athleteUserIds }
    }).lean();
    
    // Create a map for quick lookup: userId -> athleteData
    const athleteDataMap = new Map();
    athleteRecords.forEach(athlete => {

      athleteDataMap.set(athlete.userId.toString(), athlete);
    });

    // Format the response
    const athletes = await Promise.all(subscriptions.map(async (sub) => {
      const athleteData = athleteDataMap.get(sub.athleteId._id.toString());
      
      // Get workout assignment status using calendar and subscription dates
      const workoutStatus = await checkWorkoutAssignmentStatus(
        sub.athleteId._id,
        coachUserId,
        sub._id,
        sub.startDate,
        sub.endDate
      );
      
      return {
        subscriptionId: sub._id,
        athlete: {
          id: sub.athleteId._id,
          name: `${sub.athleteId.firstName} ${sub.athleteId.lastName || ''}`.trim(),
          email: sub.athleteId.email,
          phoneNumber: sub.athleteId.phoneNumber,
          profileImage: sub.athleteId.profileImage,
          gender: sub.athleteId.gender|| null,
          weight: athleteData?.weight ? parseFloat(athleteData.weight.$numberDecimal ?? athleteData.weight) : null,
          height: athleteData?.height ? parseFloat(athleteData.height.$numberDecimal ?? athleteData.height) : null,
          trainingFrequency: athleteData?.trainingFrequency || null,
          inbodyFile: athleteData?.inbodyFile || null,
          dateOfBirth: athleteData?.dateOfBirth ? new Date(athleteData.dateOfBirth).toISOString().split('T')[0] : null,
          goals: athleteData?.goals || null,
          injuries: athleteData?.injuries || null
        },
        subscription: {
          plan: sub.subscriptionPlan,
          amount: parseFloat(sub.amount.$numberDecimal ?? sub.amount),
          currency: sub.currency,
          startDate: resetTime(sub.startDate),
          endDate: resetTime(sub.endDate),
          paymentStatus: sub.paymentStatus
        },
        workoutCalendar: workoutStatus
      };
    }));

    res.status(200).json({
      status: "success",
      message: "Retrieved athletes successfully",
      count: athletes.length,
      data: athletes
    });

  } catch (err) {
    console.error('Get coach athletes error:', err);
    next(err);
  }
};
export const getCoachProfile=async (req, res, next) => {
  try {

    
    const coachId = req.params.id??req.userId;
    const editMode=req.query.edit==="true"?true:false;
  
    
    const coach = await Coach.findOne({userId: coachId}).populate('userId')


    
    if (!coach) {
      return res.status(404).json({
        status: "error",
        message: "Coach not found"
      });
    }

     // Fetch certificates and achievements using the coach's userId
    const certificates = await Certificate.find({userId: coach.userId._id}).lean();
    const achievements = await Achievement.find({userId: coach.userId._id}).lean();
    
    // Map certificate fields to match API naming convention
    const mappedCertificates = certificates.map(cert => ({
      _id: cert._id,
      name: cert.certificateName,
      year: cert.year,
      image: cert.certificateImage
    }));
    
    // Achievements already have correct field names (name, image)
    const mappedAchievements = achievements.map(ach => ({
      _id: ach._id,
      name: ach.name,
      rank: ach.rank,
      image: ach.image
    }));
    
    // Add them to the coach object
    coach.certificates = mappedCertificates;
    coach.achievements = mappedAchievements;
    
    res.status(200).json({
      status: "success",
      message: "Retrieved coach successfully",
      data: new CoachResource(coach,{},editMode)
    });
  } catch (err) {
    next(err);
  }
};
export const addNutritionFile = async (req, res, next) => {
  try {
    const subscriptionId=req.params.subscriptionId;
    let subscriptionRecord=await Subscription.findById(subscriptionId);
    if(!subscriptionRecord || subscriptionRecord.status !== "active"){
      return res.status(404).json({
        status: "error",
        message: "Subscription not found or not active"
      });
    }
    let nutritionPath=subscriptionRecord.nutritionFile?subscriptionRecord.nutritionFile:null;
    let nutritionText=subscriptionRecord.nutritionText?subscriptionRecord.nutritionText:null;
   if(req.file){
     nutritionPath=`/images/${req.uploadFolder}/${req.file.filename}`
   }
   const cleanNutritionText = req.body.nutritionText?sanitizeHtml(req.body.nutritionText):nutritionText;
 
    await Subscription.findByIdAndUpdate(subscriptionId, { nutritionFile: nutritionPath ,nutritionText:cleanNutritionText});
    
  } catch (err) {
    next(err);
  }
  return res.status(200).json({
    status: "success",
    message: "Nutrition file added successfully"
  });
};

export const getNutrition = async (req, res, next) => {
  try {
    const subscriptionId=req.params.subscriptionId;
    const subscription = await Subscription.findById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        status: "error",
        message: "Subscription not found"
      });
    }
    
    res.status(200).json({
      status: "success",
      message: "Retrieved nutrition successfully",
      data: {
        nutritionFile: subscription.nutritionFile,
        nutritionText: subscription.nutritionText
      }
    });
  } catch (err) {
    next(err);
  }
};

