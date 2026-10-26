import { describe, expect, it } from 'vitest';
import { contractorTotal, formatVndString, lineTotalVnd, vndDigits } from './quote-proposal';

describe('quote proposal maths (same rules as api-qltn)', () => {
  it('rounds each line half up to the đồng', () => {
    expect(lineTotalVnd('1.5', '333333')).toBe(500000n);
    expect(lineTotalVnd('0.125', '99999')).toBe(12500n);
    expect(lineTotalVnd('abc', '1000')).toBe(0n);
  });

  it('adds other costs and tax to the line subtotal', () => {
    expect(
      contractorTotal(
        [
          { name: 'Ống', unit: 'm', quantity: '1.5' },
          { name: 'Van', unit: 'cái', quantity: '2' },
          { name: 'Keo', unit: 'tuýp', quantity: '0.125' },
        ],
        {
          name: 'NT 1',
          unitPricesVnd: ['333333', '1250000', '80000'],
          otherCostVnd: '100000',
          taxVnd: '300000',
          quotationAttachmentIds: [],
        },
      ),
    ).toEqual({ lineTotalsVnd: ['500000', '2500000', '10000'], subtotalVnd: '3010000', totalVnd: '3410000' });
  });

  it('parses and formats VND strings without floating point', () => {
    expect(vndDigits('12.500.000 ₫')).toBe('12500000');
    expect(vndDigits('007')).toBe('7');
    expect(formatVndString('3410000')).toMatch(/^3\.410\.000/);
    expect(formatVndString(null)).toBe('—');
  });
});
