import { getEquipmentHistory, getEquipmentReport } from '@/services/equipment-report-service';
import { BUILDING_A, BUILDING_B, BUILDING_C, BUILDING_D, USER_ID } from '@/mock/seed-reference';
import { getDb } from '@/storage/db';
import { asUser, seedAt } from '@/test/helpers';

const itemId = async (code: string): Promise<string> => {
  const item = await getDb().maintenanceItems.filter((row) => row.code === code).first();
  if (!item) throw new Error(`Missing item ${code}`);
  return item.id;
};

describe('equipment report', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should count items per building and rank the repeated-failure item first', async () => {
    asUser(USER_ID.ADMIN);
    const report = await getEquipmentReport();

    expect(report.buildings.map((row) => row.itemCount)).toEqual([7, 3, 3, 3]);
    expect(report.itemCount).toBe(16);
    expect(report.unlinkedRecordCount).toBe(2);
    const top = report.items[0];
    expect(top.item.code).toBe('TM-A01');
    expect(top.repairCount).toBe(3);
    expect(top.isRepeated).toBe(true);
    expect(report.repeatedCount).toBe(1);
    expect(report.repairCount).toBe(report.items.reduce((sum, row) => sum + row.repairCount, 0));
  });

  it('should keep other buildings out of a single-building account', async () => {
    // BQL-B manages buildings B, C and D only.
    asUser(USER_ID.BQL_B);
    const report = await getEquipmentReport();
    expect(new Set(report.items.map((row) => row.item.buildingId))).toEqual(new Set([BUILDING_B, BUILDING_C, BUILDING_D]));
    expect(report.buildings.map((row) => row.buildingId)).not.toContain(BUILDING_A);
    await expect(getEquipmentHistory(await itemId('TM-A01'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should filter by building and type, and count repairs inside the period only', async () => {
    asUser(USER_ID.ADMIN);
    const lifts = await getEquipmentReport({ buildingId: BUILDING_A, type: 'Thang máy' });
    expect(lifts.items.map((row) => row.item.code)).toEqual(['TM-A01']);
    const future = await getEquipmentReport({ dateFrom: '2099-01-01' });
    expect(future.repairCount).toBe(0);
    expect(future.items.find((row) => row.item.code === 'TM-A01')?.repairCountTotal).toBe(3);
  });

  it('should describe what was repaired, by whom, when and for how much', async () => {
    asUser(USER_ID.ADMIN);
    const history = await getEquipmentHistory(await itemId('TM-A01'));

    expect(history.repairs.map((entry) => entry.record.code)).toEqual(['SC-008', 'SC-018', 'SC-019']);
    expect(new Set(history.repairs.map((entry) => entry.contractorName)).size).toBe(3);
    const reworked = history.repairs.find((entry) => entry.record.code === 'SC-018');
    expect(reworked?.acceptanceRounds.map((round) => round.result)).toEqual(['FAILED', 'PASSED']);
    expect(reworked?.approvedAmount).toBeGreaterThan(0);
    expect(reworked?.durationDays).toBeGreaterThan(0);
    expect(reworked?.proposal).toBeTruthy();
    expect(history.costTotal).toBe(history.repairs.reduce((sum, entry) => sum + (entry.approvedAmount ?? 0), 0));
  });
});
