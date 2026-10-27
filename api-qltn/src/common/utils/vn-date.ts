/** Business dates are Vietnam dates (UTC+7, no DST), written YYYY-MM-DD. */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-10-26" for an instant, in Vietnam time. */
export const vnDate = (at: Date): string => dateFormatter.format(at);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day written YYYY-MM-DD. */
export const isIsoDate = (value: string): boolean =>
  ISO_DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** "2026-10-26" → "26/10/2026". */
export const formatVnDate = (isoDate: string): string => isoDate.split('-').reverse().join('/');

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "09:10 28/10/2026" for an instant, in Vietnam time (the app's date-time format). */
export const formatVnDateTime = (at: Date): string => `${timeFormatter.format(at)} ${formatVnDate(vnDate(at))}`;
