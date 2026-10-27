import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, signIn, type Session } from './app-harness';
import { confirmedRecord, SIGNATURE, upload, type FlowRecord, type FlowSessions } from './repair-flow';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-tasks-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC TK-S1 (docs/product/features/TK-cong-viec-ca-nhan/SPEC.md): repair tasks of the signed-in person. */

interface Task {
  id: string;
  kind: string;
  label: string;
  tab: string;
  detail: string | null;
  dueAt: string | null;
  isOverdue: boolean;
  record: { id: string; code: string };
}

interface MyTasks {
  today: string;
  open: Task[];
  done: Array<{ label: string; result: string; at: string; record: { id: string } }>;
  counts: { open: number; overdue: number; dueToday: number; done: number };
}

const DAY_MS = 86_400_000;
const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

describe('My repair tasks, TK-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let ktA: Session;
  let ktA2: Session;
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
  const mine = async (session: Session): Promise<MyTasks> =>
    dataOf<MyTasks>(await session.get('/api/me/tasks').expect(200));
  const tasksOn = async (session: Session, record: { id: string }): Promise<Task[]> =>
    (await mine(session)).open.filter((task) => task.record.id === record.id);
  const act = async (session: Session, record: FlowRecord, route: string, body: object = {}): Promise<FlowRecord> =>
    dataOf<FlowRecord>(
      await session.post(`/api/records/${record.id}/${route}`, { version: record.version, ...body }).expect(200),
    );
  const title = (label: string): string => {
    sequence += 1;
    return `TK ${label} ${sequence}`;
  };

  /** A record waiting for its confirmer (KT-A on the default template). */
  const pendingConfirmation = async (): Promise<FlowRecord> => {
    const reference = dataOf<{ locations: Array<{ id: string; buildingId: string }> }>(
      await bqlA.get('/api/reference'),
    );
    const draft = dataOf<FlowRecord>(
      await bqlA
        .post('/api/records', {
          buildingId,
          locationId: (reference.locations.find((row) => row.buildingId === buildingId) as { id: string }).id,
          title: title('chờ xác nhận'),
          description: 'Ống cấp nước trần hành lang bị rò, cần sửa.',
          noMaintenanceItem: true,
        })
        .expect(201),
    );
    return act(bqlA, draft, 'submit', { attachmentIds: [await upload(bqlA, draft.id, 'SITE_PHOTO')] });
  };

  /** A proposal waiting on its first step (TVKT), then BQT. */
  const proposalPending = async (): Promise<FlowRecord> => {
    const record = await confirmedRecord(sessions(), buildingId, title('tờ trình'));
    return act(bqlA, record, 'submit-proposal', {
      proposalType: 'SUA_CHUA',
      budgetSource: 'KINH_PHI_BAO_TRI',
      requestContent: 'Thay đoạn ống cấp nước bị rò.',
      assessment: 'Ống cũ đã mục.',
      items: [{ name: 'Ống cấp', unit: 'm', quantity: '2' }],
      contractors: [
        {
          name: 'Công ty Thủy Tín',
          unitPricesVnd: ['500000'],
          otherCostVnd: '0',
          taxVnd: '0',
          quotationAttachmentIds: [await upload(bqlA, record.id, 'QUOTATION')],
        },
      ],
      proposedContractorIndex: 0,
      shortfallReason: 'Chỉ một nhà thầu nhận việc gấp.',
      incidentAttachmentIds: [await upload(bqlA, record.id, 'INCIDENT_MINUTES')],
      signature: SIGNATURE,
    });
  };

  const approveBoard = async (record: FlowRecord): Promise<FlowRecord> =>
    act(bqt, record, 'approve-proposal', {
      boardMinutesAttachmentIds: [await upload(bqt, record.id, 'BOARD_MINUTES')],
      signature: SIGNATURE,
    });

  const enteredAt = async (record: { id: string }, status: string): Promise<Date> =>
    (
      await dataSource.query<Array<{ at: Date }>>(
        `SELECT max(created_at) AS at FROM audit_events WHERE subject_id = $1 AND to_status = $2 AND from_status IS DISTINCT FROM to_status`,
        [record.id, status],
      )
    )[0].at;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    ktA = await signIn(server, 'kt-a');
    ktA2 = await signIn(server, 'kt-a2');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    ktoan = await signIn(server, 'ktoan-a');
    buildingId = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    )?.id as string;
    const reference = dataOf<{ users: Array<{ id: string; code: string }> }>(await bqlA.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('AC-TK.1 / AC-TK.6 / AC-TK.9: the confirmer alone has "Xác nhận hồ sơ", due from entering the status', async () => {
    const record = await pendingConfirmation();
    const [task] = await tasksOn(ktA, record);
    expect(task).toMatchObject({ kind: 'CONFIRM_RECORD', label: 'Xác nhận hồ sơ', tab: 'overview', isOverdue: false });
    expect(await tasksOn(bqlA, record)).toEqual([]);
    expect(await tasksOn(ktA2, record)).toEqual([]);

    const days = (
      await dataSource.query<Array<{ d: number }>>(
        `SELECT (task_due_days->>'CONFIRM_RECORD')::int AS d FROM repair_records WHERE id = $1`,
        [record.id],
      )
    )[0].d;
    const due = new Date((await enteredAt(record, 'PENDING_CONFIRMATION')).getTime() + days * DAY_MS).toISOString();
    expect(task.dueAt).toBe(due);
    const detail = dataOf<{ record: { dueAt: string; isOverdue: boolean } }>(
      await bqlA.get(`/api/records/${record.id}`).expect(200),
    );
    expect(detail.record).toMatchObject({ dueAt: due, isOverdue: false });
    const list = dataOf<{ data: Array<{ id: string; dueAt: string | null; isOverdue: boolean }> }>(
      await bqlA.get('/api/records?limit=100').expect(200),
    );
    expect(list.data.find((row) => row.id === record.id)).toMatchObject({ dueAt: due, isOverdue: false });

    // Overdue once the deadline has passed: the status entry is moved back past it.
    await dataSource.query(
      `UPDATE audit_events SET created_at = created_at - interval '1 day' * ($2::int + 1) WHERE subject_id = $1 AND to_status = 'PENDING_CONFIRMATION'`,
      [record.id, days],
    );
    const late = (await tasksOn(ktA, record))[0];
    expect(late.isOverdue).toBe(true);
    expect((await mine(ktA)).counts.overdue).toBeGreaterThanOrEqual(1);
    expect(
      dataOf<{ record: { isOverdue: boolean } }>(await bqlA.get(`/api/records/${record.id}`)).record.isOverdue,
    ).toBe(true);
  });

  it('AC-TK.7: a later change of the building due days does not move a sent record', async () => {
    const record = await pendingConfirmation();
    const before = (await tasksOn(ktA, record))[0].dueAt;
    await dataSource.query(
      `UPDATE building_configs SET task_due_days = jsonb_set(task_due_days, '{CONFIRM_RECORD}', '9') WHERE building_id = $1`,
      [buildingId],
    );
    expect((await tasksOn(ktA, record))[0].dueAt).toBe(before);
  });

  it('AC-TK.8 / AC-TK.10: the manager gets "Soạn tờ trình" without deadline; the confirmation shows in "Đã hoàn thành"', async () => {
    const record = await pendingConfirmation();
    const confirmed = await act(ktA, record, 'confirm-repair', { note: 'Đúng hiện trạng.' });
    expect(await tasksOn(ktA, record)).toEqual([]);
    const done = (await mine(ktA)).done.find((row) => row.record.id === record.id);
    expect(done).toMatchObject({ label: 'Xác nhận hồ sơ', result: 'Đã xác nhận cần sửa' });
    const [prepare] = await tasksOn(bqlA, confirmed);
    expect(prepare).toMatchObject({ kind: 'PREPARE_PROPOSAL', label: 'Soạn tờ trình', dueAt: null, isOverdue: false });

    await dataSource.query(
      `UPDATE audit_events SET created_at = now() - interval '31 days' WHERE subject_id = $1 AND action = 'confirmRepair'`,
      [record.id],
    );
    expect((await mine(ktA)).done.some((row) => row.record.id === record.id)).toBe(false);
  });

  it('AC-TK.2: only the current step holder approves; the task moves to BQT after TVKT', async () => {
    let record = await proposalPending();
    expect((await tasksOn(tvkt, record)).map((task) => task.kind)).toEqual(['APPROVE_PROPOSAL']);
    expect(await tasksOn(bqt, record)).toEqual([]);
    record = await act(tvkt, record, 'approve-proposal');
    expect(await tasksOn(tvkt, record)).toEqual([]);
    expect((await tasksOn(bqt, record)).map((task) => task.label)).toEqual(['Duyệt tờ trình']);
  });

  it('AC-TK.3 / AC-TK.4: acceptance members who have not decided, then the advance for its approver and every accountant', async () => {
    let record = await approveBoard(await act(tvkt, await proposalPending(), 'approve-proposal'));
    record = await act(bqlA, record, 'start-construction', {
      startDate: vnToday(),
      plannedEndDate: vnToday(),
      planNote: 'Thi công ban ngày.',
    });
    expect((await tasksOn(bqlA, record)).map((task) => task.label)).toEqual(['Gửi nghiệm thu']);

    // Advance: BQT approves, then every PAYMENT_CONFIRM holder of the building records the transfer.
    record = await act(bqlA, record, 'submit-advance-request', {
      amountVnd: '400000',
      payeeName: 'CONG TY THUY TIN',
      accountNo: '0123456789',
      bankName: 'Vietcombank',
      requestAttachmentIds: [await upload(bqlA, record.id, 'PAYMENT_REQUEST')],
      signature: SIGNATURE,
    });
    expect((await tasksOn(bqt, record)).map((task) => task.kind)).toEqual(['APPROVE_ADVANCE']);
    record = await act(bqt, record, 'approve-advance');
    expect((await tasksOn(ktoan, record)).map((task) => task.kind)).toEqual(['RECORD_ADVANCE_PAYMENT']);
    record = await act(ktoan, record, 'confirm-advance-transfer', {
      amountVnd: '400000',
      transferDate: vnToday(),
      reference: `FT${Date.now()}`,
      proofAttachmentIds: [await upload(ktoan, record.id, 'PAYMENT_PROOF')],
    });
    expect(await tasksOn(ktoan, record)).toEqual([]);

    record = await act(bqlA, record, 'update-construction', { progressPercent: 100, note: 'Hoàn thành.' });
    record = await act(bqlA, record, 'submit-acceptance', {
      completedDate: vnToday(),
      inspectedAt: new Date().toISOString(),
      inspectionLocation: 'Hành lang tầng 3',
      content: 'Kiểm tra đoạn ống mới thay.',
      photoAttachmentIds: [await upload(bqlA, record.id, 'ACCEPTANCE')],
    });
    // Default template: KT (TECH_CONFIRM) and TVKT (TECH) are the members.
    const members = [ktA, tvkt];
    for (const member of members)
      expect((await tasksOn(member, record)).map((task) => task.kind)).toEqual(['REVIEW_ACCEPTANCE']);
    record = await act(ktA, record, 'pass-acceptance', { signature: SIGNATURE });
    expect(await tasksOn(ktA, record)).toEqual([]);
    expect(
      (await mine(ktA)).done.find((row) => row.record.id === record.id && row.label === 'Nghiệm thu')?.result,
    ).toBe('Đạt');
    expect((await tasksOn(tvkt, record)).map((task) => task.kind)).toEqual(['REVIEW_ACCEPTANCE']);
  });

  it('AC-TK.13: another building scope sees none of building A, and nobody can ask for someone else', async () => {
    const record = await pendingConfirmation();
    expect(await tasksOn(bqlB, record)).toEqual([]);
    // There is no parameter for another person: one is simply ignored and the caller still gets their own tasks.
    const asked = dataOf<MyTasks>(await ktA.get(`/api/me/tasks?userId=${ids['BQL-A']}`).expect(200));
    expect(asked.open.map((task) => task.id)).toEqual((await mine(ktA)).open.map((task) => task.id));
    expect(asked.open.some((task) => task.kind === 'PREPARE_PROPOSAL')).toBe(false);
  });

  it('AC-TK.5: a locked BQT holder loses the task and the manager gets one "Cần phân công lại"', async () => {
    const record = await act(tvkt, await proposalPending(), 'approve-proposal');
    // Locked directly: the account form needs every profile field, and only the flag matters here.
    await dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [ids.BQT]);
    try {
      const reassign = (await tasksOn(bqlA, record)).filter((task) => task.kind === 'REASSIGN_REQUIRED');
      expect(reassign).toHaveLength(1);
      expect(reassign[0].label).toBe('Cần phân công lại');
      expect(reassign[0].detail).toMatch(/^Bước BQT duyệt · .+ \(đã khóa\)$/);
    } finally {
      await dataSource.query('UPDATE users SET is_active = true WHERE id = $1', [ids.BQT]);
    }
  });
});
