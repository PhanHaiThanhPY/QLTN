import { TIME_ZONE } from '@/domain/constants';
import type { IsoDate, IsoDateTime } from '@/domain/types';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const vnDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date of an instant in Vietnam time. */
export const toVnDate = (instant: Date | IsoDateTime): IsoDate =>
  vnDateFormatter.format(typeof instant === 'string' ? new Date(instant) : instant);

export const isValidIsoDate = (value: string): boolean => {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
};

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

const parts = (date: IsoDate): [number, number, number] => {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid date ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const format = (year: number, month: number, day: number): IsoDate =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const addDays = (date: IsoDate, days: number): IsoDate => {
  const [y, m, d] = parts(date);
  const value = new Date(Date.UTC(y, m - 1, d + days));
  return format(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
};

/** Adds months keeping the anchor day; clamps to the last day when the target month is shorter. */
export const addMonthsClamped = (date: IsoDate, months: number): IsoDate => {
  const [y, m, d] = parts(date);
  const zeroBased = m - 1 + months;
  const year = y + Math.floor(zeroBased / 12);
  const month = (((zeroBased % 12) + 12) % 12) + 1;
  return format(year, month, Math.min(d, daysInMonth(year, month)));
};

export const diffDays = (from: IsoDate, to: IsoDate): number => {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
};

/** Instant for a VN wall-clock time on a calendar date (VN has no DST, UTC+7). */
export const vnDateTimeToIso = (date: IsoDate, hour = 9, minute = 0): IsoDateTime => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d, hour - 7, minute)).toISOString();
};

/** End of a VN calendar day as instant; used as task due time for date-based work. */
export const vnEndOfDayIso = (date: IsoDate): IsoDateTime => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d, 23 - 7, 59, 59)).toISOString();
};

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Date-time in VN time; non-breaking spaces keep "23:59 09/10/2026" on one line. */
export const formatDateTime = (value?: IsoDateTime): string =>
  value ? dateTimeFormatter.format(new Date(value)).replace(/[\s,]+/g, '\u00a0') : '—';

export const formatDate = (value?: IsoDate): string => {
  if (!value) return '—';
  const [y, m, d] = parts(value);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};
