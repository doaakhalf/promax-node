import { environment } from '../../environments/environment';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getPlatformPercentage = (coachNet: number) => {
  const tiers = environment.commissionTiers ?? {
    tier1Max: 400,
    tier2Max: 700,
    tier1Pct: 33.3,
    tier2Pct: 25,
    tier3Pct: 20,
  };
  if (coachNet <= tiers.tier1Max) return tiers.tier1Pct;
  if (coachNet <= tiers.tier2Max) return tiers.tier2Pct;
  return tiers.tier3Pct;
};

export const money = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)} EGP`;
};

/** Fill coachPrice / platformFee when the deployed API does not send them yet. */
export const withCoachPricing = <T extends {
  price?: number;
  coachPrice?: number;
  platformFee?: number;
}>(coach: T): T => {
  if (coach.coachPrice != null && coach.platformFee != null) return coach;

  const registered = Number(coach.coachPrice ?? coach.price ?? 0) || 0;
  const pct = getPlatformPercentage(registered);
  const platformFee = Math.round((registered * pct) / 100);

  return {
    ...coach,
    coachPrice: roundMoney(registered),
    platformFee,
    price: roundMoney(registered + platformFee),
  };
};
