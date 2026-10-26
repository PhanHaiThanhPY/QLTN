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

/** "2026-10-26" → "26/10/2026". */
export const formatVnDate = (isoDate: string): string => isoDate.split('-').reverse().join('/');
