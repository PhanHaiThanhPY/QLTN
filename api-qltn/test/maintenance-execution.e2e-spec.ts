import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Clock } from '../src/common/services/clock.service';
import { MaintenanceRemindersService } from '../src/modules/maintenance/maintenance-reminders.service';
import { createApp, dataOf, errorFields, errorOf, signIn, type Session } from './app-harness';
import { PDF, PNG } from './repair-flow';

/** SPEC MT-S3 (docs/product/features/MT-thuc-hien-bao-tri/SPEC.md): running an occurrence. "Now" is pinned. */

interface Entry {
  itemId: string;
  result: string | null;
  value: number | null;
  note: string | null;
  attachmentIds: string[];
}
interface Detail {
  occurrence: {
    id: string;
    code: string;
    status: string;
    version: number;
    round: number;
    scheduledDate: string;
    performerUserId: string;
    reviewDueAt: string | null;
    overdueDays: number;
    rework: Record<string, string>;
    work: { entries: Entry[]; summary: string | null; attachmentIds: string[] };
    checklist: Array<{ id: string; label: string }>;
  };
  submissions: Array<{ round: number; entries: Entry[]; decision: string | null; summary: string }>;
  repairs: Array<{ id: string; code: string; status: string; itemId: string | null; inForce: boolean }>;
}

const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const shift = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
/** 09:00 in Vietnam on a day. */
const at9 = (date: string): Date => new Date(`${date}T09:00:00+07:00`);

const CHECKLIST = [
  { label: 'Vận hành', kind: 'CHECK', required: true },
  { label: 'Rò rỉ', kind: 'CHECK', required: false, photoRequired: true },
  { label: 'Áp suất', kind: 'MEASUREMENT', required: true, unit: 'bar', min: 2, max: 6 },
];

describe('Maintenance execution, MT-S3 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let db: DataSource;
  let clock: Clock;
  let reminders: MaintenanceRemindersService;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let kt1: Session;
  let kt2: Session;
  let ids: Record<string, string>;
  let buildingA: string;
  let pumpRoom: string;
  let seq = 0;
  const T = vnToday();
  /** Every occurrence below is scheduled on S. */
  const S = shift(T, 16);

  const detail = async (id: string, session: Session = kt1): Promise<Detail> =>
    dataOf<Detail>(await session.get(`/api/maintenance-occurrences/${id}`).expect(200));
  const act = (session: Session, id: string, route: string, body: object, status = 200) =>
    session.post(`/api/maintenance-occurrences/${id}/${route}`, body).expect(status);
  const photo = async (occurrenceId: string, name = 'anh.png', content = PNG, type = 'image/png'): Promise<string> =>
    dataOf<{ id: string }>(
      await kt1
        .postMultipart(
          '/api/attachments',
          { subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrenceId, purpose: 'MAINTENANCE_RESULT' },
          { content, filename: name, contentType: type },
        )
        .expect(201),
    ).id;
  const itemId = (d: Detail, label: string): string =>
    d.occurrence.checklist.find((row) => row.label === label)?.id as string;
  const noticeKinds = async (userId: string, occurrenceId: string): Promise<string[]> =>
    (
      await db.query<Array<{ kind: string }>>(
        `SELECT kind FROM notifications WHERE recipient_id = $1 AND subject_id = $2 ORDER BY created_at`,
        [userId, occurrenceId],
      )
    ).map((row) => row.kind);

  /** A running plan with the three items; answers its occurrence on S. */
  const occurrence = async (): Promise<string> => {
    seq += 1;
    const item = dataOf<{ id: string }>(
      await bqlA
        .post('/api/maintenance-items', {
          buildingId: buildingA,
          code: `BOM-E${String(seq).padStart(2, '0')}${Date.now() % 1000}`,
          name: 'Bơm thử MT-S3',
          type: 'Bơm nước',
          locationId: pumpRoom,
          ownerUserId: ids['BQL-A'],
        })
        .expect(201),
    );
    const plan = dataOf<{ id: string; version: number }>(
      await bqlA
        .post('/api/maintenance-plans', {
          itemId: item.id,
          name: 'Kiểm tra bơm',
          unit: 'MONTH',
          every: 1,
          startDate: S,
          performerUserId: ids['KT-A'],
          reviewerUserId: ids['KT-A2'],
          checklist: CHECKLIST,
        })
        .expect(201),
    );
    await bqlA.post(`/api/maintenance-plans/${plan.id}/activate`, { version: plan.version }).expect(200);
    const rows = await db.query<Array<{ id: string }>>(
      `SELECT id FROM maintenance_occurrences WHERE plan_id = $1 AND scheduled_date = $2`,
      [plan.id, S],
    );
    return rows[0].id;
  };

  /** Started occurrence with valid work: Rò rỉ and Áp suất failed, each with note and photo. */
  const filled = async (): Promise<{ id: string; d: Detail }> => {
    const id = await occurrence();
    clock.set(at9(shift(S, -1)));
    let d = await detail(id);
    d = dataOf<Detail>(await act(kt1, id, 'start', { version: d.occurrence.version }));
    const [p1, p2, p3] = [await photo(id), await photo(id), await photo(id)];
    const entries = [
      { itemId: itemId(d, 'Vận hành'), result: 'PASS' },
      { itemId: itemId(d, 'Rò rỉ'), result: 'FAIL', note: 'Có rò tại khớp nối.', attachmentIds: [p1] },
      { itemId: itemId(d, 'Áp suất'), value: 7, note: 'Áp suất cao.', attachmentIds: [p2] },
    ];
    d = dataOf<Detail>(
      await act(kt1, id, 'save', {
        version: d.occurrence.version,
        entries,
        summary: 'Đã kiểm xong lượt.',
        attachmentIds: [p3],
      }),
    );
    return { id, d };
  };
  const submit = async (id: string, d: Detail): Promise<Detail> =>
    dataOf<Detail>(await act(kt1, id, 'submit', { version: d.occurrence.version, entries: [] }));

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    db = app.get(DataSource);
    clock = app.get(Clock);
    reminders = app.get(MaintenanceRemindersService);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    kt1 = await signIn(server, 'kt-a');
    kt2 = await signIn(server, 'kt-a2');
    const reference = dataOf<{
      users: Array<{ id: string; code: string }>;
      locations: Array<{ id: string; buildingId: string; name: string }>;
    }>(await admin.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
    buildingA = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    )?.id as string;
    pumpRoom = reference.locations.find(
      (row) => row.buildingId === buildingA && row.name === 'Phòng bơm & bể nước ngầm',
    )?.id as string;
  });

  afterEach(() => clock.set(null));

  afterAll(async () => {
    await db.query(
      `UPDATE building_configs SET task_due_days = jsonb_set(task_due_days, '{REVIEW_MAINTENANCE}', '2') WHERE building_id = $1`,
      [buildingA],
    );
    await app.close();
  });

  it('AC-MT3.1: starting opens 3 days before the day, for the performer only', async () => {
    const id = await occurrence();
    const { occurrence: occ } = await detail(id);
    clock.set(at9(shift(S, -4)));
    const early = await act(kt1, id, 'start', { version: occ.version }, 409);
    expect(errorOf(early).message).toBe('Chưa đến lúc làm lượt này. Nhờ BQL đổi lịch nếu cần làm sớm.');
    clock.set(at9(shift(S, -3)));
    await act(kt2, id, 'start', { version: occ.version }, 403);
    await act(bqlA, id, 'start', { version: occ.version }, 403);
    expect(dataOf<Detail>(await act(kt1, id, 'start', { version: occ.version })).occurrence.status).toBe('IN_PROGRESS');
  });

  it('AC-MT3.2: a measurement outside the threshold is stored as failed and survives a reload', async () => {
    const id = await occurrence();
    clock.set(at9(S));
    let d = await detail(id);
    d = dataOf<Detail>(await act(kt1, id, 'start', { version: d.occurrence.version }));
    d = dataOf<Detail>(
      await act(kt1, id, 'save', {
        version: d.occurrence.version,
        entries: [{ itemId: itemId(d, 'Áp suất'), result: 'PASS', value: 7 }],
      }),
    );
    const reloaded = await detail(id);
    expect(reloaded.occurrence.work.entries.find((row) => row.itemId === itemId(d, 'Áp suất'))).toMatchObject({
      value: 7,
      result: 'FAIL',
    });
  });

  it('AC-MT3.3 / AC-MT3.4: submission problems are named per item; a valid one waits for review with the building days', async () => {
    await db.query(
      `UPDATE building_configs SET task_due_days = jsonb_set(task_due_days, '{REVIEW_MAINTENANCE}', '3') WHERE building_id = $1`,
      [buildingA],
    );
    const id = await occurrence();
    clock.set(at9(S));
    let d = await detail(id);
    d = dataOf<Detail>(await act(kt1, id, 'start', { version: d.occurrence.version }));
    const pdf = await photo(id, 'bien-ban.pdf', PDF, 'application/pdf');
    const missing = await act(
      kt1,
      id,
      'submit',
      {
        version: d.occurrence.version,
        entries: [
          { itemId: itemId(d, 'Vận hành'), result: 'PASS' },
          { itemId: itemId(d, 'Rò rỉ'), result: 'PASS' },
          { itemId: itemId(d, 'Áp suất'), value: 7, attachmentIds: [pdf] },
        ],
        summary: 'Đã kiểm xong lượt.',
      },
      400,
    );
    expect(errorFields(missing)).toEqual(
      expect.arrayContaining([`entries.${itemId(d, 'Rò rỉ')}`, `entries.${itemId(d, 'Áp suất')}`, 'attachmentIds']),
    );
    const ready = await filled();
    clock.set(at9(shift(S, -1)));
    const submitted = await submit(ready.id, ready.d);
    expect(submitted.occurrence.status).toBe('PENDING_REVIEW');
    expect(submitted.submissions.map((row) => row.round)).toEqual([1]);
    expect(new Date(submitted.occurrence.reviewDueAt as string).toISOString()).toBe(
      new Date(at9(shift(S, 2))).toISOString(),
    );
    expect(await noticeKinds(ids['KT-A2'], ready.id)).toContain('MAINTENANCE_SUBMITTED');
    await db.query(
      `UPDATE building_configs SET task_due_days = jsonb_set(task_due_days, '{REVIEW_MAINTENANCE}', '2') WHERE building_id = $1`,
      [buildingA],
    );
  });

  it('AC-MT3.5 / AC-MT3.6: rework marks items; a second round keeps the first; an old round is a conflict', async () => {
    const { id, d } = await filled();
    let pending = await submit(id, d);
    const pressure = itemId(pending, 'Áp suất');
    await act(
      kt2,
      id,
      'rework',
      { version: pending.occurrence.version, round: 1, reason: 'Kiểm lại giúp.', items: [] },
      400,
    );
    const rework = dataOf<Detail>(
      await act(kt2, id, 'rework', {
        version: pending.occurrence.version,
        round: 1,
        reason: 'Kiểm lại giúp.',
        items: [{ itemId: pressure, reason: 'Đo lại áp suất sau khi xả khí.' }],
      }),
    );
    expect(rework.occurrence.status).toBe('REWORK');
    expect(rework.occurrence.rework).toEqual({ [pressure]: 'Đo lại áp suất sau khi xả khí.' });
    expect(rework.occurrence.work.entries.find((row) => row.itemId === itemId(rework, 'Vận hành'))?.result).toBe(
      'PASS',
    );
    expect(await noticeKinds(ids['KT-A'], id)).toContain('MAINTENANCE_REWORK');
    pending = await submit(id, rework);
    expect(pending.submissions.map((row) => [row.round, row.decision])).toEqual([
      [2, null],
      [1, 'REWORK'],
    ]);
    await act(kt2, id, 'confirm', { version: pending.occurrence.version, round: 1 }, 409);
  });

  it('AC-MT3.7 / AC-MT3.8 / AC-MT3.10 / AC-MT3.11: each failed item needs its record or resolution; condition change kept', async () => {
    const { id, d } = await filled();
    const pending = await submit(id, d);
    const [leak, pressure] = [itemId(pending, 'Rò rỉ'), itemId(pending, 'Áp suất')];
    const refused = await act(kt2, id, 'confirm', { version: pending.occurrence.version, round: 1 }, 400);
    expect(errorFields(refused).sort()).toEqual([`entries.${leak}`, `entries.${pressure}`].sort());

    await act(kt1, id, 'repairs', { version: pending.occurrence.version, itemId: leak }, 403);
    const made = dataOf<{ recordId: string; code: string }>(
      await act(bqlA, id, 'repairs', { version: pending.occurrence.version, itemId: leak }, 201),
    );
    const record = dataOf<{
      record: {
        status: string;
        title: string;
        description: string;
        maintenanceItemId: string;
        attachmentIds: string[];
      };
      sourceOccurrence: { code: string; itemLabel: string };
    }>(await bqlA.get(`/api/records/${made.recordId}`).expect(200));
    expect(record.record).toMatchObject({ status: 'DRAFT', description: 'Có rò tại khớp nối.' });
    expect(record.record.title).toMatch(/: Rò rỉ$/);
    expect(record.record.attachmentIds).toHaveLength(1);
    expect(record.sourceOccurrence).toMatchObject({ code: pending.occurrence.code, itemLabel: 'Rò rỉ' });

    const now = await detail(id);
    await act(bqlA, id, 'repairs', { version: now.occurrence.version, itemId: leak }, 409);
    expect(now.repairs).toEqual([expect.objectContaining({ code: made.code, itemId: leak, inForce: true })]);

    const confirmed = dataOf<Detail>(
      await act(kt2, id, 'confirm', {
        version: now.occurrence.version,
        round: 1,
        resolutions: [{ itemId: pressure, text: 'Đã xả khí, áp suất về 5 bar, theo dõi lượt sau.' }],
        condition: 'NEEDS_ATTENTION',
        conditionNote: 'Theo dõi rò rỉ.',
      }),
    );
    expect(confirmed.occurrence.status).toBe('COMPLETED');
    expect(await noticeKinds(ids['BQL-A'], id)).toContain('MAINTENANCE_COMPLETED');
    const item = dataOf<{ item: { condition: string }; audit: Array<{ action: string; toStatus: string }> }>(
      await bqlA
        .get(
          `/api/maintenance-items/${(await db.query<Array<{ item_id: string }>>(`SELECT item_id FROM maintenance_occurrences WHERE id = $1`, [id]))[0].item_id}`,
        )
        .expect(200),
    );
    expect(item.item.condition).toBe('NEEDS_ATTENTION');
    expect(
      item.audit.some((row) => row.action === 'confirmMaintenanceCondition' && row.toStatus === 'NEEDS_ATTENTION'),
    ).toBe(true);
  });

  it('AC-MT3.9: a record of item A never answers for item B, even after a withdrawn one', async () => {
    const { id, d } = await filled();
    const pending = await submit(id, d);
    const [leak, pressure] = [itemId(pending, 'Rò rỉ'), itemId(pending, 'Áp suất')];
    const first = dataOf<{ recordId: string }>(
      await act(bqlA, id, 'repairs', { version: pending.occurrence.version, itemId: leak }, 201),
    );
    const record = dataOf<{ record: { version: number } }>(await bqlA.get(`/api/records/${first.recordId}`)).record;
    await bqlA
      .post(`/api/records/${first.recordId}/withdraw`, { version: record.version, reason: 'Tạo nhầm, làm lại.' })
      .expect(200);
    let now = await detail(id);
    await act(bqlA, id, 'repairs', { version: now.occurrence.version, itemId: leak }, 201);
    now = await detail(id);
    expect(now.repairs.map((row) => row.inForce)).toEqual([false, true]);
    const refused = await act(kt2, id, 'confirm', { version: now.occurrence.version, round: 1 }, 400);
    expect(errorFields(refused)).toEqual([`entries.${pressure}`]);
  });

  it('AC-MT3.13 / AC-MT3.14: cancel while in progress, never while pending review; reassign keeps the work', async () => {
    const { id, d } = await filled();
    const reassigned = dataOf<Detail>(
      await act(bqlA, id, 'reassign', {
        version: d.occurrence.version,
        slot: 'PERFORMER',
        userId: ids['BQL-A'],
        reason: 'KT-A nghỉ phép tuần này.',
      }),
    );
    expect(reassigned.occurrence.performerUserId).toBe(ids['BQL-A']);
    expect(reassigned.occurrence.work.summary).toBe('Đã kiểm xong lượt.');
    expect(await noticeKinds(ids['BQL-A'], id)).not.toContain('MAINTENANCE_ASSIGNED');
    const same = await act(
      bqlA,
      id,
      'reassign',
      { version: reassigned.occurrence.version, slot: 'REVIEWER', userId: ids['BQL-A'], reason: 'Đổi người xác nhận.' },
      400,
    );
    expect(errorFields(same)).toEqual(['userId']);
    await act(bqlA, id, 'save', { version: reassigned.occurrence.version, entries: [] });

    const other = await filled();
    const pending = await submit(other.id, other.d);
    await bqlA
      .post(`/api/maintenance-occurrences/${other.id}/cancel`, {
        version: pending.occurrence.version,
        reason: 'Thiết bị thay mới.',
      })
      .expect(409);
    const fresh = await filled();
    await bqlA
      .post(`/api/maintenance-occurrences/${fresh.id}/cancel`, {
        version: fresh.d.occurrence.version,
        reason: 'Thiết bị thay mới.',
      })
      .expect(200);
    const cancelled = await detail(fresh.id);
    expect(cancelled.occurrence.status).toBe('CANCELLED');
    expect(cancelled.occurrence.work.summary).toBe('Đã kiểm xong lượt.');
  });

  it('AC-MT3.15: due-today and overdue reminders go out once each, however many runs', async () => {
    const id = await occurrence();
    await reminders.run(new Date(`${S}T00:16:00+07:00`));
    await reminders.run(new Date(`${S}T00:20:00+07:00`));
    expect((await noticeKinds(ids['KT-A'], id)).filter((kind) => kind === 'MAINTENANCE_DUE_TODAY')).toHaveLength(1);
    const nextDay = shift(S, 1);
    clock.set(at9(nextDay));
    expect((await detail(id)).occurrence.overdueDays).toBe(1);
    await Promise.all([
      reminders.run(new Date(`${nextDay}T00:16:00+07:00`)),
      reminders.run(new Date(`${nextDay}T00:16:00+07:00`)),
    ]);
    expect((await noticeKinds(ids['KT-A'], id)).filter((kind) => kind === 'MAINTENANCE_OVERDUE')).toHaveLength(1);
    expect((await noticeKinds(ids['BQL-A'], id)).filter((kind) => kind === 'MAINTENANCE_OVERDUE')).toHaveLength(1);
  });

  it('AC-MT3.16: "Việc của tôi" and the server counts; another building answers 404', async () => {
    const { id, d } = await filled();
    await submit(id, d);
    clock.set(at9(shift(S, -1)));
    const mineKt2 = dataOf<{ rows: Array<{ id: string; status: string }>; counts: { pendingReview: number } }>(
      await kt2.get('/api/maintenance-occurrences?scope=mine').expect(200),
    );
    expect(mineKt2.rows.some((row) => row.id === id)).toBe(true);
    expect(mineKt2.rows.every((row) => row.status === 'PENDING_REVIEW')).toBe(true);
    expect(mineKt2.counts.pendingReview).toBe(mineKt2.rows.length);
    const mineKt1 = dataOf<{ rows: Array<{ performerUserId: string; status: string }> }>(
      await kt1.get('/api/maintenance-occurrences?scope=mine').expect(200),
    );
    expect(mineKt1.rows.every((row) => row.performerUserId === ids['KT-A'] && row.status !== 'COMPLETED')).toBe(true);
    const all = dataOf<{ rows: Array<{ id: string }> }>(
      await bqlB.get('/api/maintenance-occurrences?scope=all').expect(200),
    );
    expect(all.rows.some((row) => row.id === id)).toBe(false);
    await bqlB.get(`/api/maintenance-occurrences/${id}`).expect(404);
  });
});
