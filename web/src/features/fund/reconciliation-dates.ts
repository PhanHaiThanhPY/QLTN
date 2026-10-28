/** "2026-11" → "2026-11-30". */
export const monthBoundsLast = (month: string): string => {
  const [year, mon] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, '0')}`;
};
