import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';
import {
  confirmedRecord,
  readyForConstruction,
  SIGNATURE,
  upload,
  type FlowRecord,
  type FlowSessions,
} from './repair-flow';

// Before createApp: the attachment storage reads STORAGE_DIR when the module boots.
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-emergency-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC B06-S1 (docs/product/features/B06-xu-ly-khan-cap/SPEC.md): emergency repair and its post-review. */

interface Emergency {
  reason: string;
  contractorName: string;
  estimatedAmountVnd: string;
  limitVnd: string;
  docsDueAt: string;
  startedAt: string;
  fromStatus: string;
  docsSubmittedAt: string | null;
  lateReason: string | null;
  postReviewOutcome: string | null;
  closeDecision: { reason: string; attachmentIds: string[] } | null;
  docsOverdue: boolean;
  hoursLeft: number | null;
  overEmergencyLimit: boolean;
}

type EmergencyRecord = FlowRecord & { emergency: Emergency | null; approvedAmountVnd: string | null };

interface Detail {
  record: EmergencyRecord;
  proposal: { draft: { contractors?: Array<{ name: string }>; requestContent?: string } | null };
  execution: { construction: { startDate: string; plannedEndDate: string; progressPercent: number } | null };
  audit: Array<{ action: string; fromStatus: string | null; toStatus: string | null; reason: string | null }>;
  emergencyPolicy: { limitVnd: string; docHours: number } | null;
}

interface Notice {
  kind: string;
  subjectId: string;
  body: string;
}

const REASON = 'Ống cấp chính vỡ, nước tràn hầm B1, nguy cơ ngập tủ điện.';
const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;
const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

describe('Emergency repair, B06-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let otherBql: Session;
  let ktA: Session;
  let tvkt: Session;
  let bqt: Session;
  let ktoan: Session;
  let buildingId: string;
  let ids: Record<string, string>;
  let sequence = 0;

  const sessions = (): FlowSessions => ({
    manager: bqlA,
    confirmer: (record) => (record.confirmationUserId === ids.TVKT ? tvkt : ktA),
    approvers: () => [tvkt, bqt],
    board: bqt,
  });
  const title = (label: string): string => {
    sequence += 1;
    return `B06 ${label} ${sequence}`;
  };

  const act = (session: Session, record: { id: string; version: number }, route: string, body: object = {}) =>
    session.post(`/api/records/${record.id}/${route}`, { version: record.version, ...body });
  const ok = async (session: Session, record: { id: string; version: number }, route: string, body: object = {}) =>
    dataOf<EmergencyRecord>(
      await act(session, record, route, body).then((res) => {
        if (res.status !== 200) throw new Error(`${route} answered ${res.status}: ${JSON.stringify(res.body)}`);
        return res;
      }),
    );
  const detailOf = async (id: string): Promise<Detail> =>
    dataOf<Detail>(await bqlA.get(`/api/records/${id}`).expect(200));
  const noticesOf = async (session: Session, recordId: string, kind: string): Promise<Notice[]> =>
    dataOf<{ data: Notice[] }>(await session.get('/api/notifications?limit=100').expect(200)).data.filter(
      (row) => row.subjectId === recordId && row.kind === kind,
    );

  const startBody = (estimatedAmountVnd = '12500000') => ({
    reason: REASON,
    contractorName: 'Cty TNHH Bình An',
    estimatedAmountVnd,
    plannedEndDate: vnToday(),
  });
  const start = (record: FlowRecord, estimatedAmountVnd?: string) =>
    ok(bqlA, record, 'start-emergency-repair', startBody(estimatedAmountVnd));

  /** A record in the first location of building A: DRAFT. */
  const draftRecord = async (): Promise<FlowRecord> => {
    const reference = dataOf<{ locations: Array<{ id: string; buildingId: string }> }>(
      await bqlA.get('/api/reference'),
    );
    return dataOf<FlowRecord>(
      await bqlA
        .post('/api/records', {
          buildingId,
          locationId: (reference.locations.find((row) => row.buildingId === buildingId) as { id: string }).id,
          title: title('nháp'),
          description: 'Ống cấp nước chính hầm B1 bị vỡ, nước tràn.',
          noMaintenanceItem: true,
        })
        .expect(201),
    );
  };

  /** Emergency started from PENDING_PROPOSAL. */
  const emergencyRecord = async (estimatedAmountVnd?: string): Promise<EmergencyRecord> =>
    start(await confirmedRecord(sessions(), buildingId, title('khẩn cấp')), estimatedAmountVnd);

  /** One item × 2 from the emergency contractor, quotation and incident minutes uploaded now. */
  const proposalBody = async (record: FlowRecord, unitPriceVnd: string) => ({
    proposalType: 'SUA_CHUA',
    budgetSource: 'KINH_PHI_BAO_TRI',
    requestContent: REASON,
    assessment: 'Thay đoạn ống chính và van khóa, chạy thử áp lực.',
    items: [{ name: 'Ống cấp chính D90', unit: 'đoạn', quantity: '2' }],
    contractors: [
      {
        name: 'Cty TNHH Bình An',
        unitPricesVnd: [unitPriceVnd],
        otherCostVnd: '0',
        taxVnd: '0',
        quotationAttachmentIds: [await upload(bqlA, record.id, 'QUOTATION')],
      },
    ],
    proposedContractorIndex: 0,
    shortfallReason: 'Sự cố gấp, chỉ một nhà thầu nhận làm ngay.',
    incidentAttachmentIds: [await upload(bqlA, record.id, 'INCIDENT_MINUTES')],
    signature: SIGNATURE,
  });
  const submit = async (record: EmergencyRecord, route = 'submit-proposal', unitPriceVnd = '5000000', extra = {}) =>
    ok(bqlA, record, route, { ...(await proposalBody(record, unitPriceVnd)), ...extra });
  const boardEvidence = async (record: FlowRecord) => ({
    boardMinutesAttachmentIds: [await upload(bqt, record.id, 'BOARD_MINUTES')],
    signature: SIGNATURE,
  });
  /** TVKT then BQT approve the current submission. */
  const approveAll = async (record: EmergencyRecord): Promise<EmergencyRecord> => {
    const next = await ok(tvkt, record, 'approve-proposal');
    return ok(bqt, next, 'approve-proposal', await boardEvidence(next));
  };

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    ktoan = await signIn(server, 'ktoan-a');
    buildingId = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    )?.id as string;
    const reference = dataOf<{ users: Array<{ id: string; code: string }> }>(await bqlA.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
    // SPEC §6: building A on AQUA (limit 15 000 000 ₫, documents within 24 hours).
    const config = dataOf<{ version: number }>(await admin.get(`/api/buildings/${buildingId}/config`));
    await admin
      .post(`/api/buildings/${buildingId}/config/apply-template`, { templateKey: 'AQUA', version: config.version })
      .expect(201);
    // A second BQL of building A who does not manage the records here (AC-E1.4).
    const roles = dataOf<Array<{ id: string; code: string; isSystem: boolean }>>(await admin.get('/api/roles'));
    const managerProfile = dataOf<{ departmentId: string }>(await admin.get(`/api/users/${ids['BQL-A']}`));
    await admin
      .post('/api/users', {
        code: 'BQL-A9',
        fullName: 'BQL phụ Tòa A',
        password: 'E2e-bql-a9-1',
        roleDefId: (roles.find((row) => row.code === 'BQL' && row.isSystem) as { id: string }).id,
        departmentId: managerProfile.departmentId,
        buildingIds: [buildingId],
      })
      .expect(201);
    otherBql = await signIn(server, 'bql-a9', 'E2e-bql-a9-1');
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  describe('E-T1 start', () => {
    it('AC-E1.1 + AC-E1.5: opens construction and a prefilled draft, 24 h deadline, each approver notified once', async () => {
      const record = await emergencyRecord('12500000');
      expect(record.status).toBe('EMERGENCY_IN_PROGRESS');
      const detail = await detailOf(record.id);
      expect(detail.execution.construction).toMatchObject({ startDate: vnToday(), progressPercent: 0 });
      expect(detail.emergencyPolicy).toEqual({ limitVnd: '15000000', docHours: 24 });
      expect(detail.proposal.draft?.contractors?.[0].name).toBe('Cty TNHH Bình An');
      expect(detail.proposal.draft?.requestContent).toBe(REASON);
      const emergency = detail.record.emergency as Emergency;
      expect(emergency).toMatchObject({
        reason: REASON,
        estimatedAmountVnd: '12500000',
        limitVnd: '15000000',
        fromStatus: 'PENDING_PROPOSAL',
        docsSubmittedAt: null,
        postReviewOutcome: null,
        docsOverdue: false,
        hoursLeft: 24,
        overEmergencyLimit: false,
      });
      expect(new Date(emergency.docsDueAt).getTime() - new Date(emergency.startedAt).getTime()).toBe(24 * 3_600_000);

      // On AQUA the confirmer is TVKT, who also holds TECH; BQT holds BOARD.
      expect(await noticesOf(tvkt, record.id, 'EMERGENCY_STARTED')).toHaveLength(1);
      const [boardNotice] = await noticesOf(bqt, record.id, 'EMERGENCY_STARTED');
      expect(boardNotice.body).toContain(`Hồ sơ ${record.code} đang xử lý khẩn cấp: ${REASON}`);
      expect(boardNotice.body).toMatch(/Hạn bổ sung tờ trình: \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}\./);
      expect(await noticesOf(bqlA, record.id, 'EMERGENCY_STARTED')).toHaveLength(0);
    });

    it('AC-E1.2: 15 000 000 is allowed, 15 000 001 is refused on the field with no change and no audit', async () => {
      expect((await emergencyRecord('15000000')).status).toBe('EMERGENCY_IN_PROGRESS');
      const record = await confirmedRecord(sessions(), buildingId, title('vượt hạn mức'));
      const audits = (await detailOf(record.id)).audit.length;
      const res = await act(bqlA, record, 'start-emergency-repair', startBody('15000001')).expect(400);
      expect(errorFields(res)).toEqual(['estimatedAmountVnd']);
      expect(errorOf(res).message).toBe(
        'Chi phí dự kiến vượt hạn mức khẩn cấp của tòa (15.000.000 ₫). Hãy đi quy trình duyệt thông thường.',
      );
      const after = await detailOf(record.id);
      expect(after.record.status).toBe('PENDING_PROPOSAL');
      expect(after.audit).toHaveLength(audits);
    });

    it('AC-E1.3: starts from DRAFT and PENDING_CONFIRMATION with the source status audited; not from IN_CONSTRUCTION', async () => {
      // BR-E-01: from DRAFT the record must be complete as for T01, site photo included.
      const bare = await draftRecord();
      const missingPhoto = await act(bqlA, bare, 'start-emergency-repair', startBody()).expect(400);
      expect(errorFields(missingPhoto)).toEqual(['attachmentIds']);
      const withPhoto = dataOf<FlowRecord>(
        await bqlA
          .patch(`/api/records/${bare.id}`, {
            version: bare.version,
            attachmentIds: [await upload(bqlA, bare.id, 'SITE_PHOTO')],
          })
          .expect(200),
      );
      const fromDraft = await start(withPhoto);
      expect(fromDraft.emergency?.fromStatus).toBe('DRAFT');
      const draftAudit = (await detailOf(fromDraft.id)).audit.find((row) => row.action === 'startEmergencyRepair');
      expect(draftAudit).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'EMERGENCY_IN_PROGRESS' });
      expect(draftAudit?.reason).toContain('Từ «Nháp»; chi phí dự kiến 12.500.000 ₫; hạn mức 15.000.000 ₫');

      const draft = await draftRecord();
      const photo = await upload(bqlA, draft.id, 'SITE_PHOTO');
      const pending = await ok(bqlA, draft, 'submit', { attachmentIds: [photo] });
      expect((await start(pending)).emergency?.fromStatus).toBe('PENDING_CONFIRMATION');

      const ready = await readyForConstruction(sessions(), buildingId, title('đang thi công'));
      const building = await ok(bqlA, ready, 'start-construction', {
        startDate: vnToday(),
        plannedEndDate: vnToday(),
        planNote: 'Thi công trong ngày.',
      });
      const refused = await act(bqlA, building, 'start-emergency-repair', startBody()).expect(409);
      expect(reasonOf(refused)).toBe('invalid_status_transition');
    });

    it('AC-E1.4: another BQL and KT get 403; a stale version gets 409', async () => {
      const record = await confirmedRecord(sessions(), buildingId, title('quyền'));
      expect(reasonOf(await act(otherBql, record, 'start-emergency-repair', startBody()).expect(403))).toBe(
        'not_record_manager',
      );
      expect(reasonOf(await act(ktA, record, 'start-emergency-repair', startBody()).expect(403))).toBe(
        'missing_capability',
      );
      await act(bqlA, { id: record.id, version: record.version - 1 }, 'start-emergency-repair', startBody()).expect(
        409,
      );
    });
  });

  describe('post-review', () => {
    it('AC-E2.5 → AC-E2.1 → AC-E2.3: progress while in emergency, on-time proposal, approval resumes construction and S3/S4 follow', async () => {
      let record = await emergencyRecord();
      record = await ok(bqlA, record, 'update-construction', {
        progressPercent: 40,
        note: 'Đã cắt nước, thay xong 1 đoạn.',
      });
      expect(record.status).toBe('EMERGENCY_IN_PROGRESS');

      record = await submit(record);
      expect(record.emergency).toMatchObject({ lateReason: null, docsOverdue: false, hoursLeft: null });
      expect(record.emergency?.docsSubmittedAt).not.toBeNull();
      record = await approveAll(record);
      expect(record).toMatchObject({ status: 'IN_CONSTRUCTION', approvedAmountVnd: '10000000' });
      expect(record.emergency).toMatchObject({ postReviewOutcome: 'APPROVED', overEmergencyLimit: false });

      // S3 + S4 as usual: a 4 M advance, acceptance, settlement of the 10 M, close.
      const payee = { payeeName: 'CTY BINH AN', accountNo: '0123456789', bankName: 'Vietcombank' };
      record = await ok(bqlA, record, 'submit-advance-request', {
        amountVnd: '4000000',
        ...payee,
        requestAttachmentIds: [await upload(bqlA, record.id, 'PAYMENT_REQUEST')],
        signature: SIGNATURE,
      });
      record = await ok(bqt, record, 'approve-advance');
      const transfer = async (session: Session, amountVnd: string) => ({
        amountVnd,
        transferDate: vnToday(),
        reference: `FT${Date.now()}`,
        proofAttachmentIds: [await upload(session, record.id, 'PAYMENT_PROOF')],
      });
      record = await ok(ktoan, record, 'confirm-advance-transfer', await transfer(ktoan, '4000000'));
      record = await ok(bqlA, record, 'update-construction', { progressPercent: 100, note: 'Hoàn thành.' });
      record = await ok(bqlA, record, 'submit-acceptance', {
        completedDate: vnToday(),
        inspectedAt: new Date().toISOString(),
        inspectionLocation: 'Hầm B1',
        content: 'Chạy thử áp lực đạt, không rò.',
        photoAttachmentIds: [await upload(bqlA, record.id, 'ACCEPTANCE')],
      });
      for (const member of [bqlA, bqt, tvkt])
        record = await ok(member, record, 'pass-acceptance', { signature: SIGNATURE });
      expect(record.status).toBe('PENDING_PAYMENT_REQUEST');
      record = await ok(bqlA, record, 'submit-payment-request', {
        amountVnd: '10000000',
        ...payee,
        requestAttachmentIds: [await upload(bqlA, record.id, 'PAYMENT_REQUEST')],
        invoiceAttachmentIds: [await upload(bqlA, record.id, 'INVOICE')],
        signature: SIGNATURE,
      });
      record = await ok(bqt, record, 'approve-payment');
      record = await ok(ktoan, record, 'confirm-payment-transfer', await transfer(ktoan, '6000000'));
      record = await ok(bqlA, record, 'complete');
      expect(record.status).toBe('COMPLETED');
      expect(record.emergency?.postReviewOutcome).toBe('APPROVED');
    });

    it('AC-E2.2: after the deadline the first submission needs a late reason', async () => {
      const record = await emergencyRecord();
      await dataSource.query(
        `UPDATE repair_records SET emergency = jsonb_set(emergency, '{docsDueAt}', to_jsonb($2::text)) WHERE id = $1`,
        [record.id, new Date(Date.now() - 90 * 60_000).toISOString()],
      );
      const overdue = (await detailOf(record.id)).record.emergency as Emergency;
      expect(overdue).toMatchObject({ docsOverdue: true, hoursLeft: -2 });

      const missing = await act(bqlA, record, 'submit-proposal', await proposalBody(record, '5000000')).expect(400);
      expect(errorFields(missing)).toEqual(['lateReason']);
      const late = await submit(record, 'submit-proposal', '5000000', { lateReason: 'Chờ nhà thầu gửi báo giá.' });
      expect(late.emergency).toMatchObject({ lateReason: 'Chờ nhà thầu gửi báo giá.', docsOverdue: false });
    });

    it('AC-E2.4: a 16 M quotation above the 15 M limit is submitted and approved, flagged overEmergencyLimit', async () => {
      let record = await submit(await emergencyRecord(), 'submit-proposal', '8000000');
      expect(record.emergency?.overEmergencyLimit).toBe(true);
      record = await approveAll(record);
      expect(record).toMatchObject({ status: 'IN_CONSTRUCTION', approvedAmountVnd: '16000000' });
      expect(record.emergency?.overEmergencyLimit).toBe(true);
    });

    it('AC-E3.1: a BQT rejection without the flag is resubmittable, then approval resumes construction', async () => {
      let record = await ok(tvkt, await submit(await emergencyRecord()), 'approve-proposal');
      record = await ok(bqt, record, 'reject-proposal', {
        reason: 'Báo giá chưa có dấu.',
        ...(await boardEvidence(record)),
      });
      expect(record.status).toBe('REJECTED_RESUBMITTABLE');
      record = await approveAll(await submit(record, 'resubmit-proposal'));
      expect(record.status).toBe('IN_CONSTRUCTION');
    });

    it('AC-E3.2/3.3/3.5 + AC-E0.2: BOARD ends the post-review, BQL is told once, the BOARD holder closes the record', async () => {
      let record = await submit(await emergencyRecord());
      // AC-E3.3: TVKT holds TECH, not BOARD.
      const notBoard = await act(tvkt, record, 'reject-proposal', {
        reason: 'Không chấp nhận.',
        finalPostReview: true,
      });
      expect(notBoard.status).toBe(403);
      expect(reasonOf(notBoard)).toBe('final_post_review_denied');

      record = await ok(tvkt, record, 'approve-proposal');
      record = await ok(bqt, record, 'reject-proposal', {
        reason: 'Chi phí không hợp lý, không có biên bản hiện trường.',
        finalPostReview: true,
        ...(await boardEvidence(record)),
      });
      expect(record.status).toBe('POST_REVIEW_REJECTED');
      expect(record.emergency?.postReviewOutcome).toBe('REJECTED');
      expect(await noticesOf(bqlA, record.id, 'POST_REVIEW_REJECTED')).toHaveLength(1);
      const needsAction = dataOf<{ data: Array<{ id: string }> }>(
        await bqlA.get('/api/records?statusGroup=NEEDS_ACTION&limit=100').expect(200),
      ).data;
      expect(needsAction.map((row) => row.id)).toContain(record.id);

      // AC-E3.5: BQL cannot close; a 4-character reason is refused; the BOARD holder closes with a decision file.
      expect(
        reasonOf(await act(bqlA, record, 'close-post-review-rejected', { reason: 'Đóng hồ sơ.' }).expect(403)),
      ).toBe('missing_capability');
      const short = await act(bqt, record, 'close-post-review-rejected', { reason: 'Ngắn' }).expect(400);
      expect(errorFields(short)).toEqual(['reason']);
      const decision = await upload(bqt, record.id, 'BOARD_DECISION');
      record = await ok(bqt, record, 'close-post-review-rejected', {
        reason: 'Nhà thầu tự chịu chi phí đã làm.',
        attachmentIds: [decision],
      });
      expect(record.status).toBe('CLOSED_POST_REVIEW_REJECTED');
      expect(record.emergency?.closeDecision).toMatchObject({
        reason: 'Nhà thầu tự chịu chi phí đã làm.',
        attachmentIds: [decision],
      });
      const closed = dataOf<{ data: Array<{ id: string }> }>(
        await bqlA.get('/api/records?statusGroup=CLOSED&limit=100').expect(200),
      ).data;
      expect(closed.map((row) => row.id)).toContain(record.id);
      const audit = (await detailOf(record.id)).audit;
      expect(audit.find((row) => row.action === 'closePostReviewRejected')).toMatchObject({
        fromStatus: 'POST_REVIEW_REJECTED',
        toStatus: 'CLOSED_POST_REVIEW_REJECTED',
      });
    });

    it('AC-E3.4: a rejection of the third submission ends the post-review instead of UNRESOLVED', async () => {
      let record = await submit(await emergencyRecord());
      record = await ok(tvkt, record, 'reject-proposal', { reason: 'Thiếu bản vẽ.' });
      record = await ok(tvkt, await submit(record, 'resubmit-proposal'), 'reject-proposal', {
        reason: 'Vẫn thiếu bản vẽ.',
      });
      expect(record.status).toBe('REJECTED_RESUBMITTABLE');
      record = await ok(tvkt, await submit(record, 'resubmit-proposal'), 'reject-proposal', {
        reason: 'Lần cuối vẫn thiếu.',
      });
      expect(record.status).toBe('POST_REVIEW_REJECTED');
    });
  });

  it('AC-E4.1: no advance, settlement or acceptance before the post-review is approved', async () => {
    const blockedIn = async (record: EmergencyRecord) => {
      const audits = (await detailOf(record.id)).audit.length;
      const cases: Array<[string, object]> = [
        ['submit-advance-request', { amountVnd: '1000000', signature: SIGNATURE }],
        ['submit-payment-request', { amountVnd: '1000000', signature: SIGNATURE }],
        [
          'submit-acceptance',
          {
            completedDate: vnToday(),
            inspectedAt: new Date().toISOString(),
            inspectionLocation: 'Hầm B1',
            content: 'Kiểm tra kết quả.',
            photoAttachmentIds: [],
          },
        ],
      ];
      for (const [route, body] of cases) {
        const res = await act(bqlA, record, route, body);
        expect([record.status, route, res.status, reasonOf(res)]).toEqual([
          record.status,
          route,
          409,
          'invalid_status_transition',
        ]);
      }
      expect((await detailOf(record.id)).audit).toHaveLength(audits);
    };
    const inProgress = await emergencyRecord();
    await blockedIn(inProgress);
    const waiting = await submit(inProgress);
    expect(waiting.status).not.toBe('EMERGENCY_IN_PROGRESS');
    await blockedIn(waiting);
    const approved = await ok(tvkt, waiting, 'approve-proposal');
    const rejected = await ok(bqt, approved, 'reject-proposal', {
      reason: 'Không chấp nhận chi phí.',
      finalPostReview: true,
      ...(await boardEvidence(approved)),
    });
    await blockedIn(rejected);
  });

  it('AC-E1.6: a later change of the building limit and hours leaves a started emergency as it was', async () => {
    const record = await emergencyRecord();
    const before = (await detailOf(record.id)).record.emergency as Emergency;
    const config = dataOf<Record<string, unknown> & { version: number }>(
      await admin.get(`/api/buildings/${buildingId}/config`),
    );
    await admin
      .put(`/api/buildings/${buildingId}/config`, {
        taskDueDays: config.taskDueDays,
        emergencyLimitVnd: '10000000',
        emergencyDocHours: 48,
        recentRepairDays: config.recentRepairDays,
        repeatMinRecords: config.repeatMinRecords,
        priceRatio: config.priceRatio,
        version: config.version,
      })
      .expect(200);
    const after = (await detailOf(record.id)).record.emergency as Emergency;
    expect(after).toMatchObject({ limitVnd: '15000000', docsDueAt: before.docsDueAt });
  });
});
