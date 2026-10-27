// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type { ReconciliationMonth, StatementLine, StatementPreview } from '@/services/statement-api';
import { MatchedPairs } from './MatchedPairs';
import { StatementPreviewTable } from './StatementPreviewTable';
import { StatementStatus } from './StatementStatus';

const line = (code: string, txnDate: string, amountVnd: string, direction: 'IN' | 'OUT' = 'IN'): StatementLine => ({
  id: code,
  code,
  txnDate,
  direction,
  amountVnd,
  description: `${code} nội dung`,
  reference: null,
  possibleDuplicate: false,
  status: 'MATCHED',
  recordAs: direction === 'IN' ? 'INTEREST' : 'BANK_FEE',
});

const entry = (sourceCode: string, entryDate: string, amountVnd: string, direction: 'IN' | 'OUT' = 'IN') => ({
  id: sourceCode,
  entryDate,
  direction,
  amountVnd,
  category: direction === 'IN' ? ('CONTRACT_RECEIPT' as const) : ('TAX' as const),
  sourceType: 'RECEIPT',
  sourceId: sourceCode,
  sourceCode,
  description: sourceCode,
});

const view = (patch: Partial<ReconciliationMonth> = {}): ReconciliationMonth => ({
  fund: { id: 'f1', buildingId: 'b1', accountNo: null, accountMasked: '****0001', openingDate: '2026-11-01' },
  month: '2026-11',
  statement: { openingVnd: '50000000', inVnd: '15000000', outVnd: '5000000', closingVnd: '60000000' },
  asOf: '2026-11-30',
  ledgerClosingVnd: '60000000',
  differenceVnd: '0',
  counts: { lines: 4, matched: 4, unmatchedLines: 0, unreconciledEntries: 0, gaps: 0, duplicates: 0 },
  matchedMonth: true,
  openingWarning: null,
  pairs: [],
  unmatchedLines: [],
  unmatchedEntries: [],
  selfCancelled: [],
  suggestions: [],
  imports: 1,
  ...patch,
});

describe('F-S4 components', () => {
  it('names the errors by line and column and says when the statement does not close (AC-F4.2, AC-F4.3)', () => {
    const preview: StatementPreview = {
      rows: [
        { row: 2, txnDate: '2026-11-18', direction: 'IN', amountVnd: '10000000', description: 'DV-A', reference: null, result: 'NEW' },
        { row: 3, txnDate: '2026-11-22', direction: 'IN', amountVnd: '5000000', description: 'DV-A', reference: null, result: 'DUPLICATE' },
      ],
      errors: [{ row: 4, column: 'debit', message: 'Dòng 4: Ghi nợ có phần thập phân.' }],
      closureGapVnd: '1000000',
      sumVnd: '15000000',
      newCount: 1,
      duplicateCount: 1,
      possibleDuplicateCount: 0,
      blocked: true,
    };
    render(<StatementPreviewTable preview={preview} openingVnd="50000000" closingVnd="66000000" />);
    expect(within(screen.getByRole('alert')).getByText('Dòng 4: Ghi nợ có phần thập phân.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Sao kê không khép: lệch 1.000.000 ₫');
    expect(screen.getAllByText('Trùng (bỏ qua)').length).toBeGreaterThan(0);
  });

  it('lays the statement and its documents in two titled sections, one pair per row, each with a spoken name (AC-F4.6)', () => {
    const pairs = [
      { matchId: 'm1', kind: 'MATCH' as const, reason: null, line: line('GD-001', '2026-11-18', '10000000'), entry: entry('PT-001', '2026-11-18', '10000000') },
      { matchId: 'm2', kind: 'MATCH' as const, reason: null, line: line('GD-003', '2026-11-22', '2000000', 'OUT'), entry: entry('GNT-001', '2026-11-22', '2000000', 'OUT') },
    ];
    render(<MatchedPairs pairs={pairs} accountLabel="****0001" canOperate onUnmatch={vi.fn()} />);
    const statement = screen.getByRole('region', { name: /Sao kê · \*\*\*\*0001/ });
    const documents = screen.getByRole('region', { name: /Chứng từ đã ghép/ });
    expect(within(statement).getAllByRole('listitem')).toHaveLength(2);
    expect(within(documents).getAllByRole('listitem')[1].textContent).toContain('GNT-001 · Liên kết GD-003');
    expect(screen.getAllByText('GD-001, ngày 18 tháng 11, cộng mười triệu đồng, đã ghép với PT-001').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Bỏ ghép GD-001' })).toBeTruthy();
  });

  it('reads the month: matched, a difference with both balances, or no statement at all (BR-F4-10, AC-F4.11, AC-F4.12)', () => {
    const { rerender } = render(<StatementStatus view={view()} />);
    expect(screen.getByText('✓ Đã khớp')).toBeTruthy();
    expect(document.body.textContent).toContain('4/4 khớp');
    expect(document.body.textContent).toContain('Lệch/trùng 0/0');
    rerender(<StatementStatus view={view({ differenceVnd: '1000000', ledgerClosingVnd: '61000000', matchedMonth: false, counts: { lines: 4, matched: 4, unmatchedLines: 0, unreconciledEntries: 1, gaps: 1, duplicates: 0 } })} />);
    expect(screen.getByText('Còn lệch')).toBeTruthy();
    expect(document.body.textContent).toContain('Theo sổ 61.000.000 ₫ · Theo sao kê 60.000.000 ₫ · Chênh lệch +1.000.000 ₫');
    rerender(<StatementStatus view={view({ statement: { openingVnd: null, inVnd: null, outVnd: null, closingVnd: null }, differenceVnd: null, matchedMonth: false })} />);
    expect(screen.getByText('Chưa có sao kê')).toBeTruthy();
  });
});
