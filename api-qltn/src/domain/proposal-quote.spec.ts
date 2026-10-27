import {
  checkQuoteLimits,
  contractorTotal,
  lineTotalVnd,
  QUANTITY_PATTERN,
  VND_MAX,
  VND_PATTERN,
} from './proposal-quote';

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

describe('quotation bounds (FX-S3 BR-FX3-06, AC-FX3.9)', () => {
  const contractor = (unitPricesVnd: string[], otherCostVnd = '0', taxVnd = '0') => ({
    name: 'Nhà thầu',
    unitPricesVnd,
    otherCostVnd,
    taxVnd,
  });

  it('reports a line of 999 999 999 999 999 × 999 999 999 as over the limit instead of overflowing', () => {
    const check = checkQuoteLimits(
      [{ name: 'Ống', unit: 'm', quantity: '999999999' }],
      contractor(['999999999999999']),
    );
    expect(check.linesOverLimit).toEqual([0]);
    expect(check.totalVnd).toBe(999_999_999_999_999n * 999_999_999n);
  });

  it('reports a total over the limit when every line is within it', () => {
    const items = [
      { name: 'A', unit: 'gói', quantity: '1' },
      { name: 'B', unit: 'gói', quantity: '1' },
    ];
    const check = checkQuoteLimits(items, contractor(['999999999999999', '1']));
    expect(check.linesOverLimit).toEqual([]);
    expect(check.totalVnd).toBe(VND_MAX + 1n);
  });

  it('accepts the largest amount and a total of 0, and skips values that are not well formed', () => {
    const one = [{ name: 'A', unit: 'gói', quantity: '1' }];
    expect(checkQuoteLimits(one, contractor(['999999999999999']))).toEqual({ linesOverLimit: [], totalVnd: VND_MAX });
    expect(checkQuoteLimits(one, contractor(['0']))).toEqual({ linesOverLimit: [], totalVnd: 0n });
    expect(checkQuoteLimits(one, contractor(['12a']))).toEqual({ linesOverLimit: [], totalVnd: null });
  });
});
