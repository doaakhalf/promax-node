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
// Inclusive days, even split (lengths differ by at most 1; extras on last weeks).
export const generateBillingWeeks = (subscriptionStartDate, subscriptionEndDate) => {
  const start = resetTime(subscriptionStartDate);
  const end = resetTime(subscriptionEndDate);
  const totalDays = Math.max(1, inclusiveDays(start, end));
  const baseDays = Math.floor(totalDays / WEEKS_PER_MONTH);
  const remainder = totalDays % WEEKS_PER_MONTH;
  const weeks = [];
  let dayOffset = 0;

  for (let weekIndex = 1; weekIndex <= WEEKS_PER_MONTH; weekIndex++) {
    const daysInWeek = baseDays + (weekIndex > WEEKS_PER_MONTH - remainder ? 1 : 0);
    const billingWeekStart = addDays(start, dayOffset);

    if (compareDates(billingWeekStart, end) > 0) {
      break;
    }

    let billingWeekEnd = addDays(billingWeekStart, daysInWeek - 1);
    if (compareDates(billingWeekEnd, end) > 0) {
      billingWeekEnd = end;
    }

    weeks.push({ weekIndex, billingWeekStart, billingWeekEnd });
    dayOffset += daysInWeek;
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

/**
 * Transfer days (1st / 16th) open a new payout period. A week that ends exactly
 * on a transfer day is attributed to the period that just closed, so the coach
 * is paid on that transfer instead of waiting for the next one.
 * e.g. week ending 1 Oct → assigned as 30 Sep → period 16–30 Sep → payout 1 Oct.
 */
export const getPeriodAssignmentDate = (billingWeekEnd) => {
  const end = resetTime(billingWeekEnd);
  const day = end.getUTCDate();

  if (day === 1 || day === 16) {
    return addDays(end, -1);
  }

  return end;
};

export const weekQualifiesForPeriod = (billingWeekEnd, periodStart, periodEnd) => {
  const end = getPeriodAssignmentDate(billingWeekEnd);
  return compareDates(end, periodStart) >= 0 && compareDates(end, periodEnd) <= 0;
};
