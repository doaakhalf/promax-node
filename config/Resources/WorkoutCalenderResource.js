class WorkoutCalendarResource {
  constructor(calendar, subscription) {
    this.calendarId = calendar._id;
    
    this.subscriptionPeriod = {
      startDate: subscription?.startDate || null,
      endDate: subscription?.endDate || null
    };
    
    this.trainingFrequency = calendar.trainingFrequency;
    
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

  // Static method for single calendar
  static single(calendar, subscription) {
    return new WorkoutCalendarResource(calendar, subscription);
  }

  // Static method for collection of calendars
  static collection(calendars) {
    return calendars.map(item => 
      new WorkoutCalendarResource(item.calendar, item.subscription)
    );
  }
}

export default WorkoutCalendarResource;