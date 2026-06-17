class AthleteWorkoutCalendarResource {
  constructor(calendar) {
    this.calendarId = calendar._id;
    
    // Coach information (only for athlete view)
    this.coach = {
      id: calendar.coachId._id,
      name: `${calendar.coachId.firstName} ${calendar.coachId.lastName}`,
      email: calendar.coachId.email,
      phoneNumber: calendar.coachId.phoneNumber,
      profileImage: calendar.coachId.profileImage
    };
    
    // Subscription information
    this.subscription = {
      id: calendar.subscriptionId._id,
      plan: calendar.subscriptionId.subscriptionPlan,
      amount: parseFloat(calendar.subscriptionId.amount.$numberDecimal ?? calendar.subscriptionId.amount),
      startDate: calendar.subscriptionId.startDate,
      endDate: calendar.subscriptionId.endDate,
      status: calendar.subscriptionId.status
    };
    
    this.trainingFrequency = calendar.trainingFrequency;
    this.totalWeeks = calendar.weeks.length;
    
    this.weeks = calendar.weeks.map(week => ({
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      isOpen: week.isOpen,
      trainingDays: week.trainingDays.map(day => ({
        dayNumber: day.dayNumber,
        date: day.date,
        isAssigned: day.isAssigned,
        completedAt: day.completedAt,
        notes: day.notes || null,
        workout: day.workoutId ? {
          id: day.workoutId._id,
          name: day.workoutId.name,
          description: day.workoutId.description,
          type: day.workoutId.workoutType
        } : null
      }))
    }));
  }

  static collection(calendars) {
    return calendars.map(calendar => new AthleteWorkoutCalendarResource(calendar));
  }
}

export default AthleteWorkoutCalendarResource;