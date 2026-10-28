import { formatRate, parseRate, rankOffers, termInterest } from './deposit';

describe('deposit domain (SPEC T-S1)', () => {
  it('parses rates to thousandths of a percent, at most 3 decimals, in (0, 30] (AC-T1.6)', () => {
    expect(parseRate('5,875')).toBe(5875);
    expect(parseRate('5.875')).toBe(5875);
    expect(parseRate('6')).toBe(6000);
    expect(parseRate('6,0')).toBe(6000);
    expect(parseRate('0,05')).toBe(50);
    expect(parseRate('30')).toBe(30000);
    for (const bad of ['5,8755', '0', '0,000', '30,001', '31', '-1', 'abc', '', '5,', ',5'])
      expect(parseRate(bad)).toBeNull();
  });

  it('formats a rate with the decimals it has, at least one', () => {
    expect([formatRate(6000), formatRate(5875), formatRate(5850), formatRate(50)]).toEqual([
      '6,0',
      '5,875',
      '5,85',
      '0,05',
    ]);
  });

  it('computes the interest of the term like D1 (AC-T1.7)', () => {
    const amount = 1_000_000_000n;
    expect(termInterest(amount, 5800, 90, 360)).toBe(14_500_000n);
    expect(termInterest(amount, 6000, 90, 360)).toBe(15_000_000n);
    expect(termInterest(amount, 5900, 90, 360)).toBe(14_750_000n);
  });

  it('uses the offer basis and rounds half up to the đồng (AC-T1.8)', () => {
    // 1e9 × 6% × 90 ÷ 365 = 14.794.520,547… → 14.794.521
    expect(termInterest(1_000_000_000n, 6000, 90, 365)).toBe(14_794_521n);
    // 1 × 18% × 1 ÷ 360 = 0,0005 → 0; 10.000 × 18% × 1 ÷ 360 = 5 exactly; 1.000 × 18% × 1 ÷ 360 = 0,5 → 1
    expect(termInterest(1n, 18000, 1, 360)).toBe(0n);
    expect(termInterest(10_000n, 18000, 1, 360)).toBe(5n);
    expect(termInterest(1_000n, 18000, 1, 360)).toBe(1n);
  });

  it('never overflows on large amounts', () => {
    expect(termInterest(9_000_000_000_000_000n, 30000, 3650, 360)).toBe(27_375_000_000_000_000n);
  });

  it('ranks by interest, then rate, then the earlier offer', () => {
    const at = (iso: string) => new Date(iso);
    const ranked = rankOffers([
      { id: 'A', interestVnd: 14_500_000n, rateMilli: 5800, receivedAt: at('2026-08-26T09:00:00Z') },
      { id: 'B', interestVnd: 15_000_000n, rateMilli: 6000, receivedAt: at('2026-08-26T10:00:00Z') },
      { id: 'C', interestVnd: 14_750_000n, rateMilli: 5900, receivedAt: at('2026-08-26T08:00:00Z') },
      { id: 'D', interestVnd: 14_750_000n, rateMilli: 5900, receivedAt: at('2026-08-26T07:00:00Z') },
    ]);
    expect(ranked.map((row) => row.id)).toEqual(['B', 'D', 'C', 'A']);
  });
});
