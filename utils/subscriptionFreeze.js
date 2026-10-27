import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import { updateOpenWeeks } from "../Controller/WorkoutCalendarController.js";
import { compareDates, resetTime } from "./resetTime.js";

export const MAX_FREEZE_DAYS = 14;

export class FreezeError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "FreezeError";
    this.statusCode = statusCode;
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const addUtcDays = (date, days) => {
  const next = resetTime(date);
  next.setUTCDate(next.getUTCDate() + days);
  return resetTime(next);
};

export const inclusiveDaySpan = (startDate, endDate) => {
  const start = resetTime(startDate);
  const end = resetTime(endDate);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
};

export const getFreezeRecord = (subscription) =>
  subscription?.metadata?.freeze || null;

export const isFreezeWindowOpen = (freeze, asOf = new Date()) => {
  if (!freeze || freeze.status !== "active") return false;
  const today = resetTime(asOf);
  const end = resetTime(freeze.freezeEnd);
  return compareDates(today, end) <= 0;
};

export const computeRemainingFreezeDays = (freeze, asOf = new Date()) => {
  if (!freeze || freeze.status !== "active") return 0;

  const today = resetTime(asOf);
  const start = resetTime(freeze.freezeStart);
  const end = resetTime(freeze.freezeEnd);

  if (compareDates(today, end) > 0) return 0;
  if (compareDates(today, start) < 0) {
    return Number.isInteger(freeze.days) && freeze.days > 0
      ? freeze.days
      : inclusiveDaySpan(start, end);
  }
  return inclusiveDaySpan(today, end);
};

export const buildFreezeInfo = (subscription, asOf = new Date()) => {
  const freeze = getFreezeRecord(subscription);
  if (!freeze) return null;

  const remainingDays = computeRemainingFreezeDays(freeze, asOf);
  const isActive = isFreezeWindowOpen(freeze, asOf);

  return {
    freezeStart: freeze.freezeStart ? resetTime(freeze.freezeStart) : null,
    freezeEnd: freeze.freezeEnd ? resetTime(freeze.freezeEnd) : null,
    days: freeze.days ?? null,
    status: freeze.status || null,
    frozenAt: freeze.frozenAt || null,
    frozenByAdminId: freeze.frozenByAdminId || null,
    unfrozenAt: freeze.unfrozenAt || null,
    unfrozenByAdminId: freeze.unfrozenByAdminId || null,
    remainingDaysReversed: freeze.remainingDaysReversed ?? null,
    remainingDays,
    isActive,
    canUnfreeze: freeze.status === "active" && remainingDays > 0,
  };
};

const ensureActiveSubscription = (subscription) => {
  if (!subscription || subscription.deletedAt != null) {
    throw new FreezeError(404, "Subscription not found");
  }
  if (subscription.status !== "active") {
    throw new FreezeError(400, "Only active subscriptions can be frozen");
  }
};

const validateFreezeWindow = (freezeStart, freezeEnd) => {
  if (!freezeStart || !freezeEnd) {
    throw new FreezeError(400, "freezeStart and freezeEnd are required");
  }

  const start = resetTime(freezeStart);
  const end = resetTime(freezeEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new FreezeError(400, "Invalid freezeStart or freezeEnd");
  }
  if (compareDates(end, start) < 0) {
    throw new FreezeError(400, "freezeEnd must be on or after freezeStart");
  }

  const days = inclusiveDaySpan(start, end);
  if (days < 1 || days > MAX_FREEZE_DAYS) {
    throw new FreezeError(
      400,
      `Freeze duration must be between 1 and ${MAX_FREEZE_DAYS} days`
    );
  }

  return { start, end, days };
};

const shiftFutureCalendarWeeks = async (subscription, dayDelta) => {
  if (!dayDelta) {
    return { shiftedWeekNumbers: [], calendar: null };
  }

  const calendar = await WorkoutCalendar.findOne({
    subscriptionId: subscription._id,
    deletedAt: null,
    status: "active",
  });

  if (!calendar) {
    return { shiftedWeekNumbers: [], calendar: null };
  }

  const today = resetTime(new Date());
  const shiftedWeekNumbers = [];

  for (const week of calendar.weeks || []) {
    if (compareDates(resetTime(week.startDate), today) < 0) continue;

    week.startDate = addUtcDays(week.startDate, dayDelta);
    week.endDate = addUtcDays(week.endDate, dayDelta);

    for (const day of week.trainingDays || []) {
      if (day?.date) {
        day.date = addUtcDays(day.date, dayDelta);
      }
    }

    shiftedWeekNumbers.push(week.weekNumber);
  }

  updateOpenWeeks(calendar);
  await calendar.save();

  return { shiftedWeekNumbers, calendar };
};

/**
 * Extend subscription endDate and push future calendar weeks forward.
 */
export const applySubscriptionFreeze = async ({
  subscription,
  freezeStart,
  freezeEnd,
  adminId,
}) => {
  ensureActiveSubscription(subscription);

  const existing = getFreezeRecord(subscription);
  if (existing?.status === "active" && isFreezeWindowOpen(existing)) {
    throw new FreezeError(400, "Subscription already has an active freeze");
  }

  const { start, end, days } = validateFreezeWindow(freezeStart, freezeEnd);

  subscription.endDate = addUtcDays(subscription.endDate, days);
  subscription.metadata = {
    ...(subscription.metadata && typeof subscription.metadata === "object"
      ? subscription.metadata
      : {}),
    freeze: {
      freezeStart: start,
      freezeEnd: end,
      days,
      frozenAt: new Date(),
      frozenByAdminId: adminId || null,
      status: "active",
    },
  };
  subscription.markModified("metadata");

  const { shiftedWeekNumbers } = await shiftFutureCalendarWeeks(
    subscription,
    days
  );
  await subscription.save();

  return {
    subscription,
    days,
    shiftedWeekNumbers,
    freeze: buildFreezeInfo(subscription),
  };
};

/**
 * Reverse only remaining freeze days (unused portion of the freeze window).
 */
export const applySubscriptionUnfreeze = async ({ subscription, adminId }) => {
  ensureActiveSubscription(subscription);

  const freeze = getFreezeRecord(subscription);
  if (!freeze || freeze.status !== "active") {
    throw new FreezeError(400, "No active freeze on this subscription");
  }

  const remainingDays = computeRemainingFreezeDays(freeze);
  if (remainingDays <= 0) {
    freeze.status = "completed";
    subscription.metadata = {
      ...(subscription.metadata && typeof subscription.metadata === "object"
        ? subscription.metadata
        : {}),
      freeze,
    };
    subscription.markModified("metadata");
    await subscription.save();
    throw new FreezeError(400, "Freeze window has already ended");
  }

  const nextEndDate = addUtcDays(subscription.endDate, -remainingDays);
  const today = resetTime(new Date());

  const calendarForGuard = await WorkoutCalendar.findOne({
    subscriptionId: subscription._id,
    deletedAt: null,
    status: "active",
  }).select("weeks.startDate weeks.endDate");

  const weeks = calendarForGuard?.weeks || [];
  if (weeks.length) {
    const lastWeek = weeks.reduce((latest, week) => {
      const end = resetTime(week.endDate);
      if (!latest || compareDates(end, resetTime(latest.endDate)) > 0) {
        return week;
      }
      return latest;
    }, null);

    if (lastWeek) {
      const lastEnd = resetTime(lastWeek.endDate);
      const lastStart = resetTime(lastWeek.startDate);
      const effectiveMinEnd =
        compareDates(lastStart, today) >= 0
          ? addUtcDays(lastEnd, -remainingDays)
          : lastEnd;

      if (compareDates(nextEndDate, effectiveMinEnd) < 0) {
        throw new FreezeError(
          400,
          "Cannot unfreeze: endDate would fall before the last calendar week"
        );
      }
    }
  }

  subscription.endDate = nextEndDate;

  const { shiftedWeekNumbers } = await shiftFutureCalendarWeeks(
    subscription,
    -remainingDays
  );

  subscription.metadata = {
    ...(subscription.metadata && typeof subscription.metadata === "object"
      ? subscription.metadata
      : {}),
    freeze: {
      ...freeze,
      status: "cancelled",
      unfrozenAt: new Date(),
      unfrozenByAdminId: adminId || null,
      remainingDaysReversed: remainingDays,
    },
  };
  subscription.markModified("metadata");
  await subscription.save();

  return {
    subscription,
    remainingDaysReversed: remainingDays,
    shiftedWeekNumbers,
    freeze: buildFreezeInfo(subscription),
  };
};
