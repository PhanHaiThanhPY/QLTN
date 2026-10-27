import type { Fund } from './entities/fund.entity';
import { fundView } from './fund-views';

const fund = { id: 'f1', buildingId: 'b1', kind: 'KHAI_THAC', accountNo: '0071000000001', version: 1 } as Fund;

describe('fundView (SPEC F-S3 BR-F3-02)', () => {
  it('gives Kế toán and BQT the full account number, anyone else only the last four digits', () => {
    expect(fundView(fund, false, true)).toMatchObject({ accountNo: '0071000000001', accountMasked: '****0001' });
    expect(fundView(fund, false, false)).toMatchObject({ accountNo: null, accountMasked: '****0001' });
  });
});
