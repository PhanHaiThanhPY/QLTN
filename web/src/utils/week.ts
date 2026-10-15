import type { IsoDate } from '@/domain/types';
import { addDays } from './date';

/** Vietnamese weekday headers, Monday first. */
export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** Monday of the ISO week containing `date`. */
export const mondayOf = (date: IsoDate): IsoDate => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
};

/** "6 – 12 tháng 10, 2026", or "29/9 – 5/10/2026" when the range spans two months. */
export const weekRangeLabel = (from: IsoDate, to: IsoDate): string => {
  const fromMonth = Number(from.slice(5, 7));
  const toMonth = Number(to.slice(5, 7));
  const year = to.slice(0, 4);
  if (fromMonth === toMonth) return `${Number(from.slice(8))} – ${Number(to.slice(8))} tháng ${toMonth}, ${year}`;
  return `${Number(from.slice(8))}/${fromMonth} – ${Number(to.slice(8))}/${toMonth}/${year}`;
};
