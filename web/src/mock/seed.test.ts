import { getDb } from '@/storage/db';
import { getDashboard } from '@/services/report-service';
import { recordItemLink } from '@/domain/record-item-link';
import { BUILDING_A, BUILDING_B, BUILDING_C, BUILDING_D, USER_ID } from './seed-reference';
import { asUser, occurrenceByCode, recordByCode, seedAt } from '@/test/helpers';

const EXPECTED_RECORDS: Record<string, string> = {
  'SC-001': 'DRAFT',
  'SC-002': 'PENDING_CONFIRMATION',
  'SC-003': 'NEEDS_RECORD_UPDATE',
  'SC-004': 'PENDING_PROPOSAL',
  'SC-005': 'PENDING_TECH_REVIEW',
  'SC-006': 'NEEDS_SUBMISSION_UPDATE',
  'SC-007': 'PENDING_BOARD_APPROVAL',
  'SC-008': 'PENDING_BOARD_APPROVAL',
  'SC-009': 'READY_FOR_CONSTRUCTION',
  'SC-010': 'IN_CONSTRUCTION',
  'SC-011': 'NEEDS_REPAIR',
  'SC-012': 'PENDING_PAYMENT_APPROVAL',
  'SC-013': 'PENDING_PAYMENT',
  'SC-014': 'COMPLETED',
  'SC-015': 'CLOSED_NO_REPAIR',
  'SC-016': 'PENDING_BOARD_APPROVAL',
  'SC-017': 'COMPLETED',
  'SC-018': 'COMPLETED',
  'SC-019': 'COMPLETED',
  'SC-020': 'EMERGENCY_IN_PROGRESS',
  'SC-021': 'DRAFT',
};

const EXPECTED_OCCURRENCES: Record<string, string> = {
  'BT-001': 'COMPLETED',
  'BT-002': 'COMPLETED',
  'BT-003': 'SCHEDULED',
  'BT-004': 'SCHEDULED',
  'BT-005': 'COMPLETED',
  'BT-006': 'SCHEDULED',
  'BT-007': 'IN_PROGRESS',
  'BT-008': 'SCHEDULED',
  'BT-009': 'COMPLETED',
  'BT-010': 'PENDING_REVIEW',
  'BT-011': 'CANCELLED',
  'BT-012': 'SCHEDULED',
  'BT-013': 'REWORK',
};

const openTasks = (assigneeId: string, subjectType: string) =>
  getDb()
    .tasks.where('assigneeId')
    .equals(assigneeId)
    .filter((task) => task.status === 'OPEN' && task.subjectType === subjectType)
    .count();

describe.each(['2026-10-12', '2027-03-31', '2027-03-01', '2028-02-29', '2026-05-31'])('seed on %s', (seedDate) => {
  beforeAll(async () => {
    await seedAt(seedDate);
  }, 60_000);

  it('should create 21 repair records over 4 buildings in the expected states', async () => {
    const records = await getDb().records.toArray();
    expect(records).toHaveLength(21);
    expect(new Set(records.map((record) => record.buildingId)).size).toBe(4);
    for (const [code, status] of Object.entries(EXPECTED_RECORDS)) {
      expect((await recordByCode(code)).status, code).toBe(status);
    }
  });

  it('should give every building equipment and link most repairs to an item', async () => {
    const items = await getDb().maintenanceItems.toArray();
    const perBuilding = (buildingId: string) => items.filter((item) => item.buildingId === buildingId).length;
    expect([BUILDING_A, BUILDING_B, BUILDING_C, BUILDING_D].map(perBuilding)).toEqual([7, 3, 3, 3]);
    const records = await getDb().records.toArray();
    const byLink = (link: string) => records.filter((record) => recordItemLink(record) === link);
    expect(byLink('LINKED')).toHaveLength(12);
    expect(byLink('NONE')).toHaveLength(7);
    // Only drafts may stay without equipment (submit requires an item or "Không thuộc thiết bị cụ thể").
    expect(byLink('UNLINKED').map((record) => `${record.code}:${record.status}`).sort()).toEqual(['SC-001:DRAFT', 'SC-021:DRAFT']);
    for (const record of byLink('LINKED')) {
      expect(items.find((item) => item.id === record.maintenanceItemId)?.buildingId, record.code).toBe(record.buildingId);
    }
  });

  it('should keep a repeated-failure history on TM-A01 with a failed acceptance round', async () => {
    const tm = await getDb().maintenanceItems.where('code').equals('TM-A01').first();
    const repairs = await getDb().records.where('maintenanceItemId').equals(tm?.id ?? '').toArray();
    expect(repairs.map((record) => record.code).sort()).toEqual(['SC-008', 'SC-018', 'SC-019']);
    const contractors = await Promise.all(repairs.map(async (record) => (await getDb().submissions.where('recordId').equals(record.id).last())?.contractorName));
    expect(new Set(contractors).size).toBe(3);
    const sc18 = await recordByCode('SC-018');
    const rounds = await getDb().acceptances.where('recordId').equals(sc18.id).sortBy('roundNo');
    expect(rounds).toHaveLength(2);
  });

  it('should create 13 maintenance occurrences grouped by plan', async () => {
    expect(await getDb().occurrences.count()).toBe(13);
    for (const [code, status] of Object.entries(EXPECTED_OCCURRENCES)) {
      expect((await occurrenceByCode(code)).status, code).toBe(status);
    }
  });

  it('should keep attempt history for SC-007 and SC-008', async () => {
    const sc7 = await recordByCode('SC-007');
    const sc8 = await recordByCode('SC-008');
    expect(await getDb().submissions.where('recordId').equals(sc7.id).count()).toBe(2);
    expect(await getDb().submissions.where('recordId').equals(sc8.id).count()).toBe(3);
  });

  it('should link SC-004 with BT-005 both ways', async () => {
    const sc4 = await recordByCode('SC-004');
    const bt5 = await occurrenceByCode('BT-005');
    expect(sc4.sourceMaintenanceOccurrenceId).toBe(bt5.id);
    expect(bt5.repairRecordIds).toContain(sc4.id);
  });

  it('should open the expected maintenance tasks', async () => {
    expect(await openTasks(USER_ID.BQL_A, 'MAINTENANCE_OCCURRENCE')).toBe(5);
    expect(await openTasks(USER_ID.BQL_B, 'MAINTENANCE_OCCURRENCE')).toBe(2);
    expect(await openTasks(USER_ID.KT_A2, 'MAINTENANCE_OCCURRENCE')).toBe(1);
  });

  it('should match dashboard numbers from spec 10.4', async () => {
    asUser(USER_ID.ADMIN);
    const dashboard = await getDashboard();
    expect(dashboard.upcomingMaintenance.map((row) => row.code).sort()).toEqual(['BT-006', 'BT-012']);
    expect(dashboard.overdueMaintenance.map((row) => row.code).sort()).toEqual(['BT-003', 'BT-007', 'BT-013']);
    expect(dashboard.pendingReviewCount).toBe(1);
  });

  it('should not generate more occurrences when opened on the seed day', async () => {
    const plans = await getDb().maintenancePlans.toArray();
    expect(plans.every((plan) => plan.status === 'ACTIVE')).toBe(true);
    const window = new Set(plans.map((plan) => plan.generatedThrough));
    expect(window.size).toBe(1);
  });
});
