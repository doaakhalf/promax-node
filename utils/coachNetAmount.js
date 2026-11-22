const WEEKS_PER_MONTH = 4;

const parseEnvNumber = (raw, fallback) => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toMoney = (value) => Math.round(value * 100) / 100;

export const decimalToNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (typeof value === "object") {
    if (value.$numberDecimal != null) return parseFloat(value.$numberDecimal) || 0;
    if (typeof value.toString === "function") {
      const asString = value.toString();
      if (asString && asString !== "[object Object]") return parseFloat(asString) || 0;
    }
  }
  return 0;
};

export const getCommissionTiers = () => ({
  tier1Max: parseEnvNumber(process.env.COMMISSION_TIER1_MAX, 400),
  tier2Max: parseEnvNumber(process.env.COMMISSION_TIER2_MAX, 700),
  tier1Pct: parseEnvNumber(process.env.PERCENTAGE_TIER1, 33.3),
  tier2Pct: parseEnvNumber(process.env.PERCENTAGE_TIER2, 25),
  tier3Pct: parseEnvNumber(process.env.PERCENTAGE_TIER3, 20),
});

/** Platform fee % for a coach monthly net price (tiered). */
export const getPlatformPercentage = (coachMonthlyPrice) => {
  const price = decimalToNumber(coachMonthlyPrice);
  const { tier1Max, tier2Max, tier1Pct, tier2Pct, tier3Pct } = getCommissionTiers();
  if (price <= tier1Max) return tier1Pct;
  if (price <= tier2Max) return tier2Pct;
  return tier3Pct;
};

/** Platform fee added on top of the coach's registered monthly price (nearest EGP). */
export const getPlatformFee = (coachMonthlyPrice) => {
  const coachNet = decimalToNumber(coachMonthlyPrice);
  return Math.round((coachNet * getPlatformPercentage(coachNet)) / 100);
};

/** What the athlete pays: coach price + platform percentage. */
export const getAthletePrice = (coachMonthlyPrice) => {
  const coachNet = decimalToNumber(coachMonthlyPrice);
  return toMoney(coachNet + getPlatformFee(coachNet));
};

export const getCoachNet = (coachMonthlyPrice) => toMoney(decimalToNumber(coachMonthlyPrice));

export const getSubscriptionAmounts = (coachMonthlyPrice) => {
  const coachNetAmount = getCoachNet(coachMonthlyPrice);
  const platformFee = getPlatformFee(coachNetAmount);
  const amount = toMoney(coachNetAmount + platformFee);
  return { amount, platformFee, coachNetAmount };
};

/** One week: monthly coach price + tiered percentage, then divided by 4. */
export const getWeeklySubscriptionAmounts = (coachMonthlyPrice) => {
  const monthly = getSubscriptionAmounts(coachMonthlyPrice);
  const coachNetAmount = toMoney(monthly.coachNetAmount / WEEKS_PER_MONTH);
  const platformFee = toMoney(monthly.platformFee / WEEKS_PER_MONTH);
  const amount = toMoney(coachNetAmount + platformFee);
  return { amount, platformFee, coachNetAmount };
};

export const getAthleteWeeklyPrice = (coachMonthlyPrice) =>
  getWeeklySubscriptionAmounts(coachMonthlyPrice).amount;

export const PACKAGE_PLANS = {
  quarterly: { months: 3, label: "٣ شهور", field: "quarterlyPriceEgp" },
  semiannual: { months: 6, label: "٦ شهور", field: "semiannualPriceEgp" },
  annual: { months: 12, label: "١٢ شهر", field: "annualPriceEgp" },
};

export const getPackagePlan = (plan) => PACKAGE_PLANS[plan] ?? null;

const SUBSCRIPTION_PLAN_LABELS = {
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
  annual: "سنوي",
};

export const subscriptionPlanLabel = (plan) => SUBSCRIPTION_PLAN_LABELS[plan] || plan || "";

export const isKnownSubscriptionPlan = (plan) =>
  plan === "weekly" || plan === "monthly" || getPackagePlan(plan) != null;

/** Billing weeks: 1 for weekly, otherwise 4 per covered month. */
export const getPlanWeekCount = (plan) => {
  if (plan === "weekly") return 1;
  const spec = getPackagePlan(plan);
  return (spec ? spec.months : 1) * WEEKS_PER_MONTH;
};

export const getPlanWeeklyRate = (coachNetAmount, plan) =>
  toMoney(decimalToNumber(coachNetAmount) / getPlanWeekCount(plan));

/** Highest coach package price that is still rejected. Valid prices are strictly below this. */
export const getPackagePriceCap = (coachMonthlyPrice, months) =>
  toMoney(decimalToNumber(coachMonthlyPrice) * months);

/**
 * Package net must be greater than zero and strictly below monthly price × months.
 * Equal to the cap is rejected.
 */
export const normalizePackagePrice = (coachMonthlyPrice, packagePrice, months) => {
  const price = toMoney(decimalToNumber(packagePrice));
  const maxCoachPrice = getPackagePriceCap(coachMonthlyPrice, months);
  const ok = price > 0 && price < maxCoachPrice;
  return { ok, price, maxCoachPrice };
};

export const packagePriceError = (coachMonthlyPrice, packagePrice, months, label) => {
  const { ok, maxCoachPrice } = normalizePackagePrice(coachMonthlyPrice, packagePrice, months);
  if (ok) return null;
  if (toMoney(decimalToNumber(packagePrice)) <= 0) {
    return `سعر باقة ${label} لازم يكون أكبر من صفر`;
  }
  return `سعر باقة ${label} لازم يكون أقل من ${maxCoachPrice} جنيه`;
};

/** Errors when a new monthly price would make a saved package equal or higher than the cap. */
export const packageCapErrors = (coach, coachMonthlyPrice) => {
  const errors = {};
  if (!coach) return errors;
  for (const spec of Object.values(PACKAGE_PLANS)) {
    const current = decimalToNumber(coach[spec.field]);
    if (current <= 0) continue;
    const message = packagePriceError(coachMonthlyPrice, current, spec.months, spec.label);
    if (message) errors[spec.field] = message;
  }
  return errors;
};

/** Platform fee stays the original monthly fee × months. Coach net is the package price they set. */
export const getPackageSubscriptionAmounts = (coachMonthlyPrice, packageNetPrice, months) => {
  const coachNetAmount = toMoney(decimalToNumber(packageNetPrice));
  const platformFee = toMoney(getPlatformFee(coachMonthlyPrice) * months);
  const amount = toMoney(coachNetAmount + platformFee);
  return { amount, platformFee, coachNetAmount };
};

export const getSubscriptionAmountsForPlan = (coachMonthlyPrice, plan, packageNetPrice) => {
  if (plan === "weekly") return getWeeklySubscriptionAmounts(coachMonthlyPrice);
  const spec = getPackagePlan(plan);
  if (spec) return getPackageSubscriptionAmounts(coachMonthlyPrice, packageNetPrice, spec.months);
  return getSubscriptionAmounts(coachMonthlyPrice);
};

export const buildPackageQuote = (coachMonthlyPrice, packageNetPrice, plan) => {
  const spec = getPackagePlan(plan);
  if (!spec) return null;
  const net = decimalToNumber(packageNetPrice);
  const maxCoachPrice = getPackagePriceCap(coachMonthlyPrice, spec.months);
  const platformFee = toMoney(getPlatformFee(coachMonthlyPrice) * spec.months);
  if (net <= 0) {
    return {
      plan,
      months: spec.months,
      coachPrice: null,
      platformFee,
      price: null,
      maxCoachPrice,
    };
  }
  const amounts = getPackageSubscriptionAmounts(coachMonthlyPrice, net, spec.months);
  return {
    plan,
    months: spec.months,
    coachPrice: amounts.coachNetAmount,
    platformFee: amounts.platformFee,
    price: amounts.amount,
    maxCoachPrice,
  };
};

export const buildCoachPackages = (coachMonthlyPrice, coach) => {
  const packages = {};
  for (const plan of Object.keys(PACKAGE_PLANS)) {
    packages[plan] = buildPackageQuote(
      coachMonthlyPrice,
      coach?.[PACKAGE_PLANS[plan].field],
      plan
    );
  }
  return packages;
};

export const resolveSubscriptionAmounts = (subscription) => {
  const storedNet = decimalToNumber(subscription?.coachNetAmount);
  const storedFee = decimalToNumber(subscription?.platformFee);
  const storedGross = decimalToNumber(subscription?.amount);

  if (storedNet > 0) {
    const platformFee = storedFee > 0 ? storedFee : getPlatformFee(storedNet);
    const amount = storedGross > 0 ? storedGross : toMoney(storedNet + platformFee);
    return { amount, platformFee, coachNetAmount: storedNet };
  }

  return getSubscriptionAmounts(storedGross);
};

export const getWeeklyRate = (coachNetAmount) => {
  return toMoney(decimalToNumber(coachNetAmount) / WEEKS_PER_MONTH);
};

/** Mongo expression: athlete price = coach net * (1 + tierPct/100). */
export const athletePriceMongoExpr = () => {
  const { tier1Max, tier2Max, tier1Pct, tier2Pct, tier3Pct } = getCommissionTiers();
  const coachNet = { $toDouble: { $ifNull: ["$monthlyPriceEgp", 0] } };
  return {
    $multiply: [
      coachNet,
      {
        $add: [
          1,
          {
            $divide: [
              {
                $switch: {
                  branches: [
                    { case: { $lte: [coachNet, tier1Max] }, then: tier1Pct },
                    { case: { $lte: [coachNet, tier2Max] }, then: tier2Pct },
                  ],
                  default: tier3Pct,
                },
              },
              100,
            ],
          },
        ],
      },
    ],
  };
};

export { WEEKS_PER_MONTH };
