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

export const getSubscriptionAmountsForPlan = (coachMonthlyPrice, plan) =>
  plan === "weekly"
    ? getWeeklySubscriptionAmounts(coachMonthlyPrice)
    : getSubscriptionAmounts(coachMonthlyPrice);

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
