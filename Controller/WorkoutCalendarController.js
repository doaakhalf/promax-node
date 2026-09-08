import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Subscription from "../Models/Subscription.js";
import Athlete from "../Models/Athlete.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import WorkoutCalendarResource from "../config/Resources/WorkoutCalendarResource.js";
import { resetTime, compareDates } from "../utils/resetTime.js";
import NotificationService from "../services/NotificationService.js";
import { displayName } from "../utils/displayName.js";

// Helper function to generate calendar weeks based on subscription dates
const generateCalendarWeeks = (subscriptionStartDate, subscriptionEndDate, trainingFrequency) => {
  const weeks = [];
  const startDate = resetTime(subscriptionStartDate);
  const endDate = resetTime(subscriptionEndDate);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const weekCount = 4;

  // Inclusive day count so 2/9–1/10 = 30 days (not 29)
  const totalDays = Math.max(1, Math.floor((endDate - startDate) / MS_PER_DAY) + 1);
  const baseDays = Math.floor(totalDays / weekCount);
  const remainder = totalDays % weekCount;

  // Even split: lengths differ by at most 1; extra days go to the last weeks
  let dayOffset = 0;
  for (let weekNum = 1; weekNum <= weekCount; weekNum++) {
    const daysInWeek = baseDays + (weekNum > weekCount - remainder ? 1 : 0);

    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(startDate.getDate() + dayOffset);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + daysInWeek - 1);

    // Don't let any week exceed subscription end date
    if (compareDates(weekEndDate, endDate) > 0) {
      weekEndDate.setTime(endDate.getTime());
    }

    dayOffset += daysInWeek;
    
    // Generate training days for this week
    const trainingDays = [];
    for (let dayNum = 1; dayNum <= trainingFrequency; dayNum++) {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(weekStartDate.getDate() + (dayNum - 1));
      
      // Only add training days that fall within the week period
      if (compareDates(dayDate, weekEndDate) <= 0) {
        trainingDays.push({
          dayNumber: dayNum,
          date: resetTime(dayDate),
          workoutId: null,
          isAssigned: false,
          completedAt: null
        });
      }
    }
    
    weeks.push({
      weekNumber: weekNum,
      startDate: resetTime(weekStartDate),
      endDate: resetTime(weekEndDate),
      isOpen: weekNum === 1 || weekNum === 2, // First and second week are open by default
      trainingDays
    });
  }
  
  return weeks;
};

/**
 * Adjust future weeks' trainingDays to match newFrequency.
 * Past and current weeks (startDate <= today) are left unchanged.
 * Increase: append empty slots for missing dayNumbers.
 * Decrease: drop highest dayNumbers; returns dropped { weekNumber, dayNumber }[].
 */
export const adjustCalendarForTrainingFrequency = (calendar, newFrequency, now = new Date()) => {
  const today = resetTime(now);
  const freq = parseInt(newFrequency, 10);
  const dropped = [];

  calendar.trainingFrequency = freq;

  for (const week of calendar.weeks || []) {
    const weekStart = resetTime(week.startDate);
    const weekEnd = resetTime(week.endDate);
    // Only future weeks (startDate > today); skip past and current
    if (compareDates(today, weekStart) >= 0) {
      continue;
    }

    const days = [...(week.trainingDays || [])].sort(
      (a, b) => a.dayNumber - b.dayNumber
    );

    if (freq > days.length) {
      const existingNumbers = new Set(days.map((d) => d.dayNumber));

      for (let dayNum = 1; dayNum <= freq; dayNum++) {
        if (existingNumbers.has(dayNum)) continue;

        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + (dayNum - 1));

        if (compareDates(dayDate, weekEnd) <= 0) {
          days.push({
            dayNumber: dayNum,
            date: resetTime(dayDate),
            workoutId: null,
            isAssigned: false,
            completedAt: null,
            notes: null,
          });
        }
      }

      days.sort((a, b) => a.dayNumber - b.dayNumber);
      week.trainingDays = days;
    } else if (freq < days.length) {
      const toDrop = days.slice(freq);
      for (const day of toDrop) {
        dropped.push({ weekNumber: week.weekNumber, dayNumber: day.dayNumber });
      }
      week.trainingDays = days.slice(0, freq);
    }
  }

  return dropped;
};

/**
 * For an athlete's active-subscription calendars, sync trainingFrequency
 * and adjust future week day slots. Cleans up orphaned assignments.
 */
export const syncAthleteCalendarsForTrainingFrequency = async (athleteId, newFrequency) => {
  const freq = parseInt(newFrequency, 10);
  if (!Number.isFinite(freq) || freq < 1 || freq > 7) return;

  const activeSubs = await Subscription.find({
    athleteId,
    status: "active",
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!activeSubs.length) return;

  const calendars = await WorkoutCalendar.find({
    athleteId,
    subscriptionId: { $in: activeSubs.map((s) => s._id) },
    status: "active",
    deletedAt: null,
  });

  for (const calendar of calendars) {
    const dropped = adjustCalendarForTrainingFrequency(calendar, freq);
    await calendar.save();

    if (dropped.length) {
      await WorkoutAssignment.deleteMany({
        calendarId: calendar._id,
        $or: dropped.map(({ weekNumber, dayNumber }) => ({ weekNumber, dayNumber })),
      });
    }
  }
};

// Helper function to check which weeks should be open
 export const updateOpenWeeks = (calendar) => {
  const now = resetTime(new Date());
  
  calendar.weeks.forEach((week, index) => {
    const startDate = resetTime(week.startDate);
    const endDate = resetTime(week.endDate);
    const daysUntilEnd = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // Current week is always open if not ended
    if (compareDates(now, startDate) >= 0 && compareDates(now, endDate) <= 0) {
      week.isOpen = true;
      
      // Open next week if within 2 days of current week ending
      // if (daysUntilEnd <= 2 && index < calendar.weeks.length - 1) {
        if (week.weekNumber >= 2 && daysUntilEnd <= 2) {
          if (index + 1 < calendar.weeks.length) {
            calendar.weeks[index + 1].isOpen = true;
          }
          if (index + 2 < calendar.weeks.length) {
            calendar.weeks[index + 2].isOpen = true;
          }
        // calendar.weeks[index + 1].isOpen = true;

      }
    }
    
    // Close weeks that have ended
    if (compareDates(now, endDate) > 0) {
      week.isOpen = false;
    }
  });
  
  return calendar;
};

// 
// Get or create workout calendar for athlete
export const getAthleteCalendar = async (req, res) => {
  try {
    const coachId = req.userId;
    const athleteId = req.params.athleteId;

    const { calendar, subscription } = await fetchAthleteCalendarData(coachId, athleteId);
  
    res.status(200).json({
      status: "success",
      message: "Calendar retrieved successfully",
       data: WorkoutCalendarResource.single(calendar, subscription)
    });
    
  } catch (error) {
    console.error('Get athlete calendar error:', error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve calendar",
      error: error.message
    });
  }
};

// Assign workout to a specific day
export const assignWorkout = async (req, res) => {
  try {
    const coachId = req.userId;
    
    
    const { calendarId, weekNumber, dayNumber, workoutId } = req.body;
    
    const calendar = await WorkoutCalendar.findOne({
      _id: calendarId,
      coachId
    });
  await calendar.populate('coachId', 'firstName lastName');
    if (!calendar) {
      return res.status(404).json({
        status: "error",
        message: "Calendar not found"
      });
    }
    
    // Update open weeks status
    updateOpenWeeks(calendar);
    
    // Find the week
    const week = calendar.weeks.find(w => w.weekNumber === weekNumber);
    if (!week) {
      return res.status(404).json({
        status: "error",
        message: "Week not found"
      });
    }
    
    // Check if week is open for assignment
    if (!week.isOpen) {
      return res.status(403).json({
        status: "error",
        message: "This week is not open for assignment"
      });
    }
    
    // Find the day
    const day = week.trainingDays.find(d => d.dayNumber === dayNumber);
    if (!day) {
      return res.status(404).json({
        status: "error",
        message: "Training day not found"
      });
    }
    if(day.completedAt){
         return res.status(200).json({
        status: "error",
        message: "Training day is already assigned and completed by athlete"
      });
    }
    
    // Assign workout
    day.workoutId = workoutId;
    day.isAssigned = true;
    
    await calendar.save();
   // Complete the WorkoutAssignment creation
    const assignedWorkoutExist=await WorkoutAssignment.findOneAndUpdate({
    coachId,
    athleteId: calendar.athleteId,
    calendarId: calendar._id,
    weekNumber: weekNumber,
    dayNumber: dayNumber,
    status: 'assigned'  
    },{
         coachId,
    athleteId: calendar.athleteId,
    workoutId,
    assignedDate: Date.now(),
    calendarId: calendar._id,
    weekNumber: weekNumber,
    dayNumber: dayNumber,
    status: 'assigned'  
    });
    if(!assignedWorkoutExist){
        await WorkoutAssignment.create({
            coachId,
            athleteId: calendar.athleteId,
            workoutId,
            assignedDate: Date.now(),
            calendarId: calendar._id,
            weekNumber: weekNumber,
            dayNumber: dayNumber,
            status: 'assigned'  
    });
    }
    // Populate the workout details
    const updatedCalendar = await WorkoutCalendar.findById(calendar._id)
      .populate({
        path: 'weeks.trainingDays.workoutId',
        select: 'name description workoutType'
      });
      const coachName = displayName(calendar.coachId);

      //send notification to athlete
      const notificationMessage = `تم تعيين تدريب لليوم ${dayNumber} في الأسبوع ${weekNumber} من المدرب ${coachName}`;
      NotificationService.sendNotification(
       
        {
          recipientId: calendar.athleteId,
          senderId: coachId,
          type: "workout_assigned",
          title: "تم تعيين تدريب",
          message: notificationMessage,
          data: {
            calendarId: calendar._id.toString(),
            weekNumber: weekNumber,
            dayNumber: dayNumber,
            workoutId: workoutId
          }
        }
      );
    
    res.status(200).json({
      status: "success",
      message: "Workout assigned successfully",
      data: updatedCalendar
    });
    
  } catch (error) {
    console.error('Assign workout error:', error);
    res.status(500).json({
      status: "error",
      message: "Failed to assign workout",
      error: error.message
    });
  }
};

// Helper function to fetch calendar data (no HTTP response)
// - status "active"  → findOne subscription + one calendar (create if missing)
// - status "expired" → find ALL expired subscriptions + their calendars (read-only)
export const fetchAthleteCalendarData = async (coachId, athleteId, status = "active") => {
  if (status === "expired") {
    const subscriptions = await Subscription.find({
      coachId,
      athleteId,
      status: "expired",
      deletedAt: null,
    })
      .sort({ endDate: -1 })
      .lean();

    if (subscriptions.length === 0) {
      throw new Error("No expired subscription found for this athlete");
    }

    for (const subscription of subscriptions) {
      subscription.startDate = resetTime(subscription.startDate);
      subscription.endDate = resetTime(subscription.endDate);
    }

    const subscriptionIds = subscriptions.map((subscription) => subscription._id);
    const calendars = await WorkoutCalendar.find({
      coachId,
      athleteId,
      subscriptionId: { $in: subscriptionIds },
      deletedAt: null,
    })
      .populate({
        path: "weeks.trainingDays.workoutId",
        select: "name description workoutType",
      })
      .lean();

    const calendarBySubscriptionId = new Map(
      calendars.map((calendar) => [calendar.subscriptionId.toString(), calendar])
    );

    const items = subscriptions.map((subscription) => ({
      subscription,
      calendar: calendarBySubscriptionId.get(subscription._id.toString()) || null,
    }));

    return {
      items,
      subscriptions,
      calendars,
    };
  }

  // Active flow: one subscription + one calendar
  const subscription = await Subscription.findOne({
    coachId,
    athleteId,
    status: "active",
    deletedAt: null,
  }).lean();

  if (!subscription) {
    throw new Error("No active subscription found for this athlete");
  }

  // .lean() bypasses Mongoose getters, so apply resetTime manually
  subscription.startDate = resetTime(subscription.startDate);
  subscription.endDate = resetTime(subscription.endDate);

  // Get athlete's training frequency
  const athlete = await Athlete.findOne({ userId: athleteId }).lean();
  if (!athlete) {
    throw new Error("Athlete profile not found");
  }

  const trainingFrequency = parseInt(athlete.trainingFrequency);

  // Find or create calendar for this subscription
  let calendar = await WorkoutCalendar.findOne({
    subscriptionId: subscription._id,
  }).populate({
    path: "weeks.trainingDays.workoutId",
    select: "name description workoutType",
  });

  if (!calendar) {
    // Create new calendar based on subscription dates
    const weeks = generateCalendarWeeks(
      subscription.startDate,
      subscription.endDate,
      trainingFrequency
    );

    calendar = await WorkoutCalendar.create({
      athleteId,
      coachId,
      subscriptionId: subscription._id,
      month: new Date(subscription.startDate).getMonth() + 1,
      year: new Date(subscription.startDate).getFullYear(),
      trainingFrequency,
      weeks,
      status: "active",
    });

    // Populate workouts after creation
    calendar = await WorkoutCalendar.findById(calendar._id).populate({
      path: "weeks.trainingDays.workoutId",
      select: "name description workoutType",
    });
  }

  // Update which weeks are open
  calendar = updateOpenWeeks(calendar);
  await calendar.save();

  return { calendar, subscription };
};

    // // Verify subscription exists and is active
    // const subscription = await Subscription.findOne({
    //   coachId,
    //   athleteId,
    //   status: "active"
    // }).lean();
    
    // if (!subscription) {
    //   return res.status(403).json({
    //     status: "error",
    //     message: "No active subscription found for this athlete"
    //   });
    // }
    
    // // Get athlete's training frequency
    // const athlete = await Athlete.findOne({ userId: athleteId }).lean();
    // if (!athlete) {
    //   return res.status(404).json({
    //     status: "error",
    //     message: "Athlete profile not found"
    //   });
    // }
    
    // const trainingFrequency = parseInt(athlete.trainingFrequency);
    
    // // Find or create calendar for this subscription
    // let calendar = await WorkoutCalendar.findOne({
    //   subscriptionId: subscription._id
    // }).populate({
    //   path: 'weeks.trainingDays.workoutId',
    //   select: 'name description workoutType'
    // });
   
    // if (!calendar) {
    //   // Create new calendar based on subscription dates
    //   const weeks = generateCalendarWeeks(
    //     subscription.startDate, 
    //     subscription.endDate, 
    //     trainingFrequency
    //   );
      
    //   calendar = await WorkoutCalendar.create({
    //     athleteId,
    //     coachId,
    //     subscriptionId: subscription._id,
    //     month: new Date(subscription.startDate).getMonth() + 1,
    //     year: new Date(subscription.startDate).getFullYear(),
    //     trainingFrequency,
    //     weeks,
    //     status: "active"
    //   });
      
    //   // Populate workouts after creation
    //   calendar = await WorkoutCalendar.findById(calendar._id).populate({
    //     path: 'weeks.trainingDays.workoutId',
    //     select: 'name description workoutType'
    //   });
    // }
    
    // // Update which weeks are open
    // calendar = updateOpenWeeks(calendar);
    // await calendar.save();
    