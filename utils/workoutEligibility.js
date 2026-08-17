import { compareDates, resetTime } from "./resetTime.js";

export const getTrainingDaysInWindow = (calendar, weekStart, weekEnd) => {
  if (!calendar?.weeks?.length) return [];

  const start = resetTime(weekStart);
  const end = resetTime(weekEnd);
  const days = [];

  for (const week of calendar.weeks) {
    for (const day of week.trainingDays || []) {
      const dayDate = resetTime(day.date);
      if (compareDates(dayDate, start) >= 0 && compareDates(dayDate, end) <= 0) {
        days.push(day);
      }
    }
  }

  return days;
};

export const isCalendarWeekEligible = (week) => {
  const trainingDays = week?.trainingDays || [];

  if (trainingDays.length === 0) {
    return {
      eligible: false,
      assignedDaysCount: 0,
      requiredDaysCount: 0,
      reason: "no_assignment",
    };
  }

  const assignedDaysCount = trainingDays.filter((day) => day.isAssigned).length;
  const requiredDaysCount = trainingDays.length;
  const eligible = assignedDaysCount === requiredDaysCount;

  return {
    eligible,
    assignedDaysCount,
    requiredDaysCount,
    reason: eligible ? null : "no_assignment",
  };
};

export const isWeekEligible = (calendar, weekStart, weekEnd, calendarWeek = null) => {
  if (calendarWeek?.trainingDays) {
    return isCalendarWeekEligible(calendarWeek);
  }

  const trainingDays = getTrainingDaysInWindow(calendar, weekStart, weekEnd);

  if (trainingDays.length === 0) {
    return {
      eligible: false,
      assignedDaysCount: 0,
      requiredDaysCount: 0,
      reason: "no_assignment",
    };
  }

  const assignedDaysCount = trainingDays.filter((day) => day.isAssigned).length;
  const requiredDaysCount = trainingDays.length;
  const eligible = assignedDaysCount === requiredDaysCount;

  return {
    eligible,
    assignedDaysCount,
    requiredDaysCount,
    reason: eligible ? null : "no_assignment",
  };
};
