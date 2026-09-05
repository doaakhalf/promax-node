
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
import { updateOpenWeeks, fetchAthleteCalendarData } from "./WorkoutCalendarController.js";
import WorkoutCalendarResource from "../config/Resources/WorkoutCalendarResource.js";
import { resetTime } from "../utils/resetTime.js";
import { athletePriceMongoExpr } from "../utils/coachNetAmount.js";
import { formatExpiredSubscription, formatExpiredUser } from "../utils/expiredFormatters.js";
import sanitizeHtml from "sanitize-html";
import Gallery from "../Models/Gallery.js";
import { sendCoachActivationEmail } from "../utils/email.js";
import NotificationService from "../services/NotificationService.js";



/**
 * Pure helper: build workout assignment status from an already-loaded calendar.
 * Used by list endpoints and checkWorkoutAssignmentStatus (no DB calls).
 */
const buildWorkoutAssignmentStatus = (calendar) => {
  if (!calendar) {
    return {
      hasCalendar: false,
      currentWeek: null,
      nextOpenWeek: null,
      needsAssignment: {
        currentWeek: true,
        nextWeek: true,
      },
    };
  }

  const now = resetTime(new Date());

  const currentWeek = calendar.weeks.find((week) => {
    const weekStart = resetTime(new Date(week.startDate));
    const weekEnd = resetTime(new Date(week.endDate));
    return now >= weekStart && now <= weekEnd;
  });

  const nextOpenWeek = calendar.weeks.find((week) => {
    const weekStart = resetTime(new Date(week.startDate));
    const daysUntilStart = Math.ceil((weekStart - now) / (1000 * 60 * 60 * 24));
    return (week.isOpen || daysUntilStart <= 2) && weekStart > now;
  });

  let currentWeekUnassignedDays = [];
  let currentWeekNeedsAssignment = false;

  if (currentWeek) {
    currentWeekUnassignedDays = currentWeek.trainingDays
      .filter((day) => !day.isAssigned)
      .map((day) => day.dayNumber);
    currentWeekNeedsAssignment = currentWeekUnassignedDays.length > 0;
  }

  let nextWeekUnassignedDays = [];
  let nextWeekNeedsAssignment = true;

  if (nextOpenWeek) {
    nextWeekUnassignedDays = nextOpenWeek.trainingDays
      .filter((day) => !day.isAssigned)
      .map((day) => day.dayNumber);
    nextWeekNeedsAssignment = nextWeekUnassignedDays.length > 0;
  } else {
    nextWeekNeedsAssignment = false;
  }

  return {
    hasCalendar: true,
    currentWeek: currentWeek
      ? {
        weekNumber: currentWeek.weekNumber,
        startDate: resetTime(currentWeek.startDate),
        endDate: resetTime(currentWeek.endDate),
        isOpen: currentWeek.isOpen,
        totalDays: currentWeek.trainingDays.length,
        assignedDays: currentWeek.trainingDays.filter((d) => d.isAssigned).length,
        unassignedDays: currentWeekUnassignedDays,
        hasUnassignedDays: currentWeekNeedsAssignment,
      }
      : null,
    nextOpenWeek: nextOpenWeek
      ? {
        weekNumber: nextOpenWeek.weekNumber,
        startDate: resetTime(nextOpenWeek.startDate),
        endDate: resetTime(nextOpenWeek.endDate),
        isOpen: nextOpenWeek.isOpen,
        totalDays: nextOpenWeek.trainingDays.length,
        assignedDays: nextOpenWeek.trainingDays.filter((d) => d.isAssigned).length,
        unassignedDays: nextWeekUnassignedDays,
        hasUnassignedDays: nextWeekNeedsAssignment,
      }
      : null,
    needsAssignment: {
      currentWeek: currentWeekNeedsAssignment,
      nextWeek: nextWeekNeedsAssignment,
    },
  };
};

const toPlainCalendar = (calendar) => {
  if (!calendar) return null;
  return typeof calendar.toObject === "function" ? calendar.toObject() : calendar;
};

const pickCalendarForSubscription = (calendars, subscription) => {
  const key = subscription._id.toString();
  const month = new Date(subscription.startDate).getMonth() + 1;
  const year = new Date(subscription.startDate).getFullYear();
  return (
    calendars.find(
      (calendar) =>
        calendar.subscriptionId.toString() === key &&
        calendar.month === month &&
        calendar.year === year
    ) ||
    calendars.find((calendar) => calendar.subscriptionId.toString() === key) ||
    null
  );
};

/**
 * Helper function to check workout assignment status using WorkoutCalendar.
 * Ensures calendar exists (create/open weeks), then returns assignment status.
 * Signature unchanged for callers.
 */
const checkWorkoutAssignmentStatus = async (
  athleteId,
  coachId,
  subscriptionId,
  subscriptionStart,
  subscriptionEnd,
  status = "active"
) => {
  const { calendar } = await fetchAthleteCalendarData(coachId, athleteId, status);
  return buildWorkoutAssignmentStatus(toPlainCalendar(calendar));
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
                name: 1,
                rank: 1,
                image: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: "galleries",
          localField: "userId._id",
          foreignField: "userId",
          as: "galleries",
          pipeline: [
            {
              $project: {
                _id: 1,
                imageUrl: 1,
                fileName: 1,
                fileSize: 1,
                mimeType: 1
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
                $gte: [athletePriceMongoExpr(), minPrice]
              }] : []),
              ...(maxPrice !== null ? [{
                $lte: [athletePriceMongoExpr(), maxPrice]
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
          data: [{ $sort: { yearOfExperience: -1 ,_id:-1} }, { $skip: skip }, { $limit: limit }]
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
      coaches: CoachResource.collection(
        coachesData,
        req.user?.role_id?.name === 'admin' ? { name: 'admin' } : {},
        req.userId,
        req.user?.role_id?.name === 'admin',
        { athletePrice: true }
      ),
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
    const isAdmin = req.user?.role_id?.name === 'admin';
    const editMode = req.query.edit == "true" || isAdmin;
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
                name: 1,
                rank: 1,
                image: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: "galleries",
          localField: "userId._id",
          foreignField: "userId",
          as: "galleries",
          pipeline: [
            {
              $project: {
                _id: 1,
                imageUrl: 1,
                fileName: 1,
                fileSize: 1,
                mimeType: 1
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
                $gte: [athletePriceMongoExpr(), minPrice]
              }] : []),
              ...(maxPrice !== null ? [{
                $lte: [athletePriceMongoExpr(), maxPrice]
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
          data: [{ $sort: { yearOfExperience: -1 ,_id:-1} }, { $skip: skip }, { $limit: limit }]
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
      coaches: CoachResourceForAthelete.collection(
        coachesData,
        isAdmin ? { name: 'admin' } : {},
        req.userId,
        editMode,
        conversationMap
      ),
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
    await coach.userId.save({ validateModifiedOnly: true });
    // TODO: Send email to coach
    try {
      await sendCoachActivationEmail(coach.userId.email, coach.userId.firstName + ' ' + coach.userId.lastName);
    } catch (error) {
      console.error("Error sending coach activation email:", error);
    }
    res.status(200).json({
      message: "Coach activated successfully",
    });
  } catch (err) {
    next(err);
  }
}
export const changeCoachStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const coach = await Coach.findOne({ userId: id }).populate("userId");
    if (!coach) {
      return res.status(404).json({
        message: "Coach not found",
      });
    }
    if (status == "active" || status == "rejected" || status == "pending") {
    
      coach.userId.status = status;
      await coach.userId.save({ validateModifiedOnly: true });
      if(status=="active"){
        try {
          await sendCoachActivationEmail(coach.userId.email, coach.userId.firstName + ' ' + coach.userId.lastName);
        } catch (error) {
          console.error("Error sending coach activation email:", error);
        }
      }
      return res.status(200).json({
        message: "Coach status changed successfully"
      });
    } else if (status == "removed") {
      // TODO: Delete coach from database
      await coach.deleteOne();
      await User.findByIdAndDelete(id);
      return res.status(200).json({
        message: "Coach removed successfully"
      });  
    }
    else {
      return res.status(400).json({
        message: "Invalid status"
      });
    }
  } catch (err) {
    next(err);
  }
}

export const getCoachAthletes = async (req, res, next) => {
  try {
    const coachUserId = req.userId;

    const subscriptions = await Subscription.find({
      coachId: coachUserId,
      status: "active",
      deletedAt: null,
    })
      .populate({
        path: "athleteId",
        select: "firstName lastName email phoneNumber profileImage gender",
      })
      .lean();

    const validSubscriptions = subscriptions.filter((sub) => sub.athleteId?._id);
    const athleteUserIds = [
      ...new Set(validSubscriptions.map((sub) => sub.athleteId._id.toString())),
    ];
    const subscriptionIds = validSubscriptions.map((sub) => sub._id);

    const [athleteRecords, calendars] = await Promise.all([
      Athlete.find({ userId: { $in: athleteUserIds } }).lean(),
      WorkoutCalendar.find({
        coachId: coachUserId,
        subscriptionId: { $in: subscriptionIds },
        deletedAt: null,
      }).lean(),
    ]);

    const athleteDataMap = new Map(
      athleteRecords.map((athlete) => [athlete.userId.toString(), athlete])
    );

    const calendarMap = new Map();
    for (const sub of validSubscriptions) {
      const calendar = pickCalendarForSubscription(calendars, sub);
      if (calendar) calendarMap.set(sub._id.toString(), calendar);
    }

    // Create missing calendars only (preserves previous side effect), in parallel.
    const missingSubs = validSubscriptions.filter(
      (sub) => !calendarMap.has(sub._id.toString())
    );
    if (missingSubs.length > 0) {
      await Promise.all(
        missingSubs.map(async (sub) => {
          try {
            const { calendar } = await fetchAthleteCalendarData(
              coachUserId,
              sub.athleteId._id,
              "active"
            );
            calendarMap.set(sub._id.toString(), toPlainCalendar(calendar));
          } catch (err) {
            console.error(
              `Failed to ensure calendar for subscription ${sub._id}:`,
              err.message
            );
          }
        })
      );
    }

    const athletes = validSubscriptions.map((sub) => {
      const athleteData = athleteDataMap.get(sub.athleteId._id.toString());
      const calendar = calendarMap.get(sub._id.toString());
      if (calendar?.weeks) {
        updateOpenWeeks(calendar);
      }

      return {
        subscriptionId: sub._id,
        athlete: {
          id: sub.athleteId._id,
          name: `${sub.athleteId.firstName} ${sub.athleteId.lastName || ""}`.trim(),
          email: sub.athleteId.email,
          phoneNumber: sub.athleteId.phoneNumber,
          profileImage: sub.athleteId.profileImage,
          gender: sub.athleteId.gender || null,
          weight: athleteData?.weight
            ? parseFloat(athleteData.weight.$numberDecimal ?? athleteData.weight)
            : null,
          height: athleteData?.height
            ? parseFloat(athleteData.height.$numberDecimal ?? athleteData.height)
            : null,
          trainingFrequency: athleteData?.trainingFrequency || null,
          inbodyFile: athleteData?.inbodyFile || null,
          dateOfBirth: athleteData?.dateOfBirth
            ? new Date(athleteData.dateOfBirth).toISOString().split("T")[0]
            : null,
          goals: athleteData?.goals || null,
          injuries: athleteData?.injuries || null,
        },
        subscription: {
          plan: sub.subscriptionPlan,
          amount: parseFloat(sub.amount.$numberDecimal ?? sub.amount),
          platformFee: parseFloat(sub.platformFee?.$numberDecimal ?? sub.platformFee ?? 0),
          coachNetAmount: parseFloat(sub.coachNetAmount?.$numberDecimal ?? sub.coachNetAmount ?? 0),
          currency: sub.currency,
          startDate: resetTime(sub.startDate),
          endDate: resetTime(sub.endDate),
          paymentStatus: sub.paymentStatus,
        },
        workoutCalendar: buildWorkoutAssignmentStatus(calendar),
      };
    });

    res.status(200).json({
      status: "success",
      message: "Retrieved athletes successfully",
      count: athletes.length,
      data: athletes,
    });
  } catch (err) {
    console.error("Get coach athletes error:", err);
    next(err);
  }
};

export const getExpiredCoachAthletes = async (req, res, next) => {
  try {
    const coachUserId = req.userId;

    const subscriptions = await Subscription.find({
      coachId: coachUserId,
      status: "expired",
      deletedAt: null,
    })
      .populate({
        path: "athleteId",
        select: "firstName lastName email phoneNumber profileImage gender",
      })
      .sort({ endDate: -1 })
      .lean();

    const validSubscriptions = subscriptions.filter((sub) => sub.athleteId?._id);
    // Unique athletes that have at least one expired subscription with this coach
    const athleteUserIds = [
      ...new Set(validSubscriptions.map((sub) => sub.athleteId._id.toString())),
    ];
    const expiredAthletesCount = athleteUserIds.length;
    const expiredSubscriptionsCount = validSubscriptions.length;

    // Batch-load athlete profiles (no per-subscription DB calls).
    const athleteRecords = await Athlete.find({
      userId: { $in: athleteUserIds },
    }).lean();

    const athleteDataMap = new Map(
      athleteRecords.map((athlete) => [athlete.userId.toString(), athlete])
    );

    const athletesMap = new Map();

    for (const sub of validSubscriptions) {
      const athleteId = sub.athleteId._id.toString();
      const athleteData = athleteDataMap.get(athleteId);

      if (!athletesMap.has(athleteId)) {
        athletesMap.set(athleteId, {
          athlete: {
            id: sub.athleteId._id,
            name: `${sub.athleteId.firstName} ${sub.athleteId.lastName || ""}`.trim(),
            email: sub.athleteId.email,
            phoneNumber: sub.athleteId.phoneNumber,
            profileImage: sub.athleteId.profileImage,
            gender: sub.athleteId.gender || null,
            weight: athleteData?.weight
              ? parseFloat(athleteData.weight.$numberDecimal ?? athleteData.weight)
              : null,
            height: athleteData?.height
              ? parseFloat(athleteData.height.$numberDecimal ?? athleteData.height)
              : null,
            trainingFrequency: athleteData?.trainingFrequency || null,
            inbodyFile: athleteData?.inbodyFile || null,
            dateOfBirth: athleteData?.dateOfBirth
              ? new Date(athleteData.dateOfBirth).toISOString().split("T")[0]
              : null,
            goals: athleteData?.goals || null,
            injuries: athleteData?.injuries || null,
          },
          expiredSubscriptions: [],
        });
      }

      athletesMap.get(athleteId).expiredSubscriptions.push(formatExpiredSubscription(sub));
    }

    const athletes = Array.from(athletesMap.values()).map((entry) => ({
      ...entry,
      expiredSubscriptionsCount: entry.expiredSubscriptions.length,
    }));

    res.status(200).json({
      status: "success",
      message: "Retrieved expired athletes successfully",
      count: expiredAthletesCount,
      expiredAthletesCount,
      expiredSubscriptionsCount,
      data: athletes,
    });
  } catch (err) {
    console.error("Get expired coach athletes error:", err);
    next(err);
  }
};
export const getExpiredAthleteCalendar = async (req, res, next) => {
  try {
    const coachUserId = req.userId;
    const athleteId = req.params.athleteId;

    const { items, subscriptions } = await fetchAthleteCalendarData(
      coachUserId,
      athleteId,
      "expired"
    );

    const athleteUser = await User.findById(athleteId)
      .select("firstName lastName email phoneNumber profileImage gender")
      .lean();

    const data = items.map(({ subscription, calendar }) => ({
      subscription: formatExpiredSubscription(subscription),
      calendar: calendar ? WorkoutCalendarResource.single(calendar, subscription) : null,
    }));

    res.status(200).json({
      status: "success",
      message: "Retrieved expired athlete calendars successfully",
      count: subscriptions.length,
      athlete: formatExpiredUser(athleteUser),
      data,
    });
  } catch (err) {
    if (err.message === "No expired subscription found for this athlete") {
      return res.status(404).json({
        status: "error",
        message: err.message,
      });
    }
    console.error("Get expired athlete calendar error:", err);
    next(err);
  }
};
export const getCoachProfile = async (req, res, next) => {
  try {


    const coachId = req.params.id ?? req.userId;
    const editMode = req.query.edit === "true" ? true : false;


    const coach = await Coach.findOne({ userId: coachId }).populate('userId')



    if (!coach) {
      return res.status(404).json({
        status: "error",
        message: "Coach not found"
      });
    }

    // Fetch certificates and achievements using the coach's userId
    const certificates = await Certificate.find({ userId: coach.userId._id }).lean();
    const achievements = await Achievement.find({ userId: coach.userId._id }).lean();
    const galleries = await Gallery.find({ userId: coach.userId._id }).lean();



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
    coach.galleryImages = galleries;

    res.status(200).json({
      status: "success",
      message: "Retrieved coach successfully",
      data: new CoachResource(coach, {}, editMode)
    });
  } catch (err) {
    next(err);
  }
};
export const addNutritionFile = async (req, res, next) => {
  try {
    const subscriptionId = req.params.subscriptionId;
    let subscriptionRecord = await Subscription.findById(subscriptionId);
    if (!subscriptionRecord || subscriptionRecord.status !== "active") {
      return res.status(404).json({
        status: "error",
        message: "Subscription not found or not active"
      });
    }


    const hadNutrition =
      Boolean(subscriptionRecord.nutritionFile) ||
      Boolean(subscriptionRecord.nutritionText);
    // true  → already had file and/or text → update
    // false → neither existed → add new
    const isUpdate = hadNutrition

    let nutritionPath = subscriptionRecord.nutritionFile ? subscriptionRecord.nutritionFile : null;
    let nutritionText = subscriptionRecord.nutritionText ? subscriptionRecord.nutritionText : null;
    if (req.file) {
      nutritionPath = `/images/${req.uploadFolder}/${req.file.filename}`
    }
    const cleanNutritionText = req.body.nutritionText ? sanitizeHtml(req.body.nutritionText) : nutritionText;
    await Subscription.findByIdAndUpdate(subscriptionId, { nutritionFile: nutritionPath, nutritionText: cleanNutritionText });

    //send Notification to athlete
    const coachId = req.userId;
    NotificationService.sendNotification({
      recipientId: subscriptionRecord.athleteId,
      senderId: coachId,
      type: isUpdate ? "nutrition_updated" : "nutrition_added",
      title: isUpdate ? "🍎 تم تحديث خطة التغذية" : " 🍎 تم إضافة خطة التغذية",
      message: isUpdate
        ? "قام المدرب بتحديث خطة التغذية الخاصة بك"
        : "قام المدرب بإضافة خطة تغذية جديدة لك",
      data: {
        subscriptionId: subscriptionId.toString(),
        type: isUpdate ? "nutrition_updated" : "nutrition_added",
      },
    });

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
    const subscriptionId = req.params.subscriptionId;
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

