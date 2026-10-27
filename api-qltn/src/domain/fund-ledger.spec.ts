import { availableFrom, balanceAt, maskAccount, monthBounds, monthFigures, type LedgerLine } from './fund-ledger';

const OPENING = { openingDate: '2026-11-01', openingBalanceVnd: '50000000' };
/** D1 November: PT-001, PT-002, GNT-001, PC-001. */
const D1: LedgerLine[] = [
  { entryDate: '2026-11-18', direction: 'IN', amountVnd: '10000000' },
  { entryDate: '2026-11-22', direction: 'IN', amountVnd: '5000000' },
  { entryDate: '2026-11-22', direction: 'OUT', amountVnd: '2000000' },
  { entryDate: '2026-11-23', direction: 'OUT', amountVnd: '3000000' },
];

describe('fund ledger (SPEC F-S3 BR-F3-05, BR-F3-13)', () => {
  it('gives the D1 month: 50 + 15 − 5 = 60 (AC-F3.2)', () => {
    expect(monthFigures(OPENING, D1, '2026-11')).toEqual({
      openingVnd: '50000000',
      inVnd: '15000000',
      outVnd: '5000000',
      closingVnd: '60000000',
    });
    expect(balanceAt(OPENING, D1, '2026-11-22')).toBe('63000000');
  });

  it('carries the closing into the next month and counts a reversal like any line (AC-F3.3)', () => {
    const reversed = [...D1, { entryDate: '2026-12-02', direction: 'OUT' as const, amountVnd: '5000000' }];
    expect(monthFigures(OPENING, reversed, '2026-12')).toEqual({
      openingVnd: '60000000',
      inVnd: '0',
      outVnd: '5000000',
      closingVnd: '55000000',
    });
  });

  it('finds the lowest balance from a day on, so a back-dated payout cannot dip any later day (AC-F3.14)', () => {
    const lines: LedgerLine[] = [
      { entryDate: '2026-11-05', direction: 'OUT', amountVnd: '48000000' },
      { entryDate: '2026-11-10', direction: 'IN', amountVnd: '1000000' },
    ];
    // 2 tr from 05/11 to 09/11, 3 tr after 10/11: the low point from 03/11 is 2 tr on 05/11.
    expect(availableFrom(OPENING, lines, '2026-11-03')).toEqual({ amountVnd: '2000000', date: '2026-11-05' });
    expect(availableFrom(OPENING, lines, '2026-11-12')).toEqual({ amountVnd: '3000000', date: '2026-11-12' });
    expect(availableFrom(OPENING, [], '2026-11-01')).toEqual({ amountVnd: '50000000', date: '2026-11-01' });
  });

  it('bounds months and masks account numbers', () => {
    expect(monthBounds('2027-02')).toEqual({ first: '2027-02-01', last: '2027-02-28' });
    expect(monthBounds('2028-02').last).toBe('2028-02-29');
    expect(maskAccount('0071 0000 0001')).toBe('****0001');
    expect(maskAccount(null)).toBeNull();
  });
});
