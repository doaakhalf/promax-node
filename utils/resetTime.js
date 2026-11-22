
import { getPackagePlan } from "./coachNetAmount.js";

// Helper function to reset time to midnight (work with dates only)
export const resetTime = (date) => {
  const newDate = new Date(date);
  newDate.setUTCHours(0, 0, 0, 0);
  return newDate;
};

// Helper function to compare dates only (returns -1, 0, or 1)
export const compareDates = (date1, date2) => {
  const d1 = resetTime(date1);
  const d2 = resetTime(date2);
  return d1.getTime() - d2.getTime();
};

// Inclusive calendar span: same day N months ahead, then -1 day
export const getMonthlySubscriptionEndDate = (startDate, months = 1) => {
  const start = resetTime(startDate);
  const end = resetTime(new Date(start));
  const span = Number.isInteger(months) && months > 0 ? months : 1;
  end.setMonth(end.getMonth() + span);
  if (end.getDate() !== start.getDate()) {
    end.setDate(0); // overflow: last day of the short month
  }
  end.setDate(end.getDate() - 1);
  return resetTime(end);
};

/** Inclusive 7 days: start day plus 6. */
export const getWeeklySubscriptionEndDate = (startDate) => {
  const start = resetTime(startDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return resetTime(end);
};

export const getSubscriptionEndDate = (startDate, plan) => {
  if (plan === "weekly") return getWeeklySubscriptionEndDate(startDate);
  const packagePlan = getPackagePlan(plan);
  return getMonthlySubscriptionEndDate(startDate, packagePlan ? packagePlan.months : 1);
};