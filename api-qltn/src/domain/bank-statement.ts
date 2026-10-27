/**
 * Bank statements of a fund's account and their reconciliation with the fund ledger (SPEC F-S4 §3). Kind-neutral:
 * group T reconciles the maintenance fund's account with the same rules. Dates are `YYYY-MM-DD`; money is integer VND
 * as a string (bigint) — a decimal amount is refused, never rounded.
 */
import type { LedgerDirection } from './fund-ledger';

/** BR-F4-02: the standard columns, in the template's order. */
export const STATEMENT_COLUMNS = {
  date: 'Ngày giao dịch',
  credit: 'Ghi có',
  debit: 'Ghi nợ',
  description: 'Nội dung',
  reference: 'Số tham chiếu',
  account: 'Số tài khoản',
} as const;
export type StatementColumn = keyof typeof STATEMENT_COLUMNS;

export const STATEMENT_ROWS_MAX = 5000;
const DESCRIPTION_MAX = 500;
const REFERENCE_MAX = 100;
/** D-F4-3: a match within 5 days needs no reason; BR-F4-06 suggests within 2. */
export const MATCH_DAYS_FREE = 5;
export const SUGGEST_DAYS = 2;

export type Cell = string | number | null | undefined;

export interface StatementRowError {
  /** The file's line number, the header being line 1. */
  row: number;
  column: StatementColumn | null;
  message: string;
}

export interface StatementRow {
  row: number;
  txnDate: string;
  direction: LedgerDirection;
  amountVnd: string;
  description: string;
  reference: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const blank = (cell: Cell): boolean => cell === null || cell === undefined || String(cell).trim() === '';

/**
 * BR-F4-02: an integer VND amount ≥ 0. Thousands may be grouped with "." or "," ("10.000.000"); anything with a
 * fractional part ("2.000.000,50", 2000000.5) is refused as decimal.
 */
export const parseAmountCell = (cell: Cell, label: string): Parsed<string | null> => {
  if (blank(cell)) return { ok: true, value: null };
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < 0) return { ok: false, message: `${label} không phải số tiền hợp lệ.` };
    if (!Number.isInteger(cell)) return { ok: false, message: `${label} có phần thập phân.` };
    if (!Number.isSafeInteger(cell)) return { ok: false, message: `${label} vượt giới hạn.` };
    return { ok: true, value: String(cell) };
  }
  const text = String(cell).trim().replace(/\s/g, '');
  if (/^\d+$/.test(text)) return { ok: true, value: BigInt(text).toString() };
  if (/^\d{1,3}(\.\d{3})+$/.test(text) || /^\d{1,3}(,\d{3})+$/.test(text))
    return { ok: true, value: BigInt(text.replace(/[.,]/g, '')).toString() };
  if (/^\d[\d.,]*[.,]\d{1,2}$/.test(text) || /^\d+[.,]\d+$/.test(text)) return { ok: false, message: `${label} có phần thập phân.` };
  return { ok: false, message: `${label} không phải số tiền hợp lệ.` };
};

/** Excel's day 0 (1899-12-30, so serial 1 is 1900-01-01 with its leap-year quirk). */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/** BR-F4-02: `dd/mm/yyyy` text, or an Excel date serial from an XLSX cell. */
export const parseDateCell = (cell: Cell): Parsed<string> => {
  if (typeof cell === 'number' && Number.isInteger(cell) && cell > 0) {
    return { ok: true, value: new Date(EXCEL_EPOCH + cell * DAY_MS).toISOString().slice(0, 10) };
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(cell ?? '').trim());
  if (!match) return { ok: false, message: 'Ngày giao dịch phải có dạng dd/mm/yyyy.' };
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const valid = new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;
  return valid ? { ok: true, value: iso } : { ok: false, message: 'Ngày giao dịch không có thật.' };
};

const normalizeHeader = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Maps the header row to columns; a missing required column is an error on line 1. */
export const readHeader = (header: readonly Cell[]): { index: Partial<Record<StatementColumn, number>>; errors: StatementRowError[] } => {
  const index: Partial<Record<StatementColumn, number>> = {};
  header.forEach((cell, at) => {
    const name = normalizeHeader(String(cell ?? ''));
    const column = (Object.keys(STATEMENT_COLUMNS) as StatementColumn[]).find((key) => normalizeHeader(STATEMENT_COLUMNS[key]) === name);
    if (column && index[column] === undefined) index[column] = at;
  });
  const errors: StatementRowError[] = [];
  for (const column of ['date', 'credit', 'debit', 'description'] as const)
    if (index[column] === undefined) errors.push({ row: 1, column, message: `Thiếu cột "${STATEMENT_COLUMNS[column]}".` });
  return { index, errors };
};

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * BR-F4-02: every data line becomes a statement row, or errors named by line and column. Any error, or an account
 * number other than the fund's, refuses the whole file (D-F4-1) — the caller imports nothing then.
 */
export const readRows = (
  table: ReadonlyArray<readonly Cell[]>,
  accountNo: string | null,
): { rows: StatementRow[]; errors: StatementRowError[] } => {
  const [header = [], ...data] = table;
  const { index, errors } = readHeader(header);
  if (errors.length) return { rows: [], errors };
  const cell = (line: readonly Cell[], column: StatementColumn): Cell => (index[column] === undefined ? null : line[index[column] as number]);
  const rows: StatementRow[] = [];
  if (data.length > STATEMENT_ROWS_MAX) errors.push({ row: 1, column: null, message: `Tệp có quá ${STATEMENT_ROWS_MAX} dòng.` });
  data.forEach((line, at) => {
    const row = at + 2;
    if (line.every(blank)) return;
    const fail = (column: StatementColumn | null, message: string) => errors.push({ row, column, message: `Dòng ${row}: ${message}` });
    const date = parseDateCell(cell(line, 'date'));
    if (!date.ok) fail('date', date.message);
    const credit = parseAmountCell(cell(line, 'credit'), STATEMENT_COLUMNS.credit);
    const debit = parseAmountCell(cell(line, 'debit'), STATEMENT_COLUMNS.debit);
    if (!credit.ok) fail('credit', credit.message);
    if (!debit.ok) fail('debit', debit.message);
    const description = String(cell(line, 'description') ?? '').trim();
    if (!description) fail('description', 'Thiếu nội dung.');
    if (description.length > DESCRIPTION_MAX) fail('description', `Nội dung tối đa ${DESCRIPTION_MAX} ký tự.`);
    const reference = String(cell(line, 'reference') ?? '').trim();
    if (reference.length > REFERENCE_MAX) fail('reference', `Số tham chiếu tối đa ${REFERENCE_MAX} ký tự.`);
    const account = String(cell(line, 'account') ?? '').trim();
    if (account && digitsOnly(account) !== digitsOnly(accountNo ?? ''))
      fail('account', 'Số tài khoản không phải tài khoản của quỹ; cả tệp không được nhập.');
    if (!date.ok || !credit.ok || !debit.ok) return;
    const inflow = credit.value && BigInt(credit.value) > 0n ? credit.value : null;
    const outflow = debit.value && BigInt(debit.value) > 0n ? debit.value : null;
    if ((inflow === null) === (outflow === null)) {
      fail(null, 'Mỗi dòng có đúng một trong hai cột Ghi có, Ghi nợ là số lớn hơn 0.');
      return;
    }
    rows.push({
      row,
      txnDate: date.value,
      direction: inflow ? 'IN' : 'OUT',
      amountVnd: (inflow ?? outflow) as string,
      description,
      reference: reference || null,
    });
  });
  return { rows, errors };
};

/** BR-F4-01: opening + Σ lines must equal the bank's closing; answers the gap (closing − computed). */
export const closureGap = (openingVnd: string, closingVnd: string, rows: ReadonlyArray<Pick<StatementRow, 'direction' | 'amountVnd'>>): string => {
  const computed = rows.reduce((total, row) => total + (row.direction === 'IN' ? 1n : -1n) * BigInt(row.amountVnd), BigInt(openingVnd));
  return (BigInt(closingVnd) - computed).toString();
};

/** BR-F4-03: the key a transaction is known by; without a reference the description counts, normalised. */
export const dedupeKey = (row: Pick<StatementRow, 'txnDate' | 'direction' | 'amountVnd' | 'reference' | 'description'>): string => {
  const signed = `${row.direction === 'IN' ? '' : '-'}${row.amountVnd}`;
  const tail = row.reference ? `ref:${row.reference.trim()}` : `txt:${row.description.trim().replace(/\s+/g, ' ').toLowerCase()}`;
  return `${row.txnDate}|${signed}|${tail}`;
};

export const daysBetween = (a: string, b: string): number =>
  Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

export interface MatchableLine {
  id: string;
  date: string;
  direction: LedgerDirection;
  amountVnd: string;
}

export interface Suggestion {
  lineId: string;
  entryId: string;
  days: number;
}

/** BR-F4-05: same direction, same amount; the day gap decides whether a reason is needed. */
export const isCandidate = (line: MatchableLine, entry: MatchableLine): boolean =>
  line.direction === entry.direction && BigInt(line.amountVnd) === BigInt(entry.amountVnd);

/**
 * BR-F4-06: a statement line is paired with a ledger line when that is its only candidate within 5 days and it is
 * within 2; a ledger line wanted by two statement lines is suggested to neither.
 */
export const suggestMatches = (lines: readonly MatchableLine[], entries: readonly MatchableLine[]): Suggestion[] => {
  const proposals: Suggestion[] = [];
  for (const line of lines) {
    const near = entries.filter((entry) => isCandidate(line, entry) && daysBetween(line.date, entry.date) <= MATCH_DAYS_FREE);
    if (near.length !== 1) continue;
    const days = daysBetween(line.date, near[0].date);
    if (days <= SUGGEST_DAYS) proposals.push({ lineId: line.id, entryId: near[0].id, days });
  }
  const wanted = new Map<string, number>();
  for (const row of proposals) wanted.set(row.entryId, (wanted.get(row.entryId) ?? 0) + 1);
  return proposals.filter((row) => wanted.get(row.entryId) === 1);
};

export interface StatementPeriod {
  periodFrom: string;
  periodTo: string;
  openingVnd: string;
}

/**
 * BR-F4-09: the bank's balance at the end of `date`, from a statement covering that day (its opening plus every
 * stored line of the account from its start up to `date` — duplicates were stored once); null when none covers it.
 */
export const statementBalanceAt = (
  periods: readonly StatementPeriod[],
  lines: ReadonlyArray<Pick<MatchableLine, 'date' | 'direction' | 'amountVnd'>>,
  date: string,
): string | null => {
  const covering = periods
    .filter((period) => period.periodFrom <= date && date <= period.periodTo)
    .sort((a, b) => b.periodFrom.localeCompare(a.periodFrom))[0];
  if (!covering) return null;
  return lines
    .filter((line) => line.date >= covering.periodFrom && line.date <= date)
    .reduce((total, line) => total + (line.direction === 'IN' ? 1n : -1n) * BigInt(line.amountVnd), BigInt(covering.openingVnd))
    .toString();
};

/** The balance at the start of `date` (the end of the day before), when a statement covers `date`. */
export const statementBalanceBefore = (
  periods: readonly StatementPeriod[],
  lines: ReadonlyArray<Pick<MatchableLine, 'date' | 'direction' | 'amountVnd'>>,
  date: string,
): string | null => {
  const covering = periods
    .filter((period) => period.periodFrom <= date && date <= period.periodTo)
    .sort((a, b) => b.periodFrom.localeCompare(a.periodFrom))[0];
  if (!covering) return null;
  return lines
    .filter((line) => line.date >= covering.periodFrom && line.date < date)
    .reduce((total, line) => total + (line.direction === 'IN' ? 1n : -1n) * BigInt(line.amountVnd), BigInt(covering.openingVnd))
    .toString();
};
