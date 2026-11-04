import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import CoachPayout from "../Models/CoachPayout.js";
import Coach from "../Models/Coach.js";
import User from "../Models/User.js";
import { compareDates, resetTime } from "../utils/resetTime.js";
import {
  getBillingWeeks,
  getPeriodAssignmentDate,
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
import { displayName } from "../utils/displayName.js";

const weekKey = (weekStart, weekEnd) =>
  `${resetTime(weekStart).toISOString()}-${resetTime(weekEnd).toISOString()}`;

const getCoachPaymentMap = async (userIds = []) => {
  const ids = [...new Set(userIds.map((id) => id?.toString()).filter(Boolean))];
  if (!ids.length) return new Map();

  const coaches = await Coach.find({
    userId: { $in: ids },
    deletedAt: null,
  })
    .select("userId instapayLink walletNumber")
    .lean();

  return new Map(
    coaches.map((coach) => [
      coach.userId.toString(),
      {
        instapayLink: coach.instapayLink || null,
        walletNumber: coach.walletNumber || null,
      },
    ])
  );
};

const formatAthleteName = (user) => {
  if (!user) return "Unknown";
  return displayName(user) || "Unknown";
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
const payoutGenerationInFlight = new Map();
const upcomingPayoutsInFlight = new Map();

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
  const weeklyRate = subscription.subscriptionPlan === "weekly"
    ? toMoney(coachNetAmount)
    : getWeeklyRate(coachNetAmount);
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
    compareDates(getPeriodAssignmentDate(week.billingWeekEnd), periodStart) < 0;

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

const subscriptionEarningsQuery = (
  coachIdOrIds,
  periodStart,
  periodEnd,
  { asOf = new Date(), carryOutstanding = false } = {}
) => {
  const today = resetTime(asOf);
  const query = {
    coachId: Array.isArray(coachIdOrIds) ? { $in: coachIdOrIds } : coachIdOrIds,
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

  return query;
};

const buildLineItemsFromSubscriptions = (
  subscriptions,
  {
    athleteMap,
    calendarMap,
    paymentBySubscriptionId,
    paidWeekKeysBySubscriptionId,
  },
  periodStart,
  periodEnd,
  { asOf = new Date(), carryOutstanding = false } = {}
) => {
  const today = resetTime(asOf);
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

const computeLineItemsForCoach = async (
  coachId,
  periodStart,
  periodEnd,
  options = {}
) => {
  const subscriptions = await Subscription.find(
    subscriptionEarningsQuery(coachId, periodStart, periodEnd, options)
  ).lean();
  const context = await loadEarningsContext(subscriptions);
  return buildLineItemsFromSubscriptions(
    subscriptions,
    context,
    periodStart,
    periodEnd,
    options
  );
};

const sumEligibleAmount = (lineItems) =>
  toMoney(
    lineItems.filter((item) => item.isEligible).reduce((sum, item) => sum + item.allocatedAmount, 0)
  );

const INELIGIBLE_REASON_LABELS_AR = {
  no_assignment: "لم يتم تعيين التمارين بالكامل لهذا الأسبوع",
  pending_payment: "اشتراك المتدرب لم يُدفع بعد",
  already_paid: "تم صرف هذا الأسبوع مسبقاً",
  partial_week: "الأسبوع خارج فترة التحويل الحالية",
};

const REASON_PRIORITY = ["no_assignment", "pending_payment", "already_paid", "partial_week"];

const getIneligibleReasonLabel = (reason) =>
  (reason && INELIGIBLE_REASON_LABELS_AR[reason]) || null;

const buildZeroAmountMessage = (primaryReason, count) => {
  if (!primaryReason || !count) return null;

  const n = count;
  const weekWord = n === 1 ? "أسبوع" : "أسابيع";

  switch (primaryReason) {
    case "no_assignment":
      return `المستحق ٠ ج.م لأن ${n} ${weekWord} بدون تعيين تمارين كامل`;
    case "pending_payment":
      return `المستحق ٠ ج.م لأن ${n} ${weekWord} بانتظار دفع اشتراك المتدرب`;
    case "already_paid":
      return `المستحق ٠ ج.م لأن ${n} ${weekWord} تم صرفها مسبقاً`;
    case "partial_week":
      return `المستحق ٠ ج.م لأن ${n} ${weekWord} خارج فترة التحويل الحالية`;
    default:
      return `المستحق ٠ ج.م`;
  }
};

const summarizeLineItems = (lineItems = [], { amount = null } = {}) => {
  const eligibleWeeksCount = lineItems.filter((item) => item.isEligible).length;
  const ineligibleItems = lineItems.filter((item) => !item.isEligible && item.ineligibleReason);
  const ineligibleWeeksCount = ineligibleItems.length;

  const reasonCounts = {};
  for (const item of ineligibleItems) {
    const reason = item.ineligibleReason;
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }

  let primaryReason = null;
  let maxCount = 0;
  for (const reason of REASON_PRIORITY) {
    const count = reasonCounts[reason] || 0;
    if (count > maxCount) {
      maxCount = count;
      primaryReason = reason;
    }
  }
  if (!primaryReason) {
    for (const [reason, count] of Object.entries(reasonCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryReason = reason;
      }
    }
  }

  const resolvedAmount = amount == null ? sumEligibleAmount(lineItems) : amount;
  const message =
    resolvedAmount <= 0 && primaryReason
      ? buildZeroAmountMessage(primaryReason, reasonCounts[primaryReason] || 0)
      : null;

  return {
    eligibleWeeksCount,
    ineligibleWeeksCount,
    reasonCounts,
    primaryReason,
    message,
  };
};

const enrichWeekFromLineItem = (item) => ({
  weekIndex: item.weekIndex,
  billingWeekStart: item.billingWeekStart,
  billingWeekEnd: item.billingWeekEnd,
  periodLabel: formatPeriodLabel(item.billingWeekStart, item.billingWeekEnd),
  amount: toMoney(decimalToNumber(item.allocatedAmount)),
  isEligible: item.isEligible,
  ineligibleReason: item.ineligibleReason,
  ineligibleReasonLabel: getIneligibleReasonLabel(item.ineligibleReason),
  assignedDaysCount: item.assignedDaysCount ?? 0,
  requiredDaysCount: item.requiredDaysCount ?? 0,
});

const periodSummaryFields = (lineItems, amount) => {
  const summary = summarizeLineItems(lineItems, { amount });
  return {
    eligibleWeeksCount: summary.eligibleWeeksCount,
    ineligibleWeeksCount: summary.ineligibleWeeksCount,
    reasonCounts: summary.reasonCounts,
    primaryReason: summary.primaryReason,
    message: summary.message,
  };
};

// A paid row with no eligible weeks did not settle the period. It must not
// block a later draft (for example mark-paid on an empty generated payout).
const isEmptyPaidPayout = (payout) => {
  if (decimalToNumber(payout?.amount) > 0) return false;
  return !(payout?.lineItems || []).some(
    (item) => item.isEligible && decimalToNumber(item.allocatedAmount) > 0
  );
};

const payoutHasPayableAmount = (payout) => {
  if (decimalToNumber(payout?.amount) <= 0) return false;
  return (payout?.lineItems || []).some(
    (item) => item.isEligible && decimalToNumber(item.allocatedAmount) > 0
  );
};

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
        grossAmount: toMoney(decimalToNumber(item.grossAmount)),
        platformFee: toMoney(decimalToNumber(item.platformFee)),
        coachNetAmount: toMoney(decimalToNumber(item.coachNetAmount)),
        weeklyRate: toMoney(decimalToNumber(item.weeklyRate)),
        allocatedAmount: 0,
        weeksCount: 0,
        weeks: [],
        badge: item.isPartialNew ? "new_subscription" : null,
      });
    }

    const trainee = map.get(key);
    if (item.isEligible) {
      trainee.allocatedAmount = toMoney(
        trainee.allocatedAmount + decimalToNumber(item.allocatedAmount)
      );
      trainee.weeksCount += 1;
    }
    trainee.weeks.push(enrichWeekFromLineItem(item));
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
      ...periodSummaryFields(nextEarnings.lineItems, nextEarnings.amount),
    },
    followingPeriod: {
      amount: followingEarnings.amount,
      scheduledDate: following.scheduledDate,
      periodStart: following.periodStart,
      periodEnd: following.periodEnd,
      periodLabel: formatPeriodLabel(following.periodStart, following.periodEnd),
      ...periodSummaryFields(followingEarnings.lineItems, followingEarnings.amount),
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
  const totalAmount = sumEligibleAmount(lineItems);

  const start = (page - 1) * limit;
  const items = trainees.slice(start, start + limit);

  return {
    periodStart: next.periodStart,
    periodEnd: next.periodEnd,
    periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
    totalAmount,
    ...periodSummaryFields(lineItems, totalAmount),
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
      paymentReference: payout.paymentReference || null,
      paymentProofImage: payout.paymentProofImage || null,
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

  const lineItems = payout.lineItems || [];
  const amount = decimalToNumber(payout.amount);
  const trainees = aggregateTraineesFromLineItems(lineItems, { eligibleOnly: false });

  return {
    payoutId: payout._id,
    scheduledDate: payout.scheduledDate,
    transferDay: payout.scheduledDate.getUTCDate(),
    paidAt: payout.paidAt,
    amount,
    periodStart: payout.periodStart,
    periodEnd: payout.periodEnd,
    periodLabel: formatPeriodLabel(payout.periodStart, payout.periodEnd),
    paymentReference: payout.paymentReference || null,
    paymentProofImage: payout.paymentProofImage || null,
    ...periodSummaryFields(lineItems, amount),
    trainees,
  };
};

const generatePayoutsInternal = async ({
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
    period = getNextTransferInfo();
  }

  let coachIds;
  if (coachId) {
    coachIds = [coachId];
  } else {
    coachIds = await Subscription.distinct("coachId", { deletedAt: null });
  }

  const results = [];

  const scheduled = resetTime(period.scheduledDate);
  const scheduledDayEnd = new Date(scheduled);
  scheduledDayEnd.setUTCDate(scheduledDayEnd.getUTCDate() + 1);
  const scheduledDayQuery = {
    scheduledDate: { $gte: scheduled, $lt: scheduledDayEnd },
  };

  for (const id of coachIds) {
    // Prefer matching by period; also catch legacy rows that share the same
    // transfer day but differ by one day on periodEnd (e.g. 1–15 vs 1–16).
    const existing =
      (await CoachPayout.findOne({
        coachId: id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        deletedAt: null,
      })) ||
      (await CoachPayout.findOne({
        coachId: id,
        deletedAt: null,
        ...scheduledDayQuery,
      }).sort({ status: 1, updatedAt: -1 }));

    if (existing?.status === "paid" && !isEmptyPaidPayout(existing)) {
      // Soft-delete stale pending drafts left over from period-boundary drift.
      await CoachPayout.updateMany(
        {
          coachId: id,
          deletedAt: null,
          status: { $in: ["pending", "processing"] },
          ...scheduledDayQuery,
          _id: { $ne: existing._id },
        },
        { $set: { deletedAt: new Date() } }
      );
      results.push({ coachId: id, status: "skipped", reason: "already_paid" });
      continue;
    }

    if (existing?.status === "paid") {
      existing.status = "pending";
      existing.paidAt = null;
      existing.paidBy = null;
      existing.paymentReference = null;
      existing.paymentProofImage = null;
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
      if (amount <= 0) {
        existing.deletedAt = new Date();
        await existing.save();
        results.push({ coachId: id, payoutId: existing._id, status: "skipped", reason: "no_eligible_earnings" });
      } else {
        existing.amount = amount;
        existing.lineItems = lineItems;
        existing.periodStart = period.periodStart;
        existing.periodEnd = period.periodEnd;
        existing.scheduledDate = period.scheduledDate || existing.scheduledDate;
        existing.status = "pending";
        await existing.save();
        results.push({ coachId: id, payoutId: existing._id, status: "updated", amount });
      }
    } else if (amount > 0) {
      const payout = await CoachPayout.create(payload);
      results.push({ coachId: id, payoutId: payout._id, status: "created", amount });
    } else {
      results.push({ coachId: id, status: "skipped", reason: "no_eligible_earnings" });
    }
  }

  return results;
};

export const generatePayouts = (options = {}) => {
  const key = JSON.stringify({
    scheduledDate: options.scheduledDate ?? null,
    periodStart: options.periodStart ?? null,
    periodEnd: options.periodEnd ?? null,
    coachId: options.coachId ?? null,
  });

  const running = payoutGenerationInFlight.get(key);
  if (running) return running;

  const promise = generatePayoutsInternal(options).finally(() => {
    payoutGenerationInFlight.delete(key);
  });
  payoutGenerationInFlight.set(key, promise);
  return promise;
};

const listUpcomingPayoutsInternal = async ({
  asOf = new Date(),
  includeZero = false,
  summaryOnly = false,
} = {}) => {
  const next = getNextTransferInfo(asOf);
  const earningsOptions = { asOf, carryOutstanding: true };
  const coachIds = await Subscription.distinct("coachId", {
    deletedAt: null,
    status: { $nin: ["rejected", "refunded", "cancelled"] },
  });

  const scheduled = resetTime(next.scheduledDate);
  const scheduledDayEnd = new Date(scheduled);
  scheduledDayEnd.setUTCDate(scheduledDayEnd.getUTCDate() + 1);

  // Batch: one subscriptions query + one earnings context for all coaches.
  const [subscriptions, coaches, pendingPayouts, paymentMap] = await Promise.all([
    coachIds.length
      ? Subscription.find(
          subscriptionEarningsQuery(
            coachIds,
            next.periodStart,
            next.periodEnd,
            earningsOptions
          )
        ).lean()
      : Promise.resolve([]),
    summaryOnly
      ? Promise.resolve([])
      : User.find({ _id: { $in: coachIds } }).select("firstName lastName email").lean(),
    CoachPayout.find({
      coachId: { $in: coachIds },
      deletedAt: null,
      status: "pending",
      scheduledDate: { $gte: scheduled, $lt: scheduledDayEnd },
    })
      .select("_id coachId amount")
      .lean(),
    summaryOnly ? Promise.resolve(new Map()) : getCoachPaymentMap(coachIds),
  ]);

  const context = await loadEarningsContext(subscriptions);
  const subsByCoach = new Map();
  for (const subscription of subscriptions) {
    const key = subscription.coachId?.toString();
    if (!key) continue;
    if (!subsByCoach.has(key)) subsByCoach.set(key, []);
    subsByCoach.get(key).push(subscription);
  }

  const coachMap = new Map(coaches.map((coach) => [coach._id.toString(), coach]));
  const pendingMap = new Map(
    pendingPayouts.map((payout) => [payout.coachId.toString(), payout])
  );

  const payouts = [];
  let summaryCoachCount = 0;
  let summaryTotal = toMoney(0);

  for (const coachId of coachIds) {
    const coachKey = coachId.toString();
    const lineItems = buildLineItemsFromSubscriptions(
      subsByCoach.get(coachKey) || [],
      context,
      next.periodStart,
      next.periodEnd,
      earningsOptions
    );
    const amount = sumEligibleAmount(lineItems);

    if (!includeZero && amount <= 0) continue;
    summaryCoachCount += 1;
    summaryTotal = toMoney(summaryTotal + amount);

    if (summaryOnly) continue;

    const eligible = lineItems.filter((item) => item.isEligible);
    const traineeIds = new Set(eligible.map((item) => item.athleteId.toString()));
    const coach = coachMap.get(coachKey);
    const pending = pendingMap.get(coachKey);
    const draftAmount = pending ? decimalToNumber(pending.amount) : 0;
    const payment = paymentMap.get(coachKey) || {
      instapayLink: null,
      walletNumber: null,
    };
    const summary = periodSummaryFields(lineItems, amount);

    payouts.push({
      coachId,
      coach: coach
        ? {
            id: coach._id,
            firstName: coach.firstName,
            lastName: coach.lastName,
            email: coach.email,
            name: `${coach.firstName || ""} ${coach.lastName || ""}`.trim(),
            instapayLink: payment.instapayLink,
            walletNumber: payment.walletNumber,
          }
        : null,
      instapayLink: payment.instapayLink,
      walletNumber: payment.walletNumber,
      amount,
      scheduledDate: next.scheduledDate,
      daysUntil: next.daysUntil,
      periodStart: next.periodStart,
      periodEnd: next.periodEnd,
      periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
      traineeCount: traineeIds.size,
      weeksCount: eligible.length,
      pendingPayoutId: draftAmount > 0 ? pending._id : null,
      ...summary,
    });
  }

  payouts.sort((a, b) => b.amount - a.amount);

  return {
    scheduledDate: next.scheduledDate,
    periodStart: next.periodStart,
    periodEnd: next.periodEnd,
    periodLabel: formatPeriodLabel(next.periodStart, next.periodEnd),
    daysUntil: next.daysUntil,
    coachCount: summaryOnly ? summaryCoachCount : payouts.length,
    totalAmount: summaryOnly
      ? summaryTotal
      : toMoney(payouts.reduce((sum, row) => sum + row.amount, 0)),
    payouts: summaryOnly ? undefined : payouts,
  };
};

export const listUpcomingPayouts = (options = {}) => {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const key = JSON.stringify({
    timeBucket: Math.floor(asOf.getTime() / 5000),
    includeZero: options.includeZero === true,
    summaryOnly: options.summaryOnly === true,
  });

  const running = upcomingPayoutsInFlight.get(key);
  if (running) return running;

  const promise = listUpcomingPayoutsInternal({
    ...options,
    asOf,
  }).finally(() => {
    upcomingPayoutsInFlight.delete(key);
  });
  upcomingPayoutsInFlight.set(key, promise);
  return promise;
};

export const listPayouts = async ({
  coachId,
  status,
  from,
  to,
  page = 1,
  limit = 20,
} = {}) => {
  const query = { deletedAt: null };
  if (coachId) query.coachId = coachId;
  if (status) query.status = status;
  if (from || to) {
    query.scheduledDate = {};
    if (from) query.scheduledDate.$gte = resetTime(new Date(from));
    if (to) query.scheduledDate.$lte = resetTime(new Date(to));
  }

  const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
  const [payouts, total] = await Promise.all([
    CoachPayout.find(query)
      .select("-lineItems")
      .populate("coachId", "firstName lastName email")
      .sort({ scheduledDate: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    CoachPayout.countDocuments(query),
  ]);

  const paymentMap = await getCoachPaymentMap(
    payouts.map((payout) => payout.coachId?._id || payout.coachId)
  );
  const payoutsWithPayment = payouts.map((payout) => {
    const coachKey = (payout.coachId?._id || payout.coachId)?.toString();
    const payment = paymentMap.get(coachKey) || {
      instapayLink: null,
      walletNumber: null,
    };
    return {
      ...payout,
      instapayLink: payment.instapayLink,
      walletNumber: payment.walletNumber,
      coachId:
        payout.coachId && typeof payout.coachId === "object"
          ? {
              ...payout.coachId,
              instapayLink: payment.instapayLink,
              walletNumber: payment.walletNumber,
            }
          : payout.coachId,
    };
  });

  return {
    payouts: payoutsWithPayment,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

export const getAdminPayoutDetails = async (payoutId) => {
  const payout = await CoachPayout.findOne({ _id: payoutId, deletedAt: null })
    .populate("coachId", "firstName lastName email")
    .lean();
  if (!payout) return null;

  const coachKey = (payout.coachId?._id || payout.coachId)?.toString();
  const paymentMap = await getCoachPaymentMap(coachKey ? [coachKey] : []);
  const payment = paymentMap.get(coachKey) || {
    instapayLink: null,
    walletNumber: null,
  };

  return {
    ...payout,
    instapayLink: payment.instapayLink,
    walletNumber: payment.walletNumber,
    coachId:
      payout.coachId && typeof payout.coachId === "object"
        ? {
            ...payout.coachId,
            instapayLink: payment.instapayLink,
            walletNumber: payment.walletNumber,
          }
        : payout.coachId,
  };
};

const batchStatusQuery = (status) => {
  if (status === "paid") return { status: "paid" };
  if (status) return { status };
  return { status: { $nin: ["cancelled"] } };
};

const batchLineItemCounts = (lineItems = []) => {
  const eligible = lineItems.filter((item) => item.isEligible);
  const subscriptionIds = new Set(
    eligible.map((item) => item.subscriptionId?.toString()).filter(Boolean)
  );
  return {
    eligibleWeeksCount: eligible.length,
    subscriptionCount: subscriptionIds.size,
  };
};

const payoutStatusRank = (status) => {
  if (status === "paid") return 0;
  if (status === "processing") return 1;
  if (status === "pending") return 2;
  return 3;
};

const scheduledDayKey = (scheduledDate) =>
  resetTime(scheduledDate).toISOString().slice(0, 10);

/** One row per coach per transfer day; prefer paid over stale pending drafts. */
const dedupePayoutsByCoachTransferDay = (payouts = []) => {
  const best = new Map();
  for (const payout of payouts) {
    if (!payout.scheduledDate) continue;
    const coachKey = (payout.coachId?._id || payout.coachId)?.toString();
    if (!coachKey) continue;
    const key = `${coachKey}:${scheduledDayKey(payout.scheduledDate)}`;
    const current = best.get(key);
    if (!current) {
      best.set(key, payout);
      continue;
    }
    const rank = payoutStatusRank(payout.status);
    const currentRank = payoutStatusRank(current.status);
    if (rank < currentRank) best.set(key, payout);
  }
  return Array.from(best.values());
};

export const listPayoutBatchMonths = async ({ status } = {}) => {
  const rawPayouts = await CoachPayout.find({
    deletedAt: null,
    ...batchStatusQuery(status),
  })
    .select("scheduledDate amount status coachId")
    .sort({ scheduledDate: -1 })
    .lean();

  const payouts = dedupePayoutsByCoachTransferDay(rawPayouts);
  const monthMap = new Map();

  for (const payout of payouts) {
    if (!payout.scheduledDate) continue;
    const scheduled = resetTime(payout.scheduledDate);
    const year = scheduled.getUTCFullYear();
    const month = scheduled.getUTCMonth() + 1;
    const transferDay = scheduled.getUTCDate();
    const monthKey = `${year}-${month}`;
    const amount = decimalToNumber(payout.amount);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        year,
        month,
        label: scheduled.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
        totalAmount: 0,
        coachPayoutCount: 0,
        batches: new Map(),
      });
    }

    const entry = monthMap.get(monthKey);
    entry.totalAmount = toMoney(entry.totalAmount + amount);
    entry.coachPayoutCount += 1;

    const dayKey = String(transferDay);
    if (!entry.batches.has(dayKey)) {
      entry.batches.set(dayKey, {
        transferDay,
        scheduledDate: scheduled,
        totalAmount: 0,
        coachCount: 0,
        paidCount: 0,
        pendingCount: 0,
      });
    }

    const batch = entry.batches.get(dayKey);
    batch.totalAmount = toMoney(batch.totalAmount + amount);
    batch.coachCount += 1;
    if (payout.status === "paid") batch.paidCount += 1;
    else if (payout.status === "pending" || payout.status === "processing") {
      batch.pendingCount += 1;
    }
  }

  const months = Array.from(monthMap.values())
    .map((entry) => ({
      year: entry.year,
      month: entry.month,
      label: entry.label,
      totalAmount: entry.totalAmount,
      coachPayoutCount: entry.coachPayoutCount,
      batches: Array.from(entry.batches.values()).sort(
        (a, b) => a.transferDay - b.transferDay
      ),
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  return { months };
};

export const getPayoutBatchByScheduledDate = async (
  scheduledDate,
  { status } = {}
) => {
  const scheduled = resetTime(new Date(scheduledDate));
  if (Number.isNaN(scheduled.getTime())) {
    const error = new Error("Invalid scheduledDate");
    error.statusCode = 400;
    throw error;
  }

  const day = scheduled.getUTCDate();
  if (day !== 1 && day !== 16) {
    const error = new Error("scheduledDate must be the 1st or 16th of a month");
    error.statusCode = 400;
    throw error;
  }

  const dayEnd = new Date(scheduled);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const next = getNextTransferInfo();
  const isLiveUpcomingBatch =
    status !== "paid" &&
    scheduledDayKey(next.scheduledDate) === scheduledDayKey(scheduled);

  // Lean list fields only — full lineItems load on Details expand.
  const rawPayouts = await CoachPayout.find({
    deletedAt: null,
    scheduledDate: { $gte: scheduled, $lt: dayEnd },
    ...batchStatusQuery(status),
  })
    .select(
      "coachId amount status paidAt paymentReference paymentProofImage periodStart periodEnd scheduledDate lineItems.subscriptionId lineItems.isEligible"
    )
    .populate("coachId", "firstName lastName email")
    .sort({ amount: -1 })
    .lean();

  const preferred = dedupePayoutsByCoachTransferDay(rawPayouts);
  const preferredIds = new Set(preferred.map((p) => p._id.toString()));
  const staleDraftIds = rawPayouts
    .filter(
      (p) =>
        !preferredIds.has(p._id.toString()) &&
        (p.status === "pending" || p.status === "processing")
    )
    .map((p) => p._id);
  // Non-blocking cleanup of legacy duplicate drafts.
  if (staleDraftIds.length) {
    CoachPayout.updateMany(
      { _id: { $in: staleDraftIds }, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    ).catch(() => {});
  }

  let coaches;
  let periodLabel = null;
  let periodStart = null;
  let periodEnd = null;

  if (isLiveUpcomingBatch) {
    // One batched upcoming compute (shared cache) + already-fetched drafts.
    const live = await listUpcomingPayouts({ includeZero: false });

    periodLabel = live.periodLabel;
    periodStart = live.periodStart;
    periodEnd = live.periodEnd;

    const paidRows = preferred.filter((p) => p.status === "paid");
    const paidCoachIds = new Set(
      paidRows
        .map((p) => (p.coachId?._id || p.coachId)?.toString())
        .filter(Boolean)
    );
    const draftByCoach = new Map(
      preferred
        .filter((p) => p.status === "pending" || p.status === "processing")
        .map((p) => [(p.coachId?._id || p.coachId)?.toString(), p])
    );
    const paidPaymentMap = await getCoachPaymentMap(
      paidRows.map((p) => p.coachId?._id || p.coachId)
    );

    coaches = [];

    for (const row of paidRows) {
      const coachKey = (row.coachId?._id || row.coachId)?.toString();
      const payment = paidPaymentMap.get(coachKey) || {
        instapayLink: null,
        walletNumber: null,
      };
      const coachDoc =
        row.coachId && typeof row.coachId === "object" ? row.coachId : null;
      const summary = batchLineItemCounts(row.lineItems);
      coaches.push({
        payoutId: row._id,
        coachId: coachKey,
        coach: coachDoc
          ? {
              id: coachDoc._id,
              firstName: coachDoc.firstName,
              lastName: coachDoc.lastName,
              email: coachDoc.email,
              name: `${coachDoc.firstName || ""} ${coachDoc.lastName || ""}`.trim(),
              instapayLink: payment.instapayLink,
              walletNumber: payment.walletNumber,
            }
          : null,
        amount: decimalToNumber(row.amount),
        status: row.status,
        paidAt: row.paidAt || null,
        paymentReference: row.paymentReference || null,
        paymentProofImage: row.paymentProofImage || null,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        periodLabel: formatPeriodLabel(row.periodStart, row.periodEnd),
        eligibleWeeksCount: summary.eligibleWeeksCount,
        subscriptionCount: summary.subscriptionCount,
        instapayLink: payment.instapayLink,
        walletNumber: payment.walletNumber,
        livePreview: false,
      });
    }

    for (const row of live.payouts || []) {
      const coachKey = row.coachId?.toString();
      if (!coachKey || paidCoachIds.has(coachKey)) continue;
      const draft = draftByCoach.get(coachKey);
      const eligible = (row.weeksCount ?? row.eligibleWeeksCount) || 0;
      coaches.push({
        payoutId: draft?._id || row.pendingPayoutId || null,
        coachId: coachKey,
        coach: row.coach || null,
        amount: row.amount,
        status: draft?.status || "pending",
        paidAt: null,
        paymentReference: draft?.paymentReference || null,
        paymentProofImage: draft?.paymentProofImage || null,
        periodStart: live.periodStart,
        periodEnd: live.periodEnd,
        periodLabel: live.periodLabel,
        eligibleWeeksCount: eligible,
        subscriptionCount: row.traineeCount || 0,
        instapayLink: row.instapayLink || null,
        walletNumber: row.walletNumber || null,
        livePreview: true,
      });
    }

    coaches.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  } else {
    const payouts = preferred;
    const paymentMap = await getCoachPaymentMap(
      payouts.map((payout) => payout.coachId?._id || payout.coachId)
    );

    coaches = payouts.map((payout) => {
      const coachKey = (payout.coachId?._id || payout.coachId)?.toString();
      const payment = paymentMap.get(coachKey) || {
        instapayLink: null,
        walletNumber: null,
      };
      const coachDoc =
        payout.coachId && typeof payout.coachId === "object"
          ? payout.coachId
          : null;
      const summary = batchLineItemCounts(payout.lineItems);

      return {
        payoutId: payout._id,
        coachId: coachKey,
        coach: coachDoc
          ? {
              id: coachDoc._id,
              firstName: coachDoc.firstName,
              lastName: coachDoc.lastName,
              email: coachDoc.email,
              name: `${coachDoc.firstName || ""} ${coachDoc.lastName || ""}`.trim(),
              instapayLink: payment.instapayLink,
              walletNumber: payment.walletNumber,
            }
          : null,
        amount: decimalToNumber(payout.amount),
        status: payout.status,
        paidAt: payout.paidAt || null,
        paymentReference: payout.paymentReference || null,
        paymentProofImage: payout.paymentProofImage || null,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
        periodLabel: formatPeriodLabel(payout.periodStart, payout.periodEnd),
        eligibleWeeksCount: summary.eligibleWeeksCount,
        subscriptionCount: summary.subscriptionCount,
        instapayLink: payment.instapayLink,
        walletNumber: payment.walletNumber,
        livePreview: false,
      };
    });

    periodLabel = coaches[0]?.periodLabel || null;
    periodStart = coaches[0]?.periodStart || null;
    periodEnd = coaches[0]?.periodEnd || null;
  }

  let totalAmount = 0;
  let paidCount = 0;
  let pendingCount = 0;
  for (const row of coaches) {
    totalAmount = toMoney(totalAmount + (row.amount || 0));
    if (row.status === "paid") paidCount += 1;
    else if (row.status === "pending" || row.status === "processing") {
      pendingCount += 1;
    }
  }

  return {
    scheduledDate: scheduled,
    transferDay: day,
    periodLabel,
    periodStart,
    periodEnd,
    totalAmount,
    coachCount: coaches.length,
    paidCount,
    pendingCount,
    livePreview: isLiveUpcomingBatch,
    coaches,
  };
};

export const markPayoutPaid = async (
  payoutId,
  { paidBy, paymentReference, paymentProofImage, notes } = {}
) => {
  const payout = await CoachPayout.findOne({ _id: payoutId, deletedAt: null });
  if (!payout) return null;
  if (payout.status === "paid") return { payout, newlyPaid: false };

  if (!payoutHasPayableAmount(payout)) {
    const error = new Error(
      "This draft has no earnings to pay. Generate the payout again after eligible weeks exist."
    );
    error.statusCode = 400;
    throw error;
  }

  payout.status = "paid";
  payout.paidAt = new Date();
  payout.paidBy = paidBy;
  payout.paymentReference = paymentReference || null;
  if (paymentProofImage) payout.paymentProofImage = paymentProofImage;
  payout.notes = notes || null;
  await payout.save();
  return { payout, newlyPaid: true };
};
