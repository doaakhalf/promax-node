import User from "../Models/User.js";
import Subscription from "../Models/Subscription.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Athlete from "../Models/Athlete.js";
import WorkoutCalendarResource from "../config/Resources/WorkoutCalendarResource.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import SubscriptionPaymentResource from "../config/Resources/SubscriptionPaymentResource.js";
import { resetTime } from "../utils/resetTime.js";

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (value.$numberDecimal) return parseFloat(value.$numberDecimal) || 0;
  if (typeof value.toString === "function") {
    const asString = value.toString();
    if (asString && asString !== "[object Object]") return parseFloat(asString) || 0;
  }
  return 0;
};

const pickCalendarForSubscription = (calendars, subscription) => {
  const key = subscription._id.toString();
  const month = new Date(subscription.startDate).getMonth() + 1;
  const year = new Date(subscription.startDate).getFullYear();
  return (
    calendars.find(
      (calendar) =>
        calendar.subscriptionId.toString() === key &&
        calendar.month === month &&
        calendar.year === year
    ) ||
    calendars.find((calendar) => calendar.subscriptionId.toString() === key) ||
    null
  );
};

const buildWeeksSummary = (calendar) => {
  const now = resetTime(new Date());
  const weeks = calendar?.weeks || [];

  return weeks.map((week) => {
    const startDate = resetTime(week.startDate);
    const endDate = resetTime(week.endDate);
    const trainingDays = week.trainingDays || [];
    const assignedDays = trainingDays.filter((day) => day.isAssigned).length;
    const totalDays = trainingDays.length;
    const isCurrent = now >= startDate && now <= endDate;

    return {
      weekNumber: week.weekNumber,
      startDate,
      endDate,
      isOpen: !!week.isOpen,
      isCurrent,
      totalDays,
      assignedDays,
      complete: totalDays > 0 && assignedDays === totalDays,
      days: trainingDays.map((day) => ({
        dayNumber: day.dayNumber,
        date: resetTime(day.date),
        isAssigned: !!day.isAssigned,
      })),
    };
  });
};

const buildAssignmentStatus = (calendar) => {
  const weeks = buildWeeksSummary(calendar);
  const currentWeek = weeks.find((week) => week.isCurrent) || null;

  if (!calendar) {
    return {
      hasCalendar: false,
      currentWeek: null,
      weeks: [],
    };
  }

  return {
    hasCalendar: true,
    currentWeek,
    weeks,
  };
};

export const listCoachesWithSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ deletedAt: null })
      .select("coachId status")
      .lean();

    const countsByCoach = new Map();
    for (const sub of subscriptions) {
      const id = sub.coachId?.toString();
      if (!id) continue;
      if (!countsByCoach.has(id)) {
        countsByCoach.set(id, {
          active: 0,
          pending: 0,
          expired: 0,
          rejected: 0,
          refunded: 0,
          other: 0,
          total: 0,
        });
      }
      const counts = countsByCoach.get(id);
      counts.total += 1;
      if (sub.status === "active") counts.active += 1;
      else if (sub.status === "pending") counts.pending += 1;
      else if (sub.status === "expired") counts.expired += 1;
      else if (sub.status === "rejected") counts.rejected += 1;
      else if (sub.status === "refunded") counts.refunded += 1;
      else counts.other += 1;
    }

    const coachIds = [...countsByCoach.keys()];
    const coaches = await User.find({ _id: { $in: coachIds } })
      .select("firstName lastName email phoneNumber profileImage status")
      .lean();

    const userById = new Map(coaches.map((coach) => [coach._id.toString(), coach]));

    const data = coachIds
      .map((id) => {
        const user = userById.get(id);
        const counts = countsByCoach.get(id);
        return {
          id,
          name: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : "Unknown coach",
          email: user?.email || null,
          phone: user?.phoneNumber || null,
          status: user?.status || null,
          counts,
        };
      })
      .sort((a, b) => (b.counts?.rejected || 0) - (a.counts?.rejected || 0)
        || (b.counts?.active || 0) - (a.counts?.active || 0));

    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

export const getCoachSubscriptionTrainees = async (req, res) => {
  try {
    const { coachId } = req.params;
    const statusFilter = req.query.status;

    const coach = await User.findById(coachId)
      .select("firstName lastName email phoneNumber status")
      .lean();
    if (!coach) {
      return res.status(404).json({ status: "error", message: "Coach not found" });
    }

    const query = { coachId, deletedAt: null };
    if (statusFilter) query.status = statusFilter;

    const subscriptions = await Subscription.find(query)
      .populate({
        path: "athleteId",
        select: "firstName lastName email phoneNumber profileImage gender",
      })
      .sort({ createdAt: -1 })
      .lean();

    const validSubscriptions = subscriptions.filter((sub) => sub.athleteId?._id);
    const athleteUserIds = [
      ...new Set(validSubscriptions.map((sub) => sub.athleteId._id.toString())),
    ];
    const subscriptionIds = validSubscriptions.map((sub) => sub._id);

    const [athleteRecords, calendars] = await Promise.all([
      Athlete.find({ userId: { $in: athleteUserIds } }).lean(),
      WorkoutCalendar.find({
        coachId,
        subscriptionId: { $in: subscriptionIds },
        deletedAt: null,
      }).lean(),
    ]);

    const athleteDataMap = new Map(
      athleteRecords.map((athlete) => [athlete.userId.toString(), athlete])
    );

    const trainees = validSubscriptions.map((sub) => {
      const athleteData = athleteDataMap.get(sub.athleteId._id.toString());
      const calendar = pickCalendarForSubscription(calendars, sub);

      return {
        subscriptionId: sub._id,
        athlete: {
          id: sub.athleteId._id,
          name: `${sub.athleteId.firstName} ${sub.athleteId.lastName || ""}`.trim(),
          email: sub.athleteId.email,
          phoneNumber: sub.athleteId.phoneNumber,
          profileImage: sub.athleteId.profileImage,
          gender: sub.athleteId.gender || null,
          trainingFrequency: athleteData?.trainingFrequency || null,
        },
        subscription: {
          plan: sub.subscriptionPlan,
          status: sub.status,
          paymentStatus: sub.paymentStatus,
          amount: toNumber(sub.amount),
          platformFee: toNumber(sub.platformFee),
          coachNetAmount: toNumber(sub.coachNetAmount),
          currency: sub.currency,
          startDate: resetTime(sub.startDate),
          endDate: resetTime(sub.endDate),
        },
        workoutCalendar: buildAssignmentStatus(calendar),
      };
    });

    return res.status(200).json({
      status: "success",
      coach: {
        id: coach._id,
        name: `${coach.firstName || ""} ${coach.lastName || ""}`.trim(),
        email: coach.email,
        phone: coach.phoneNumber,
        status: coach.status,
      },
      count: trainees.length,
      data: trainees,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

export const getCoachAthleteCalendar = async (req, res) => {
  try {
    const { coachId, athleteId } = req.params;

    const subscription = await Subscription.findOne({
      coachId,
      athleteId,
      deletedAt: null,
      status: { $in: ["active", "pending", "expired", "paused"] },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ status: "error", message: "Subscription not found" });
    }

    const calendar = await WorkoutCalendar.findOne({
      coachId,
      athleteId,
      subscriptionId: subscription._id,
      deletedAt: null,
    }).populate("weeks.trainingDays.workoutId", "name description workoutType");

    if (!calendar) {
      return res.status(404).json({
        status: "error",
        message: "No workout calendar for this trainee yet",
      });
    }

    return res.status(200).json({
      status: "success",
      data: WorkoutCalendarResource.single(calendar, subscription),
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

export const listProcessedSubscriptionPayments = async (req, res) => {
  try {
    const statusFilter = req.query.status;
    const query = {
      deletedAt: null,
      status: statusFilter && statusFilter !== "pending"
        ? statusFilter
        : { $nin: ["pending"] },
    };

    const payments = await SubscriptionPayment.find(query)
      .populate({
        path: "subscriptionId",
        populate: [{ path: "coachId" }, { path: "athleteId" }],
      })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: SubscriptionPaymentResource.collection(payments),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
