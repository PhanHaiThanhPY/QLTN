import { contractorTotal, lineTotalVnd, QUANTITY_PATTERN, VND_PATTERN } from './proposal-quote';

describe('proposal quote maths (SPEC B03–B09 v2 §4.2)', () => {
  it('rounds a line half up to the đồng (AC-2.1: 1,5 × 333.333 = 499.999,5 → 500.000)', () => {
    expect(lineTotalVnd('1.5', '333333')).toBe(500000n);
    expect(lineTotalVnd('1.5', '333332')).toBe(499998n);
    expect(lineTotalVnd('0.001', '499')).toBe(0n);
    expect(lineTotalVnd('0.001', '500')).toBe(1n);
    expect(lineTotalVnd('3', '1000000')).toBe(3000000n);
  });

  it('sums lines, other costs and tax without floating point', () => {
    const total = contractorTotal(
      [
        { name: 'Ống cấp', unit: 'm', quantity: '1.5' },
        { name: 'Van', unit: 'cái', quantity: '2' },
      ],
      { name: 'NT 1', unitPricesVnd: ['333333', '1250000'], otherCostVnd: '100000', taxVnd: '285000' },
    );
    expect(total).toEqual({
      lineTotalsVnd: ['500000', '2500000'],
      subtotalVnd: '3000000',
      totalVnd: '3385000',
    });
  });

  it('keeps exact integers beyond the float range', () => {
    expect(
      contractorTotal([{ name: 'X', unit: 'gói', quantity: '999999999' }], {
        name: 'NT',
        unitPricesVnd: ['999999999999999'],
        otherCostVnd: '0',
        taxVnd: '0',
      }).totalVnd,
    ).toBe('999999998999999000000001');
  });

  it('accepts quantities with up to 3 decimals and integer VND only', () => {
    expect(QUANTITY_PATTERN.test('1.125')).toBe(true);
    expect(QUANTITY_PATTERN.test('1.1255')).toBe(false);
    expect(QUANTITY_PATTERN.test('-1')).toBe(false);
    expect(VND_PATTERN.test('0')).toBe(true);
    expect(VND_PATTERN.test('01')).toBe(false);
    expect(VND_PATTERN.test('1.5')).toBe(false);
  });
});
