import { vndInWords } from './payment';

/**
 * SPEC T-S1 rates and interest. Mirrors api-qltn/src/domain/deposit.ts (parity test): rates are integers in thousandths
 * of a percent (5,875 %/năm → 5875) and the interest of a term is integer arithmetic, half up.
 */
export const RATE_SCALE = 1000;
export const RATE_MAX_MILLI = 30 * RATE_SCALE;
export const DAY_BASES = [360, 365] as const;
export type DayBasis = (typeof DAY_BASES)[number];
export const TERM_MIN_DAYS = 7;
export const TERM_MAX_DAYS = 3650;

const RATE_TEXT = /^(\d{1,2})(?:[.,](\d{1,3}))?$/;
const DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'] as const;

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

/** "sáu phẩy không phần trăm một năm" (ui-brief §4, accessibility). */
export const spokenRate = (milli: number): string => {
  const [whole, decimals] = formatRate(milli).split(',');
  const wholeWords = vndInWords(whole).replace(/ đồng$/, '').toLowerCase();
  const decimalWords = [...decimals].map((digit) => DIGIT_WORDS[Number(digit)]).join(' ');
  return `${wholeWords} phẩy ${decimalWords} phần trăm một năm`;
};

/** BR-T1-08: amount × rate × days ÷ basis, rounded to the đồng, half up; for comparison only (D-T1-3). */
export const termInterest = (amountVnd: bigint, rateMilli: number, days: number, basis: DayBasis): bigint => {
  const numerator = amountVnd * BigInt(rateMilli) * BigInt(days);
  const denominator = BigInt(basis) * BigInt(100 * RATE_SCALE);
  return (numerator * 2n + denominator) / (denominator * 2n);
};
