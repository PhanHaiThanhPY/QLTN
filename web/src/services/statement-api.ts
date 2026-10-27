import { apiRequest } from './http/client';
import type { LedgerCategory, LedgerDirection } from './fund-api';

/** SPEC F-S4 shapes as the API answers them (api mode only). Money is integer VND as a string. */
export type RecordKind = 'BANK_FEE' | 'INTEREST';

export interface StatementLine {
  id: string;
  code: string;
  txnDate: string;
  direction: LedgerDirection;
  amountVnd: string;
  description: string;
  reference: string | null;
  possibleDuplicate: boolean;
  status: 'UNMATCHED' | 'MATCHED' | 'RECORDED';
  recordAs: RecordKind;
}

export interface LedgerSide {
  id: string;
  entryDate: string;
  direction: LedgerDirection;
  amountVnd: string;
  category: LedgerCategory;
  sourceType: string;
  sourceId: string;
  sourceCode: string;
  description: string;
}

export interface ReconciliationMonth {
  fund: { id: string; buildingId: string; accountNo: string | null; accountMasked: string | null; openingDate: string | null };
  month: string;
  /** By the statement; null means "Chưa có sao kê", never 0. */
  statement: { openingVnd: string | null; inVnd: string | null; outVnd: string | null; closingVnd: string | null };
  /** The day the month is read on: its last day, or the last day a statement covers while the month runs. */
  asOf: string | null;
  ledgerClosingVnd: string | null;
  differenceVnd: string | null;
  counts: { lines: number; matched: number; unmatchedLines: number; unreconciledEntries: number; gaps: number; duplicates: number };
  matchedMonth: boolean;
  openingWarning: { statementVnd: string; ledgerVnd: string; date: string } | null;
  pairs: Array<{ matchId: string; kind: 'MATCH' | 'RECORDED'; reason: string | null; line: StatementLine; entry: LedgerSide }>;
  unmatchedLines: StatementLine[];
  unmatchedEntries: LedgerSide[];
  selfCancelled: LedgerSide[];
  suggestions: Array<{ line: StatementLine; entry: LedgerSide; days: number }>;
  imports: number;
}

export interface Candidate {
  days: number;
  needsReason: boolean;
  line?: StatementLine;
  entry?: LedgerSide;
}

export interface StatementImport {
  id: string;
  periodFrom: string;
  periodTo: string;
  openingBalanceVnd: string;
  closingBalanceVnd: string;
  source: 'FILE' | 'MANUAL';
  attachmentId: string | null;
  newCount: number;
  duplicateCount: number;
  /** BR-F4-04: an import with a matched line cannot be deleted. */
  matchedCount: number;
  deletedAt: string | null;
  deleteReason: string | null;
  createdBy: string;
  createdAt: string;
}

export type RowResult = 'NEW' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE';

export interface StatementPreview {
  rows: Array<{ row: number; txnDate: string; direction: LedgerDirection; amountVnd: string; description: string; reference: string | null; result: RowResult }>;
  errors: Array<{ row: number; column: string | null; message: string }>;
  closureGapVnd: string;
  sumVnd: string;
  newCount: number;
  duplicateCount: number;
  possibleDuplicateCount: number;
  blocked: boolean;
}

/** The fields of an import: the period, the bank's two balances, then a file or typed lines. */
export interface StatementFields {
  periodFrom: string;
  periodTo: string;
  openingBalanceVnd: string;
  closingBalanceVnd: string;
}

export interface ManualLine {
  date: string;
  credit: string;
  debit: string;
  description: string;
  reference: string;
}

/** The multipart body of a preview or an import. */
export const statementForm = (fields: StatementFields, source: { file?: File | null; lines?: readonly ManualLine[] }): FormData => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (source.file) form.set('file', source.file, source.file.name);
  if (source.lines) form.set('lines', JSON.stringify(source.lines));
  return form;
};

const fundPath = (id: string, suffix: string): string => `/funds/${encodeURIComponent(id)}${suffix}`;

export const getReconciliation = (fundId: string, month: string): Promise<ReconciliationMonth> =>
  apiRequest('GET', fundPath(fundId, '/reconciliation'), { query: { month } });

export const getCandidates = (fundId: string, side: { lineId?: string; entryId?: string }): Promise<Candidate[]> =>
  apiRequest('GET', fundPath(fundId, '/reconciliation/candidates'), { query: side });

export const listStatementImports = (fundId: string): Promise<StatementImport[]> => apiRequest('GET', fundPath(fundId, '/statements'));

export const previewStatement = (fundId: string, form: FormData): Promise<StatementPreview> =>
  apiRequest('POST', fundPath(fundId, '/statements/preview'), { form });

export const STATEMENT_TEMPLATE_PATH = '/funds/statements/template';
