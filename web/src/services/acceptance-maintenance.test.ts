import { USER_ID } from '@/mock/seed-reference';
import { makeSamplePdf, makeSamplePng } from '@/mock/placeholder-files';
import { signatureDataUrl } from '@/mock/signature-art';
import { getDb } from '@/storage/db';
import { asUser, occurrenceByCode, run, seedAt } from '@/test/helpers';
import type { AppError } from '@/domain/errors';
import { vnDateTimeToIso } from '@/utils/date';
import { executeSystemCommand } from './command-engine';
import { uploadAttachment } from './file-service';
import { getItemDetail } from './maintenance-service';
import { getMaintenanceReport } from './report-service';
import { setFixedNow } from './runtime';

const expectError = async (promise: Promise<unknown>, code: string): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected ${code}`);
};

const generate = (commandId: string) =>
  executeSystemCommand({ commandId, subjectType: 'MAINTENANCE_PLAN', action: 'generateOccurrences', payload: { buildingIds: ['bld-a', 'bld-b'] } });

const occPhoto = (occurrenceId: string) =>
  uploadAttachment({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrenceId, purpose: 'MAINTENANCE_RESULT', file: makeSamplePng('#111111', '#eeeeee'), fileName: 'b.png' }).then((a) => a.id);

const repairPhoto = (recordId: string, purpose: 'CONSTRUCTION' | 'ACCEPTANCE' = 'ACCEPTANCE') =>
  uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose, file: makeSamplePng('#222222', '#dddddd'), fileName: 'repair.png' }).then((a) => a.id);

const repairPdf = (recordId: string, purpose: 'PROPOSAL' | 'PAYMENT_REQUEST' | 'PAYMENT_PROOF' | 'ACCEPTANCE') =>
  uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose, file: makeSamplePdf('repair'), fileName: 'repair.pdf' }).then((a) => a.id);

const planOf = async (code: string) => {
  const plan = await getDb().maintenancePlans.where('code').equals(code).first();
  if (!plan) throw new Error(code);
  return plan;
};

describe('maintenance workflow acceptance (spec 13.2)', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should never duplicate occurrences when generation runs repeatedly', async () => {
    const before = await getDb().occurrences.count();
    await generate('g1');
    await generate('g2');
    asUser(USER_ID.BQL_A);
    await run('refreshSchedule', 'MAINTENANCE_PLAN', undefined);
    expect(await getDb().occurrences.count()).toBe(before);
    setFixedNow(new Date(vnDateTimeToIso('2026-11-12', 12)));
    await generate('g3');
    await generate('g4');
    const keys = (await getDb().occurrences.toArray()).map((row) => row.scheduleKey).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('should run start → submit → rework → resubmit → confirm and keep history', async () => {
    const bt3 = await occurrenceByCode('BT-003');
    asUser(USER_ID.BQL_A);
    await run('startMaintenance', 'MAINTENANCE_OCCURRENCE', bt3.id);
    const checklist = bt3.checklist.map((entry) => ({ templateItemId: entry.templateItemId, result: 'OK' }));
    const missing = await expectError(
      run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', bt3.id, { checklist: checklist.slice(1), resultNote: 'Đã làm xong.', performerName: 'Đội KT' }),
      'VALIDATION_ERROR',
    );
    expect(Object.values(missing.fieldErrors ?? {}).join(' ')).toContain('chưa được kiểm tra');
    const noPhoto = await expectError(
      run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', bt3.id, { checklist, resultNote: 'Đã làm xong.', performerName: 'Đội KT' }),
      'VALIDATION_ERROR',
    );
    expect(noPhoto.fieldErrors?.attachmentIds).toBeDefined();
    await run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', bt3.id, {
      checklist,
      resultNote: 'Đã làm xong.',
      performerName: 'Đội KT',
      attachmentIds: [await occPhoto(bt3.id)],
    });
    asUser(USER_ID.KT_A);
    await run('requestMaintenanceRework', 'MAINTENANCE_OCCURRENCE', bt3.id, { reason: 'Thiếu ảnh tủ điều khiển.' });
    asUser(USER_ID.BQL_A);
    await run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', bt3.id, { resultNote: 'Đã bổ sung ảnh tủ điều khiển.' });
    asUser(USER_ID.KT_A);
    await run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt3.id);
    const submissions = await getDb().maintenanceSubmissions.where('occurrenceId').equals(bt3.id).sortBy('roundNo');
    expect(submissions.map((row) => row.resultNote)).toEqual(['Đã làm xong.', 'Đã bổ sung ảnh tủ điều khiển.']);
    const reviews = await getDb().maintenanceReviews.where('occurrenceId').equals(bt3.id).sortBy('roundNo');
    expect(reviews.map((row) => row.outcome)).toEqual(['REWORK', 'CONFIRMED']);
    expect((await occurrenceByCode('BT-003')).status).toBe('COMPLETED');
  });

  it('should route an elevator issue from technical inspection to the linked repair workflow', async () => {
    const bt003 = await occurrenceByCode('BT-003');
    expect(bt003.status).toBe('SCHEDULED');

    // BQL opens the scheduled maintenance visit; the technician records the actual finding.
    asUser(USER_ID.BQL_A);
    await run('startMaintenance', 'MAINTENANCE_OCCURRENCE', bt003.id);
    const started = (await getDb().occurrences.get(bt003.id)) as typeof bt003;
    const inspectionPhoto = await occPhoto(bt003.id);
    const issueChecklist = started.checklist.map((entry, index) => ({
      templateItemId: entry.templateItemId,
      result: index === 0 ? ('ISSUE' as const) : ('OK' as const),
      note: index === 0 ? 'Phanh và bộ hãm an toàn hoạt động bất thường, cần kiểm tra sửa chữa.' : undefined,
    }));
    await run('saveMaintenanceProgress', 'MAINTENANCE_OCCURRENCE', bt003.id, {
      checklist: issueChecklist,
      resultNote: 'Phát hiện lỗi phanh thang máy số 1 trong lúc kiểm tra định kỳ.',
      performerName: 'Kỹ thuật tòa nhà',
      attachmentIds: [inspectionPhoto],
    });

    // The technician only records the condition. BQL owns the handoff to a repair record.
    asUser(USER_ID.KT_A);
    await expectError(
      run('createRepairFromMaintenance', 'MAINTENANCE_OCCURRENCE', bt003.id, {
        title: 'Sửa phanh thang máy số 1',
        description: 'Phanh và bộ hãm an toàn hoạt động bất thường khi kiểm tra định kỳ.',
        priority: 'URGENT',
        confirmationUserId: USER_ID.KT_A,
        attachmentIds: [inspectionPhoto],
      }),
      'FORBIDDEN',
    );

    asUser(USER_ID.BQL_A);
    const linked = await run('createRepairFromMaintenance', 'MAINTENANCE_OCCURRENCE', bt003.id, {
      title: 'Sửa phanh thang máy số 1',
      description: 'Phanh và bộ hãm an toàn hoạt động bất thường khi kiểm tra định kỳ.',
      priority: 'URGENT',
      confirmationUserId: USER_ID.KT_A,
      attachmentIds: [inspectionPhoto],
    });
    const repairId = linked.subjectId as string;
    const draft = await getDb().records.get(repairId);
    expect(draft?.status).toBe('DRAFT');
    expect(draft?.sourceMaintenanceOccurrenceId).toBe(bt003.id);
    expect(draft?.maintenanceItemId).toBe(bt003.itemId);

    const afterLink = (await getDb().occurrences.get(bt003.id)) as typeof bt003;
    const submitChecklist = afterLink.checklist.map((entry, index) => ({
      templateItemId: entry.templateItemId,
      result: index === 0 ? ('ISSUE' as const) : ('OK' as const),
      note: index === 0 ? 'Đã lập hồ sơ sửa chữa liên kết để xử lý lỗi phanh.' : undefined,
    }));
    await run('submitMaintenance', 'MAINTENANCE_OCCURRENCE', bt003.id, {
      checklist: submitChecklist,
      resultNote: 'Đã ghi nhận lỗi và chuyển sang hồ sơ sửa chữa thang máy.',
      performerName: 'Kỹ thuật tòa nhà',
    });

    asUser(USER_ID.KT_A);
    await run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt003.id, {
      itemCondition: 'NEEDS_ATTENTION',
      conditionNote: 'Không tiếp tục vận hành khi chưa kiểm tra và sửa phanh.',
    });
    expect((await occurrenceByCode('BT-003')).status).toBe('COMPLETED');

    asUser(USER_ID.BQL_A);
    await run('submitRecord', 'REPAIR_RECORD', repairId);
    expect((await getDb().records.get(repairId))?.status).toBe('PENDING_CONFIRMATION');

    asUser(USER_ID.KT_A);
    await run('confirmRepair', 'REPAIR_RECORD', repairId, {
      note: 'Đã kiểm tra hiện trạng, xác nhận cần sửa phanh thang máy.',
    });
    expect((await getDb().records.get(repairId))?.status).toBe('PENDING_PROPOSAL');

    const nextTask = await getDb().tasks
      .where('[subjectType+subjectId]')
      .equals(['REPAIR_RECORD', repairId])
      .filter((task) => task.status === 'OPEN')
      .first();
    expect(nextTask?.assigneeId).toBe(USER_ID.BQL_A);

    asUser(USER_ID.BQL_A);
    await run('submitProposal', 'REPAIR_RECORD', repairId, {
      proposal: 'Thay bộ phanh và kiểm định lại thang máy số 1.',
      contractorName: 'Công ty TNHH Thang máy & Bảo trì Nam Long',
      amountVnd: 18_000_000,
      attachmentIds: [await repairPdf(repairId, 'PROPOSAL')],
      signature: signatureDataUrl('BQL-A'),
    });
    asUser(USER_ID.TVKT);
    await run('approveProposal', 'REPAIR_RECORD', repairId);
    asUser(USER_ID.BQT);
    await run('approveProposal', 'REPAIR_RECORD', repairId);

    asUser(USER_ID.BQL_A);
    await run('startConstruction', 'REPAIR_RECORD', repairId, { startDate: '2026-10-12', plannedEndDate: '2026-10-16' });
    await run('updateConstruction', 'REPAIR_RECORD', repairId, {
      progressPercent: 100,
      note: 'Đã thay bộ phanh và kiểm định vận hành đạt.',
      attachmentIds: [await repairPhoto(repairId, 'CONSTRUCTION')],
    });
    await run('submitAcceptance', 'REPAIR_RECORD', repairId, {
      completedDate: '2026-10-12',
      note: 'Đề nghị kỹ thuật nghiệm thu sau khi hoàn thành sửa chữa.',
      attachmentIds: [await repairPhoto(repairId), await repairPdf(repairId, 'ACCEPTANCE')],
    });
    asUser(USER_ID.KT_A);
    await run('passAcceptance', 'REPAIR_RECORD', repairId, {
      note: 'Thang máy vận hành ổn định, đạt yêu cầu kỹ thuật.',
      reportAttachmentIds: [await repairPdf(repairId, 'ACCEPTANCE')],
    });
    asUser(USER_ID.TVKT);
    await run('passAcceptance', 'REPAIR_RECORD', repairId, { note: 'TVKT xác nhận kết quả nghiệm thu đạt.' });

    asUser(USER_ID.BQL_A);
    await run('submitPaymentRequest', 'REPAIR_RECORD', repairId, {
      amountVnd: 18_000_000,
      attachmentIds: [await repairPdf(repairId, 'PAYMENT_REQUEST')],
    });
    asUser(USER_ID.BQT);
    await run('approvePayment', 'REPAIR_RECORD', repairId);
    asUser(USER_ID.BQL_A);
    await run('recordPayment', 'REPAIR_RECORD', repairId, {
      amountVnd: 18_000_000,
      paidDate: '2026-10-12',
      reference: 'UNC-ELEVATOR-001',
      attachmentIds: [await repairPdf(repairId, 'PAYMENT_PROOF')],
    });
    await run('completeRecord', 'REPAIR_RECORD', repairId);

    expect((await getDb().records.get(repairId))?.status).toBe('COMPLETED');
    const openTasks = await getDb().tasks
      .where('[subjectType+subjectId]')
      .equals(['REPAIR_RECORD', repairId])
      .filter((task) => task.status === 'OPEN')
      .count();
    expect(openTasks).toBe(0);
  });

  it('should not recreate the original period after rescheduling', async () => {
    const bt4 = await occurrenceByCode('BT-004');
    asUser(USER_ID.BQL_A);
    await run('rescheduleMaintenance', 'MAINTENANCE_OCCURRENCE', bt4.id, { scheduledDate: '2026-11-20', reason: 'Trùng lịch kiểm định.' });
    await generate('g-after-reschedule');
    const same = await getDb().occurrences.where('planId').equals(bt4.planId).filter((row) => row.originalScheduledDate === bt4.originalScheduledDate).count();
    expect(same).toBe(1);
    expect((await occurrenceByCode('BT-004')).scheduledDate).toBe('2026-11-20');
  });

  it('should skip paused periods on resume instead of creating overdue work', async () => {
    const plan = await planOf('KH-03');
    asUser(USER_ID.BQL_A);
    await run('pauseMaintenancePlan', 'MAINTENANCE_PLAN', plan.id, { reason: 'Máy phát đang đại tu.' });
    setFixedNow(new Date(vnDateTimeToIso('2027-02-15', 9)));
    await generate('g-paused');
    const countPaused = await getDb().occurrences.where('planId').equals(plan.id).count();
    expect(countPaused).toBe(2);
    await run('activateMaintenancePlan', 'MAINTENANCE_PLAN', plan.id);
    const resumed = await planOf('KH-03');
    expect(resumed.skippedPeriods.length).toBeGreaterThan(0);
    // Occurrences generated before the pause stay; nothing new may fall inside the pause.
    const createdDuringPause = await getDb()
      .occurrences.where('planId')
      .equals(plan.id)
      .filter((row) => row.scheduledDate > (plan.generatedThrough as string) && row.scheduledDate < '2027-02-15')
      .count();
    expect(createdDuringPause).toBe(0);
  });

  it('should flag already generated occurrences when the cycle changes', async () => {
    const plan = await planOf('KH-01');
    asUser(USER_ID.BQL_A);
    const result = await run('changeMaintenanceSchedule', 'MAINTENANCE_PLAN', plan.id, {
      frequency: 'QUARTERLY',
      effectiveFrom: '2026-10-20',
      anchorDate: '2026-10-25',
      reason: 'Hợp đồng bảo trì mới theo quý.',
    });
    expect(result.data?.flagged).toBe(1);
    const bt4 = await occurrenceByCode('BT-004');
    expect(bt4.reviewFlag).toBe('SCHEDULE_CHANGED');
    const task = await getDb().tasks.where('[subjectType+subjectId]').equals(['MAINTENANCE_OCCURRENCE', bt4.id]).filter((t) => t.status === 'OPEN').first();
    expect(task?.kind).toBe('REVIEW_SCHEDULE_CHANGE');
    const newOne = await getDb().occurrences.where('planId').equals(plan.id).filter((row) => row.scheduledDate === '2026-10-25').count();
    expect(newOne).toBe(1);
  });

  it('should create one linked repair per command even when retried', async () => {
    const bt7 = await occurrenceByCode('BT-007');
    asUser(USER_ID.BQL_A);
    const image = await occPhoto(bt7.id);
    const payload = {
      title: 'Thay ắc quy máy phát',
      description: 'Ắc quy khởi động máy phát yếu, không đề nổ được lần đầu.',
      priority: 'HIGH',
      confirmationUserId: USER_ID.KT_A,
      attachmentIds: [image],
    };
    const first = await run('createRepairFromMaintenance', 'MAINTENANCE_OCCURRENCE', bt7.id, payload, 'cmd-link');
    const retry = await run('createRepairFromMaintenance', 'MAINTENANCE_OCCURRENCE', bt7.id, payload, 'cmd-link').catch((error: AppError) => error);
    // The retry carries a newer expectedVersion but same id: stored result or conflict, never a duplicate record.
    expect(retry && 'ok' in retry ? retry.subjectId : first.subjectId).toBe(first.subjectId);
    const linked = await getDb().records.where('sourceMaintenanceOccurrenceId').equals(bt7.id).toArray();
    expect(linked).toHaveLength(1);
    expect(linked[0].maintenanceItemId).toBe(bt7.itemId);
    expect(linked[0].attachmentIds).toHaveLength(1);
    const detail = await getItemDetail(bt7.itemId);
    expect(detail.repairs.map((row) => row.id)).toContain(first.subjectId);
  });

  it('should require an issue resolution before confirming', async () => {
    const bt10 = await occurrenceByCode('BT-010');
    asUser(USER_ID.BQL_A);
    await expectError(run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt10.id), 'FORBIDDEN');
    asUser(USER_ID.KT_A);
    await expectError(run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt10.id), 'FORBIDDEN');
    asUser(USER_ID.KT_A2);
    await run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt10.id);
  });

  it('should require a resolution for every issue not covered by a linked repair', async () => {
    const bt10 = await occurrenceByCode('BT-010');
    const submission = await getDb().maintenanceSubmissions.get(bt10.currentSubmissionId ?? '');
    if (!submission || submission.checklistSnapshot.length < 2) throw new Error('BT-010 needs at least two checklist entries for this regression test.');
    const checklistSnapshot = submission.checklistSnapshot.map((entry, index) =>
      index < 2 ? { ...entry, result: 'ISSUE' as const, note: `Đã ghi nhận vấn đề ${index + 1}.` } : entry,
    );
    await getDb().maintenanceSubmissions.put({ ...submission, checklistSnapshot });
    await getDb().occurrences.put({ ...bt10, repairRecordIds: ['rec-linked-1'] });

    asUser(USER_ID.KT_A2);
    const missing = await expectError(run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt10.id), 'VALIDATION_ERROR');
    expect(missing.fieldErrors?.issueResolutionNote).toBeDefined();
    await run('confirmMaintenance', 'MAINTENANCE_OCCURRENCE', bt10.id, { issueResolutionNote: 'Mục còn lại đã được ghi nhận để theo dõi tiếp.' });
    expect((await occurrenceByCode('BT-010')).status).toBe('COMPLETED');
  });

  it('should report maintenance numbers consistent with the seed', async () => {
    asUser(USER_ID.ADMIN);
    const report = await getMaintenanceReport({});
    expect(report.dueCount).toBe(13);
    expect(report.completedCount).toBe(4);
    expect(report.lateCompletedCount).toBe(1);
    expect(report.cancelledCount).toBe(1);
    expect(report.overdueCount).toBe(3);
    expect(report.completionRate).toBeCloseTo(4 / 12);
    expect(report.issueCount).toBe(1);
    expect(report.linkedRepairCount).toBe(1);
    asUser(USER_ID.KT_A);
    await expectError(getMaintenanceReport({}), 'FORBIDDEN');
  });
});
