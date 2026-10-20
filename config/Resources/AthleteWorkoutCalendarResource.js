import { displayName } from "../../utils/displayName.js";
import { resolveDayWorkoutShell } from "../../services/workoutSnapshotService.js";

class AthleteWorkoutCalendarResource {
  constructor(calendar, canRateByCoachId = null) {
    this.calendarId = calendar._id;

    const coach = calendar.coachId;
    this.coach = coach
      ? {
          id: coach._id,
          name: displayName(coach),
          email: coach.email,
          phoneNumber: coach.phoneNumber,
          profileImage: coach.profileImage,
        }
      : null;

    const subscription = calendar.subscriptionId;
    const coachKey = coach?._id?.toString() ?? subscription?.coachId?.toString();
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
          canRate:
            canRateByCoachId instanceof Map && coachKey
              ? canRateByCoachId.get(coachKey) ?? false
              : false,
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
        workout: resolveDayWorkoutShell(day),
      })),
    }));
  }

  static collection(calendars, canRateByCoachId = null) {
    return calendars.map(
      (calendar) => new AthleteWorkoutCalendarResource(calendar, canRateByCoachId)
    );
  }
}

export default AthleteWorkoutCalendarResource;
