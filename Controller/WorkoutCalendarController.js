import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Subscription from "../Models/Subscription.js";
import Athlete from "../Models/Athlete.js";
import WorkoutAssignment from "../Models/WorkoutAssignment.js";
import WorkoutCalendarResource from "../config/Resources/WorkoutCalendarResource.js";
import { resetTime, compareDates } from "../utils/resetTime.js";

// Helper function to generate calendar weeks based on subscription dates
const generateCalendarWeeks = (subscriptionStartDate, subscriptionEndDate, trainingFrequency) => {
  const weeks = [];
  const startDate = resetTime(subscriptionStartDate);
  const endDate = resetTime(subscriptionEndDate);
  
  // Calculate total days in subscription period
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const daysPerWeek = Math.ceil(totalDays / 4); // Divide subscription period into 4 weeks
  
  // Calculate 4 weeks based on subscription period
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(startDate.getDate() + (weekNum - 1) * daysPerWeek);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + daysPerWeek - 1);
    
    // Don't let the last week exceed subscription end date
    if (compareDates(weekEndDate, endDate) > 0) {
      weekEndDate.setTime(endDate.getTime());
    }
    
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
      isOpen: weekNum === 1, // First week is open by default
      trainingDays
    });
  }
  
  return weeks;
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
      if (daysUntilEnd <= 2 && index < calendar.weeks.length - 1) {
        calendar.weeks[index + 1].isOpen = true;
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
    console.log(subscription);
    
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
      const coachName=calendar.coachId.firstName + ' ' + calendar.coachId.lastName?.charAt(0)+' .';

      //send notification to athlete
      const notificationMessage = `تم تعيين تدريب لليوم ${dayNumber} في الأسبوع ${weekNumber} من المدرب ${coachName}`;
      NotificationService.sendNotification(
        calendar.athleteId,
        {
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
export const fetchAthleteCalendarData = async (coachId, athleteId) => {
  // Verify subscription exists and is active
  const subscription = await Subscription.findOne({
    coachId,
    athleteId,
    status: "active"
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
    subscriptionId: subscription._id
  }).populate({
    path: 'weeks.trainingDays.workoutId',
    select: 'name description workoutType'
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
      status: "active"
    });
    
    // Populate workouts after creation
    calendar = await WorkoutCalendar.findById(calendar._id).populate({
      path: 'weeks.trainingDays.workoutId',
      select: 'name description workoutType'
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
    