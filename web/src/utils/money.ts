const vndFormatter = new Intl.NumberFormat('vi-VN');

export const formatVnd = (amount?: number): string => (amount === undefined ? '—' : `${vndFormatter.format(amount)} ₫`);

/** Integer VND sent by the API as a string ("16500000" → "16.500.000 ₫"), formatted through BigInt, never a float. */
export const formatVndText = (amount: string | null | undefined): string =>
  amount && /^-?\d+$/.test(amount) ? `${vndFormatter.format(BigInt(amount))} ₫` : '—';

export const isValidVndAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** Parses user input like "12.500.000" into an integer VND amount. */
export const parseVndInput = (raw: string): number | undefined => {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : undefined;
};

/** Amount shown in a money text box ("12.500.000"); empty when there is no amount yet. */
export const formatVndInput = (amount?: number): string => (amount ? new Intl.NumberFormat('vi-VN').format(amount) : '');
