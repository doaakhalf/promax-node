import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import CoachPayout from "../Models/CoachPayout.js";
import User from "../Models/User.js";
import { compareDates, resetTime } from "../utils/resetTime.js";
import {
  getBillingWeeks,
  weekQualifiesForPeriod,
  inclusiveDays,
} from "../utils/billingWeeks.js";
import {
  decimalToNumber,
  getWeeklyRate,
  resolveSubscriptionAmounts,
  toMoney,
} from "../utils/coachNetAmount.js";
import { isWeekEligible } from "../utils/workoutEligibility.js";
import {
  formatPeriodLabel,
  getFollowingTransferInfo,
  getNextTransferInfo,
  getPeriodForScheduledDate,
  getScheduledDateForPeriod,
} from "../utils/payoutPeriods.js";

const weekKey = (weekStart, weekEnd) =>
  `${resetTime(weekStart).toISOString()}-${resetTime(weekEnd).toISOString()}`;

const formatAthleteName = (user) => {
  if (!user) return "Unknown";
  const lastInitial = user.lastName ? `${user.lastName.charAt(0).toUpperCase()}.` : "";
  return `${user.firstName || ""} ${lastInitial}`.trim();
};

const getInitials = (user) => {
  if (!user) return "??";
  const first = user.firstName?.charAt(0)?.toUpperCase() || "";
  const last = user.lastName?.charAt(0)?.toUpperCase() || "";
  return `${first}${last}` || "??";
};

const isSubscriptionExpired = (subscription, asOf = new Date()) => {
  if (subscription.status === "expired") return true;
  if (!subscription.endDate) return false;
  return compareDates(subscription.endDate, asOf) < 0;
};

const isHiddenSubscriptionStatus = (status) =>
  ["rejected", "refunded", "cancelled"].includes(status);

const PAID_PAYMENT_STATUSES = ["active", "expired"];

const isSuccessfullyPaid = (subscription, paymentBySubscriptionId) => {
  if (PAID_PAYMENT_STATUSES.includes(subscription.paymentStatus)) return true;
  const payment = paymentBySubscriptionId.get(subscription._id.toString());
  return PAID_PAYMENT_STATUSES.includes(payment?.status);
};

// Only weeks in PAID payouts are locked. Pending/processing payouts are draft
// snapshots for admin review — they must NOT hide weeks from live earnings preview.
const SETTLED_PAYOUT_STATUS = "paid";

const loadEarningsContext = async (subscriptions) => {
  const visibleSubscriptions = subscriptions.filter(
    (subscription) => !isHiddenSubscriptionStatus(subscription.status)
  );

  if (visibleSubscriptions.length === 0) {
    return {
      athleteMap: new Map(),
      calendarMap: new Map(),
      paymentBySubscriptionId: new Map(),
      paidWeekKeysBySubscriptionId: new Map(),
    };
  }

  const subscriptionIds = visibleSubscriptions.map((subscription) => subscription._id);
  const athleteIds = [
    ...new Set(visibleSubscriptions.map((subscription) => subscription.athleteId.toString())),
  ];
  const subscriptionIdsNeedingPaymentCheck = visibleSubscriptions
    .filter((subscription) => !PAID_PAYMENT_STATUSES.includes(subscription.paymentStatus))
    .map((subscription) => subscription._id);

  const [athletes, calendars, payments, paidPayouts] = await Promise.all([
    User.find({ _id: { $in: athleteIds } }).lean(),
    WorkoutCalendar.find({
      subscriptionId: { $in: subscriptionIds },
      deletedAt: null,
    }).lean(),
    subscriptionIdsNeedingPaymentCheck.length
      ? SubscriptionPayment.find({
          subscriptionId: { $in: subscriptionIdsNeedingPaymentCheck },
          deletedAt: null,
        }).lean()
      : Promise.resolve([]),
    CoachPayout.find({
      deletedAt: null,
      status: SETTLED_PAYOUT_STATUS,
      "lineItems.subscriptionId": { $in: subscriptionIds },
      "lineItems.isEligible": true,
    }).lean(),
  ]);

  const athleteMap = new Map(athletes.map((athlete) => [athlete._id.toString(), athlete]));
  const calendarMap = new Map(
    calendars.map((calendar) => [calendar.subscriptionId.toString(), calendar])
  );

  const paymentBySubscriptionId = new Map();
  for (const payment of payments) {
    const key = payment.subscriptionId.toString();
    if (!paymentBySubscriptionId.has(key)) {
      paymentBySubscriptionId.set(key, payment);
    }
  }

  const paidWeekKeysBySubscriptionId = new Map(
    subscriptionIds.map((subscriptionId) => [subscriptionId.toString(), new Set()])
  );
  for (const payout of paidPayouts) {
    for (const item of payout.lineItems || []) {
      if (!item.isEligible) continue;
      const paidWeekKeys = paidWeekKeysBySubscriptionId.get(item.subscriptionId?.toString());
      if (paidWeekKeys) {
        paidWeekKeys.add(weekKey(item.billingWeekStart, item.billingWeekEnd));
      }
    }
  }

  return {
    athleteMap,
    calendarMap,
    paymentBySubscriptionId,
    paidWeekKeysBySubscriptionId,
  };
};

const buildLineItem = ({
  subscription,
  athlete,
  week,
  calendar,
  periodStart,
  periodEnd,
  paidWeekKeys,
  isPaid,
  expired = false,
  carryOutstanding = false,
}) => {
  const { amount: grossAmount, platformFee, coachNetAmount } = resolveSubscriptionAmounts(subscription);
  const weeklyRate = getWeeklyRate(coachNetAmount);
  const key = weekKey(week.billingWeekStart, week.billingWeekEnd);
  const inPeriod = weekQualifiesForPeriod(week.billingWeekEnd, periodStart, periodEnd);

  let isEligible = false;
  let ineligibleReason = null;
  let allocatedAmount = 0;

  const eligibility = isWeekEligible(
    calendar,
    week.billingWeekStart,
    week.billingWeekEnd,
    week
  );

  const outstandingCarry =
    expired &&
    carryOutstanding &&
    isPaid &&
    eligibility.eligible &&
    !paidWeekKeys.has(key) &&
    compareDates(week.billingWeekEnd, periodStart) < 0;

  if (!isPaid) {
    ineligibleReason = "pending_payment";
  } else if (paidWeekKeys.has(key)) {
    ineligibleReason = "already_paid";
  } else if (eligibility.eligible && (inPeriod || outstandingCarry)) {
    isEligible = true;
    allocatedAmount = weeklyRate;
  } else if (!inPeriod && !outstandingCarry) {
    ineligibleReason = "partial_week";
  } else {
    ineligibleReason = eligibility.reason;
  }

  return {
    subscriptionId: subscription._id,
    athleteId: subscription.athleteId,
    athleteName: formatAthleteName(athlete),
    athleteInitials: getInitials(athlete),
    subscriptionPlan: subscription.subscriptionPlan,
    subscriptionStartDate: subscription.startDate,
    subscriptionEndDate: subscription.endDate,
    billingWeekStart: week.billingWeekStart,
    billingWeekEnd: week.billingWeekEnd,
    weekIndex: week.weekIndex,
    grossAmount,
    platformFee,
    coachNetAmount,
    weeklyRate,
    allocatedAmount,
    isEligible,
    ineligibleReason,
    isPartialNew: week.weekIndex === 1,
    assignedDaysCount: eligibility.assignedDaysCount,
    requiredDaysCount: eligibility.requiredDaysCount,
  };
};

const computeLineItemsForCoach = async (
  coachId,
  periodStart,
  periodEnd,
  { asOf = new Date(), carryOutstanding = false } = {}
) => {
  const today = resetTime(asOf);
  const query = {
    coachId,
    deletedAt: null,
    startDate: { $lte: periodEnd },
    status: { $nin: ["rejected", "refunded", "cancelled"] },
  };

  if (carryOutstanding) {
    query.$or = [
      { endDate: { $gte: periodStart } },
      { status: "expired" },
      { endDate: { $lt: today } },
    ];
  } else {
    query.endDate = { $gte: periodStart };
  }

  const subscriptions = await Subscription.find(query).lean();
  const {
    athleteMap,
    calendarMap,
    paymentBySubscriptionId,
    paidWeekKeysBySubscriptionId,
  } = await loadEarningsContext(subscriptions);

  const lineItems = [];

  for (const subscription of subscriptions) {
    if (isHiddenSubscriptionStatus(subscription.status)) continue;

    const expired = isSubscriptionExpired(subscription, today);
    const athlete = athleteMap.get(subscription.athleteId?.toString());
    const calendar = calendarMap.get(subscription._id.toString());
    const isPaid = isSuccessfullyPaid(subscription, paymentBySubscriptionId);
    const paidWeekKeys =
      paidWeekKeysBySubscriptionId.get(subscription._id.toString()) ?? new Set();

    const weeks = getBillingWeeks(subscription, calendar);

    for (const week of weeks) {
      const item = buildLineItem({
        subscription,
        athlete,
        week,
        calendar,
        periodStart,
        periodEnd,
        paidWeekKeys,
        isPaid,
        expired,
        carryOutstanding,
      });

      const inPeriod = weekQualifiesForPeriod(week.billingWeekEnd, periodStart, periodEnd);

      if (expired) {
        if (item.isEligible) lineItems.push(item);
      } else if (item.isEligible || inPeriod) {
        lineItems.push(item);
      }
    }
  }

  return lineItems;
};

const sumEligibleAmount = (lineItems) =>
  toMoney(
    lineItems.filter((item) => item.isEligible).reduce((sum, item) => sum + item.allocatedAmount, 0)
  );

export const computeCoachEarnings = async (
  coachId,
  periodStart,
  periodEnd,
  options = {}
) => {
  const lineItems = await computeLineItemsForCoach(coachId, periodStart, periodEnd, options);
  return {
    amount: sumEligibleAmount(lineItems),
    lineItems,
  };
};

const aggregateTraineesFromLineItems = (lineItems, { eligibleOnly = true } = {}) => {
  const map = new Map();
  const source = eligibleOnly ? lineItems.filter((i) => i.isEligible) : lineItems;

  for (const item of source) {
    const key = item.athleteId.toString();
    if (!map.has(key)) {
      map.set(key, {
        athleteId: item.athleteId,
        athleteName: item.athleteName,
        initials: item.athleteInitials || "??",
        subscriptionPlan: item.subscriptionPlan,
        subscriptionStartDate: item.subscriptionStartDate,
        subscriptionEndDate: item.subscriptionEndDate,
        subscriptionPeriodLabel: formatPeriodLabel(
          item.subscriptionStartDate,
          item.subscriptionEndDate
        ),
        grossAmount: item.grossAmount,
        platformFee: item.platformFee,
        coachNetAmount: item.coachNetAmount,
        weeklyRate: item.weeklyRate,
        allocatedAmount: 0,
        weeksCount: 0,
        weeks: [],
        badge: item.isPartialNew ? "new_subscription" : null,
      });
    }

    const trainee = map.get(key);
    if (item.isEligible) {
      trainee.allocatedAmount = toMoney(trainee.allocatedAmount + item.allocatedAmount);
      trainee.weeksCount += 1;
    }
    trainee.weeks.push({
      weekIndex: item.weekIndex,
      billingWeekStart: item.billingWeekStart,
      billingWeekEnd: item.billingWeekEnd,
      periodLabel: formatPeriodLabel(item.billingWeekStart, item.billingWeekEnd),
      amount: item.allocatedAmount,
      isEligible: item.isEligible,
      ineligibleReason: item.ineligibleReason,
    });
  }

  return Array.from(map.values()).map((trainee) => {
    const billedWeeks = trainee.weeks.filter((week) => week.isEligible !== false);
    const rangeWeeks = billedWeeks.length ? billedWeeks : trainee.weeks;
    const earningPeriodStart = rangeWeeks[0]?.billingWeekStart || null;
    const earningPeriodEnd = rangeWeeks[rangeWeeks.length - 1]?.billingWeekEnd || null;
    return {
      ...trainee,
      earningPeriodStart,
      earningPeriodEnd,
      earningPeriodLabel:
        earningPeriodStart && earningPeriodEnd
          ? formatPeriodLabel(earningPeriodStart, earningPeriodEnd)
          : null,
    };
  });
};

export const getDashboard = async (coachId, filter = "this_month", asOf = new Date()) => {
  const next = getNextTransferInfo(asOf);
  const following = getFollowingTransferInfo(asOf);

  const [nextEarnings, followingEarnings, paidThisMonth] = await Promise.all([
    computeCoachEarnings(coachId, next.periodStart, next.periodEnd, {
      asOf,
      carryOutstanding: true,
    }),
    computeCoachEarnings(coachId, following.periodStart, following.periodEnd, {
      asOf,
      carryOutstanding: false,
    }),
    CoachPayout.find({
      coachId,
      status: "paid",
      deletedAt: null,
      scheduledDate: {
        $gte: resetTime(new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1))),
        $lte: resetTime(new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0))),
      },
    }).lean(),
  ]);

  const totalProfits = toMoney(
    paidThisMonth.reduce((sum, payout) => sum + decimalToNumber(payout.amount), 0)
  );

  return {
    filter,
    totalProfits: {
      amount: totalProfits,
      label: "منذ بداية الشهر",
    },
    nextPayout: {
      amount: nextEarnings.amount,
      scheduledDate: next.scheduledDate,
      daysUntil: next.daysUntil,
      periodStart: next.periodStart,
      periodEnd: next.periodEnd,
      periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
    },
    followingPeriod: {
      amount: followingEarnings.amount,
      scheduledDate: following.scheduledDate,
      periodStart: following.periodStart,
      periodEnd: following.periodEnd,
      periodLabel: formatPeriodLabel(following.periodStart, following.periodEnd),
    },
    transferSchedule: {
      days: [1, 16],
      label: "من كل شهر",
    },
  };
};

export const getNextPayoutDetails = async (coachId, { page = 1, limit = 20 } = {}, asOf = new Date()) => {
  const next = getNextTransferInfo(asOf);
  const lineItems = await computeLineItemsForCoach(coachId, next.periodStart, next.periodEnd, {
    asOf,
    carryOutstanding: true,
  });
  const trainees = aggregateTraineesFromLineItems(lineItems, { eligibleOnly: false });

  const start = (page - 1) * limit;
  const items = trainees.slice(start, start + limit);

  return {
    periodStart: next.periodStart,
    periodEnd: next.periodEnd,
    periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
    totalAmount: sumEligibleAmount(lineItems),
    pagination: {
      page,
      limit,
      total: trainees.length,
      totalPages: Math.ceil(trainees.length / limit) || 1,
    },
    items: items.map((item) => ({
      ...item,
      badgeDays: item.weeks[0]
        ? inclusiveDays(item.weeks[0].billingWeekStart, item.weeks[0].billingWeekEnd)
        : 0,
    })),
  };
};

export const getPaymentHistory = async (coachId, { year, page = 1, limit = 12 } = {}) => {
  const targetYear = year ? parseInt(year, 10) : new Date().getUTCFullYear();
  const yearStart = resetTime(new Date(Date.UTC(targetYear, 0, 1)));
  const yearEnd = resetTime(new Date(Date.UTC(targetYear, 11, 31)));

  const payouts = await CoachPayout.find({
    coachId,
    status: "paid",
    deletedAt: null,
    scheduledDate: { $gte: yearStart, $lte: yearEnd },
  })
    .sort({ scheduledDate: -1 })
    .lean();

  const monthMap = new Map();

  for (const payout of payouts) {
    const month = payout.scheduledDate.getUTCMonth() + 1;
    const key = `${payout.scheduledDate.getUTCFullYear()}-${month}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month,
        year: payout.scheduledDate.getUTCFullYear(),
        label: payout.scheduledDate.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
        totalPaid: 0,
        payoutCount: 0,
        payouts: [],
      });
    }

    const entry = monthMap.get(key);
    const amount = decimalToNumber(payout.amount);
    const eligibleItems = (payout.lineItems || []).filter((item) => item.isEligible);
    const traineeIds = new Set(eligibleItems.map((item) => item.athleteId.toString()));

    entry.totalPaid = toMoney(entry.totalPaid + amount);
    entry.payoutCount += 1;
    entry.payouts.push({
      payoutId: payout._id,
      scheduledDate: payout.scheduledDate,
      transferDay: payout.scheduledDate.getUTCDate(),
      paidAt: payout.paidAt,
      status: payout.status,
      amount,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      periodLabel: formatPeriodLabel(payout.periodStart, payout.periodEnd),
      traineeCount: traineeIds.size,
    });
  }

  const months = Array.from(monthMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const start = (page - 1) * limit;
  const paginatedMonths = months.slice(start, start + limit);

  return {
    year: targetYear,
    pagination: {
      page,
      limit,
      total: months.length,
      totalPages: Math.ceil(months.length / limit) || 1,
    },
    months: paginatedMonths,
  };
};

export const getPayoutDetails = async (coachId, payoutId) => {
  const payout = await CoachPayout.findOne({
    _id: payoutId,
    coachId,
    status: "paid",
    deletedAt: null,
  }).lean();

  if (!payout) {
    return null;
  }

  const trainees = aggregateTraineesFromLineItems(payout.lineItems || []);

  return {
    payoutId: payout._id,
    scheduledDate: payout.scheduledDate,
    transferDay: payout.scheduledDate.getUTCDate(),
    paidAt: payout.paidAt,
    amount: decimalToNumber(payout.amount),
    periodStart: payout.periodStart,
    periodEnd: payout.periodEnd,
    periodLabel: formatPeriodLabel(payout.periodStart, payout.periodEnd),
    trainees,
  };
};

export const generatePayouts = async ({
  scheduledDate,
  periodStart,
  periodEnd,
  coachId = null,
} = {}) => {
  let period;
  if (scheduledDate) {
    period = getPeriodForScheduledDate(resetTime(new Date(scheduledDate)));
  } else if (periodStart && periodEnd) {
    const start = resetTime(new Date(periodStart));
    const end = resetTime(new Date(periodEnd));
    period = {
      periodStart: start,
      periodEnd: end,
      scheduledDate: getScheduledDateForPeriod(start, end),
      transferDay: getScheduledDateForPeriod(start, end).getUTCDate(),
    };
  } else {
    throw new Error("scheduledDate or periodStart/periodEnd required");
  }

  let coachIds;
  if (coachId) {
    coachIds = [coachId];
  } else {
    coachIds = await Subscription.distinct("coachId", { deletedAt: null });
  }

  const results = [];

  for (const id of coachIds) {
    const existing = await CoachPayout.findOne({
      coachId: id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      deletedAt: null,
    });

    if (existing?.status === "paid") {
      results.push({ coachId: id, status: "skipped", reason: "already_paid" });
      continue;
    }

    // Recompute from scratch. Pending rows are drafts only — weeks stay
    // visible in coach dashboard until this payout is marked paid.
    const { amount, lineItems } = await computeCoachEarnings(
      id,
      period.periodStart,
      period.periodEnd,
      { carryOutstanding: true }
    );

    const payload = {
      coachId: id,
      amount,
      currency: "EGP",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      scheduledDate: period.scheduledDate || existing?.scheduledDate,
      status: "pending",
      lineItems,
    };

    if (existing) {
      existing.amount = amount;
      existing.lineItems = lineItems;
      await existing.save();
      results.push({ coachId: id, payoutId: existing._id, status: "updated", amount });
    } else if (amount > 0 || lineItems.length > 0) {
      const payout = await CoachPayout.create(payload);
      results.push({ coachId: id, payoutId: payout._id, status: "created", amount });
    } else {
      results.push({ coachId: id, status: "skipped", reason: "no_eligible_earnings" });
    }
  }

  return results;
};

export const listUpcomingPayouts = async ({
  asOf = new Date(),
  includeZero = false,
} = {}) => {
  const next = getNextTransferInfo(asOf);
  const coachIds = await Subscription.distinct("coachId", {
    deletedAt: null,
    status: { $nin: ["rejected", "refunded", "cancelled"] },
  });

  const [coaches, pendingPayouts] = await Promise.all([
    User.find({ _id: { $in: coachIds } }).select("firstName lastName email").lean(),
    CoachPayout.find({
      coachId: { $in: coachIds },
      deletedAt: null,
      status: "pending",
      periodStart: next.periodStart,
      periodEnd: next.periodEnd,
    }).lean(),
  ]);

  const coachMap = new Map(coaches.map((coach) => [coach._id.toString(), coach]));
  const pendingMap = new Map(
    pendingPayouts.map((payout) => [payout.coachId.toString(), payout])
  );

  const payouts = [];

  for (const coachId of coachIds) {
    const { amount, lineItems } = await computeCoachEarnings(
      coachId,
      next.periodStart,
      next.periodEnd,
      { asOf, carryOutstanding: true }
    );

    if (!includeZero && amount <= 0) continue;

    const eligible = lineItems.filter((item) => item.isEligible);
    const traineeIds = new Set(eligible.map((item) => item.athleteId.toString()));
    const coach = coachMap.get(coachId.toString());
    const pending = pendingMap.get(coachId.toString());

    payouts.push({
      coachId,
      coach: coach
        ? {
            id: coach._id,
            firstName: coach.firstName,
            lastName: coach.lastName,
            email: coach.email,
            name: `${coach.firstName || ""} ${coach.lastName || ""}`.trim(),
          }
        : null,
      amount,
      scheduledDate: next.scheduledDate,
      daysUntil: next.daysUntil,
      periodStart: next.periodStart,
      periodEnd: next.periodEnd,
      periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
      traineeCount: traineeIds.size,
      weeksCount: eligible.length,
      pendingPayoutId: pending?._id || null,
    });
  }

  payouts.sort((a, b) => b.amount - a.amount);

  return {
    scheduledDate: next.scheduledDate,
    periodStart: next.periodStart,
    periodEnd: next.periodEnd,
    periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
    daysUntil: next.daysUntil,
    coachCount: payouts.length,
    totalAmount: toMoney(payouts.reduce((sum, row) => sum + row.amount, 0)),
    payouts,
  };
};

export const listPayouts = async ({ coachId, status, from, to } = {}) => {
  const query = { deletedAt: null };
  if (coachId) query.coachId = coachId;
  if (status) query.status = status;
  if (from || to) {
    query.scheduledDate = {};
    if (from) query.scheduledDate.$gte = resetTime(new Date(from));
    if (to) query.scheduledDate.$lte = resetTime(new Date(to));
  }

  return CoachPayout.find(query)
    .populate("coachId", "firstName lastName email")
    .sort({ scheduledDate: -1 })
    .lean();
};

export const markPayoutPaid = async (payoutId, { paidBy, paymentReference, notes } = {}) => {
  const payout = await CoachPayout.findOne({ _id: payoutId, deletedAt: null });
  if (!payout) return null;
  if (payout.status === "paid") return payout;

  payout.status = "paid";
  payout.paidAt = new Date();
  payout.paidBy = paidBy;
  payout.paymentReference = paymentReference || null;
  payout.notes = notes || null;
  await payout.save();
  return payout;
};
