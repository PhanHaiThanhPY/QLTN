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

  it('should execute a customer-defined approval step for a custom role', async () => {
    asUser(USER_ID.ADMIN);
    const role = await run('createRoleDef', 'ACCOUNT', undefined, {
      sourceRoleId: 'role-tech_consultant',
      name: 'Hội đồng kỹ thuật riêng',
    });
    const customRoleId = role.subjectId as string;
    const approver = await run('createUser', 'ACCOUNT', undefined, {
      code: 'TVKT-RIENG',
      fullName: 'Người duyệt workflow riêng',
      departmentId: 'dep-consulting',
      roleDefId: customRoleId,
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-5'],
    });

    const settings = await getBuildingSettings('bld-a');
    const customStep = {
      key: 'CUSTOM_TECH_PANEL',
      label: 'Hội đồng kỹ thuật riêng duyệt',
      actor: 'Hội đồng kỹ thuật riêng',
      role: 'TECH_CONSULTANT' as const,
      roleDefId: customRoleId,
      status: 'PENDING_CUSTOM_APPROVAL' as const,
    };
    await run('updateBuildingConfig', 'BUILDING', 'bld-a', {
      ...settings.config,
      workflowApprovalSteps: [...(settings.config.workflowApprovalSteps ?? []), customStep],
      approvalStepKeys: [customStep.key],
    });

    asUser(USER_ID.BQL_A);
    const recordId = await newRecord('bld-a', 'loc-a-5');
    await run('submitRecord', 'REPAIR_RECORD', recordId);
    asUser(USER_ID.KT_A);
    await run('confirmRepair', 'REPAIR_RECORD', recordId, { note: 'Đã xác nhận cần sửa.' });
    asUser(USER_ID.BQL_A);
    const file = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'PROPOSAL', file: makeSamplePdf('TT'), fileName: 'tt.pdf' });
    await run('submitProposal', 'REPAIR_RECORD', recordId, {
      proposal: 'Thay thế linh kiện theo phương án đã khảo sát.',
      contractorName: 'Nhà thầu thử nghiệm',
      amountVnd: 8_000_000,
      attachmentIds: [file.id],
      signature: signatureDataUrl('BQL-A'),
    });
    expect((await getDb().records.get(recordId))?.status).toBe('PENDING_CUSTOM_APPROVAL');
    expect((await getDb().records.get(recordId))?.approvalAssigneeUserIds?.[customStep.key]).toBe(approver.subjectId);

    await expectCode(run('approveProposal', 'REPAIR_RECORD', recordId, { submissionId: (await getDb().records.get(recordId))?.currentSubmissionId }), 'FORBIDDEN');
    asUser(approver.subjectId as string);
    await run('approveProposal', 'REPAIR_RECORD', recordId, { submissionId: (await getDb().records.get(recordId))?.currentSubmissionId });
    expect((await getDb().records.get(recordId))?.status).toBe('READY_FOR_CONSTRUCTION');
  });

  it('should execute custom acceptance and payment stages from the workflow designer', async () => {
    asUser(USER_ID.ADMIN);
    const acceptanceRole = await run('createRoleDef', 'ACCOUNT', undefined, {
      sourceRoleId: 'role-tech_confirmer',
      name: 'Tổ nghiệm thu riêng',
    });
    const paymentRole = await run('createRoleDef', 'ACCOUNT', undefined, {
      sourceRoleId: 'role-owners_board',
      name: 'Hội đồng thanh toán riêng',
    });
    const acceptanceUser = await run('createUser', 'ACCOUNT', undefined, {
      code: 'KT-NT-RIENG',
      fullName: 'Tổ nghiệm thu riêng',
      departmentId: 'dep-technical',
      roleDefId: acceptanceRole.subjectId,
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-5'],
    });
    const paymentUser = await run('createUser', 'ACCOUNT', undefined, {
      code: 'BQT-TT-RIENG',
      fullName: 'Hội đồng thanh toán riêng',
      departmentId: 'dep-board',
      roleDefId: paymentRole.subjectId,
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-5'],
    });
    const settings = await getBuildingSettings('bld-a');
    const acceptanceKey = 'CUSTOM_ACCEPTANCE_PANEL';
    const paymentKey = 'CUSTOM_PAYMENT_PANEL';
    const customSteps = [
      { key: acceptanceKey, label: 'Tổ nghiệm thu riêng', actor: 'Tổ nghiệm thu riêng', role: 'TECH_CONFIRMER' as const, roleDefId: acceptanceRole.subjectId as string, status: 'PENDING_CUSTOM_APPROVAL' as const },
      { key: paymentKey, label: 'Hội đồng thanh toán riêng', actor: 'Hội đồng thanh toán riêng', role: 'OWNERS_BOARD' as const, roleDefId: paymentRole.subjectId as string, status: 'PENDING_CUSTOM_APPROVAL' as const },
    ];
    const workflowStages = (settings.config.workflowStages ?? []).map((stage) => stage.key === 'ACCEPTANCE'
      ? { ...stage, approvalStepKeys: [acceptanceKey, 'TECH'], stepBindings: (stage.stepBindings ?? []).map((binding) => ({ ...binding, approvalStepKey: undefined })) }
      : stage.key === 'PAYMENT' ? { ...stage, approvalStepKeys: [paymentKey], stepBindings: (stage.stepBindings ?? []).map((binding) => ({ ...binding, approvalStepKey: undefined })) } : stage);
    await run('updateBuildingConfig', 'BUILDING', 'bld-a', {
      ...settings.config,
      workflowApprovalSteps: [...(settings.config.workflowApprovalSteps ?? []), ...customSteps],
      workflowStages,
    });

    asUser(USER_ID.BQL_A);
    const recordId = await newRecord('bld-a', 'loc-a-5');
    const snapshot = await getDb().records.get(recordId);
    expect(snapshot?.workflowStageApprovalStepKeys?.ACCEPTANCE).toEqual([acceptanceKey, 'TECH']);
    expect(snapshot?.workflowStageApprovalStepKeys?.PAYMENT).toEqual([paymentKey]);
    await run('submitRecord', 'REPAIR_RECORD', recordId);
    asUser(snapshot?.confirmationUserId as string);
    await run('confirmRepair', 'REPAIR_RECORD', recordId, { note: 'Đã xác nhận cần sửa.' });
    asUser(USER_ID.BQL_A);
    const proposalFile = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'PROPOSAL', file: makeSamplePdf('TT'), fileName: 'tt.pdf' });
    await run('submitProposal', 'REPAIR_RECORD', recordId, {
      proposal: 'Thay mới hạng mục theo phương án.',
      contractorName: 'Nhà thầu thử nghiệm',
      amountVnd: 8_000_000,
      attachmentIds: [proposalFile.id],
      signature: signatureDataUrl('BQL-A'),
    });
    asUser(USER_ID.TVKT);
    await run('approveProposal', 'REPAIR_RECORD', recordId);
    const proposalBoard = await getDb().records.get(recordId);
    asUser(proposalBoard?.approvalAssigneeUserIds?.BOARD as string);
    await run('approveProposal', 'REPAIR_RECORD', recordId);
    asUser(USER_ID.BQL_A);
    await run('startConstruction', 'REPAIR_RECORD', recordId, { startDate: '2026-10-12', plannedEndDate: '2026-10-15' });
    await run('updateConstruction', 'REPAIR_RECORD', recordId, { progressPercent: 100, note: 'Đã hoàn thành.', attachmentIds: [] });
    await run('submitAcceptance', 'REPAIR_RECORD', recordId, { completedDate: '2026-10-12', note: 'Gửi nghiệm thu.', attachmentIds: [await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'ACCEPTANCE', file: makeSamplePng('#000', '#fff'), fileName: 'nt.png' }).then((file) => file.id)] });
    const acceptanceTask = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', recordId]).filter((task) => task.status === 'OPEN').first();
    expect(acceptanceTask?.assigneeId).toBe(acceptanceUser.subjectId);
    asUser(acceptanceUser.subjectId as string);
    await run('passAcceptance', 'REPAIR_RECORD', recordId, { note: 'Đạt yêu cầu.', reportAttachmentIds: [await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'ACCEPTANCE', file: makeSamplePdf('NT'), fileName: 'nt.pdf' }).then((file) => file.id)] });
    expect((await getDb().records.get(recordId))?.status).toBe('PENDING_ACCEPTANCE');
    const nextAcceptanceTask = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', recordId]).filter((task) => task.status === 'OPEN').first();
    expect(nextAcceptanceTask?.assigneeId).toBe(USER_ID.TVKT);
    asUser(USER_ID.TVKT);
    await run('passAcceptance', 'REPAIR_RECORD', recordId, { note: 'TVKT thống nhất nghiệm thu.', reportAttachmentIds: [] });
    asUser(USER_ID.BQL_A);
    await run('submitPaymentRequest', 'REPAIR_RECORD', recordId, { amountVnd: 8_000_000, attachmentIds: [await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'PAYMENT_REQUEST', file: makeSamplePdf('TTT'), fileName: 'ttt.pdf' }).then((file) => file.id)] });
    expect((await getDb().records.get(recordId))?.status).toBe('PENDING_CUSTOM_PAYMENT_APPROVAL');
    const paymentTask = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', recordId]).filter((task) => task.status === 'OPEN').first();
    expect(paymentTask?.assigneeId).toBe(paymentUser.subjectId);
    asUser(USER_ID.BQT);
    await expectCode(run('approvePayment', 'REPAIR_RECORD', recordId), 'FORBIDDEN');
    asUser(paymentUser.subjectId as string);
    await run('approvePayment', 'REPAIR_RECORD', recordId);
    expect((await getDb().records.get(recordId))?.status).toBe('PENDING_PAYMENT');
    expect((await getDb().paymentRequests.where('recordId').equals(recordId).first())?.approvalDecisions?.map((decision) => decision.step)).toEqual([paymentKey]);
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
    const createdFromScratch = await run('createRoleDef', 'ACCOUNT', undefined, { baseRole: 'OWNERS_BOARD', name: 'Hội đồng đầu tư' });
    expect(createdFromScratch.data?.code).toBe('VT-02');
    await expectCode(run('createRoleDef', 'ACCOUNT', undefined, { sourceRoleId: 'role-tech_confirmer', name: 'KT thử', capabilities: ['VIEW', 'PAYMENT_DECIDE'] }), 'VALIDATION_ERROR');
    const role = await run('createRoleDef', 'ACCOUNT', undefined, { sourceRoleId: 'role-bql', name: 'BQL ca đêm', capabilities: ['VIEW', 'RECORD_EDIT', 'EMERGENCY_START'] });
    expect(role.data?.code).toBe('VT-03');
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
