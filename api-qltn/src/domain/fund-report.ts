/**
 * The fund report of a period (SPEC F-S5 BR-F5-01..04): opening, money in and out by group, closing — by the ledger,
 * or by the bank statement when every day is covered and every month reconciled. Internal lines (a deposit offset)
 * move nothing and stay out of in and out. Dates are `YYYY-MM-DD`; money is integer VND as a string.
 */
import type { LedgerDirection } from './fund-ledger';

export type ReportPeriodKind = 'MONTH' | 'QUARTER' | 'YEAR' | 'RANGE';

export interface ReportPeriod {
  from: string;
  to: string;
  /** "Tháng 11/2026", "Quý 4/2026", "Năm 2026", "01/11/2026 – 15/12/2026". */
  label: string;
  /** For file names: "2026-11", "2026-q4", "2026", "2026-11-01_2026-12-15". */
  slug: string;
}

const lastDay = (year: number, month: number): string => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
const vnDay = (iso: string): string => iso.split('-').reverse().join('/');

/** BR-F5-01: a month ("2026-11"), quarter ("2026-Q4"), year ("2026") or range ("2026-11-01..2026-12-15"). */
export const reportPeriod = (kind: ReportPeriodKind, value: string): ReportPeriod | null => {
  if (kind === 'MONTH' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return { from: `${value}-01`, to: lastDay(year, month), label: `Tháng ${value.slice(5)}/${value.slice(0, 4)}`, slug: value };
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(value);
  if (kind === 'QUARTER' && quarter) {
    const year = Number(quarter[1]);
    const q = Number(quarter[2]);
    const first = (q - 1) * 3 + 1;
    return {
      from: `${year}-${String(first).padStart(2, '0')}-01`,
      to: lastDay(year, first + 2),
      label: `Quý ${q}/${year}`,
      slug: `${year}-q${q}`,
    };
  }
  if (kind === 'YEAR' && /^\d{4}$/.test(value)) return { from: `${value}-01-01`, to: `${value}-12-31`, label: `Năm ${value}`, slug: value };
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (kind === 'RANGE' && range && range[1] <= range[2])
    return { from: range[1], to: range[2], label: `${vnDay(range[1])} – ${vnDay(range[2])}`, slug: `${range[1]}_${range[2]}` };
  return null;
};

/** The months a period touches ("2026-10", "2026-11", …). */
export const monthsOf = (from: string, to: string): string[] => {
  const months: string[] = [];
  let [year, month] = from.slice(0, 7).split('-').map(Number);
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > end) break;
    months.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

export interface ReportLine {
  entryDate: string;
  direction: LedgerDirection;
  amountVnd: string;
  category: string;
  internal: boolean;
}

export interface ReportFigures {
  openingVnd: string;
  inVnd: string;
  outVnd: string;
  closingVnd: string;
  /** BR-F5-03: Σ by group and direction, internal lines left out; groups at 0 are absent. */
  sources: Array<{ direction: LedgerDirection; category: string; amountVnd: string }>;
}

const signed = (line: Pick<ReportLine, 'direction' | 'amountVnd'>): bigint =>
  line.direction === 'IN' ? BigInt(line.amountVnd) : -BigInt(line.amountVnd);

/**
 * BR-F5-02, BR-F5-03 by the ledger: the opening is the balance at the end of the day before the period (or the opening
 * balance when the ledger starts inside it); in and out leave internal lines out; closing = opening + in − out.
 */
export const ledgerReport = (
  opening: { openingDate: string; openingBalanceVnd: string },
  lines: readonly ReportLine[],
  from: string,
  to: string,
): ReportFigures => {
  const start = lines.filter((line) => line.entryDate < from).reduce((total, line) => total + signed(line), BigInt(opening.openingBalanceVnd));
  const inPeriod = lines.filter((line) => line.entryDate >= from && line.entryDate <= to && !line.internal);
  const sum = (direction: LedgerDirection): bigint =>
    inPeriod.filter((line) => line.direction === direction).reduce((total, line) => total + BigInt(line.amountVnd), 0n);
  const groups = new Map<string, bigint>();
  for (const line of inPeriod) {
    const key = `${line.direction}|${line.category}`;
    groups.set(key, (groups.get(key) ?? 0n) + BigInt(line.amountVnd));
  }
  const inflow = sum('IN');
  const outflow = sum('OUT');
  return {
    openingVnd: start.toString(),
    inVnd: inflow.toString(),
    outVnd: outflow.toString(),
    closingVnd: (start + inflow - outflow).toString(),
    sources: [...groups.entries()]
      .filter(([, amount]) => amount > 0n)
      .map(([key, amount]) => {
        const [direction, category] = key.split('|') as [LedgerDirection, string];
        return { direction, category, amountVnd: amount.toString() };
      }),
  };
};

/** BR-F5-01: whether statements cover every day from `from` to `to` (their union, gaps and all). */
export const statementsCover = (periods: ReadonlyArray<{ periodFrom: string; periodTo: string }>, from: string, to: string): boolean => {
  const sorted = [...periods].sort((a, b) => a.periodFrom.localeCompare(b.periodFrom));
  let reached = from;
  const nextDay = (iso: string): string => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  let covered = false;
  for (const period of sorted) {
    if (period.periodFrom > reached) break;
    if (period.periodTo >= reached) {
      if (period.periodTo >= to) return true;
      reached = nextDay(period.periodTo);
      covered = true;
    }
  }
  return covered && reached > to;
};

/** BR-F5-13: the five conditions a termination needs before it can be closed, in the screen's order. */
export interface CloseCheck {
  key: 'HANDOVER' | 'MINUTES' | 'RECEIVABLES' | 'DEPOSIT' | 'PENDING';
  ok: boolean;
  /** What stands in the way ("Còn 5.000.000 đ"), or what is done. */
  detail: string;
  amountVnd?: string;
}

export const closeChecks = (input: {
  latestHandover: 'PASSED' | 'FAILED' | null;
  minutes: boolean;
  remainingVnd: string;
  depositHeldVnd: string;
  pending: number;
}): CloseCheck[] => {
  const money = (amount: string): string => amount.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return [
    {
      key: 'HANDOVER',
      ok: input.latestHandover === 'PASSED',
      detail: { PASSED: 'Đạt', FAILED: 'Không đạt', none: 'Chưa có' }[input.latestHandover ?? 'none'],
    },
    { key: 'MINUTES', ok: input.minutes, detail: input.minutes ? 'Đã lập' : 'Chưa có' },
    {
      key: 'RECEIVABLES',
      ok: BigInt(input.remainingVnd) === 0n,
      detail: BigInt(input.remainingVnd) === 0n ? 'Đã xử lý' : `Còn ${money(input.remainingVnd)} đ`,
      amountVnd: input.remainingVnd,
    },
    {
      key: 'DEPOSIT',
      ok: BigInt(input.depositHeldVnd) === 0n,
      detail: BigInt(input.depositHeldVnd) === 0n ? 'Đã xử lý' : `Còn giữ ${money(input.depositHeldVnd)} đ`,
      amountVnd: input.depositHeldVnd,
    },
    { key: 'PENDING', ok: input.pending === 0, detail: input.pending === 0 ? 'Không' : `${input.pending} đang chờ duyệt hoặc chờ chi` },
  ];
};
