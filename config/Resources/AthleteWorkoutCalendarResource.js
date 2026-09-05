class AthleteWorkoutCalendarResource {
  constructor(calendar) {
    this.calendarId = calendar._id;

    const coach = calendar.coachId;
    this.coach = coach
      ? {
          id: coach._id,
          name: `${coach.firstName ?? ""} ${coach.lastName ?? ""}`.trim(),
          email: coach.email,
          phoneNumber: coach.phoneNumber,
          profileImage: coach.profileImage,
        }
      : null;

    const subscription = calendar.subscriptionId;
    this.subscription = subscription
      ? {
          id: subscription._id,
          plan: subscription.subscriptionPlan,
          amount: parseFloat(
            subscription.amount?.$numberDecimal ?? subscription.amount
          ),
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: subscription.status,
        }
      : null;

    this.trainingFrequency = calendar.trainingFrequency;
    this.totalWeeks = calendar.weeks?.length ?? 0;

    this.weeks = (calendar.weeks ?? []).map((week) => ({
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      isOpen: week.isOpen,
      trainingDays: (week.trainingDays ?? []).map((day) => ({
        dayNumber: day.dayNumber,
        date: day.date,
        isAssigned: day.isAssigned,
        completedAt: day.completedAt,
        notes: day.notes || null,
        workout: day.workoutId
          ? {
              id: day.workoutId._id,
              name: day.workoutId.name,
              description: day.workoutId.description,
              type: day.workoutId.workoutType,
            }
          : null,
      })),
    }));
  }

  static collection(calendars) {
    return calendars.map(
      (calendar) => new AthleteWorkoutCalendarResource(calendar)
    );
  }
}

export default AthleteWorkoutCalendarResource;
