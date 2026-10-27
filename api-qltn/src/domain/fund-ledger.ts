/**
 * Money model of a fund (SPEC F-S3 §3.1, FG-02): an opening balance on a start day, then one immutable ledger line per
 * movement; a reversal is a line of its own. Dates are `YYYY-MM-DD`; money is integer VND as a string (bigint). Shared
 * with group T (maintenance fund): nothing here knows what kind of fund it is.
 */

export type LedgerDirection = 'IN' | 'OUT';

export interface LedgerLine {
  entryDate: string;
  direction: LedgerDirection;
  amountVnd: string;
}

export interface FundOpening {
  openingDate: string;
  openingBalanceVnd: string;
}

export interface MonthFigures {
  openingVnd: string;
  inVnd: string;
  outVnd: string;
  closingVnd: string;
}

/** The low point of the balance from a day on: the most that may still leave the fund on that day (BR-F3-13). */
export interface Available {
  amountVnd: string;
  date: string;
}

const signed = (line: LedgerLine): bigint => (line.direction === 'IN' ? BigInt(line.amountVnd) : -BigInt(line.amountVnd));

/** BR-F3-05: opening balance + Σ in − Σ out of every line dated on or before `date` (reversals included). */
export const balanceAt = (opening: FundOpening, lines: readonly LedgerLine[], date: string): string =>
  lines
    .filter((line) => line.entryDate <= date)
    .reduce((total, line) => total + signed(line), BigInt(opening.openingBalanceVnd))
    .toString();

/** `YYYY-MM` → its first and last day. */
export const monthBounds = (month: string): { first: string; last: string } => {
  const [year, mon] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, '0')}` };
};

/**
 * BR-F3-05: a month's opening (the balance at the end of the day before it starts, or the opening balance when the
 * ledger starts inside it), in, out and closing = opening + in − out.
 */
export const monthFigures = (opening: FundOpening, lines: readonly LedgerLine[], month: string): MonthFigures => {
  const { first, last } = monthBounds(month);
  const inMonth = lines.filter((line) => line.entryDate >= first && line.entryDate <= last);
  const before = lines.filter((line) => line.entryDate < first);
  const start = before.reduce((total, line) => total + signed(line), BigInt(opening.openingBalanceVnd));
  const sum = (direction: LedgerDirection): bigint =>
    inMonth.filter((line) => line.direction === direction).reduce((total, line) => total + BigInt(line.amountVnd), 0n);
  const inflow = sum('IN');
  const outflow = sum('OUT');
  return {
    openingVnd: start.toString(),
    inVnd: inflow.toString(),
    outVnd: outflow.toString(),
    closingVnd: (start + inflow - outflow).toString(),
  };
};

/**
 * BR-F3-13, D-F3-7: the lowest end-of-day balance on `from` or any later day that has a line. A payout of X dated
 * `from` keeps every day non-negative exactly when X ≤ this amount; the date says where the fund would go short.
 */
export const availableFrom = (opening: FundOpening, lines: readonly LedgerLine[], from: string): Available => {
  const days = [...new Set([from, ...lines.map((line) => line.entryDate).filter((day) => day > from)])].sort();
  let low: Available | null = null;
  for (const day of days) {
    const balance = balanceAt(opening, lines, day);
    if (!low || BigInt(balance) < BigInt(low.amountVnd)) low = { amountVnd: balance, date: day };
  }
  return low ?? { amountVnd: balanceAt(opening, lines, from), date: from };
};

/** Masks an account number to its last four digits ("****0001", BR-F3-02). */
export const maskAccount = (accountNo: string | null): string | null =>
  accountNo ? `****${accountNo.replace(/\s/g, '').slice(-4)}` : null;
