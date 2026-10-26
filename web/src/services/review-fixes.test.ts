import Dexie from 'dexie';
import { APPROVAL_STEP_SLOT, approvalStepOf } from '@/domain/actions';
import type { AppError } from '@/domain/errors';
import { slotUserId } from '@/domain/permissions';
import { USER_ID } from '@/mock/seed-reference';
import { makeSamplePdf, makeSamplePng } from '@/mock/placeholder-files';
import { signatureDataUrl } from '@/mock/signature-art';
import { DB_NAME, deleteStaleDatabases, getDb } from '@/storage/db';
import { asUser, occurrenceByCode, recordByCode, run, seedAt } from '@/test/helpers';
import { executeCommand } from './command-engine';
import { uploadAttachment } from './file-service';
import { getSettings, saveSettings } from './settings-service';

const expectCode = async (promise: Promise<unknown>, code: string): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected ${code}`);
};

const openTasks = (subjectType: 'REPAIR_RECORD' | 'MAINTENANCE_OCCURRENCE', id: string) =>
  getDb().tasks.where('[subjectType+subjectId]').equals([subjectType, id]).filter((task) => task.status === 'OPEN').toArray();

const upload = (subjectType: 'REPAIR_RECORD' | 'MAINTENANCE_OCCURRENCE' | 'MAINTENANCE_ITEM', subjectId: string, purpose: Parameters<typeof uploadAttachment>[0]['purpose'], file: Blob, fileName: string) =>
  uploadAttachment({ subjectType, subjectId, purpose, file, fileName }).then((row) => row.id);

/** Approves every configured step with whoever holds it, whatever the building's chain is. */
const approveAllSteps = async (recordId: string): Promise<void> => {
  for (let guard = 0; guard < 5; guard += 1) {
    const record = await getDb().records.get(recordId);
    const step = record ? approvalStepOf(record.status, record.approvalStepKeys) : undefined;
    if (!record || !step) return;
    const slot = APPROVAL_STEP_SLOT[step.key];
    asUser(slot ? slotUserId(record, slot) ?? '' : record.approvalAssigneeUserIds?.[step.key] ?? '');
    await run('approveProposal', 'REPAIR_RECORD', recordId);
  }
};

const newEmergencyRecord = async (): Promise<string> => {
  asUser(USER_ID.BQL_A);
  const created = await run('createRecord', 'REPAIR_RECORD', undefined, {
    buildingId: 'bld-a',
    locationId: 'loc-a-5',
    title: 'Vỡ ống nước hành lang',
    description: 'Ống cấp nước hành lang tầng 5 bị vỡ, nước tràn ra sàn.',
    priority: 'URGENT',
    noMaintenanceItem: true,
  });
  const id = created.subjectId as string;
  const photo = await upload('REPAIR_RECORD', id, 'SITE_PHOTO', makeSamplePng('#000', '#fff'), 'p.png');
  await run('saveRecordDraft', 'REPAIR_RECORD', id, { attachmentIds: [photo] });
  await run('startEmergencyRepair', 'REPAIR_RECORD', id, {
    reason: 'Nước tràn, nguy cơ chập điện.',
    contractorName: 'Cấp thoát nước Hòa Bình',
    estimatedAmountVnd: 6_000_000,
    plannedEndDate: '2026-10-14',
  });
  return id;
};

describe('review fixes (14/10)', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should return an approved emergency repair to IN_CONSTRUCTION and continue to acceptance', async () => {
    const id = await newEmergencyRecord();
    const file = await upload('REPAIR_RECORD', id, 'PROPOSAL', makeSamplePdf('TT'), 'tt.pdf');
    await run('submitProposal', 'REPAIR_RECORD', id, {
      proposal: 'Thay đoạn ống D60 và van khóa tầng 5.',
      contractorName: 'Cấp thoát nước Hòa Bình',
      amountVnd: 6_000_000,
      attachmentIds: [file],
      signature: signatureDataUrl('BQL-A'),
    });
    await approveAllSteps(id);

    const approved = await getDb().records.get(id);
    expect(approved?.status).toBe('IN_CONSTRUCTION');
    expect(approved?.approvedSubmissionId).toBe(approved?.currentSubmissionId);
    expect(await getDb().constructions.where('recordId').equals(id).count()).toBe(1);
    expect((await openTasks('REPAIR_RECORD', id)).map((task) => [task.kind, task.assigneeId])).toEqual([['UPDATE_CONSTRUCTION', USER_ID.BQL_A]]);

    asUser(USER_ID.BQL_A);
    await run('updateConstruction', 'REPAIR_RECORD', id, { progressPercent: 100, note: 'Đã thay ống và thử áp.', attachmentIds: [] });
    const result = await upload('REPAIR_RECORD', id, 'ACCEPTANCE', makeSamplePng('#222', '#ddd'), 'kq.png');
    await run('submitAcceptance', 'REPAIR_RECORD', id, { completedDate: '2026-10-12', note: 'Hoàn thành thay ống.', attachmentIds: [result] });
    expect((await getDb().records.get(id))?.status).toBe('PENDING_ACCEPTANCE');
  });

  it('should reject a second construction with a business conflict instead of a database error', async () => {
    const id = await newEmergencyRecord();
    await getDb().records.update(id, { status: 'READY_FOR_CONSTRUCTION' });
    await expectCode(run('startConstruction', 'REPAIR_RECORD', id, { startDate: '2026-10-12', plannedEndDate: '2026-10-15' }), 'CONFLICT');
    expect(await getDb().constructions.where('recordId').equals(id).count()).toBe(1);
  });

  it('should copy another building configuration into the target building only', async () => {
    asUser(USER_ID.ADMIN);
    const [beforeA, beforeB] = await getDb().buildingConfigs.bulkGet(['bld-a', 'bld-b']);
    const total = await getDb().buildingConfigs.count();
    await run('applyConfigTemplate', 'BUILDING', 'bld-a', { sourceBuildingId: 'bld-b' });
    const [afterA, afterB] = await getDb().buildingConfigs.bulkGet(['bld-a', 'bld-b']);
    expect(afterA?.buildingId).toBe('bld-a');
    expect(afterA?.emergencyLimitVnd).toBe(beforeB?.emergencyLimitVnd);
    expect(afterA?.templateKey).toBe(beforeB?.templateKey);
    expect(afterA?.version).toBe((beforeA?.version ?? 0) + 1);
    expect(afterA?.updatedBy).toBe(USER_ID.ADMIN);
    expect(afterB).toEqual(beforeB);
    expect(await getDb().buildingConfigs.count()).toBe(total);
  });

  it('should require expectedVersion when saving a building configuration', async () => {
    asUser(USER_ID.ADMIN);
    const command = { commandId: 'cmd-no-version', subjectType: 'BUILDING' as const, subjectId: 'bld-a', action: 'applyConfigTemplate', payload: { templateKey: 'OFFICE' } };
    await expectCode(executeCommand(command), 'CONFLICT');
    await expectCode(executeCommand({ ...command, commandId: 'cmd-stale', expectedVersion: 99 }), 'CONFLICT');
  });

  it('should keep the due time of open occurrence tasks when an assignee is deactivated', async () => {
    const scheduled = await getDb()
      .occurrences.where('status')
      .equals('SCHEDULED')
      .filter((row) => row.confirmationUserId === USER_ID.KT_A && row.managerUserId === USER_ID.BQL_A && !row.reviewFlag)
      .first();
    if (!scheduled) throw new Error('Seed has no scheduled occurrence for KT-A');
    const [before] = await openTasks('MAINTENANCE_OCCURRENCE', scheduled.id);
    expect(before?.dueAt).toBeDefined();

    asUser(USER_ID.ADMIN);
    await run('updateUser', 'ACCOUNT', USER_ID.KT_A, { fullName: 'Trần Minh Khoa', roleDefId: 'role-tech_confirmer', buildingIds: ['bld-a'], active: false });
    const after = await openTasks('MAINTENANCE_OCCURRENCE', scheduled.id);
    expect(after.map((task) => [task.id, task.kind, task.assigneeId, task.dueAt])).toEqual([[before.id, before.kind, USER_ID.BQL_A, before.dueAt]]);
  });

  it('should ask for reassignment when an assignee loses the building, and lock account edits by version', async () => {
    asUser(USER_ID.ADMIN);
    const sc5 = await recordByCode('SC-005');
    const tvkt = await getDb().users.get(USER_ID.TVKT);
    const fields = { fullName: 'Võ Thanh Tâm', roleDefId: 'role-tech_consultant', buildingIds: ['bld-b', 'bld-c', 'bld-d'] };
    await expectCode(executeCommand({ commandId: 'cmd-user-novers', subjectType: 'ACCOUNT', subjectId: USER_ID.TVKT, action: 'updateUser', payload: fields }), 'CONFLICT');
    await run('updateUser', 'ACCOUNT', USER_ID.TVKT, fields);
    const updated = await getDb().users.get(USER_ID.TVKT);
    expect(updated?.version).toBe((tvkt?.version ?? 0) + 1);
    expect((await openTasks('REPAIR_RECORD', sc5.id)).map((task) => [task.kind, task.assigneeId])).toEqual([['REASSIGN_REQUIRED', USER_ID.BQL_A]]);
    await expectCode(
      executeCommand({ commandId: 'cmd-user-stale', subjectType: 'ACCOUNT', subjectId: USER_ID.TVKT, expectedVersion: tvkt?.version, action: 'updateUser', payload: fields }),
      'CONFLICT',
    );
  });

  it('should preserve buildings outside the administrator scope when editing an account', async () => {
    asUser(USER_ID.ADMIN);
    const admin = await run('createUser', 'ACCOUNT', undefined, { code: 'ADMIN-A', fullName: 'Quản trị tòa A', departmentId: 'dep-admin', roleDefId: 'role-admin', buildingIds: ['bld-a'] });
    asUser(admin.subjectId as string);
    await run('updateUser', 'ACCOUNT', USER_ID.TVKT, { fullName: 'Võ Thanh Tâm (A)', roleDefId: 'role-tech_consultant', buildingIds: ['bld-a'] });
    expect((await getDb().users.get(USER_ID.TVKT))?.buildingIds.sort()).toEqual(['bld-a', 'bld-b', 'bld-c', 'bld-d']);
    // Sending the out-of-scope buildings back (as a form showing them would) is accepted, not a scope error.
    await run('updateUser', 'ACCOUNT', USER_ID.TVKT, { fullName: 'Võ Thanh Tâm', roleDefId: 'role-tech_consultant', buildingIds: ['bld-a', 'bld-b', 'bld-c', 'bld-d'] });
    const invalid = await expectCode(
      run('updateUser', 'ACCOUNT', USER_ID.BQL_B, { fullName: 'Đặng Ngọc Lan', roleDefId: 'role-bql', buildingIds: ['bld-b', 'bld-a', 'bld-x'] }),
      'VALIDATION_ERROR',
    );
    expect(invalid.fieldErrors?.buildingIds).toBeDefined();
  });

  it('should require RECORD_EDIT to create a repair record from maintenance', async () => {
    const bt7 = await occurrenceByCode('BT-007');
    asUser(USER_ID.BQL_A);
    const image = await upload('MAINTENANCE_OCCURRENCE', bt7.id, 'MAINTENANCE_RESULT', makeSamplePng('#111', '#eee'), 'b.png');
    asUser(USER_ID.ADMIN);
    const role = await run('createRoleDef', 'ACCOUNT', undefined, {
      sourceRoleId: 'role-bql',
      name: 'BQL chỉ bảo trì',
      capabilities: ['VIEW', 'MAINTENANCE_MANAGE', 'ITEM_CONDITION', 'REASSIGN'],
    });
    await run('updateUser', 'ACCOUNT', USER_ID.BQL_A, { fullName: 'Nguyễn Thu Hà', roleDefId: role.subjectId, buildingIds: ['bld-a'] });
    asUser(USER_ID.BQL_A);
    const denied = await expectCode(
      run('createRepairFromMaintenance', 'MAINTENANCE_OCCURRENCE', bt7.id, {
        title: 'Thay ắc quy máy phát',
        description: 'Ắc quy khởi động máy phát yếu, không đề nổ được lần đầu.',
        priority: 'HIGH',
        confirmationUserId: USER_ID.KT_A,
        attachmentIds: [image],
      }),
      'FORBIDDEN',
    );
    expect(denied.message).toContain('tạo hồ sơ sửa chữa');
  });

  it('should apply the location scope to maintenance items, plans and uploads', async () => {
    asUser(USER_ID.ADMIN);
    const scoped = await run('createUser', 'ACCOUNT', undefined, {
      code: 'BQL-A5',
      fullName: 'BQL tầng 5',
      departmentId: 'dep-management',
      roleDefId: 'role-bql',
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-5'],
    });
    const item = await getDb().maintenanceItems.where('buildingId').equals('bld-a').filter((row) => row.active && row.locationId !== 'loc-a-5').first();
    if (!item) throw new Error('Seed has no item outside loc-a-5');
    asUser(scoped.subjectId as string);
    const outside = await expectCode(run('updateItemCondition', 'MAINTENANCE_ITEM', item.id, { condition: 'GOOD', note: 'Kiểm tra lại thấy ổn định.' }), 'FORBIDDEN');
    expect(outside.message).toContain('khu vực');
    await expectCode(run('deactivateMaintenanceItem', 'MAINTENANCE_ITEM', item.id, { reason: 'Không còn sử dụng.' }), 'FORBIDDEN');
    await expectCode(
      run('createMaintenancePlan', 'MAINTENANCE_PLAN', undefined, {
        itemId: item.id,
        title: 'Kế hoạch ngoài khu vực',
        frequency: 'MONTHLY',
        anchorDate: '2026-10-20',
        checklistTemplate: [{ label: 'Kiểm tra tổng quát', required: true }],
        confirmationUserId: USER_ID.KT_A,
      }),
      'FORBIDDEN',
    );
    await expectCode(upload('MAINTENANCE_ITEM', item.id, 'ITEM_DOCUMENT', makeSamplePdf('Doc'), 'doc.pdf'), 'FORBIDDEN');
  });

  it('should reject files whose content does not match the declared type', async () => {
    const sc2 = await recordByCode('SC-002');
    asUser(USER_ID.BQL_A);
    const renamed = new Blob([await makeSamplePng('#000', '#fff').arrayBuffer()], { type: 'application/pdf' });
    const invalid = await expectCode(upload('REPAIR_RECORD', sc2.id, 'PROPOSAL', renamed, 'fake.pdf'), 'VALIDATION_ERROR');
    expect(invalid.fieldErrors?.file).toBeDefined();
    const text = new Blob(['not an image at all'], { type: 'image/jpeg' });
    await expectCode(upload('REPAIR_RECORD', sc2.id, 'SITE_PHOTO', text, 'fake.jpg'), 'VALIDATION_ERROR');
  });

  it('should validate the demo latency setting', async () => {
    await expectCode(saveSettings({ latencyMs: Number.NaN, failNextCommand: false }), 'VALIDATION_ERROR');
    await saveSettings({ latencyMs: 99_999, failNextCommand: false });
    expect((await getSettings()).latencyMs).toBe(5000);
    await saveSettings({ latencyMs: 12.6, failNextCommand: false });
    expect((await getSettings()).latencyMs).toBe(13);
  });

  it('should delete stale demo databases but keep the current and unrelated ones', async () => {
    const stale = new Dexie('qltn-demo-v7');
    stale.version(1).stores({ meta: 'key' });
    await stale.open();
    stale.close();
    const deleted = await deleteStaleDatabases();
    expect(deleted).toContain('qltn-demo-v7');
    expect(deleted).not.toContain(DB_NAME);
    const names = await Dexie.getDatabaseNames();
    expect(names).not.toContain('qltn-demo-v7');
    expect(names).toContain(getDb().name);
  });
});
