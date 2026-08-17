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
  const start = resetTime(subscriptionStartDate);
  const normalizedEnd = addDays(start, WEEKS_PER_MONTH * 7 - 1);
  const actualEnd = resetTime(subscriptionEndDate);
  return compareDates(normalizedEnd, actualEnd) <= 0 ? normalizedEnd : actualEnd;
};

export const generateBillingWeeks = (subscriptionStartDate, subscriptionEndDate) => {
  const start = resetTime(subscriptionStartDate);
  const billingEnd = getBillingEndDate(start, subscriptionEndDate);
  const weeks = [];
  let cursor = start;

  for (let weekIndex = 1; weekIndex <= WEEKS_PER_MONTH; weekIndex++) {
    const billingWeekStart = cursor;
    const billingWeekEnd = addDays(billingWeekStart, 6);

    if (compareDates(billingWeekEnd, billingEnd) > 0) {
      break;
    }

    weeks.push({ weekIndex, billingWeekStart, billingWeekEnd });
    cursor = addDays(billingWeekEnd, 1);
  }

  return weeks;
};

export const weekQualifiesForPeriod = (billingWeekEnd, periodStart, periodEnd) => {
  const end = resetTime(billingWeekEnd);
  return compareDates(end, periodStart) >= 0 && compareDates(end, periodEnd) <= 0;
};
