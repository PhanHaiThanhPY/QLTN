import { USER_ID } from '@/mock/seed-reference';
import { signatureDataUrl } from '@/mock/signature-art';
import { makeSamplePdf, makeSamplePng } from '@/mock/placeholder-files';
import { getDb } from '@/storage/db';
import { asUser, recordByCode, run, seedAt } from '@/test/helpers';
import type { AppError } from '@/domain/errors';
import { uploadAttachment, readAttachmentBlob } from './file-service';
import { executeCommand } from './command-engine';
import { getRecordDetail, listRecords } from './records-service';
import { getSettings, saveSettings } from './settings-service';

const photo = (recordId: string, purpose: 'SITE_PHOTO' | 'CONSTRUCTION' | 'ACCEPTANCE' = 'SITE_PHOTO') =>
  uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose, file: makeSamplePng('#000000', '#ffffff'), fileName: 'p.png' }).then((a) => a.id);
const pdf = (recordId: string, purpose: 'PROPOSAL' | 'ACCEPTANCE' | 'PAYMENT_REQUEST' | 'PAYMENT_PROOF') =>
  uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose, file: makeSamplePdf('x'), fileName: 'd.pdf' }).then((a) => a.id);

const expectError = async (promise: Promise<unknown>, code: string): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected ${code}`);
};

describe('repair workflow acceptance (spec 13.1, 13.3)', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should save an incomplete new record as DRAFT and keep submit validation strict', async () => {
    asUser(USER_ID.BQL_A);
    const created = await run('createRecord', 'REPAIR_RECORD', undefined, {
      buildingId: 'bld-a',
      locationId: '',
      title: '',
      description: '',
      priority: 'NORMAL',
      confirmationUserId: '',
      consultantUserId: '',
      boardUserId: '',
    });
    const id = created.subjectId as string;
    const draft = await getDb().records.get(id);
    expect(draft?.status).toBe('DRAFT');
    expect(draft?.title).toBe('');
    expect(draft?.locationId).toBe('');

    const missing = await expectError(run('submitRecord', 'REPAIR_RECORD', id), 'VALIDATION_ERROR');
    expect(missing.fieldErrors?.title).toBeDefined();
    expect(missing.fieldErrors?.locationId).toBeDefined();
  });

  it('should run a new record end to end across accounts', async () => {
    asUser(USER_ID.BQL_A);
    const created = await run('createRecord', 'REPAIR_RECORD', undefined, {
      buildingId: 'bld-a',
      locationId: 'loc-a-5',
      title: 'Hỏng khóa cửa thoát hiểm',
      description: 'Khóa cửa thoát hiểm tầng 5 không bật lại được.',
      priority: 'NORMAL',
      noMaintenanceItem: true,
    });
    const id = created.subjectId as string;
    await expectError(run('submitRecord', 'REPAIR_RECORD', id), 'VALIDATION_ERROR');
    await run('submitRecord', 'REPAIR_RECORD', id, { attachmentIds: [await photo(id)] });

    asUser(USER_ID.KT_A);
    await run('confirmRepair', 'REPAIR_RECORD', id, { note: 'Cần thay khóa mới.' });

    asUser(USER_ID.BQL_A);
    const proposal = { proposal: 'Thay khóa cửa thoát hiểm loại mới.', contractorName: '', amountVnd: 3_000_000, attachmentIds: [await pdf(id, 'PROPOSAL')] };
    const missing = await expectError(run('submitProposal', 'REPAIR_RECORD', id, proposal), 'VALIDATION_ERROR');
    expect(missing.fieldErrors?.contractorName).toBeDefined();
    const unsigned = await expectError(run('submitProposal', 'REPAIR_RECORD', id, { ...proposal, contractorName: 'Công ty Khóa An Toàn' }), 'VALIDATION_ERROR');
    expect(unsigned.fieldErrors?.signature).toBeDefined();
    await run('submitProposal', 'REPAIR_RECORD', id, { ...proposal, contractorName: 'Công ty Khóa An Toàn', signature: signatureDataUrl('BQL-A') });
    expect((await recordByCode(created.data?.code as string)).status).toBe('PENDING_TECH_REVIEW');

    asUser(USER_ID.ADMIN);
    await expectError(run('approveProposal', 'REPAIR_RECORD', id), 'FORBIDDEN');
    // Only the approver of the current step may decide: BQT waits for TVKT.
    asUser(USER_ID.BQT);
    await expectError(run('approveProposal', 'REPAIR_RECORD', id), 'FORBIDDEN');
    for (const [approver, next] of [
      [USER_ID.TVKT, 'PENDING_BOARD_APPROVAL'],
      [USER_ID.BQT, 'READY_FOR_CONSTRUCTION'],
    ] as const) {
      asUser(approver);
      await run('approveProposal', 'REPAIR_RECORD', id);
      expect((await getDb().records.get(id))?.status).toBe(next);
    }
    const decisions = await getDb().approvalDecisions.where('recordId').equals(id).toArray();
    expect(decisions.map((row) => row.step).sort()).toEqual(['BOARD', 'TECH']);
    const signatures = await getDb().signatures.where('recordId').equals(id).toArray();
    expect(signatures.map((row) => row.kind).sort()).toEqual(['SUBMITTER']);

    asUser(USER_ID.BQL_A);
    await run('startConstruction', 'REPAIR_RECORD', id, { startDate: '2026-10-12', plannedEndDate: '2026-10-15' });
    await run('updateConstruction', 'REPAIR_RECORD', id, { progressPercent: 100, note: 'Đã thay khóa.', attachmentIds: [] });
    await run('submitAcceptance', 'REPAIR_RECORD', id, { completedDate: '2026-10-12', note: 'Hoàn thành.', attachmentIds: [await photo(id, 'ACCEPTANCE')] });

    // Acceptance needs both KT and TVKT; after KT passes, only TVKT has an open task.
    asUser(USER_ID.KT_A);
    await run('passAcceptance', 'REPAIR_RECORD', id, { note: 'Đạt yêu cầu.', reportAttachmentIds: [await pdf(id, 'ACCEPTANCE')] });
    const halfway = await getDb().records.get(id);
    expect(halfway?.status).toBe('PENDING_ACCEPTANCE');
    expect(halfway?.pendingAcceptanceSlots).toEqual(['consultant']);
    await expectError(run('passAcceptance', 'REPAIR_RECORD', id, { note: 'Đạt lần nữa.' }), 'FORBIDDEN');
    const acceptanceTasks = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', id]).filter((t) => t.status === 'OPEN').toArray();
    expect(acceptanceTasks.map((task) => task.assigneeId)).toEqual([USER_ID.TVKT]);
    asUser(USER_ID.TVKT);
    await run('passAcceptance', 'REPAIR_RECORD', id, { note: 'TVKT thống nhất.' });

    asUser(USER_ID.BQL_A);
    await run('submitPaymentRequest', 'REPAIR_RECORD', id, { amountVnd: 3_000_000, attachmentIds: [await pdf(id, 'PAYMENT_REQUEST')] });
    asUser(USER_ID.TVKT);
    await expectError(run('approvePayment', 'REPAIR_RECORD', id), 'FORBIDDEN');
    asUser(USER_ID.BQT);
    await run('approvePayment', 'REPAIR_RECORD', id);
    asUser(USER_ID.BQL_A);
    await expectError(run('completeRecord', 'REPAIR_RECORD', id), 'VALIDATION_ERROR');
    const payment = { amountVnd: 3_000_000, paidDate: '2026-10-12', reference: 'UNC-1', attachmentIds: [await pdf(id, 'PAYMENT_PROOF')] };
    await run('recordPayment', 'REPAIR_RECORD', id, payment);
    await expectError(run('recordPayment', 'REPAIR_RECORD', id, payment), 'INVALID_TRANSITION');
    await run('completeRecord', 'REPAIR_RECORD', id);

    const detail = await getRecordDetail(id);
    expect(detail.record.status).toBe('COMPLETED');
    expect(detail.audit.length).toBeGreaterThan(10);
    const open = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', id]).filter((t) => t.status === 'OPEN').count();
    expect(open).toBe(0);
  });

  it('should mark the record unresolved on the third rejection, draft a notice and never create attempt 4', async () => {
    const sc8 = await recordByCode('SC-008');
    expect(sc8.status).toBe('PENDING_BOARD_APPROVAL');
    asUser(USER_ID.BQT);
    await expectError(run('requestProposalUpdate', 'REPAIR_RECORD', sc8.id, { reason: 'Bổ sung thêm.' }), 'INVALID_TRANSITION');
    await run('rejectProposal', 'REPAIR_RECORD', sc8.id, { reason: 'Không phù hợp ngân sách.' });
    expect((await recordByCode('SC-008')).status).toBe('UNRESOLVED');
    const notice = await getDb().notices.where('recordId').equals(sc8.id).first();
    expect(notice?.status).toBe('DRAFT');
    expect(notice?.body).toContain('Không phù hợp ngân sách.');
    expect(notice?.body).toContain('Lần trình 1');
    asUser(USER_ID.BQL_A);
    await expectError(run('resubmitProposal', 'REPAIR_RECORD', sc8.id), 'INVALID_TRANSITION');
    expect(await getDb().submissions.where('recordId').equals(sc8.id).count()).toBe(3);
    const task = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', sc8.id]).filter((t) => t.status === 'OPEN').first();
    expect(task?.kind).toBe('ISSUE_UNRESOLVED_NOTICE');

    await expectError(run('saveUnresolvedNotice', 'REPAIR_RECORD', sc8.id, { title: notice?.title, body: 'Ngắn' }), 'VALIDATION_ERROR');
    await run('saveUnresolvedNotice', 'REPAIR_RECORD', sc8.id, { title: notice?.title, body: `${notice?.body}\nBổ sung ghi chú.`, noticeVersion: notice?.version });
    await run('issueUnresolvedNotice', 'REPAIR_RECORD', sc8.id);
    const issued = await getDb().notices.get(notice?.id ?? '');
    expect(issued?.status).toBe('ISSUED');
    expect(issued?.body).toContain('Bổ sung ghi chú.');
    await expectError(run('saveUnresolvedNotice', 'REPAIR_RECORD', sc8.id, { title: 'Sửa sau khi phát hành', body: issued?.body }), 'INVALID_TRANSITION');
    const open = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', sc8.id]).filter((t) => t.status === 'OPEN').count();
    expect(open).toBe(0);
    const informed = await getDb().notifications.where('recipientId').equals(USER_ID.BQT).filter((n) => n.subjectId === sc8.id && n.title.includes('chưa xử lý')).count();
    expect(informed).toBe(1);
  });

  it('should restart the chain at TVKT after a return and keep earlier attempts unchanged', async () => {
    const sc7 = await recordByCode('SC-007');
    expect(sc7.status).toBe('PENDING_BOARD_APPROVAL');
    const [first] = await getDb().submissions.where('recordId').equals(sc7.id).sortBy('attemptNo');
    asUser(USER_ID.BQT);
    await run('requestProposalUpdate', 'REPAIR_RECORD', sc7.id, { reason: 'Cần giảm giá thêm.' });
    asUser(USER_ID.BQL_A);
    const draft = await getDb().proposalDrafts.where('recordId').equals(sc7.id).first();
    await run('resubmitProposal', 'REPAIR_RECORD', sc7.id, {
      proposal: draft?.proposal,
      contractorName: draft?.contractorName,
      amountVnd: 60_000_000,
      attachmentIds: draft?.attachmentIds,
      signature: signatureDataUrl('BQL-A'),
    });
    const after = await recordByCode('SC-007');
    expect(after.status).toBe('PENDING_TECH_REVIEW');
    const submissions = await getDb().submissions.where('recordId').equals(sc7.id).sortBy('attemptNo');
    expect(submissions.map((row) => row.amountVnd)).toEqual([first.amountVnd, first.amountVnd, 60_000_000]);
    const second = await getDb().approvalDecisions.where('submissionId').equals(submissions[1].id).sortBy('createdAt');
    expect(second.map((row) => `${row.step}:${row.outcome}`)).toEqual(['TECH:APPROVED', 'BOARD:NEEDS_UPDATE']);
  });

  it('should keep failed acceptance and allow re-acceptance after fixing', async () => {
    const sc11 = await recordByCode('SC-011');
    asUser(USER_ID.BQL_A);
    await expectError(run('resubmitAcceptance', 'REPAIR_RECORD', sc11.id, { note: 'Đã sửa xong.', attachmentIds: [] }), 'VALIDATION_ERROR');
    await run('resubmitAcceptance', 'REPAIR_RECORD', sc11.id, { note: 'Đã sửa xong.', attachmentIds: [await photo(sc11.id, 'ACCEPTANCE')] });
    const rounds = await getDb().acceptances.where('recordId').equals(sc11.id).sortBy('roundNo');
    expect(rounds.map((round) => round.result)).toEqual(['FAILED', 'PENDING']);
  });

  it('should create a new payment revision after a return and keep the old decision', async () => {
    const sc12 = await recordByCode('SC-012');
    asUser(USER_ID.BQT);
    await run('requestPaymentUpdate', 'REPAIR_RECORD', sc12.id, { reason: 'Thiếu hóa đơn VAT.' });
    asUser(USER_ID.BQL_A);
    const [first] = await getDb().paymentRequests.where('recordId').equals(sc12.id).toArray();
    await run('submitPaymentRequest', 'REPAIR_RECORD', sc12.id, { amountVnd: first.amountVnd, attachmentIds: [await pdf(sc12.id, 'PAYMENT_REQUEST')] });
    const requests = await getDb().paymentRequests.where('recordId').equals(sc12.id).sortBy('revisionNo');
    expect(requests.map((row) => [row.revisionNo, row.decision])).toEqual([[1, 'NEEDS_UPDATE'], [2, undefined]]);
  });

  it('should hide building A from building B accounts, including files and deep links', async () => {
    const sc2 = await recordByCode('SC-002');
    asUser(USER_ID.KT_B);
    const list = await listRecords({ pageSize: 50 });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((row) => row.record.buildingId !== 'bld-a')).toBe(true);
    await expectError(getRecordDetail(sc2.id), 'NOT_FOUND');
    await expectError(readAttachmentBlob(sc2.attachmentIds[0]), 'NOT_FOUND');
    await expectError(run('confirmRepair', 'REPAIR_RECORD', sc2.id, { note: 'Thử thao tác.' }), 'NOT_FOUND');
  });

  it('should block a confirmer who is not assigned to the record', async () => {
    const sc2 = await recordByCode('SC-002');
    asUser(USER_ID.KT_A2);
    const error = await expectError(run('confirmRepair', 'REPAIR_RECORD', sc2.id, { note: 'Thử xác nhận.' }), 'FORBIDDEN');
    expect(error.message).toContain('được giao');
  });

  it('should return the stored result for a repeated command and reject stale versions', async () => {
    const sc2 = await recordByCode('SC-002');
    asUser(USER_ID.KT_A);
    const command = { commandId: 'cmd-dup', subjectType: 'REPAIR_RECORD' as const, subjectId: sc2.id, expectedVersion: sc2.version, action: 'confirmRepair', payload: { note: 'Xác nhận cần sửa.' } };
    const first = await executeCommand(command);
    const second = await executeCommand(command);
    expect(second).toEqual(first);
    expect(await getDb().repairConfirmations.where('recordId').equals(sc2.id).count()).toBe(1);
    await expectError(executeCommand({ ...command, payload: { note: 'Nội dung khác hẳn.' } }), 'CONFLICT');
    asUser(USER_ID.BQL_A);
    await expectError(
      executeCommand({ commandId: 'cmd-stale', subjectType: 'REPAIR_RECORD', subjectId: sc2.id, expectedVersion: sc2.version, action: 'withdrawRecord', payload: { reason: 'Không cần nữa.' } }),
      'CONFLICT',
    );
  });

  it('should roll back a simulated failure completely and succeed on retry', async () => {
    const sc2 = await recordByCode('SC-002');
    await saveSettings({ ...(await getSettings()), failNextCommand: true });
    asUser(USER_ID.KT_A);
    const command = { commandId: 'cmd-retry', subjectType: 'REPAIR_RECORD' as const, subjectId: sc2.id, expectedVersion: sc2.version, action: 'confirmRepair', payload: { note: 'Xác nhận cần sửa.' } };
    const auditBefore = await getDb().auditEvents.count();
    await expectError(executeCommand(command), 'NETWORK_ERROR');
    expect((await recordByCode('SC-002')).version).toBe(sc2.version);
    expect(await getDb().auditEvents.count()).toBe(auditBefore);
    await executeCommand(command);
    expect((await recordByCode('SC-002')).status).toBe('PENDING_PROPOSAL');
  });

  it('should require reassignment of the inactive confirmer on SC-003', async () => {
    const sc3 = await recordByCode('SC-003');
    asUser(USER_ID.BQL_A);
    const detail = await getRecordDetail(sc3.id);
    expect(detail.inactiveSlots).toEqual(['confirmer']);
    const blocked = await expectError(run('submitRecord', 'REPAIR_RECORD', sc3.id), 'VALIDATION_ERROR');
    expect(blocked.fieldErrors?.confirmationUserId).toContain('phân công lại');
    await run('reassignRepair', 'REPAIR_RECORD', sc3.id, { slot: 'confirmer', userId: USER_ID.KT_A2, reason: 'KT-A-CU đã nghỉ việc.' });
    await run('submitRecord', 'REPAIR_RECORD', sc3.id);
    const task = await getDb().tasks.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', sc3.id]).filter((t) => t.status === 'OPEN').first();
    expect(task?.assigneeId).toBe(USER_ID.KT_A2);
    const notified = await getDb().notifications.where('recipientId').equals(USER_ID.KT_A2).filter((n) => n.subjectId === sc3.id).count();
    expect(notified).toBeGreaterThan(0);
  });

  it('should withdraw before approval only', async () => {
    const sc5 = await recordByCode('SC-005');
    const sc9 = await recordByCode('SC-009');
    asUser(USER_ID.BQL_A);
    await expectError(run('withdrawRecord', 'REPAIR_RECORD', sc5.id, { reason: 'Không cần.' }), 'INVALID_TRANSITION');
    await expectError(run('withdrawRecord', 'REPAIR_RECORD', sc9.id, { reason: 'Không cần.' }), 'INVALID_TRANSITION');
    const sc1 = await recordByCode('SC-001');
    await run('withdrawRecord', 'REPAIR_RECORD', sc1.id, { reason: 'Đã tự khắc phục.' });
    expect((await recordByCode('SC-001')).status).toBe('CLOSED_WITHDRAWN');
  });

  it('should flag SC-002 as overdue', async () => {
    asUser(USER_ID.BQL_A);
    const detail = await getRecordDetail((await recordByCode('SC-002')).id);
    expect(detail.isOverdue).toBe(true);
  });
});
