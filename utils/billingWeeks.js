import { compareDates, resetTime } from "./resetTime.js";
import { WEEKS_PER_MONTH } from "./coachNetAmount.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const addDays = (date, days) => {
  const result = resetTime(date);
  result.setUTCDate(result.getUTCDate() + days);
  return resetTime(result);
};

export const inclusiveDays = (startDate, endDate) => {
  const start = resetTime(startDate);
  const end = resetTime(endDate);
  return Math.floor((end - start) / MS_PER_DAY) + 1;
};

export const getBillingEndDate = (subscriptionStartDate, subscriptionEndDate) => {
  return resetTime(subscriptionEndDate);
};

// Same 4-chunk split as WorkoutCalendarController.generateCalendarWeeks
// so week 4 of a 19 Jul–19 Aug sub is 12 Aug–19 Aug (not a 7-day slice ending 15 Aug).
export const generateBillingWeeks = (subscriptionStartDate, subscriptionEndDate) => {
  const start = resetTime(subscriptionStartDate);
  const end = resetTime(subscriptionEndDate);
  const totalDays = Math.ceil((end - start) / MS_PER_DAY);
  const daysPerWeek = Math.ceil(totalDays / WEEKS_PER_MONTH) || 1;
  const weeks = [];

  for (let weekIndex = 1; weekIndex <= WEEKS_PER_MONTH; weekIndex++) {
    const billingWeekStart = addDays(start, (weekIndex - 1) * daysPerWeek);

    if (compareDates(billingWeekStart, end) > 0) {
      break;
    }

    let billingWeekEnd = addDays(billingWeekStart, daysPerWeek - 1);
    if (compareDates(billingWeekEnd, end) > 0) {
      billingWeekEnd = end;
    }

    weeks.push({ weekIndex, billingWeekStart, billingWeekEnd });
  }

  return weeks;
};

export const getBillingWeeks = (subscription, calendar) => {
  if (calendar?.weeks?.length) {
    return calendar.weeks.map((week) => ({
      weekIndex: week.weekNumber,
      billingWeekStart: resetTime(week.startDate),
      billingWeekEnd: resetTime(week.endDate),
      trainingDays: week.trainingDays || [],
    }));
  }

  return generateBillingWeeks(subscription.startDate, subscription.endDate);
};

export const weekQualifiesForPeriod = (billingWeekEnd, periodStart, periodEnd) => {
  const end = resetTime(billingWeekEnd);
  return compareDates(end, periodStart) >= 0 && compareDates(end, periodEnd) <= 0;
};
