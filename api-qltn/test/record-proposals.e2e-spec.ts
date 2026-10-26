import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-proposals-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC B03–B09 v2 slice S2 (docs/product/features/B03-B09-luong-sua-chua/SPEC.md): proposal and approval chain. */

interface Building {
  id: string;
  code: string;
}

interface RecordView {
  id: string;
  status: string;
  version: number;
  buildingId: string;
  confirmationUserId: string;
  approvalStepKeys: string[];
  currentApprovalStepKey: string | null;
  currentSubmissionId: string | null;
  approvedSubmissionId: string | null;
  approvedAmountVnd: string | null;
  executingContractorName: string | null;
}

interface Totals {
  lineTotalsVnd: string[];
  subtotalVnd: string;
  totalVnd: string;
}

interface Submission {
  id: string;
  attemptNo: number;
  proposedAmountVnd: string;
  attachmentIds: string[];
  submittedBy: string;
  content: {
    recipient: string;
    preparedByName: string;
    items: Array<{ name: string; quantity: string }>;
    contractors: Array<{ name: string }>;
    contractorTotals: Totals[];
    proposedContractorIndex: number;
    reviewerUserId: string | null;
  };
  decisions: Array<{
    stepKey: string;
    outcome: string;
    reason: string | null;
    selectedContractorIndex: number | null;
    attachmentIds: string[];
  }>;
  signatures: Array<{ documentType: string; documentId: string; signerId: string; imageDataUrl: string }>;
}

interface AuditRow {
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
}

interface DetailView {
  record: RecordView;
  proposal: { draft: Record<string, unknown> | null; submissions: Submission[] };
  proposalAttachments: Array<{ id: string; purpose: string }>;
  audit: AuditRow[];
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('S2 signature', 'utf8'),
]);
const PDF = Buffer.from('%PDF-1.4\n% S2 proposal file\n', 'utf8');
const SIGNATURE = `data:image/png;base64,${PNG.toString('base64')}`;
const SVG_SIGNATURE = `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`;
const REQUEST_CONTENT = 'Thay đoạn ống cấp nước bị rò ở trần hành lang tầng 3.';
const ASSESSMENT = 'Ống cũ đã mục, sửa vá không bền; đề xuất thay mới cả đoạn.';
const SHORTFALL = 'Chỉ hai nhà thầu gửi báo giá trong thời hạn.';

/** AC-2.1 quotation: 3 items × 3 contractors, line 1 hits the rounding case 1,5 × 333.333 = 499.999,5 → 500.000. */
const ITEMS = [
  { name: 'Ống cấp PPR D25', unit: 'm', quantity: '1.5' },
  { name: 'Van khóa D25', unit: 'cái', quantity: '2' },
  { name: 'Keo dán ống', unit: 'tuýp', quantity: '0.125' },
];
const PRICES = [
  { name: 'Công ty Thủy Tín', unitPricesVnd: ['333333', '1250000', '80000'], otherCostVnd: '100000', taxVnd: '300000' },
  { name: 'Công ty Nam Phát', unitPricesVnd: ['300000', '1200000', '80000'], otherCostVnd: '0', taxVnd: '286000' },
  { name: 'Công ty Minh Long', unitPricesVnd: ['400000', '1000000', '99999'], otherCostVnd: '50000', taxVnd: '261250' },
];
/** Hand-computed: lines are rounded half up per line, then other costs and tax are added. */
const EXPECTED_TOTALS = [
  { lineTotalsVnd: ['500000', '2500000', '10000'], subtotalVnd: '3010000', totalVnd: '3410000' },
  { lineTotalsVnd: ['450000', '2400000', '10000'], subtotalVnd: '2860000', totalVnd: '3146000' },
  { lineTotalsVnd: ['600000', '2000000', '12500'], subtotalVnd: '2612500', totalVnd: '2923750' },
];

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;
const fieldsOf = errorFields;

describe('Repair proposal and approval chain, slice S2 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let ktA: Session;
  let tvkt: Session;
  let bqt: Session;
  let buildingA: Building;
  let tvktId: string;
  let bqtId: string;
  let sequence = 0;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    buildingA = dataOf<Building[]>(await admin.get('/api/buildings')).find((row) => row.code === 'A') as Building;
    const reference = dataOf<{ users: Array<{ id: string; code: string }> }>(await bqlA.get('/api/reference'));
    tvktId = (reference.users.find((row) => row.code === 'TVKT') as { id: string }).id;
    bqtId = (reference.users.find((row) => row.code === 'BQT') as { id: string }).id;
    // SPEC §7: the S2 seed is building A on the AQUA template (INTAKE TVKT, PROPOSAL TVKT → BQT).
    const config = dataOf<{ version: number }>(await admin.get(`/api/buildings/${buildingA.id}/config`));
    await admin
      .post(`/api/buildings/${buildingA.id}/config/apply-template`, { templateKey: 'AQUA', version: config.version })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  const detailOf = async (recordId: string): Promise<DetailView> =>
    dataOf<DetailView>(await bqlA.get(`/api/records/${recordId}`).expect(200));

  const upload = async (session: Session, recordId: string, purpose: string): Promise<string> =>
    dataOf<{ id: string }>(
      await session
        .postMultipart(
          '/api/attachments',
          { subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose },
          purpose === 'SITE_PHOTO'
            ? { content: PNG, filename: 'hien-truong.png', contentType: 'image/png' }
            : { content: PDF, filename: `${purpose.toLowerCase()}.pdf`, contentType: 'application/pdf' },
        )
        .expect(201),
    ).id;

  /** The confirmer session of a record (TVKT on AQUA, KT on the default template). */
  const confirmerOf = (record: RecordView): Session => (record.confirmationUserId === tvktId ? tvkt : ktA);

  /** A record of `buildingId` confirmed as needing repair: PENDING_PROPOSAL. */
  const proposalRecord = async (buildingId = buildingA.id): Promise<RecordView> => {
    sequence += 1;
    const reference = dataOf<{ locations: Array<{ id: string; buildingId: string }> }>(
      await bqlA.get('/api/reference'),
    );
    const locationId = (reference.locations.find((row) => row.buildingId === buildingId) as { id: string }).id;
    const draft = dataOf<RecordView>(
      await bqlA
        .post('/api/records', {
          buildingId,
          locationId,
          title: `S2- Hồ sơ tờ trình ${sequence}`,
          description: 'Ống cấp nước trần hành lang bị rò, nước nhỏ giọt liên tục.',
          noMaintenanceItem: true,
        })
        .expect(201),
    );
    const photoId = await upload(bqlA, draft.id, 'SITE_PHOTO');
    const pending = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photoId] })
        .expect(200),
    );
    const confirmed = dataOf<RecordView>(
      await confirmerOf(pending)
        .post(`/api/records/${pending.id}/confirm-repair`, {
          version: pending.version,
          note: 'Đúng hiện trạng, cần thay ống.',
        })
        .expect(200),
    );
    expect(confirmed.status).toBe('PENDING_PROPOSAL');
    return confirmed;
  };

  /** Complete proposal body with freshly uploaded incident minutes and one quotation per contractor. */
  const proposalBody = async (recordId: string, contractorCount = 3): Promise<Record<string, unknown>> => {
    const incident = await upload(bqlA, recordId, 'INCIDENT_MINUTES');
    const contractors = [];
    for (const contractor of PRICES.slice(0, contractorCount)) {
      contractors.push({ ...contractor, quotationAttachmentIds: [await upload(bqlA, recordId, 'QUOTATION')] });
    }
    return {
      proposalType: 'SUA_CHUA',
      budgetSource: 'KINH_PHI_BAO_TRI',
      requestContent: REQUEST_CONTENT,
      assessment: ASSESSMENT,
      items: ITEMS,
      contractors,
      proposedContractorIndex: 0,
      incidentAttachmentIds: [incident],
      ...(contractorCount < 3 ? { shortfallReason: SHORTFALL } : {}),
    };
  };

  const submit = async (record: RecordView, route = 'submit-proposal', contractorCount = 3): Promise<RecordView> =>
    dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${record.id}/${route}`, {
          version: record.version,
          ...(await proposalBody(record.id, contractorCount)),
          signature: SIGNATURE,
        })
        .expect(200),
    );

  const approve = (session: Session, record: RecordView, body: Record<string, unknown> = {}) =>
    session.post(`/api/records/${record.id}/approve-proposal`, { version: record.version, ...body });

  /** Board decision evidence: minutes uploaded by the BQT holder while the record waits on BQT, plus a signature. */
  const boardEvidence = async (recordId: string): Promise<Record<string, unknown>> => ({
    boardMinutesAttachmentIds: [await upload(bqt, recordId, 'BOARD_MINUTES')],
    signature: SIGNATURE,
  });

  /** Submitted and approved by TVKT: waiting on BQT. */
  const waitingBoard = async (): Promise<RecordView> => {
    const submitted = await submit(await proposalRecord());
    const next = dataOf<RecordView>(await approve(tvkt, submitted).expect(200));
    expect(next.status).toBe('PENDING_BOARD_APPROVAL');
    return next;
  };

  it('T04 saves a partial draft without changing the status, and refuses malformed values', async () => {
    const record = await proposalRecord();
    const saved = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${record.id}/save-proposal-draft`, {
          version: record.version,
          requestContent: 'Nháp',
          items: [{ name: 'Ống', unit: 'm', quantity: '1.5' }],
        })
        .expect(200),
    );
    expect(saved.status).toBe('PENDING_PROPOSAL');
    expect(saved.version).toBe(record.version + 1);
    const draft = (await detailOf(record.id)).proposal.draft;
    expect(draft).toMatchObject({ requestContent: 'Nháp', items: [{ name: 'Ống', unit: 'm', quantity: '1.5' }] });

    const bad = await bqlA
      .post(`/api/records/${record.id}/save-proposal-draft`, {
        version: saved.version,
        items: [{ name: 'Ống', unit: 'm', quantity: '1.2345' }],
        contractors: [{ name: 'NT', unitPricesVnd: ['1.5'], otherCostVnd: '-1', taxVnd: '0' }],
        proposalType: 'XAY_MOI',
      })
      .expect(400);
    expect(fieldsOf(bad)).toEqual(
      expect.arrayContaining([
        'items.0.quantity',
        'contractors.0.unitPricesVnd.0',
        'contractors.0.otherCostVnd',
        'proposalType',
      ]),
    );
  });

  it('AC-2.1: 3 items × 3 contractors, server totals with half-up rounding; submit goes to TVKT', async () => {
    const record = await proposalRecord();
    const body = await proposalBody(record.id);
    // A total sent by the client is ignored (§4.2).
    const contractors = (body.contractors as Array<Record<string, unknown>>).map((row) => ({ ...row, totalVnd: '1' }));
    const submitted = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${record.id}/submit-proposal`, {
          version: record.version,
          ...body,
          contractors,
          signature: SIGNATURE,
        })
        .expect(200),
    );
    expect(submitted.status).toBe('PENDING_TECH_REVIEW');
    expect(submitted.currentApprovalStepKey).toBe('TECH');

    const detail = await detailOf(record.id);
    const [submission] = detail.proposal.submissions;
    expect(submission.attemptNo).toBe(1);
    expect(submission.content.contractorTotals).toEqual(EXPECTED_TOTALS);
    expect(submission.proposedAmountVnd).toBe('3410000');
    expect(submission.content.reviewerUserId).toBe(tvktId);
    expect(submission.content.recipient).toMatch(/^Ban quản trị tòa \S/);
    expect(submission.content.preparedByName).not.toBe('');
    expect(submission.signatures).toEqual([
      expect.objectContaining({ documentType: 'PROPOSAL', documentId: submission.id, imageDataUrl: SIGNATURE }),
    ]);
    expect(detail.proposalAttachments.map((row) => row.purpose).sort()).toEqual([
      'INCIDENT_MINUTES',
      'QUOTATION',
      'QUOTATION',
      'QUOTATION',
    ]);
    expect(detail.audit.find((row) => row.action === 'submitProposal')).toMatchObject({
      fromStatus: 'PENDING_PROPOSAL',
      toStatus: 'PENDING_TECH_REVIEW',
    });
  });

  it('AC-2.2: 2 contractors need a shortfall reason; incident minutes and a PNG signature are required', async () => {
    const record = await proposalRecord();
    const body = await proposalBody(record.id, 2);
    const { shortfallReason: _shortfall, ...withoutReason } = body;
    void _shortfall;
    const noReason = await bqlA
      .post(`/api/records/${record.id}/submit-proposal`, {
        version: record.version,
        ...withoutReason,
        signature: SIGNATURE,
      })
      .expect(400);
    expect(fieldsOf(noReason)).toContain('shortfallReason');

    const noMinutes = await bqlA
      .post(`/api/records/${record.id}/submit-proposal`, {
        version: record.version,
        ...body,
        incidentAttachmentIds: [],
        signature: SIGNATURE,
      })
      .expect(400);
    expect(fieldsOf(noMinutes)).toContain('incidentAttachmentIds');

    const svg = await bqlA
      .post(`/api/records/${record.id}/submit-proposal`, { version: record.version, ...body, signature: SVG_SIGNATURE })
      .expect(400);
    expect(fieldsOf(svg)).toEqual(['signature']);

    // Nothing above persisted: no submission, version unchanged.
    expect((await detailOf(record.id)).proposal.submissions).toHaveLength(0);
    const submitted = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${record.id}/submit-proposal`, { version: record.version, ...body, signature: SIGNATURE })
        .expect(200),
    );
    expect(submitted.status).toBe('PENDING_TECH_REVIEW');
  });

  it('AC-2.3 on a freshly created default-template building: TVKT approves → waiting on BQT; BQT needs minutes and signature', async () => {
    // A new building takes the default template: PROPOSAL chain TVKT → BQT (RM-S2 AC-2.6 / BG-01, behavioural part).
    const created = dataOf<Building>(
      await admin.post('/api/buildings', { code: 'S2N', name: 'Tòa S2 mới', address: 'Thử nghiệm S2' }).expect(201),
    );
    const location = dataOf<{ id: string }>(
      await admin.post(`/api/buildings/${created.id}/locations`, { floor: '1', name: 'Sảnh S2' }).expect(201),
    );
    await dataSource.query(
      `INSERT INTO user_buildings (user_id, building_id)
       SELECT id, $1 FROM users WHERE username IN ('bql-a', 'kt-a', 'tvkt', 'bqt')`,
      [created.id],
    );
    await dataSource.query(
      `INSERT INTO user_locations (user_id, location_id)
       SELECT u.id, $1 FROM users u
       WHERE u.username IN ('bql-a', 'kt-a', 'tvkt', 'bqt')
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id)`,
      [location.id],
    );

    const record = await proposalRecord(created.id);
    expect(record.approvalStepKeys).toEqual(['TECH', 'BOARD']);
    const submitted = await submit(record);
    expect(submitted.status).toBe('PENDING_TECH_REVIEW');
    const waiting = dataOf<RecordView>(await approve(tvkt, submitted).expect(200));
    expect(waiting.status).toBe('PENDING_BOARD_APPROVAL');
    expect(waiting.currentApprovalStepKey).toBe('BOARD');

    const noMinutes = await approve(bqt, waiting, { signature: SIGNATURE }).expect(400);
    expect(fieldsOf(noMinutes)).toContain('boardMinutesAttachmentIds');
    const minutes = await upload(bqt, record.id, 'BOARD_MINUTES');
    const noSignature = await approve(bqt, waiting, { boardMinutesAttachmentIds: [minutes] }).expect(400);
    expect(fieldsOf(noSignature)).toEqual(['signature']);

    const approved = dataOf<RecordView>(
      await approve(bqt, waiting, { boardMinutesAttachmentIds: [minutes], signature: SIGNATURE }).expect(200),
    );
    expect(approved.status).toBe('READY_FOR_CONSTRUCTION');
    expect(approved.currentApprovalStepKey).toBeNull();
    expect(approved.approvedAmountVnd).toBe('3410000');
    expect(approved.executingContractorName).toBe(PRICES[0].name);
    const [submission] = (await detailOf(record.id)).proposal.submissions;
    expect(approved.approvedSubmissionId).toBe(submission.id);
    const board = submission.decisions.find((row) => row.stepKey === 'BOARD');
    expect(board).toMatchObject({ outcome: 'APPROVED', attachmentIds: [minutes], selectedContractorIndex: 0 });
    expect(submission.signatures.map((row) => [row.documentType, row.signerId])).toEqual([
      ['PROPOSAL', submission.submittedBy],
      ['BOARD_DECISION', bqtId],
    ]);
  });

  it('AC-2.4: only the last step picks another contractor, and only with a reason', async () => {
    const submitted = await submit(await proposalRecord());
    const early = await approve(tvkt, submitted, { selectedContractorIndex: 1 }).expect(400);
    expect(fieldsOf(early)).toEqual(['selectedContractorIndex']);
    const waiting = dataOf<RecordView>(await approve(tvkt, submitted).expect(200));

    const evidence = await boardEvidence(waiting.id);
    const noReason = await approve(bqt, waiting, { ...evidence, selectedContractorIndex: 1 }).expect(400);
    expect(fieldsOf(noReason)).toEqual(['selectionReason']);
    const outOfRange = await approve(bqt, waiting, { ...evidence, selectedContractorIndex: 3 }).expect(400);
    expect(fieldsOf(outOfRange)).toEqual(['selectedContractorIndex']);

    const reason = 'Nam Phát bảo hành 24 tháng, thi công ngay.';
    const approved = dataOf<RecordView>(
      await approve(bqt, waiting, { ...evidence, selectedContractorIndex: 1, selectionReason: reason }).expect(200),
    );
    expect(approved.approvedAmountVnd).toBe(EXPECTED_TOTALS[1].totalVnd);
    expect(approved.executingContractorName).toBe(PRICES[1].name);
    const detail = await detailOf(waiting.id);
    expect(
      detail.audit.find((row) => row.action === 'approveProposal' && row.toStatus === 'READY_FOR_CONSTRUCTION')?.reason,
    ).toContain(reason);
    expect(detail.proposal.submissions[0].decisions.at(-1)).toMatchObject({ selectedContractorIndex: 1, reason });
  });

  it('AC-2.5: BQT reject needs minutes; resubmission restarts at step 1 as attempt 2 and keeps attempt 1 intact', async () => {
    const waiting = await waitingBoard();
    const noMinutes = await bqt
      .post(`/api/records/${waiting.id}/reject-proposal`, {
        version: waiting.version,
        reason: 'Giá cao hơn mặt bằng chung.',
        signature: SIGNATURE,
      })
      .expect(400);
    expect(fieldsOf(noMinutes)).toContain('boardMinutesAttachmentIds');
    const rejected = dataOf<RecordView>(
      await bqt
        .post(`/api/records/${waiting.id}/reject-proposal`, {
          version: waiting.version,
          reason: 'Giá cao hơn mặt bằng chung.',
          ...(await boardEvidence(waiting.id)),
        })
        .expect(200),
    );
    expect(rejected.status).toBe('REJECTED_RESUBMITTABLE');
    const before = (await detailOf(waiting.id)).proposal.submissions[0];

    const resubmitted = await submit(rejected, 'resubmit-proposal', 2);
    expect(resubmitted.status).toBe('PENDING_TECH_REVIEW');
    expect(resubmitted.currentApprovalStepKey).toBe('TECH');
    const [first, second] = (await detailOf(waiting.id)).proposal.submissions;
    expect(second.attemptNo).toBe(2);
    expect(second.content.contractors).toHaveLength(2);
    expect(first).toEqual(before);
    expect(first.content.contractorTotals).toEqual(EXPECTED_TOTALS);
    expect(first.decisions.map((row) => [row.stepKey, row.outcome])).toEqual([
      ['TECH', 'APPROVED'],
      ['BOARD', 'REJECTED'],
    ]);
  });

  it('AC-2.6: the third attempt only approves or rejects; its rejection is UNRESOLVED; a 4th submission is refused', async () => {
    const reason = { reason: 'Thiếu bản vẽ hiện trạng.' };
    const first = await submit(await proposalRecord());
    const needsUpdate = dataOf<RecordView>(
      await tvkt
        .post(`/api/records/${first.id}/request-proposal-update`, { version: first.version, ...reason })
        .expect(200),
    );
    expect(needsUpdate.status).toBe('NEEDS_SUBMISSION_UPDATE');
    const second = await submit(needsUpdate, 'resubmit-proposal');
    const rejected = dataOf<RecordView>(
      await tvkt.post(`/api/records/${second.id}/reject-proposal`, { version: second.version, ...reason }).expect(200),
    );
    expect(rejected.status).toBe('REJECTED_RESUBMITTABLE');
    const third = await submit(rejected, 'resubmit-proposal');

    const finalAttempt = await tvkt
      .post(`/api/records/${third.id}/request-proposal-update`, { version: third.version, ...reason })
      .expect(409);
    expect(reasonOf(finalAttempt)).toBe('final_attempt_decide_only');
    const waiting = dataOf<RecordView>(await approve(tvkt, third).expect(200));
    const unresolved = dataOf<RecordView>(
      await bqt
        .post(`/api/records/${waiting.id}/reject-proposal`, {
          version: waiting.version,
          ...reason,
          ...(await boardEvidence(waiting.id)),
        })
        .expect(200),
    );
    expect(unresolved.status).toBe('UNRESOLVED');
    const fourth = await bqlA
      .post(`/api/records/${unresolved.id}/resubmit-proposal`, { version: unresolved.version, signature: SIGNATURE })
      .expect(409);
    expect(reasonOf(fourth)).toBe('invalid_status_transition');

    // Even from a resubmittable status, three attempts is the limit.
    await dataSource.query(`UPDATE repair_records SET status = 'REJECTED_RESUBMITTABLE' WHERE id = $1`, [
      unresolved.id,
    ]);
    const limit = await bqlA
      .post(`/api/records/${unresolved.id}/resubmit-proposal`, { version: unresolved.version, signature: SIGNATURE })
      .expect(409);
    expect(reasonOf(limit)).toBe('max_submission_attempts');
    expect((await detailOf(unresolved.id)).proposal.submissions).toHaveLength(3);
  });

  it('AC-2.7: the BQT holder uploads board minutes while waiting on BQT; TVKT gets 403 attachment_step_denied', async () => {
    const submitted = await submit(await proposalRecord());
    const early = await bqt
      .postMultipart(
        '/api/attachments',
        { subjectType: 'REPAIR_RECORD', subjectId: submitted.id, purpose: 'BOARD_MINUTES' },
        { content: PDF, filename: 'bb.pdf', contentType: 'application/pdf' },
      )
      .expect(403);
    expect(reasonOf(early)).toBe('attachment_step_denied');
    const waiting = dataOf<RecordView>(await approve(tvkt, submitted).expect(200));
    const denied = await tvkt
      .postMultipart(
        '/api/attachments',
        { subjectType: 'REPAIR_RECORD', subjectId: waiting.id, purpose: 'BOARD_MINUTES' },
        { content: PDF, filename: 'bb.pdf', contentType: 'application/pdf' },
      )
      .expect(403);
    expect(reasonOf(denied)).toBe('attachment_step_denied');
    await upload(bqt, waiting.id, 'BOARD_MINUTES');
  });

  it('BR-S2-04/07: invalid chain holder blocks submission; a non-holder is 403, a stale submission 409', async () => {
    const record = await proposalRecord();
    await dataSource.query(
      `UPDATE repair_records SET approval_assignee_user_ids = approval_assignee_user_ids || jsonb_build_object('BOARD', $2::text)
       WHERE id = $1`,
      [record.id, tvktId],
    );
    const body = await proposalBody(record.id);
    const invalid = await bqlA
      .post(`/api/records/${record.id}/submit-proposal`, { version: record.version, ...body, signature: SIGNATURE })
      .expect(400);
    expect(fieldsOf(invalid)).toEqual(['approvalStepKeys.1']);
    await dataSource.query(
      `UPDATE repair_records SET approval_assignee_user_ids = approval_assignee_user_ids || jsonb_build_object('BOARD', $2::text)
       WHERE id = $1`,
      [record.id, bqtId],
    );
    const submitted = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${record.id}/submit-proposal`, { version: record.version, ...body, signature: SIGNATURE })
        .expect(200),
    );

    const notHolder = await approve(bqt, submitted).expect(403);
    expect(reasonOf(notHolder)).toBe('not_step_assignee');
    const stale = await approve(tvkt, submitted, { submissionId: record.id }).expect(409);
    expect(errorOf(stale).code).toBe('CONFLICT');
    await approve(tvkt, submitted, { submissionId: submitted.currentSubmissionId }).expect(200);
  });

  it('AC-0.1: a wrong source status answers 409 invalid_status_transition and writes no audit', async () => {
    const record = await proposalRecord();
    const actionsOf = async (): Promise<string[]> =>
      (await detailOf(record.id)).audit.map((row) => row.action).filter((action) => action !== 'uploadAttachment');
    const auditBefore = (await actionsOf()).length;
    const cases: Array<[Session, string, Record<string, unknown>]> = [
      [tvkt, 'approve-proposal', {}],
      [tvkt, 'request-proposal-update', { reason: 'Không hợp lệ ở đây.' }],
      [tvkt, 'reject-proposal', { reason: 'Không hợp lệ ở đây.' }],
      [bqlA, 'resubmit-proposal', { signature: SIGNATURE }],
    ];
    for (const [session, route, body] of cases) {
      const res = await session
        .post(`/api/records/${record.id}/${route}`, { version: record.version, ...body })
        .expect(409);
      expect(reasonOf(res)).toBe('invalid_status_transition');
    }
    const submitted = await submit(record);
    const auditSubmitted = (await actionsOf()).length;
    for (const [route, body] of [
      ['submit-proposal', { signature: SIGNATURE }],
      ['save-proposal-draft', {}],
    ] as const) {
      const res = await bqlA
        .post(`/api/records/${record.id}/${route}`, { version: submitted.version, ...body })
        .expect(409);
      expect(reasonOf(res)).toBe('invalid_status_transition');
    }
    expect(auditSubmitted).toBe(auditBefore + 1);
    expect(await actionsOf()).toHaveLength(auditSubmitted);
  });

  it('AC-0.2: a record with an old snapshot (holders in legacy columns, no unified map) runs the whole chain', async () => {
    const record = await proposalRecord();
    await dataSource.query(
      `UPDATE repair_records
       SET approval_assignee_user_ids = '{}'::jsonb, consultant_user_id = $2, board_user_id = $3
       WHERE id = $1`,
      [record.id, tvktId, bqtId],
    );
    const submitted = await submit(record);
    const waiting = dataOf<RecordView>(await approve(tvkt, submitted).expect(200));
    expect(waiting.status).toBe('PENDING_BOARD_APPROVAL');
    const approved = dataOf<RecordView>(await approve(bqt, waiting, await boardEvidence(waiting.id)).expect(200));
    expect(approved.status).toBe('READY_FOR_CONSTRUCTION');
  });
});
