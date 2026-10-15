import { USER_ID } from '@/mock/seed-reference';
import { getMaintenanceReport, getRepairReport } from '@/services/report-service';
import { asUser, seedAt } from '@/test/helpers';

describe('report overview data', () => {
  it('loads both report datasets for the overview screen', async () => {
    await seedAt();
    for (const userId of [USER_ID.ADMIN, USER_ID.BQL_A, USER_ID.BQL_B, USER_ID.TVKT, USER_ID.BQT]) {
      asUser(userId);
      const [repair, maintenance] = await Promise.all([getRepairReport({}), getMaintenanceReport({})]);
      expect(repair.createdCount).toBeGreaterThan(0);
      expect(maintenance.dueCount).toBeGreaterThan(0);
      expect(repair.attentionCount).toBeGreaterThanOrEqual(0);
      expect(maintenance.attentionCount).toBeGreaterThanOrEqual(0);
    }
  });
});
