/**
 * Warranty state of an item (SPEC MT-S1 BR-MT-11). Dates are `YYYY-MM-DD` in Vietnam time. The threshold lives here
 * only, so MT-S4 can turn it into a per-building setting. Mirrors web `warrantyStatus`.
 */
export const WARRANTY_SOON_DAYS = 30;

export type WarrantyState = 'NONE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export const warrantyState = (warrantyUntil: string | null, today: string): WarrantyState => {
  if (!warrantyUntil) return 'NONE';
  const left = daysBetween(today, warrantyUntil);
  if (left < 0) return 'EXPIRED';
  return left <= WARRANTY_SOON_DAYS ? 'EXPIRING' : 'ACTIVE';
};
