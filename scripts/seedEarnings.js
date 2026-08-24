import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";
import Role from "../Models/Role.js";
import User from "../Models/User.js";
import Coach from "../Models/Coach.js";
import Athlete from "../Models/Athlete.js";
import Subscription from "../Models/Subscription.js";
import SubscriptionPayment from "../Models/SubscriptionPayment.js";
import WorkoutCalendar from "../Models/WorkoutCalendar.js";
import Workout from "../Models/Workout.js";
import CoachPayout from "../Models/CoachPayout.js";
import { resetTime } from "../utils/resetTime.js";
import { addDays, generateBillingWeeks } from "../utils/billingWeeks.js";
import { getPeriodForScheduledDate, getNextTransferInfo } from "../utils/payoutPeriods.js";
import { getWeeklyRate, decimalToNumber, getSubscriptionAmounts } from "../utils/coachNetAmount.js";
import {
  computeCoachEarnings,
  generatePayouts,
  getDashboard,
  getNextPayoutDetails,
  getPaymentHistory,
} from "../services/earningsService.js";

const SEED_TAG = "earnings-seed";
const PASSWORD = "Test1234!";

const utc = (y, m, d) => resetTime(new Date(Date.UTC(y, m, d)));

const CASES = {
  mohamed: {
    label: "Mohamed A. — اشتراك كامل الشهر، كل الأسابيع assigned",
    firstName: "Mohamed",
    lastName: "Ali",
    amount: 1000,
    start: utc(2026, 6, 1),
    end: utc(2026, 6, 31),
    paymentStatus: "active",
    assignAllWeeks: true,
    expectAug1Weeks: 3,
  },
  sarah: {
    label: "Sarah K. — اشتراك من 5 يوليو، أسبوعين في فترة 16-31 (W2+W3)",
    firstName: "Sarah",
    lastName: "Khaled",
    amount: 1200,
    start: utc(2026, 6, 5),
    end: utc(2026, 7, 4),
    paymentStatus: "active",
    assignAllWeeks: true,
    expectAug1Weeks: 2,
  },
  ahmed: {
    label: "Ahmed M. — اشتراك جديد 20 يوليو، أسبوع واحد + أيام مُرحَّلة",
    firstName: "Ahmed",
    lastName: "Mahmoud",
    amount: 1000,
    start: utc(2026, 6, 20),
    end: utc(2026, 7, 19),
    paymentStatus: "active",
    assignAllWeeks: true,
    expectAug1Weeks: 1,
    isNewSubscription: true,
  },
  omar: {
    label: "Omar P. — اشتراك pending (لا يُحسب)",
    firstName: "Omar",
    lastName: "Pending",
    amount: 1000,
    start: utc(2026, 6, 10),
    end: utc(2026, 7, 9),
    paymentStatus: "pending",
    assignAllWeeks: true,
    expectAug1Weeks: 0,
  },
  khaled: {
    label: "Khaled N. — active لكن assign ناقص في أسابيع الفترة (غير مستحق)",
    firstName: "Khaled",
    lastName: "NoAssign",
    amount: 1000,
    start: utc(2026, 6, 1),
    end: utc(2026, 6, 31),
    paymentStatus: "active",
    assignAllWeeks: false,
    partialWeekIndexes: [2, 3, 4],
    expectAug1Weeks: 0,
  },
  layla: {
    label: "Layla S. — 19 يوليو إلى 19 أغسطس، الأسبوع الأخير 12–19 أغسطس يظهر في دفعة 1 سبتمبر",
    firstName: "Layla",
    lastName: "Saleh",
    amount: 1000,
    start: utc(2026, 6, 19),
    end: utc(2026, 7, 19),
    paymentStatus: "active",
    assignAllWeeks: true,
    expectAug1Weeks: 1,
    expectSept1Weeks: 1,
  },
};

const buildEmail = (key) => `${SEED_TAG}-${key}@test.com`;

async function ensureRole(name) {
  await Role.updateOne({ name }, { $set: { name } }, { upsert: true });
  return Role.findOne({ name }).lean();
}

async function upsertUser({ email, firstName, lastName, roleId, status = "approved", phoneSuffix = "0" }) {
  const password = await bcrypt.hash(PASSWORD, 10);
  let user = await User.findOne({ email });
  if (user) {
    user.firstName = firstName;
    user.lastName = lastName;
    user.role_id = roleId;
    user.status = status;
    user.gender = "male";
    await user.save();
  } else {
    user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role_id: roleId,
      status,
      gender: "male",
      phoneNumber: `0109999${phoneSuffix.padStart(4, "0")}`,
    });
  }
  return user;
}

function buildTrainingDays(weekStart, weekEnd, frequency, assigned) {
  const days = [];
  for (let i = 0; i < frequency; i++) {
    const date = addDays(weekStart, i);
    if (date > weekEnd) break;
    days.push({
      dayNumber: i + 1,
      date,
      workoutId: null,
      isAssigned: assigned,
      completedAt: null,
      notes: null,
    });
  }
  return days;
}

function buildCalendarWeeks(subscription, frequency, assignmentMap) {
  const billingWeeks = generateBillingWeeks(subscription.startDate, subscription.endDate);
  return billingWeeks.map((week) => {
    const assigned = assignmentMap[week.weekIndex] ?? true;
    return {
      weekNumber: week.weekIndex,
      startDate: week.billingWeekStart,
      endDate: week.billingWeekEnd,
      isOpen: true,
      trainingDays: buildTrainingDays(
        week.billingWeekStart,
        week.billingWeekEnd,
        frequency,
        assigned
      ),
    };
  });
}

async function cleanSeedData() {
  const emails = [
    buildEmail("coach"),
    buildEmail("admin"),
    ...Object.keys(CASES).map((key) => buildEmail(key)),
  ];

  const users = await User.find({ email: { $in: emails } }).lean();
  const userIds = users.map((u) => u._id);
  const coachUser = users.find((u) => u.email === buildEmail("coach"));

  if (coachUser) {
    await CoachPayout.deleteMany({ coachId: coachUser._id });
  }

  const subscriptions = await Subscription.find({
    $or: [{ coachId: { $in: userIds } }, { athleteId: { $in: userIds } }],
  }).lean();
  const subscriptionIds = subscriptions.map((s) => s._id);

  await WorkoutCalendar.deleteMany({ subscriptionId: { $in: subscriptionIds } });
  await SubscriptionPayment.deleteMany({ subscriptionId: { $in: subscriptionIds } });
  await Subscription.deleteMany({ _id: { $in: subscriptionIds } });
  await Workout.deleteMany({ userId: coachUser?._id });
  await Athlete.deleteMany({ userId: { $in: userIds.filter((id) => !coachUser || !id.equals(coachUser._id)) } });
  await Coach.deleteMany({ userId: coachUser?._id });
  await User.deleteMany({ _id: { $in: userIds } });

  console.log("Cleaned earnings seed data.");
}

async function seedEarnings({ clean = false, verify = true } = {}) {
  if (!process.env.PERCENTAGE) {
    process.env.PERCENTAGE = "5";
  }

  await connectToMongo();
  registerModels();

  await cleanSeedData();
  console.log("Seeding earnings test data (idempotent — cleans previous seed first)...\n");

  const [coachRole, athleteRole, adminRole] = await Promise.all([
    ensureRole("coach"),
    ensureRole("athlete"),
    ensureRole("admin"),
  ]);

  const coachUser = await upsertUser({
    email: buildEmail("coach"),
    firstName: "Earnings",
    lastName: "Coach",
    roleId: coachRole._id,
    status: "active",
    phoneSuffix: "1",
  });

  await upsertUser({
    email: buildEmail("admin"),
    firstName: "Earnings",
    lastName: "Admin",
    roleId: adminRole._id,
    status: "active",
    phoneSuffix: "2",
  });

  let coachProfile = await Coach.findOne({ userId: coachUser._id });
  if (!coachProfile) {
    coachProfile = await Coach.create({
      userId: coachUser._id,
      type: "normal",
      sport: "Fitness",
      trainingExperience: "10 years",
      yearOfExperience: 10,
      motivation: "Seed data",
      headline: "Earnings test coach",
      monthlyPriceEgp: 1000,
      instapayLink: "https://instapay.test/coach",
      walletNumber: "01000000000",
    });
  }

  const workout = await Workout.findOneAndUpdate(
    { userId: coachUser._id, name: `${SEED_TAG}-template` },
    {
      userId: coachUser._id,
      workoutType: "normal",
      name: `${SEED_TAG}-template`,
      description: "Seed workout template",
      isTemplate: true,
    },
    { upsert: true, new: true }
  );

  const seeded = [];
  const frequency = 3;
  let phoneCounter = 100;

  for (const [key, config] of Object.entries(CASES)) {
    const athleteUser = await upsertUser({
      email: buildEmail(key),
      firstName: config.firstName,
      lastName: config.lastName,
      roleId: athleteRole._id,
      status: "active",
      phoneSuffix: String(phoneCounter++),
    });

    await Athlete.findOneAndUpdate(
      { userId: athleteUser._id },
      {
        userId: athleteUser._id,
        weight: 80,
        height: 175,
        trainingFrequency: String(frequency),
        dateOfBirth: utc(1995, 0, 1),
        goals: "Seed test",
      },
      { upsert: true, new: true }
    );

    const { amount, platformFee, coachNetAmount } = getSubscriptionAmounts(config.amount);
    const subscription = await Subscription.create({
      coachId: coachUser._id,
      athleteId: athleteUser._id,
      subscriptionPlan: "monthly",
      amount,
      platformFee,
      coachNetAmount,
      currency: "EGP",
      paymentMethod: "instapay",
      paymentStatus: config.paymentStatus,
      startDate: config.start,
      endDate: config.end,
      status: config.paymentStatus === "active" ? "active" : "pending",
    });

    await SubscriptionPayment.create({
      subscriptionId: subscription._id,
      paymentImage: "/images/seed/payment.jpg",
      status: config.paymentStatus,
      verifiedAt: config.paymentStatus === "active" ? new Date() : null,
    });

    const billingWeeks = generateBillingWeeks(config.start, config.end);
    const assignmentMap = {};

    for (const week of billingWeeks) {
      const partialWeeks = config.partialWeekIndexes || (config.partialWeekIndex ? [config.partialWeekIndex] : []);
      if (config.assignAllWeeks === false && partialWeeks.includes(week.weekIndex)) {
        assignmentMap[week.weekIndex] = "partial";
      } else {
        assignmentMap[week.weekIndex] = true;
      }
    }

    const weeks = billingWeeks.map((week) => {
      const mode = assignmentMap[week.weekIndex];
      const trainingDays = [];
      for (let i = 0; i < frequency; i++) {
        const date = addDays(week.billingWeekStart, i);
        if (date > week.billingWeekEnd) break;
        let isAssigned = mode === true;
        if (mode === "partial") {
          isAssigned = i < frequency - 1;
        }
        trainingDays.push({
          dayNumber: i + 1,
          date,
          workoutId: isAssigned ? workout._id : null,
          isAssigned,
          completedAt: null,
          notes: null,
        });
      }
      return {
        weekNumber: week.weekIndex,
        startDate: week.billingWeekStart,
        endDate: week.billingWeekEnd,
        isOpen: true,
        trainingDays,
      };
    });

    await WorkoutCalendar.create({
      athleteId: athleteUser._id,
      coachId: coachUser._id,
      subscriptionId: subscription._id,
      month: config.start.getUTCMonth() + 1,
      year: config.start.getUTCFullYear(),
      trainingFrequency: frequency,
      weeks,
      status: "active",
    });

    const weeklyRate = getWeeklyRate(config.amount);
    seeded.push({
      key,
      label: config.label,
      athleteEmail: buildEmail(key),
      subscriptionId: subscription._id.toString(),
      weeklyRate,
      billingWeeks: billingWeeks.map((w) => ({
        weekIndex: w.weekIndex,
        start: w.billingWeekStart.toISOString().slice(0, 10),
        end: w.billingWeekEnd.toISOString().slice(0, 10),
      })),
      expectAug1Weeks: config.expectAug1Weeks,
      expectedAug1Amount: toMoney(weeklyRate * config.expectAug1Weeks),
      expectSept1Weeks: config.expectSept1Weeks || 0,
      expectedSept1Amount: toMoney(weeklyRate * (config.expectSept1Weeks || 0)),
    });
  }

  const jul16Period = getPeriodForScheduledDate(utc(2026, 6, 16));
  const aug1Period = getPeriodForScheduledDate(utc(2026, 7, 1));

  const jul16Earnings = await computeCoachEarnings(
    coachUser._id,
    jul16Period.periodStart,
    jul16Period.periodEnd
  );

  await CoachPayout.create({
    coachId: coachUser._id,
    amount: jul16Earnings.amount,
    currency: "EGP",
    periodStart: jul16Period.periodStart,
    periodEnd: jul16Period.periodEnd,
    scheduledDate: jul16Period.scheduledDate,
    status: "paid",
    paidAt: utc(2026, 6, 16),
    paymentReference: "SEED-JUL-16",
    lineItems: jul16Earnings.lineItems,
  });

  await generatePayouts({ scheduledDate: utc(2026, 7, 1).toISOString() });

  const pendingPayout = await CoachPayout.findOne({
    coachId: coachUser._id,
    scheduledDate: aug1Period.scheduledDate,
    status: "pending",
    deletedAt: null,
  }).lean();

  const asOf = utc(2026, 6, 27);
  const next = getNextTransferInfo(asOf);
  const liveAug1 = await computeCoachEarnings(
    coachUser._id,
    next.periodStart,
    next.periodEnd
  );

  const expectedAug1Total = toMoney(
    seeded.reduce((sum, item) => sum + item.expectedAug1Amount, 0)
  );

  console.log("\n========================================");
  console.log("  EARNINGS SEED — TEST DATA READY");
  console.log("========================================\n");

  console.log("Login (password for all):", PASSWORD);
  console.log("Coach email:", buildEmail("coach"));
  console.log("Admin email:", buildEmail("admin"));
  console.log("Coach userId:", coachUser._id.toString());
  console.log("PERCENTAGE:", process.env.PERCENTAGE);
  console.log("Reference asOf:", asOf.toISOString().slice(0, 10));
  console.log("");

  console.log("--- Test cases ---");
  for (const item of seeded) {
    console.log(`\n[${item.key}] ${item.label}`);
    console.log("  athlete:", item.athleteEmail);
    console.log("  subscriptionId:", item.subscriptionId);
    console.log("  weeklyRate:", item.weeklyRate);
    console.log("  billing weeks:", item.billingWeeks.map((w) => `W${w.weekIndex} ${w.start}→${w.end}`).join(", "));
    console.log("  expected Aug-1 weeks:", item.expectAug1Weeks, "→", item.expectedAug1Amount, "EGP");
    if (item.expectSept1Weeks) {
      console.log("  expected Sept-1 weeks:", item.expectSept1Weeks, "→", item.expectedSept1Amount, "EGP");
    }
  }

  console.log("\n--- Paid history (Jul 16 payout) ---");
  console.log("  period:", jul16Period.periodStart.toISOString().slice(0, 10), "→", jul16Period.periodEnd.toISOString().slice(0, 10));
  console.log("  amount:", jul16Earnings.amount, "EGP");
  console.log("  status: paid");

  console.log("\n--- Next payout preview (Aug 1) ---");
  console.log("  period:", next.periodStart.toISOString().slice(0, 10), "→", next.periodEnd.toISOString().slice(0, 10));
  console.log("  expected total:", expectedAug1Total, "EGP");
  console.log("  computed total:", liveAug1.amount, "EGP");
  console.log("  match:", expectedAug1Total === liveAug1.amount ? "YES ✅" : "NO ❌");

  if (pendingPayout) {
    const pendingAmount = decimalToNumber(pendingPayout.amount);
    console.log("\n--- Pending vs live (Aug 1) ---");
    console.log("  pending payout exists:", pendingPayout._id.toString());
    console.log("  pending snapshot amount:", pendingAmount, "EGP");
    console.log("  live preview amount:", liveAug1.amount, "EGP");
    console.log(
      "  pending does NOT hide weeks:",
      pendingAmount === liveAug1.amount ? "YES ✅" : "NO ❌"
    );
  }

  const asOfAug17 = utc(2026, 7, 17);
  const sept1 = getNextTransferInfo(asOfAug17);
  const liveSept1 = await computeCoachEarnings(
    coachUser._id,
    sept1.periodStart,
    sept1.periodEnd
  );
  const layla = seeded.find((item) => item.key === "layla");
  const laylaWeek = layla?.billingWeeks?.find((w) => w.weekIndex === 4);
  const laylaInSept1 = liveSept1.lineItems.some(
    (item) =>
      item.subscriptionId.toString() === layla?.subscriptionId &&
      item.isEligible &&
      item.weekIndex === 4
  );

  console.log("\n--- Next payout as of 17 Aug (Sept 1) ---");
  console.log("  period:", sept1.periodStart.toISOString().slice(0, 10), "→", sept1.periodEnd.toISOString().slice(0, 10));
  console.log("  Layla last week:", laylaWeek ? `${laylaWeek.start}→${laylaWeek.end}` : "missing");
  console.log("  Layla W4 in next earnings:", laylaInSept1 ? "YES ✅" : "NO ❌");

  console.log("\n--- APIs to test ---");
  console.log("  GET  /api/coaches/earnings");
  console.log("  GET  /api/coaches/earnings/next-payout-details");
  console.log("  GET  /api/coaches/earnings/history?year=2026");
  console.log("  GET  /api/coaches/earnings/history/:payoutId");
  console.log("  POST /api/admin/payouts/generate  { \"scheduledDate\": \"2026-08-01\" }");
  console.log("  PATCH /api/admin/payouts/:id/mark-paid");

  if (verify) {
    const dashboard = await getDashboard(coachUser._id, "this_month", asOf);
    const details = await getNextPayoutDetails(coachUser._id, { page: 1, limit: 20 }, asOf);
    const history = await getPaymentHistory(coachUser._id, { year: 2026 });

    console.log("\n--- Service verify ---");
    console.log("  dashboard.nextPayout.amount:", dashboard.nextPayout.amount);
    console.log("  details.totalAmount:", details.totalAmount);
    console.log("  details.items:", details.items.length);
    console.log("  history months:", history.months.length);

    for (const item of details.items) {
      console.log(`    - ${item.athleteName}: ${item.allocatedAmount} EGP (${item.weeksCount} week(s))`);
    }
  }

  console.log("\nDone.\n");
}

function toMoney(value) {
  return Math.round(value * 100) / 100;
}

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const noVerify = args.includes("--no-verify");

seedEarnings({ clean, verify: !noVerify })
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
