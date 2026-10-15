import { USER_ID } from '@/mock/seed-reference';
import { makeSamplePng } from '@/mock/placeholder-files';
import { getDb } from '@/storage/db';
import type { AppError } from '@/domain/errors';
import { RECORD_ITEM_REQUIRED_MESSAGE, recordItemLink } from '@/domain/record-item-link';
import { asUser, run, seedAt } from '@/test/helpers';
import { uploadAttachment } from './file-service';
import { listRecords } from './records-service';

const expectValidation = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    expect((error as AppError).code).toBe('VALIDATION_ERROR');
    return error as AppError;
  }
  throw new Error('Expected VALIDATION_ERROR');
};

const itemId = async (code: string): Promise<string> => {
  const item = await getDb().maintenanceItems.where('code').equals(code).first();
  if (!item) throw new Error(`No item ${code}`);
  return item.id;
};

/** Complete draft in building A (photo attached) whose equipment is left to each test. */
const newDraft = async (extra: Record<string, unknown> = {}): Promise<string> => {
  asUser(USER_ID.BQL_A);
  const created = await run('createRecord', 'REPAIR_RECORD', undefined, {
    buildingId: 'bld-a',
    locationId: 'loc-a-5',
    title: 'Nứt trần thạch cao hành lang',
    description: 'Trần thạch cao hành lang tầng 5 nứt dài khoảng 1,5m gần cửa thang.',
    priority: 'NORMAL',
    ...extra,
  });
  const id = created.subjectId as string;
  const photo = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: id, purpose: 'SITE_PHOTO', file: makeSamplePng('#000', '#fff'), fileName: 'p.png' });
  await run('saveRecordDraft', 'REPAIR_RECORD', id, { attachmentIds: [photo.id] });
  return id;
};

const recordOf = async (id: string) => {
  const record = await getDb().records.get(id);
  if (!record) throw new Error(`No record ${id}`);
  return record;
};

describe('equipment is mandatory when reporting an incident', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should save a draft without equipment but refuse to submit it', async () => {
    const id = await newDraft();
    expect(recordItemLink(await recordOf(id))).toBe('UNLINKED');
    const error = await expectValidation(run('submitRecord', 'REPAIR_RECORD', id));
    expect(error.fieldErrors?.maintenanceItemId).toBe(RECORD_ITEM_REQUIRED_MESSAGE);
    expect((await recordOf(id)).status).toBe('DRAFT');
    const emergency = await expectValidation(
      run('startEmergencyRepair', 'REPAIR_RECORD', id, { reason: 'Nguy cơ rơi trần.', contractorName: 'Đội sửa chữa', estimatedAmountVnd: 2_000_000, plannedEndDate: '2026-10-14' }),
    );
    expect(emergency.fieldErrors?.maintenanceItemId).toBe(RECORD_ITEM_REQUIRED_MESSAGE);
  });

  it('should submit a structural repair marked "Không thuộc thiết bị cụ thể"', async () => {
    const id = await newDraft({ noMaintenanceItem: true });
    expect(recordItemLink(await recordOf(id))).toBe('NONE');
    await run('submitRecord', 'REPAIR_RECORD', id);
    expect((await recordOf(id)).status).toBe('PENDING_CONFIRMATION');
  });

  it('should keep the item and the "none" flag mutually exclusive', async () => {
    const id = await newDraft({ noMaintenanceItem: true });
    const tm = await itemId('TM-A01');
    await run('saveRecordDraft', 'REPAIR_RECORD', id, { maintenanceItemId: tm, noMaintenanceItem: false });
    let record = await recordOf(id);
    expect(record.maintenanceItemId).toBe(tm);
    expect(record.noMaintenanceItem).toBeUndefined();
    await run('saveRecordDraft', 'REPAIR_RECORD', id, { maintenanceItemId: '', noMaintenanceItem: true });
    record = await recordOf(id);
    expect(record.maintenanceItemId).toBeUndefined();
    expect(record.noMaintenanceItem).toBe(true);
    const both = await expectValidation(run('saveRecordDraft', 'REPAIR_RECORD', id, { maintenanceItemId: tm, noMaintenanceItem: true }));
    expect(both.fieldErrors?.maintenanceItemId).toBeDefined();
  });

  it('should reject an item from another building and an inactive item at submit', async () => {
    const id = await newDraft();
    const other = await expectValidation(run('saveRecordDraft', 'REPAIR_RECORD', id, { maintenanceItemId: await itemId('CS-B01') }));
    expect(other.fieldErrors?.maintenanceItemId).toContain('cùng tòa nhà');

    const camera = await itemId('CAM-A01');
    await run('saveRecordDraft', 'REPAIR_RECORD', id, { maintenanceItemId: camera });
    await getDb().maintenanceItems.update(camera, { active: false });
    const inactive = await expectValidation(run('submitRecord', 'REPAIR_RECORD', id));
    expect(inactive.fieldErrors?.maintenanceItemId).toContain('ngừng sử dụng');
    await getDb().maintenanceItems.update(camera, { active: true });
    await run('submitRecord', 'REPAIR_RECORD', id);
    expect((await recordOf(id)).status).toBe('PENDING_CONFIRMATION');
  });

  it('should list only records not yet tied to equipment with the itemLink filter', async () => {
    asUser(USER_ID.ADMIN);
    const all = await listRecords({ itemLink: 'UNLINKED', pageSize: 100 });
    expect(all.items.map((row) => row.record.code).sort()).toEqual(['SC-001', 'SC-021']);
    expect((await listRecords({ pageSize: 100 })).total).toBe(21);
    asUser(USER_ID.BQL_A);
    const scoped = await listRecords({ itemLink: 'UNLINKED', pageSize: 100 });
    expect(scoped.items.map((row) => row.record.code)).toEqual(['SC-001']);
  });
});
