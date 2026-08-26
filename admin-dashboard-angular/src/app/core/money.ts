import { environment } from '../../environments/environment';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

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

  const pct = environment.platformPercentage ?? 10;
  const registered = Number(coach.coachPrice ?? coach.price ?? 0) || 0;
  const platformFee = roundMoney((registered * pct) / 100);

  return {
    ...coach,
    coachPrice: roundMoney(registered),
    platformFee,
    price: roundMoney(registered + platformFee),
  };
};
