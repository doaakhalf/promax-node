import { compareDates, resetTime } from "./resetTime.js";

const utcDate = (year, month, day) => resetTime(new Date(Date.UTC(year, month, day)));

const lastDayOfMonth = (year, month) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

export const getPeriodForScheduledDate = (scheduledDate) => {
  const date = resetTime(scheduledDate);
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();

  if (day === 1) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return {
      periodStart: utcDate(prevYear, prevMonth, 16),
      periodEnd: utcDate(prevYear, prevMonth, lastDayOfMonth(prevYear, prevMonth)),
      scheduledDate: utcDate(year, month, 1),
      transferDay: 1,
    };
  }

  if (day === 16) {
    return {
      periodStart: utcDate(year, month, 1),
      periodEnd: utcDate(year, month, 15),
      scheduledDate: utcDate(year, month, 16),
      transferDay: 16,
    };
  }

  throw new Error("scheduledDate must be the 1st or 16th of a month");
};

export const getNextTransferInfo = (asOf = new Date()) => {
  const today = resetTime(asOf);
  const day = today.getUTCDate();
  const month = today.getUTCMonth();
  const year = today.getUTCFullYear();

  if (day === 1) {
    const period = getPeriodForScheduledDate(utcDate(year, month, 1));
    return { ...period, daysUntil: 0 };
  }

  if (day < 16) {
    const scheduledDate = utcDate(year, month, 16);
    const period = getPeriodForScheduledDate(scheduledDate);
    const daysUntil = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
    return { ...period, daysUntil };
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const scheduledDate = utcDate(nextYear, nextMonth, 1);
  const period = getPeriodForScheduledDate(scheduledDate);
  const daysUntil = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
  return { ...period, daysUntil };
};

export const getFollowingTransferInfo = (asOf = new Date()) => {
  const next = getNextTransferInfo(asOf);
  const scheduled = next.scheduledDate;
  const month = scheduled.getUTCMonth();
  const year = scheduled.getUTCFullYear();
  const day = scheduled.getUTCDate();

  let followingScheduled;
  if (day === 16) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    followingScheduled = utcDate(nextYear, nextMonth, 1);
  } else {
    followingScheduled = utcDate(year, month, 16);
  }

  const period = getPeriodForScheduledDate(followingScheduled);
  const today = resetTime(asOf);
  const daysUntil = Math.ceil((followingScheduled - today) / (1000 * 60 * 60 * 24));
  return { ...period, daysUntil };
};

export const isDateInPeriod = (date, periodStart, periodEnd) => {
  const d = resetTime(date);
  return compareDates(d, periodStart) >= 0 && compareDates(d, periodEnd) <= 0;
};

export const getScheduledDateForPeriod = (periodStart, periodEnd) => {
  const end = resetTime(periodEnd);
  const day = end.getUTCDate();
  const month = end.getUTCMonth();
  const year = end.getUTCFullYear();

  if (day === 15) {
    return resetTime(new Date(Date.UTC(year, month, 16)));
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  return resetTime(new Date(Date.UTC(nextYear, nextMonth, 1)));
};

export const formatPeriodLabel = (periodStart, periodEnd) => {
  const opts = { day: "numeric", month: "long" };
  const start = periodStart.toLocaleDateString("ar-EG", opts);
  const end = periodEnd.toLocaleDateString("ar-EG", opts);
  return `${start} - ${end}`;
};
