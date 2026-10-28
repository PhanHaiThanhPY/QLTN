/**
 * SPEC T-S1 (docs/product/features/T-chao-lai-chon-ngan-hang/SPEC.md): rates as integers in thousandths of a percent
 * (5,875 %/năm → 5875), the interest of a whole term for comparison, and the ranking of offers. Integers only.
 */

export const RATE_SCALE = 1000;
/** BR-T1-06: > 0 and ≤ 30 %/năm. */
export const RATE_MAX_MILLI = 30 * RATE_SCALE;
export const DAY_BASES = [360, 365] as const;
export type DayBasis = (typeof DAY_BASES)[number];
export const TERM_MIN_DAYS = 7;
export const TERM_MAX_DAYS = 3650;

const RATE_TEXT = /^(\d{1,2})(?:[.,](\d{1,3}))?$/;

/** "5,875" or "5.875" → 5875; null when not a rate with at most 3 decimals in (0, 30] (AC-T1.6). */
export const parseRate = (text: string): number | null => {
  const match = RATE_TEXT.exec(text.trim());
  if (!match) return null;
  const milli = Number(match[1]) * RATE_SCALE + Number((match[2] ?? '').padEnd(3, '0'));
  return milli > 0 && milli <= RATE_MAX_MILLI ? milli : null;
};

/** 6000 → "6,0"; 5875 → "5,875"; 5850 → "5,85" (ui-brief §0: the decimals it has, at least one). */
export const formatRate = (milli: number): string => {
  const whole = Math.floor(milli / RATE_SCALE);
  const decimals = String(milli % RATE_SCALE)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return `${whole},${decimals || '0'}`;
};

/**
 * BR-T1-08: amount × rate × days ÷ basis, rounded to the đồng, half up. Only for comparing offers; the contract's own
 * rounding applies later (T-S2, DF-22). 1.000.000.000 × 6,0% × 90 ÷ 360 = 15.000.000.
 */
export const termInterest = (amountVnd: bigint, rateMilli: number, days: number, basis: DayBasis): bigint => {
  const numerator = amountVnd * BigInt(rateMilli) * BigInt(days);
  const denominator = BigInt(basis) * BigInt(100 * RATE_SCALE);
  return (numerator * 2n + denominator) / (denominator * 2n);
};

export interface RankableOffer {
  id: string;
  interestVnd: bigint;
  rateMilli: number;
  receivedAt: Date;
}

/** BR-T1-08: the highest interest first; then the higher rate, then the earlier offer. */
export const rankOffers = <T extends RankableOffer>(offers: readonly T[]): T[] =>
  [...offers].sort((a, b) => {
    if (a.interestVnd !== b.interestVnd) return a.interestVnd > b.interestVnd ? -1 : 1;
    if (a.rateMilli !== b.rateMilli) return b.rateMilli - a.rateMilli;
    return a.receivedAt.getTime() - b.receivedAt.getTime();
  });
