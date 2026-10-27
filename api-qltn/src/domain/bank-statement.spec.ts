import {
  closureGap,
  dedupeKey,
  parseAmountCell,
  parseDateCell,
  readRows,
  statementBalanceAt,
  statementBalanceBefore,
  suggestMatches,
} from './bank-statement';

const HEADER = ['Ngày giao dịch', 'Ghi có', 'Ghi nợ', 'Nội dung', 'Số tham chiếu', 'Số tài khoản'];
/** D1 p. 12: GD-001..GD-004. */
const D1 = [
  HEADER,
  ['18/11/2026', '10.000.000', '', 'DV-A chuyen tien HD-001', 'FT001', ''],
  ['22/11/2026', '5000000', '', 'DV-A chuyen tien HD-001', 'FT002', ''],
  ['22/11/2026', '', '2.000.000', 'Nop thue thang 11', 'FT003', '0071000000001'],
  ['23/11/2026', '', 3000000, 'Chi dich vu ve sinh', 'FT004', ''],
];

describe('bank statements (SPEC F-S4 BR-F4-01..06, BR-F4-09)', () => {
  it('reads amounts as integers and refuses a fractional part (AC-F4.3)', () => {
    expect(parseAmountCell('10.000.000', 'Ghi có')).toEqual({ ok: true, value: '10000000' });
    expect(parseAmountCell('10,000,000', 'Ghi có')).toEqual({ ok: true, value: '10000000' });
    expect(parseAmountCell(3000000, 'Ghi nợ')).toEqual({ ok: true, value: '3000000' });
    expect(parseAmountCell('2.000.000,50', 'Ghi nợ')).toEqual({ ok: false, message: 'Ghi nợ có phần thập phân.' });
    expect(parseAmountCell(2000000.5, 'Ghi nợ')).toEqual({ ok: false, message: 'Ghi nợ có phần thập phân.' });
    expect(parseAmountCell('', 'Ghi nợ')).toEqual({ ok: true, value: null });
    expect(parseAmountCell('abc', 'Ghi nợ').ok).toBe(false);
  });

  it('reads dd/mm/yyyy and Excel serial dates', () => {
    expect(parseDateCell('18/11/2026')).toEqual({ ok: true, value: '2026-11-18' });
    expect(parseDateCell(46344)).toEqual({ ok: true, value: '2026-11-18' });
    expect(parseDateCell('31/11/2026').ok).toBe(false);
    expect(parseDateCell('2026-11-18').ok).toBe(false);
  });

  it('reads the D1 file and names errors by line and column (AC-F4.1, AC-F4.3)', () => {
    const { rows, errors } = readRows(D1, '0071000000001');
    expect(errors).toEqual([]);
    expect(rows.map((row) => [row.row, row.txnDate, row.direction, row.amountVnd])).toEqual([
      [2, '2026-11-18', 'IN', '10000000'],
      [3, '2026-11-22', 'IN', '5000000'],
      [4, '2026-11-22', 'OUT', '2000000'],
      [5, '2026-11-23', 'OUT', '3000000'],
    ]);
    const decimal = D1.map((line, at) => (at === 3 ? ['22/11/2026', '', '2.000.000,50', 'Nop thue', '', ''] : line));
    expect(readRows(decimal, '0071000000001').errors).toEqual([
      { row: 4, column: 'debit', message: 'Dòng 4: Ghi nợ có phần thập phân.' },
    ]);
    const foreign = D1.map((line, at) => (at === 1 ? [...line.slice(0, 5), '1234567890'] : line));
    expect(readRows(foreign, '0071000000001').errors[0]).toMatchObject({ row: 2, column: 'account' });
    expect(readRows([['Ngày', 'Ghi có']], null).errors.map((row) => row.column)).toEqual([
      'date',
      'debit',
      'description',
    ]);
  });

  it('checks the statement closes and keys duplicates (AC-F4.2, AC-F4.5)', () => {
    const { rows } = readRows(D1, null);
    expect(closureGap('50000000', '60000000', rows)).toBe('0');
    expect(closureGap('50000000', '61000000', rows)).toBe('1000000');
    const plain = { txnDate: '2026-11-30', direction: 'OUT' as const, amountVnd: '11000', reference: null };
    expect(dedupeKey({ ...plain, description: 'Phí  SMS ' })).toBe(dedupeKey({ ...plain, description: 'phí sms' }));
    expect(dedupeKey({ ...plain, reference: 'FT9', description: 'a' })).not.toBe(
      dedupeKey({ ...plain, description: 'a' }),
    );
  });

  it('suggests only a lone candidate within 2 days (AC-F4.1, AC-F4.7)', () => {
    const line = (id: string, date: string, amountVnd: string, direction: 'IN' | 'OUT' = 'IN') => ({
      id,
      date,
      direction,
      amountVnd,
    });
    expect(
      suggestMatches(
        [line('g1', '2026-11-18', '10000000'), line('g4', '2026-11-23', '3000000', 'OUT')],
        [line('pt1', '2026-11-18', '10000000'), line('pc1', '2026-11-23', '3000000', 'OUT')],
      ),
    ).toEqual([
      { lineId: 'g1', entryId: 'pt1', days: 0 },
      { lineId: 'g4', entryId: 'pc1', days: 0 },
    ]);
    // Two receipts of 5 tr on 21/11 and 22/11: no suggestion.
    expect(
      suggestMatches(
        [line('g2', '2026-11-22', '5000000')],
        [line('a', '2026-11-21', '5000000'), line('b', '2026-11-22', '5000000')],
      ),
    ).toEqual([]);
    // One candidate but 4 days away: listed, not suggested.
    expect(suggestMatches([line('g', '2026-11-22', '5000000')], [line('a', '2026-11-18', '5000000')])).toEqual([]);
    // A direction or amount mismatch is never a candidate.
    expect(
      suggestMatches([line('g', '2026-11-18', '10000000')], [line('pc', '2026-11-18', '10000000', 'OUT')]),
    ).toEqual([]);
  });

  it('gives the bank balance on a covered day and nothing on an uncovered one (BR-F4-09, AC-F4.12)', () => {
    const periods = [{ periodFrom: '2026-11-01', periodTo: '2026-11-30', openingVnd: '50000000' }];
    const lines = readRows(D1, null).rows.map((row) => ({
      date: row.txnDate,
      direction: row.direction,
      amountVnd: row.amountVnd,
    }));
    expect(statementBalanceAt(periods, lines, '2026-11-30')).toBe('60000000');
    expect(statementBalanceAt(periods, lines, '2026-11-22')).toBe('63000000');
    expect(statementBalanceBefore(periods, lines, '2026-11-01')).toBe('50000000');
    expect(statementBalanceAt(periods, lines, '2026-12-01')).toBeNull();
  });
});
