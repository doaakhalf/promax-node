
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Certificate from "../Models/Certificate.js";
import CoachResource from "../config/Resources/CoachResource.js";
import CoachResourceForAthelete from "../config/Resources/CoachResourceForAthelete.js";
import Subscription from "../Models/Subscription.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Athlete from "../Models/Athlete.js";

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
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // Find the workout calendar for current month
  const calendar = await WorkoutCalendar.findOne({
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
    const weekStart = new Date(week.startDate);
    const weekEnd = new Date(week.endDate);
    return now >= weekStart && now <= weekEnd;
  });
  
  // Find next open week (isOpen = true and after current week)
  const nextOpenWeek = calendar.weeks.find(week => {
    const weekStart = new Date(week.startDate);
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
      startDate: currentWeek.startDate,
      endDate: currentWeek.endDate,
      isOpen: currentWeek.isOpen,
      totalDays: currentWeek.trainingDays.length,
      assignedDays: currentWeek.trainingDays.filter(d => d.isAssigned).length,
      unassignedDays: currentWeekUnassignedDays,
      hasUnassignedDays: currentWeekNeedsAssignment
    } : null,
    nextOpenWeek: nextOpenWeek ? {
      weekNumber: nextOpenWeek.weekNumber,
      startDate: nextOpenWeek.startDate,
      endDate: nextOpenWeek.endDate,
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
 
    // const matchStage = { type: "gym" };
    
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
                certificateName : 1,
                year: 1,
                certificateImage: 1
              }
            }
          ]
        }
      },
      ...(status ? [{ $match: { "userId.status": status } }] : [])
    ]);
    // const coaches = await Coach.find({ type: "gym"}).populate("userId").lean();

    res.status(200).json({
      "status": "success",
      "message": "Retrieved Data successfully.",
      coaches: CoachResource.collection(coaches,{},req.userId)
    });
  } catch (err) {
    next(err);
  }
};

export const getCoachesWithSubscription = async (req, res, next) => {
  
  try {
   const status = req.query?.status || 'active';
  
    // const matchStage = { type: "gym" };

    
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
                certificateName : 1,
                year: 1,
                certificateImage: 1
              }
            }
          ]
        }
      },
      
    
      ...(status ? [{ $match: { "userId.status": status } }] : [])
    ]);

 
  
    res.status(200).json({
      "status": "success",
      "message": "Retrieved Data successfully.",
      coaches: CoachResourceForAthelete.collection(coaches, {}, req.userId)
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
      select: 'firstName lastName email phoneNumber profileImage'
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
          gender: athleteData?.gender || null,
          weight: athleteData?.weight ? parseFloat(athleteData.weight.$numberDecimal ?? athleteData.weight) : null,
          height: athleteData?.height ? parseFloat(athleteData.height.$numberDecimal ?? athleteData.height) : null,
          trainingFrequency: athleteData?.trainingFrequency || null,
          inbodyFile: athleteData?.inbodyFile || null,
          dateOfBirth: athleteData?.dateOfBirth || null
        },
        subscription: {
          plan: sub.subscriptionPlan,
          amount: parseFloat(sub.amount.$numberDecimal ?? sub.amount),
          currency: sub.currency,
          startDate: sub.startDate,
          endDate: sub.endDate,
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
    
    const coach = await Coach.findOne({userId: coachId}).populate('userId');
    if (!coach) {
      return res.status(404).json({
        status: "error",
        message: "Coach not found"
      });
    }
    res.status(200).json({
      status: "success",
      message: "Retrieved coach successfully",
      data: new CoachResource(coach)
    });
  } catch (err) {
    next(err);
  }
};
