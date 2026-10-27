import { closeChecks, ledgerReport, monthsOf, reportPeriod, statementsCover } from './fund-report';
import { receivableState } from './exploitation-receivables';

const D1 = [
  { entryDate: '2026-11-18', direction: 'IN' as const, amountVnd: '10000000', category: 'CONTRACT_RECEIPT', internal: false },
  { entryDate: '2026-11-22', direction: 'IN' as const, amountVnd: '5000000', category: 'CONTRACT_RECEIPT', internal: false },
  { entryDate: '2026-11-22', direction: 'OUT' as const, amountVnd: '2000000', category: 'TAX', internal: false },
  { entryDate: '2026-11-23', direction: 'OUT' as const, amountVnd: '3000000', category: 'SERVICE', internal: false },
];
const OPENING = { openingDate: '2026-11-01', openingBalanceVnd: '50000000' };

describe('fund report (SPEC F-S5 BR-F5-01..04, BR-F5-13)', () => {
  it('reads a month, a quarter, a year and a range', () => {
    expect(reportPeriod('MONTH', '2026-11')).toMatchObject({ from: '2026-11-01', to: '2026-11-30', label: 'Tháng 11/2026' });
    expect(reportPeriod('QUARTER', '2026-Q4')).toMatchObject({ from: '2026-10-01', to: '2026-12-31', slug: '2026-q4' });
    expect(reportPeriod('YEAR', '2027')).toMatchObject({ from: '2027-01-01', to: '2027-12-31' });
    expect(reportPeriod('RANGE', '2026-11-01..2026-12-15')?.label).toBe('01/11/2026 – 15/12/2026');
    expect(reportPeriod('MONTH', '2026-13')).toBeNull();
    expect(monthsOf('2026-10-01', '2026-12-31')).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('gives the D1 month by groups, and a quarter from the opening (AC-F5.1, AC-F5.3)', () => {
    const month = ledgerReport(OPENING, D1, '2026-11-01', '2026-11-30');
    expect(month).toMatchObject({ openingVnd: '50000000', inVnd: '15000000', outVnd: '5000000', closingVnd: '60000000' });
    expect(month.sources).toEqual([
      { direction: 'IN', category: 'CONTRACT_RECEIPT', amountVnd: '15000000' },
      { direction: 'OUT', category: 'TAX', amountVnd: '2000000' },
      { direction: 'OUT', category: 'SERVICE', amountVnd: '3000000' },
    ]);
    expect(ledgerReport(OPENING, D1, '2026-10-01', '2026-12-31')).toMatchObject({ openingVnd: '50000000', closingVnd: '60000000' });
  });

  it('leaves internal lines out of in and out; the closing does not move (BR-F5-10)', () => {
    const offset = [
      ...D1,
      { entryDate: '2026-11-30', direction: 'OUT' as const, amountVnd: '5000000', category: 'DEPOSIT', internal: true },
      { entryDate: '2026-11-30', direction: 'IN' as const, amountVnd: '5000000', category: 'CONTRACT_RECEIPT', internal: true },
    ];
    expect(ledgerReport(OPENING, offset, '2026-11-01', '2026-11-30')).toMatchObject({ inVnd: '15000000', outVnd: '5000000', closingVnd: '60000000' });
  });

  it('knows when statements cover a period', () => {
    expect(statementsCover([{ periodFrom: '2026-11-01', periodTo: '2026-11-30' }], '2026-11-01', '2026-11-30')).toBe(true);
    expect(
      statementsCover(
        [
          { periodFrom: '2026-11-01', periodTo: '2026-11-15' },
          { periodFrom: '2026-11-16', periodTo: '2026-12-31' },
        ],
        '2026-11-01',
        '2026-11-30',
      ),
    ).toBe(true);
    expect(statementsCover([{ periodFrom: '2026-11-02', periodTo: '2026-11-30' }], '2026-11-01', '2026-11-30')).toBe(false);
    expect(statementsCover([{ periodFrom: '2026-11-01', periodTo: '2026-11-28' }], '2026-11-01', '2026-11-30')).toBe(false);
  });

  it('reads a period settled by a write-off (BR-F5-11) and lists the close conditions (AC-F5.7)', () => {
    expect(receivableState('2026-11-25', '2026-12-05', '20000000', '15000000', '5000000')).toBe('WRITTEN_OFF');
    expect(receivableState('2026-11-25', '2026-12-05', '20000000', '20000000', '0')).toBe('PAID');
    const checks = closeChecks({ latestHandover: 'PASSED', minutes: true, remainingVnd: '5000000', depositHeldVnd: '0', pending: 0 });
    expect(checks.map((row) => [row.key, row.ok, row.detail])).toEqual([
      ['HANDOVER', true, 'Đạt'],
      ['MINUTES', true, 'Đã lập'],
      ['RECEIVABLES', false, 'Còn 5.000.000 đ'],
      ['DEPOSIT', true, 'Đã xử lý'],
      ['PENDING', true, 'Không'],
    ]);
    expect(closeChecks({ latestHandover: 'FAILED', minutes: false, remainingVnd: '0', depositHeldVnd: '0', pending: 1 }).filter((row) => !row.ok)).toHaveLength(3);
  });
});
