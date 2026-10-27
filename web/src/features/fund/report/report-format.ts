import { vndInWords } from '@/domain/payment';

/** "15000000" → "15", "15500000" → "15,5" (million đồng, one decimal at most, from integers — never a float). */
export const millions = (amountVnd: string): string => {
  const value = BigInt(amountVnd);
  const negative = value < 0n;
  const tenths = ((negative ? -value : value) + 50_000n) / 100_000n;
  const whole = (tenths / 10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimal = tenths % 10n;
  return `${negative ? '−' : ''}${whole}${decimal === 0n ? '' : `,${decimal.toString()}`}`;
};

/** "50 + 15 − 5 = 60" (BR-F5-02 check line, million đồng). */
export const checkLine = (figures: { openingVnd: string; inVnd: string; outVnd: string; closingVnd: string }): string =>
  `${millions(figures.openingVnd)} + ${millions(figures.inVnd)} − ${millions(figures.outVnd)} = ${millions(figures.closingVnd)}`;

/** "năm mươi triệu đồng" for screen readers. */
export const spokenMillions = (amountVnd: string): string => vndInWords(amountVnd.replace(/^-/, '')).toLowerCase();
