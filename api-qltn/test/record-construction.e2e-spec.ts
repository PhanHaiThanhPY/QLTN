import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';
import { readyForConstruction, SIGNATURE, upload, type FlowRecord, type FlowSessions } from './repair-flow';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-construction-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC B03–B09 v2 slice S3 (docs/product/features/B03-B09-luong-sua-chua/SPEC.md): construction and acceptance. */

interface Building {
  id: string;
  code: string;
}

interface Decision {
  stepKey: string;
  actorId: string;
  outcome: string;
  note: string | null;
  signatureDataUrl: string | null;
}

interface Round {
  id: string;
  roundNo: number;
  memberStepKeys: string[];
  outcome: string;
  closedAt: string | null;
  content: string;
  decisions: Decision[];
}

interface Detail {
  record: FlowRecord;
  execution: {
    construction: { progressPercent: number; startDate: string; completedDate: string | null } | null;
    acceptances: Round[];
    repairDraft: { note?: string } | null;
  };
  audit: Array<{ action: string }>;
}

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  subjectId: string;
  readAt: string | null;
}

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;
const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

describe('Repair construction and acceptance, slice S3 (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let ktA: Session;
  let ktA2: Session;
  let tvkt: Session;
  let bqt: Session;
  let buildingA: Building;
  let ids: Record<string, string>;
  let sequence = 0;

  const sessions = (): FlowSessions => ({
    manager: bqlA,
    confirmer: (record) => (record.confirmationUserId === ids.TVKT ? tvkt : ktA),
    approvers: () => [tvkt, bqt],
    board: bqt,
  });

  const applyTemplate = async (templateKey: string): Promise<void> => {
    const config = dataOf<{ version: number }>(await admin.get(`/api/buildings/${buildingA.id}/config`));
    await admin
      .post(`/api/buildings/${buildingA.id}/config/apply-template`, { templateKey, version: config.version })
      .expect(201);
  };

  const ready = async (): Promise<FlowRecord> => {
    sequence += 1;
    return readyForConstruction(sessions(), buildingA.id, `S3- Hồ sơ thi công ${sequence}`);
  };

  const detailOf = async (id: string): Promise<Detail> =>
    dataOf<Detail>(await bqlA.get(`/api/records/${id}`).expect(200));

  const act = (session: Session, record: FlowRecord, route: string, body: Record<string, unknown> = {}) =>
    session.post(`/api/records/${record.id}/${route}`, { version: record.version, ...body });

  const start = async (record: FlowRecord): Promise<FlowRecord> =>
    dataOf<FlowRecord>(
      await act(bqlA, record, 'start-construction', {
        startDate: vnToday(),
        plannedEndDate: vnToday(),
        planNote: 'Thi công ban ngày, khóa van tổng 2 giờ.',
      }).expect(200),
    );

  const progress = async (record: FlowRecord, percent: number): Promise<FlowRecord> =>
    dataOf<FlowRecord>(
      await act(bqlA, record, 'update-construction', {
        progressPercent: percent,
        note: `Đạt ${percent}% khối lượng.`,
      }).expect(200),
    );

  const minutes = async (record: FlowRecord): Promise<Record<string, unknown>> => ({
    completedDate: vnToday(),
    inspectedAt: new Date().toISOString(),
    inspectionLocation: 'Hành lang tầng 3',
    content: 'Kiểm tra đoạn ống mới thay và van khóa, chạy thử 30 phút.',
    otherMembers: 'Đại diện cư dân: ông Nguyễn Văn A',
    photoAttachmentIds: [await upload(bqlA, record.id, 'ACCEPTANCE')],
  });

  /** Started, 100 %, minutes submitted: PENDING_ACCEPTANCE. */
  const pendingAcceptance = async (): Promise<FlowRecord> => {
    const record = await progress(await start(await ready()), 100);
    return dataOf<FlowRecord>(await act(bqlA, record, 'submit-acceptance', await minutes(record)).expect(200));
  };

  const decide = (session: Session, record: FlowRecord, route: string, note?: string) =>
    act(session, record, route, { signature: SIGNATURE, ...(note ? { note } : {}) });

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    ktA2 = await signIn(server, 'kt-a2');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    buildingA = dataOf<Building[]>(await admin.get('/api/buildings')).find((row) => row.code === 'A') as Building;
    const reference = dataOf<{ users: Array<{ id: string; code: string }> }>(await bqlA.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
    // SPEC §7: building A on AQUA, whose ACCEPTANCE is now [MANAGER, BOARD, TECH] (ADR-0001 R3).
    await applyTemplate('AQUA');
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('AC-3.1: the plan note is required; starting notifies the BQT and TVKT holders with the contractor', async () => {
    const record = await ready();
    expect(record.status).toBe('READY_FOR_CONSTRUCTION');
    const missing = await act(bqlA, record, 'start-construction', {
      startDate: vnToday(),
      plannedEndDate: vnToday(),
      planNote: '',
    }).expect(400);
    expect(errorFields(missing)).toEqual(['planNote']);
    const inverted = await act(bqlA, record, 'start-construction', {
      startDate: '2026-12-02',
      plannedEndDate: '2026-12-01',
      planNote: 'Kế hoạch hợp lệ.',
    }).expect(400);
    expect(errorFields(inverted)).toEqual(['plannedEndDate']);

    const unreadBefore = dataOf<{ unread: number }>(await bqt.get('/api/notifications/unread-count')).unread;
    const started = await start(record);
    expect(started.status).toBe('IN_CONSTRUCTION');

    for (const session of [bqt, tvkt]) {
      const [latest] = dataOf<{ data: NotificationRow[] }>(await session.get('/api/notifications?limit=5')).data;
      expect(latest).toMatchObject({ kind: 'CONSTRUCTION_PLAN', subjectId: record.id, readAt: null });
      expect(latest.title).toBe(`Kế hoạch thi công ${record.code}`);
      expect(latest.body).toContain('Nhà thầu thực hiện: Công ty Thủy Tín');
    }
    const notice = dataOf<{ data: NotificationRow[] }>(await bqt.get('/api/notifications?limit=1')).data[0];
    expect(dataOf<{ unread: number }>(await bqt.get('/api/notifications/unread-count')).unread).toBe(unreadBefore + 1);
    await tvkt.post(`/api/notifications/${notice.id}/read`, {}).expect(404);
    const read = dataOf<NotificationRow>(await bqt.post(`/api/notifications/${notice.id}/read`, {}).expect(200));
    expect(read.readAt).not.toBeNull();
    expect(dataOf<{ unread: number }>(await bqt.get('/api/notifications/unread-count')).unread).toBe(unreadBefore);
    const own = dataOf<{ data: NotificationRow[] }>(await bqlA.get('/api/notifications')).data;
    expect(own.some((row) => row.subjectId === record.id)).toBe(false);
  });

  it('AC-3.2: submitting acceptance needs 100 %, a valid completion date and a photo; the minutes list BQL, BQT, TVKT', async () => {
    let record = await start(await ready());
    const body = await minutes(record);
    const early = await act(bqlA, record, 'submit-acceptance', body).expect(400);
    expect(errorFields(early)).toEqual(['progressPercent']);
    record = await progress(record, 100);
    const future = await act(bqlA, record, 'submit-acceptance', { ...body, completedDate: '2099-01-01' }).expect(400);
    expect(errorFields(future)).toEqual(['completedDate']);
    const noPhoto = await act(bqlA, record, 'submit-acceptance', { ...body, photoAttachmentIds: [] }).expect(400);
    expect(errorFields(noPhoto)).toEqual(['photoAttachmentIds']);

    record = dataOf<FlowRecord>(await act(bqlA, record, 'submit-acceptance', body).expect(200));
    expect(record.status).toBe('PENDING_ACCEPTANCE');
    const [round] = (await detailOf(record.id)).execution.acceptances;
    expect(round).toMatchObject({ roundNo: 1, memberStepKeys: ['MANAGER', 'BOARD', 'TECH'], outcome: 'PENDING' });
    expect(round.decisions).toEqual([]);
  });

  it('AC-3.3: BQL, BQT and TVKT each pass with a signature; the third closes the minutes and the record moves on', async () => {
    let record = await pendingAcceptance();
    const noSignature = await act(bqlA, record, 'pass-acceptance', {}).expect(400);
    expect(errorFields(noSignature)).toEqual(['signature']);
    expect(reasonOf(await decide(ktA2, record, 'pass-acceptance').expect(403))).toBe('not_step_assignee');

    record = dataOf<FlowRecord>(await decide(bqlA, record, 'pass-acceptance', 'Đường ống kín.').expect(200));
    expect(record.status).toBe('PENDING_ACCEPTANCE');
    record = dataOf<FlowRecord>(await decide(bqt, record, 'pass-acceptance').expect(200));
    expect(record.status).toBe('PENDING_ACCEPTANCE');
    record = dataOf<FlowRecord>(await decide(tvkt, record, 'pass-acceptance').expect(200));
    expect(record.status).toBe('PENDING_PAYMENT_REQUEST');

    const [round] = (await detailOf(record.id)).execution.acceptances;
    expect(round.outcome).toBe('PASSED');
    expect(round.closedAt).not.toBeNull();
    expect(round.decisions.map((row) => [row.stepKey, row.actorId, row.outcome])).toEqual([
      ['MANAGER', ids['BQL-A'], 'PASSED'],
      ['BOARD', ids.BQT, 'PASSED'],
      ['TECH', ids.TVKT, 'PASSED'],
    ]);
    expect(round.decisions.every((row) => row.signatureDataUrl === SIGNATURE)).toBe(true);
  });

  it('AC-3.4: BQT failing after BQL passed sends the record to repair; a new round keeps round 1; no second decision', async () => {
    let record = await pendingAcceptance();
    record = dataOf<FlowRecord>(await decide(bqlA, record, 'pass-acceptance').expect(200));
    const noNote = await decide(bqt, record, 'fail-acceptance').expect(400);
    expect(errorFields(noNote)).toEqual(['note']);
    record = dataOf<FlowRecord>(await decide(bqt, record, 'fail-acceptance', 'Còn rò ở mối nối thứ 2.').expect(200));
    expect(record.status).toBe('NEEDS_REPAIR');
    expect(reasonOf(await decide(tvkt, record, 'pass-acceptance').expect(409))).toBe('invalid_status_transition');
    const roundOne = (await detailOf(record.id)).execution.acceptances[0];
    expect(roundOne.outcome).toBe('FAILED');

    record = dataOf<FlowRecord>(
      await act(bqlA, record, 'save-repair-evidence', { note: 'Đã thay gioăng mối nối thứ 2.' }).expect(200),
    );
    expect((await detailOf(record.id)).execution.repairDraft).toMatchObject({ note: 'Đã thay gioăng mối nối thứ 2.' });
    record = dataOf<FlowRecord>(await act(bqlA, record, 'resubmit-acceptance', await minutes(record)).expect(200));
    expect(record.status).toBe('PENDING_ACCEPTANCE');
    const rounds = (await detailOf(record.id)).execution.acceptances;
    expect(rounds.map((row) => [row.roundNo, row.outcome])).toEqual([
      [1, 'FAILED'],
      [2, 'PENDING'],
    ]);
    expect(rounds[0]).toEqual(roundOne);

    record = dataOf<FlowRecord>(await decide(bqlA, record, 'pass-acceptance').expect(200));
    expect(reasonOf(await decide(bqlA, record, 'pass-acceptance').expect(409))).toBe('step_already_decided');
  });

  it('BR-C-02: an open acceptance member uploads ACCEPTANCE files; someone else cannot', async () => {
    const record = await pendingAcceptance();
    await upload(tvkt, record.id, 'ACCEPTANCE');
    const denied = await ktA2
      .postMultipart(
        '/api/attachments',
        { subjectType: 'REPAIR_RECORD', subjectId: record.id, purpose: 'ACCEPTANCE' },
        {
          content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
          filename: 'x.png',
          contentType: 'image/png',
        },
      )
      .expect(403);
    expect(reasonOf(denied)).toBe('attachment_step_denied');
  });

  it('AC-0.1: a wrong source status answers 409 invalid_status_transition and writes no audit', async () => {
    const record = await ready();
    const before = (await detailOf(record.id)).audit.length;
    const acceptanceBody = {
      completedDate: vnToday(),
      inspectedAt: new Date().toISOString(),
      inspectionLocation: 'Hành lang tầng 3',
      content: 'Nội dung nghiệm thu đủ dài.',
      photoAttachmentIds: [],
    };
    const cases: Array<[Session, string, Record<string, unknown>]> = [
      [bqlA, 'update-construction', { progressPercent: 10, note: 'Không hợp lệ ở đây.' }],
      [bqlA, 'submit-acceptance', acceptanceBody],
      [bqlA, 'save-repair-evidence', { note: 'Không hợp lệ ở đây.' }],
      [bqlA, 'resubmit-acceptance', acceptanceBody],
      [tvkt, 'pass-acceptance', { signature: SIGNATURE }],
      [tvkt, 'fail-acceptance', { signature: SIGNATURE, note: 'Không hợp lệ ở đây.' }],
    ];
    for (const [session, route, body] of cases) {
      const res = await act(session, record, route, body);
      expect([route, res.status, reasonOf(res)]).toEqual([route, 409, 'invalid_status_transition']);
    }
    expect((await detailOf(record.id)).audit).toHaveLength(before);
  });

  it('AC-0.2: a record with an old snapshot (ACCEPTANCE [BOARD, TECH], legacy holder columns) completes acceptance', async () => {
    let record = await progress(await start(await ready()), 100);
    await dataSource.query(
      `UPDATE repair_records
       SET workflow_stage_approval_step_keys = jsonb_set(workflow_stage_approval_step_keys, '{ACCEPTANCE}', '["BOARD","TECH"]'),
           approval_assignee_user_ids = '{}'::jsonb, consultant_user_id = $2, board_user_id = $3
       WHERE id = $1`,
      [record.id, ids.TVKT, ids.BQT],
    );
    record = dataOf<FlowRecord>(await act(bqlA, record, 'submit-acceptance', await minutes(record)).expect(200));
    expect((await detailOf(record.id)).execution.acceptances[0].memberStepKeys).toEqual(['BOARD', 'TECH']);
    expect(reasonOf(await decide(bqlA, record, 'pass-acceptance').expect(403))).toBe('not_step_assignee');
    record = dataOf<FlowRecord>(await decide(bqt, record, 'pass-acceptance').expect(200));
    record = dataOf<FlowRecord>(await decide(tvkt, record, 'pass-acceptance').expect(200));
    expect(record.status).toBe('PENDING_PAYMENT_REQUEST');
  });

  it('AC-3.5: on a STANDARD building, KT and TVKT decide in parallel and both must pass', async () => {
    await applyTemplate('STANDARD');
    try {
      let record = await pendingAcceptance();
      expect((await detailOf(record.id)).execution.acceptances[0].memberStepKeys).toEqual(['TECH_CONFIRM', 'TECH']);
      record = dataOf<FlowRecord>(await decide(tvkt, record, 'pass-acceptance').expect(200));
      expect(record.status).toBe('PENDING_ACCEPTANCE');
      record = dataOf<FlowRecord>(await decide(ktA, record, 'pass-acceptance').expect(200));
      expect(record.status).toBe('PENDING_PAYMENT_REQUEST');
    } finally {
      await applyTemplate('AQUA');
    }
  });
});
