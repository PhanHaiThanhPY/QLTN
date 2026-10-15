import { USER_ID } from '@/mock/seed-reference';
import { makeSamplePdf } from '@/mock/placeholder-files';
import { getDb } from '@/storage/db';
import type { AppError } from '@/domain/errors';
import { asUser, recordByCode, run, seedAt } from '@/test/helpers';
import { uploadAttachment } from './file-service';
import { getItemDetail } from './maintenance-service';
import { getRecordDetail } from './records-service';
import { getDashboard } from './report-service';

const expectCode = async (promise: Promise<unknown>, code: string): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected ${code}`);
};

describe('rule-based alerts, equipment data and cost dashboard', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should raise warranty, recent repair, repeated failure and price alerts on SC-008', async () => {
    asUser(USER_ID.BQT);
    const detail = await getRecordDetail((await recordByCode('SC-008')).id);
    expect(detail.alerts.map((alert) => alert.kind)).toEqual(['WARRANTY', 'RECENT_REPAIR', 'REPEATED', 'PRICE']);
    const price = detail.alerts.find((alert) => alert.kind === 'PRICE');
    expect(price?.related.map((row) => row.code).sort()).toEqual(['SC-018', 'SC-019']);
  });

  it('should not raise alerts on a record without an item', async () => {
    asUser(USER_ID.BQL_A);
    const detail = await getRecordDetail((await recordByCode('SC-005')).id);
    expect(detail.alerts).toEqual([]);
  });

  it('should validate equipment dates and keep item documents', async () => {
    asUser(USER_ID.BQL_A);
    const item = await getDb().maintenanceItems.where('code').equals('TM-A01').first();
    const id = item?.id ?? '';
    const base = { name: item?.name, type: item?.type, locationId: item?.locationId, ownerUserId: item?.ownerUserId };
    const invalid = await expectCode(run('updateMaintenanceItem', 'MAINTENANCE_ITEM', id, { ...base, installDate: '2026-05-01', warrantyUntil: '2026-01-01' }), 'VALIDATION_ERROR');
    expect(invalid.fieldErrors?.warrantyUntil).toBeDefined();
    await run('updateMaintenanceItem', 'MAINTENANCE_ITEM', id, { ...base, model: 'Model mới', installDate: '2026-01-01', warrantyUntil: '2027-01-01' });
    const file = await uploadAttachment({ subjectType: 'MAINTENANCE_ITEM', subjectId: id, purpose: 'ITEM_DOCUMENT', file: makeSamplePdf('HDSD'), fileName: 'hdsd.pdf' });
    await run('setItemDocuments', 'MAINTENANCE_ITEM', id, { documentIds: [file.id] });
    const detail = await getItemDetail(id);
    expect(detail.item.model).toBe('Model mới');
    expect(detail.documents.map((row) => row.fileName)).toEqual(['hdsd.pdf']);
    asUser(USER_ID.KT_A);
    await expectCode(uploadAttachment({ subjectType: 'MAINTENANCE_ITEM', subjectId: id, purpose: 'ITEM_DOCUMENT', file: makeSamplePdf('x'), fileName: 'x.pdf' }), 'FORBIDDEN');
  });

  it('should show pending approvals and costs on the dashboard', async () => {
    asUser(USER_ID.ADMIN);
    const dashboard = await getDashboard();
    // SC-005, 007, 008 and SC-016 are waiting in the TVKT → BQT approval chain.
    expect(dashboard.pendingApprovalCount).toBe(4);
    expect(dashboard.approvedTotal).toBeGreaterThan(dashboard.paidTotal);
    expect(dashboard.paidTotal).toBeGreaterThan(0);
  });
});
