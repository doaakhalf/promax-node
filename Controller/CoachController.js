
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
    return week.isOpen && weekStart > now;
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
  let nextWeekNeedsAssignment = false;
  
  if (nextOpenWeek) {
    nextWeekUnassignedDays = nextOpenWeek.trainingDays
      .filter(day => !day.isAssigned)
      .map(day => day.dayNumber);
    nextWeekNeedsAssignment = nextWeekUnassignedDays.length > 0;
  } else {
    nextWeekNeedsAssignment = true;
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
          from: "subscriptions",
          localField: "userId._id",
          foreignField: "coachId",
          as: "subscriptions"
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

export async function completeCoachProfile(req, res) {
  try {
    
    
    const user = req.user;
    const body = req.body;
    const files = req.files || {};

   

    // Handle photo upload
    let photoUrl = null;
    if (files.photo && files.photo[0]) {
      const photoFile = files.photo[0];
      photoUrl = `/images/${req.uploadFolder}/${photoFile.filename}`;
    }

    // Update user basic info
    await User.findByIdAndUpdate(user._id, {
      firstName: body.first_name.trim(),
      lastName: body.last_name.trim(),
      phoneNumber: body.phone_number.trim(),
      status: "pending",
    });

    // Parse best_record if provided
    let bestRecord = null;
    if (body.best_record) {
      try {
        bestRecord = typeof body.best_record === "string" 
          ? JSON.parse(body.best_record) 
          : body.best_record;
      } catch (e) {
        bestRecord = body.best_record;
      }
    }

    // Update or create coach profile
    const coach = await Coach.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        type: body.type,
        sport: body.sport.trim(),
        bestRecord: bestRecord,
        introduction: body.introduction?.trim() || null,
        trainingExperience: body.training_experience.trim(),
        motivation: body.motivation.trim(),
        headline: body.headline.trim(),
        photo: photoUrl,
        videoUrl: body.video_url?.trim() || null,
        monthlyPriceEgp: parseFloat(body.monthly_price_egp),
        instapayLink: body.instapay_link.trim(),
        
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Handle certifications if provided
    if (body.certifications && Array.isArray(body.certifications)) {
      // Delete existing certificates to avoid duplicates
      await Certificate.deleteMany({ userId: user._id });

      // Create new certificates
      const certificateDocs = body.certifications.map((cert) => ({
        userId: user._id,
        certificateName: cert.certificate_name.trim(),
        year: parseInt(cert.year),
        certificateImage: cert.certificate_image || "",
      }));

      if (certificateDocs.length > 0) {
        await Certificate.insertMany(certificateDocs);
      }
    }

    // Fetch updated user with populated data
    const updatedUser = await User.findById(user._id)
      .populate("role_id")
      .lean();

    const coachProfile = await Coach.findOne({ userId: user._id }).lean();
    const certificates = await Certificate.find({ userId: user._id }).lean();

    return res.json({
      message: "Coach profile completed successfully",
      user: {
        ...updatedUser,
        coachProfile: {
          ...coachProfile,
          certificates,
        },
      },
      profile_complete: true,
      coach_type: coachType,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to complete coach profile",
      error: err?.message || err,
    });
  }
}

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
