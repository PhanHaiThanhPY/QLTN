import { USER_ID } from '@/mock/seed-reference';
import { makeSamplePdf, makeSamplePng } from '@/mock/placeholder-files';
import { signatureDataUrl } from '@/mock/signature-art';
import { getDb } from '@/storage/db';
import type { AppError } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { asUser, recordByCode, run, seedAt } from '@/test/helpers';
import { uploadAttachment } from './file-service';
import { getBuildingSettings } from './building-service';

const expectCode = async (promise: Promise<unknown>, code: string): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected ${code}`);
};

const newRecord = async (buildingId: string, locationId: string): Promise<string> => {
  const created = await run('createRecord', 'REPAIR_RECORD', undefined, {
    buildingId,
    locationId,
    title: 'Chập điện tủ chiếu sáng',
    description: 'Tủ chiếu sáng hành lang chập, mất điện cả tầng.',
    priority: 'URGENT',
    noMaintenanceItem: true,
  });
  const id = created.subjectId as string;
  const photo = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: id, purpose: 'SITE_PHOTO', file: makeSamplePng('#000', '#fff'), fileName: 'p.png' });
  await run('saveRecordDraft', 'REPAIR_RECORD', id, { attachmentIds: [photo.id] });
  return id;
};

describe('building configuration, roles and emergency repairs', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should let BQL change its building config, keep open records on their snapshot and copy templates', async () => {
    asUser(USER_ID.BQL_A);
    const settings = await getBuildingSettings('bld-a');
    const values = { ...settings.config, taskDueDays: { ...settings.config.taskDueDays, CONFIRM_RECORD: 7 } };
    await run('updateBuildingConfig', 'BUILDING', 'bld-a', values);
    const after = await getBuildingSettings('bld-a');
    expect(after.config.taskDueDays.CONFIRM_RECORD).toBe(7);
    expect(after.audit[0].reason).toContain('3 ngày → 7 ngày');
    // SC-002 was created under the old configuration.
    expect((await recordByCode('SC-002')).dueDays?.CONFIRM_RECORD).toBe(3);
    const invalid = await expectCode(run('updateBuildingConfig', 'BUILDING', 'bld-a', { ...values, priceRatio: 9 }), 'VALIDATION_ERROR');
    expect(invalid.fieldErrors?.priceRatio).toBeDefined();
    await run('applyConfigTemplate', 'BUILDING', 'bld-a', { templateKey: 'OFFICE' });
    expect((await getBuildingSettings('bld-a')).config.emergencyLimitVnd).toBe(50_000_000);
    await expectCode(run('applyConfigTemplate', 'BUILDING', 'bld-a', { sourceBuildingId: 'bld-b' }), 'VALIDATION_ERROR');
    await expectCode(run('updateBuildingConfig', 'BUILDING', 'bld-b', values), 'NOT_FOUND');
  });

  it('should snapshot the configured approval order on new repair records', async () => {
    asUser(USER_ID.BQL_A);
    const settings = await getBuildingSettings('bld-a');
    const approvalStepKeys = ['BOARD', 'TECH'] as const;
    await run('updateBuildingConfig', 'BUILDING', 'bld-a', { ...settings.config, approvalStepKeys });

    const newId = await newRecord('bld-a', 'loc-a-5');
    expect((await getDb().records.get(newId))?.approvalStepKeys).toEqual(approvalStepKeys);
    expect((await recordByCode('SC-002')).approvalStepKeys).toEqual(['TECH', 'BOARD']);

    const invalid = await expectCode(
      run('updateBuildingConfig', 'BUILDING', 'bld-a', { ...settings.config, approvalStepKeys: ['TECH', 'TECH'] }),
      'VALIDATION_ERROR',
    );
    expect(invalid.fieldErrors?.approvalStepKeys).toBeDefined();
  });

  it('should resolve workflow assignees from configured department rules and keep legacy fallback', async () => {
    asUser(USER_ID.ADMIN);
    const department = await run('createDepartment', 'ACCOUNT', undefined, {
      code: 'KTMAI',
      name: 'Kỹ thuật mái',
      buildingIds: ['bld-a'],
    });
    const employee = await run('createUser', 'ACCOUNT', undefined, {
      code: 'KT-MAI',
      fullName: 'Kỹ thuật mái',
      departmentId: department.subjectId,
      roleDefId: 'role-tech_confirmer',
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-roof'],
    });
    const settings = await getBuildingSettings('bld-a');
    const assignmentRules = (settings.config.assignmentRules ?? []).map((rule) =>
      rule.role === 'TECH_CONFIRMER' ? { ...rule, departmentId: department.subjectId, locationIds: ['loc-a-roof'] } : rule,
    );
    await run('updateBuildingConfig', 'BUILDING', 'bld-a', { ...settings.config, assignmentRules });

    asUser(USER_ID.BQL_A);
    const created = await run('createRecord', 'REPAIR_RECORD', undefined, {
      buildingId: 'bld-a',
      locationId: 'loc-a-roof',
      title: 'Kiểm tra khu vực mái',
      description: 'Kiểm tra thiết bị kỹ thuật trên mái.',
      priority: 'NORMAL',
    });
    expect((await getDb().records.get(created.subjectId as string))?.confirmationUserId).toBe(employee.subjectId);
  });

  it('should manage locations and hide inactive ones from new records', async () => {
    asUser(USER_ID.BQL_A);
    const created = await run('createLocation', 'BUILDING', 'bld-a', { floor: '7', zone: 'Khu A', name: 'Hành lang tầng 7' });
    const locationId = String(created.data?.locationId);
    await expectCode(run('createLocation', 'BUILDING', 'bld-a', { floor: '7', name: 'hành lang tầng 7' }), 'VALIDATION_ERROR');
    await run('setLocationActive', 'BUILDING', 'bld-a', { locationId, active: false });
    expect((await getDb().locations.get(locationId))?.active).toBe(false);
    asUser(USER_ID.TVKT);
    await expectCode(run('createLocation', 'BUILDING', 'bld-a', { floor: '8', name: 'Tầng 8' }), 'FORBIDDEN');
  });

  it('should copy a role without adding permissions and apply it to accounts', async () => {
    asUser(USER_ID.ADMIN);
    await expectCode(run('createRoleDef', 'ACCOUNT', undefined, { sourceRoleId: 'role-tech_confirmer', name: 'KT thử', capabilities: ['VIEW', 'PAYMENT_DECIDE'] }), 'VALIDATION_ERROR');
    const role = await run('createRoleDef', 'ACCOUNT', undefined, { sourceRoleId: 'role-bql', name: 'BQL ca đêm', capabilities: ['VIEW', 'RECORD_EDIT', 'EMERGENCY_START'] });
    expect(role.data?.code).toBe('VT-02');
    const user = await run('createUser', 'ACCOUNT', undefined, { code: 'BQL-A3', fullName: 'Trần Văn Đêm', departmentId: 'dep-management', roleDefId: role.subjectId, buildingIds: ['bld-a'] });
    const stored = await getDb().users.get(user.subjectId as string);
    expect(stored?.role).toBe('BQL');
    expect(hasCapability(stored as NonNullable<typeof stored>, 'EMERGENCY_START')).toBe(true);
    expect(hasCapability(stored as NonNullable<typeof stored>, 'MAINTENANCE_MANAGE')).toBe(false);
    await expectCode(run('updateUser', 'ACCOUNT', user.subjectId, { fullName: 'Trần Văn Đêm', roleDefId: 'role-investor', buildingIds: ['bld-a'] }), 'VALIDATION_ERROR');
    asUser(USER_ID.BQL_A);
    await expectCode(run('createUser', 'ACCOUNT', undefined, { code: 'X1', fullName: 'Không được', roleDefId: 'role-bql', buildingIds: ['bld-a'] }), 'FORBIDDEN');
  });

  it('should ask for reassignment when an assigned account is deactivated', async () => {
    asUser(USER_ID.ADMIN);
    const sc5 = await recordByCode('SC-005');
    await run('updateUser', 'ACCOUNT', USER_ID.TVKT, { fullName: 'Võ Thanh Tâm', roleDefId: 'role-tech_consultant', buildingIds: ['bld-a', 'bld-b', 'bld-c', 'bld-d'], active: false });
    const tasks = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', sc5.id]).filter((t) => t.status === 'OPEN').toArray();
    expect(tasks.map((task) => [task.kind, task.assigneeId])).toEqual([['REASSIGN_REQUIRED', USER_ID.BQL_A]]);
  });

  it('should run an emergency repair within the limit and require a reason for late documents', async () => {
    asUser(USER_ID.BQL_A);
    const id = await newRecord('bld-a', 'loc-a-5');
    const base = { reason: 'Mất điện cả tầng, nguy cơ cháy.', contractorName: 'Điện lực Sao Việt', plannedEndDate: '2026-10-13' };
    const over = await expectCode(run('startEmergencyRepair', 'REPAIR_RECORD', id, { ...base, estimatedAmountVnd: 25_000_000 }), 'VALIDATION_ERROR');
    expect(over.fieldErrors?.estimatedAmountVnd).toContain('hạn mức');
    await run('startEmergencyRepair', 'REPAIR_RECORD', id, { ...base, estimatedAmountVnd: 8_000_000 });
    const record = await getDb().records.get(id);
    expect(record?.status).toBe('EMERGENCY_IN_PROGRESS');
    const task = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', id]).filter((t) => t.status === 'OPEN').first();
    expect(task?.kind).toBe('SUBMIT_EMERGENCY_DOCS');
    expect(task?.dueAt).toBe(record?.emergency?.docsDueAt);
    expect(await getDb().notifications.where('recipientId').equals(USER_ID.BQT).filter((n) => n.subjectId === id).count()).toBe(1);
    await run('updateConstruction', 'REPAIR_RECORD', id, { progressPercent: 100, note: 'Đã thay aptomat và dây.', attachmentIds: [] });

    const sc20 = await recordByCode('SC-020');
    asUser(USER_ID.BQL_B);
    const file = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: sc20.id, purpose: 'PROPOSAL', file: makeSamplePdf('TT'), fileName: 'tt.pdf' });
    const proposal = { proposal: 'Thay đoạn ống D90 và van khóa.', contractorName: 'Công ty CP Xây dựng Bình An', amountVnd: 12_500_000, attachmentIds: [file.id], signature: signatureDataUrl('BQL-B') };
    const late = await expectCode(run('submitProposal', 'REPAIR_RECORD', sc20.id, proposal), 'VALIDATION_ERROR');
    expect(late.fieldErrors?.lateReason).toBeDefined();
    await run('submitProposal', 'REPAIR_RECORD', sc20.id, { ...proposal, lateReason: 'Chờ nhà thầu gửi hóa đơn vật tư.' });
    const submitted = await recordByCode('SC-020');
    expect(submitted.status).toBe('PENDING_TECH_REVIEW');
    expect(submitted.emergency?.lateReason).toBe('Chờ nhà thầu gửi hóa đơn vật tư.');
  });
});
