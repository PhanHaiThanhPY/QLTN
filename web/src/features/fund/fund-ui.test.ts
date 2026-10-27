import { accountText, signedVnd, spokenVnd } from './fund-ui';

describe('fund-ui', () => {
  it('shows the full account number when the API gives it, else the last four digits (BR-F3-02)', () => {
    expect(accountText({ accountNo: '0071000000001', accountMasked: '****0001' })).toBe('0071000000001');
    expect(accountText({ accountNo: null, accountMasked: '****0001' })).toBe('****0001');
    expect(accountText({ accountNo: null, accountMasked: null })).toBe('—');
  });

  it('signs amounts and reads them in words', () => {
    expect(signedVnd('IN', '10000000')).toBe('+10.000.000 ₫');
    expect(signedVnd('OUT', '3000000')).toBe('−3.000.000 ₫');
    expect(spokenVnd('10000000', 'IN')).toBe('cộng mười triệu đồng');
  });
});
