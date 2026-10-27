import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorFields, signIn, type Session } from './app-harness';
import { confirmedRecord, readyForConstruction, type FlowRecord, type FlowSessions } from './repair-flow';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-schedule-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC B4-S1 (docs/product/features/B04-lich-sua-chua/SPEC.md): construction schedule read from real data. */

interface Entry {
  record: { id: string; code: string; status: string; emergency: object | null };
  construction: { startDate: string; plannedEndDate: string; completedDate: string | null; progressPercent: number };
  span: { start: string; end: string };
  isLate: boolean;
}

interface Awaiting {
  record: { id: string; code: string; status: string };
  readySince: string | null;
}

interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const shiftDay = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

describe('Construction schedule, B4-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let ktA: Session;
  let tvkt: Session;
  let bqt: Session;
  let buildingId: string;
  let ids: Record<string, string>;
  let secondLocationId: string;
  let sequence = 0;
  const today = vnToday();
  /** Records by role in the suite: running, late, completed (pending acceptance), redo, emergency, ready. */
  const rec: Record<string, FlowRecord> = {};

  const sessions = (): FlowSessions => ({
    manager: bqlA,
    confirmer: (record) => (record.confirmationUserId === ids.TVKT ? tvkt : ktA),
    approvers: () => [tvkt, bqt],
    board: bqt,
  });
  const title = (label: string): string => {
    sequence += 1;
    return `B4 ${label} ${sequence}`;
  };
  const act = async (record: FlowRecord, route: string, body: object): Promise<FlowRecord> =>
    dataOf<FlowRecord>(
      await bqlA.post(`/api/records/${record.id}/${route}`, { version: record.version, ...body }).expect(200),
    );
  const started = async (label: string): Promise<FlowRecord> =>
    act(await readyForConstruction(sessions(), buildingId, title(label)), 'start-construction', {
      startDate: today,
      plannedEndDate: today,
      planNote: 'Thi công ban ngày.',
    });
  /** Arranges the construction dates directly: the API only accepts a start from today. */
  const setDates = (record: FlowRecord, start: string, plannedEnd: string, completed: string | null = null) =>
    dataSource.query(
      'UPDATE repair_constructions SET start_date = $2, planned_end_date = $3, completed_date = $4 WHERE record_id = $1',
      [record.id, start, plannedEnd, completed],
    );

  const schedule = async (session: Session, query = ''): Promise<Page<Entry>> =>
    dataOf<Page<Entry>>(await session.get(`/api/records/schedule?limit=200${query}`).expect(200));
  const awaiting = async (session: Session, query = ''): Promise<Page<Awaiting>> =>
    dataOf<Page<Awaiting>>(await session.get(`/api/records/schedule/awaiting?limit=200${query}`).expect(200));
  const entryOf = (page: Page<Entry>, record: FlowRecord): Entry | undefined =>
    page.data.find((row) => row.record.id === record.id);
  const idsOf = (rows: Array<{ record: { id: string } }>): string[] => rows.map((row) => row.record.id).sort();
  const range = (from: string, to: string): string => `&from=${from}&to=${to}`;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    ktA = await signIn(server, 'kt-a');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    buildingId = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    )?.id as string;
    const reference = dataOf<{
      users: Array<{ id: string; code: string }>;
      locations: Array<{ id: string; buildingId: string }>;
    }>(await bqlA.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
    secondLocationId = reference.locations.filter((row) => row.buildingId === buildingId)[1].id;
    const config = dataOf<{ version: number }>(await admin.get(`/api/buildings/${buildingId}/config`));
    await admin
      .post(`/api/buildings/${buildingId}/config/apply-template`, { templateKey: 'AQUA', version: config.version })
      .expect(201);

    // Running: T-5 → T+1. Late: T-5 → T-3, not completed. Completed: T-5 → T-3, completed T-3, pending acceptance.
    rec.running = await started('đang thi công');
    await setDates(rec.running, shiftDay(today, -5), shiftDay(today, 1));
    await dataSource.query('UPDATE repair_records SET location_id = $2 WHERE id = $1', [
      rec.running.id,
      secondLocationId,
    ]);
    rec.late = await started('trễ');
    await setDates(rec.late, shiftDay(today, -5), shiftDay(today, -3));
    rec.completed = await started('chờ nghiệm thu');
    await setDates(rec.completed, shiftDay(today, -5), shiftDay(today, -3), shiftDay(today, -3));
    await dataSource.query("UPDATE repair_records SET status = 'PENDING_ACCEPTANCE' WHERE id = $1", [rec.completed.id]);
    // Redo after a failed acceptance: planned T-3, completed T-3, "Cần khắc phục".
    rec.redo = await started('cần khắc phục');
    await setDates(rec.redo, shiftDay(today, -5), shiftDay(today, -3), shiftDay(today, -3));
    await dataSource.query("UPDATE repair_records SET status = 'NEEDS_REPAIR' WHERE id = $1", [rec.redo.id]);
    rec.emergency = await act(
      await confirmedRecord(sessions(), buildingId, title('khẩn cấp')),
      'start-emergency-repair',
      {
        reason: 'Vỡ ống cấp nước chính, nước tràn xuống hầm.',
        contractorName: 'Cty TNHH Bình An',
        estimatedAmountVnd: '12500000',
        plannedEndDate: shiftDay(today, 2),
      },
    );
    rec.readyOld = await readyForConstruction(sessions(), buildingId, title('chờ xếp lịch cũ'));
    rec.ready = await readyForConstruction(sessions(), buildingId, title('chờ xếp lịch'));
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('answers on /records/schedule, not as a record id, and bounds the page size', async () => {
    await bqlA.get('/api/records/schedule').expect(200);
    await bqlA.get('/api/records/schedule/awaiting').expect(200);
    expect(errorFields(await bqlA.get('/api/records/schedule?limit=201').expect(400))).toEqual(['limit']);
    expect(errorFields(await bqlA.get('/api/records/schedule?from=2026-13-01').expect(400))).toEqual(['from']);
  });

  it('AC-B4.2: a span crossing two weeks is in both, and in the list filtered from a later day', async () => {
    const earlier = await schedule(bqlA, range(shiftDay(today, -6), shiftDay(today, -4)));
    const later = await schedule(bqlA, range(shiftDay(today, 1), shiftDay(today, 7)));
    expect(entryOf(earlier, rec.running)?.span).toEqual({ start: shiftDay(today, -5), end: shiftDay(today, 1) });
    expect(entryOf(later, rec.running)).toBeDefined();
    expect(entryOf(await schedule(bqlA, `&from=${shiftDay(today, 1)}`), rec.running)).toBeDefined();
    expect(entryOf(await schedule(bqlA, `&from=${shiftDay(today, 2)}`), rec.running)).toBeUndefined();
  });

  it('AC-B4.3: a late construction runs to today with the late flag, and is gone after today', async () => {
    const thisWeek = entryOf(await schedule(bqlA, range(shiftDay(today, -2), today)), rec.late);
    expect(thisWeek).toMatchObject({ span: { start: shiftDay(today, -5), end: today }, isLate: true });
    expect(entryOf(await schedule(bqlA, range(shiftDay(today, 1), shiftDay(today, 7))), rec.late)).toBeUndefined();
  });

  it('AC-B4.4: a completed construction is never late and ends on its completion date', async () => {
    const all = await schedule(bqlA);
    expect(entryOf(all, rec.completed)).toMatchObject({ span: { end: shiftDay(today, -3) }, isLate: false });
    expect(entryOf(await schedule(bqlA, range(shiftDay(today, -2), today)), rec.completed)).toBeUndefined();
  });

  it('AC-B4.5: "Cần khắc phục" runs to today without the late flag', async () => {
    const entry = entryOf(await schedule(bqlA, range(today, today)), rec.redo);
    expect(entry).toMatchObject({ span: { end: today }, isLate: false });
    expect(entry?.record.status).toBe('NEEDS_REPAIR');
  });

  it('AC-B4.8: an emergency started today is on the calendar from today, with its emergency data', async () => {
    const entry = entryOf(await schedule(bqlA, range(today, today)), rec.emergency);
    expect(entry).toMatchObject({ span: { start: today, end: shiftDay(today, 2) }, isLate: false });
    expect(entry?.record.status).toBe('EMERGENCY_IN_PROGRESS');
    expect(entry?.record.emergency).not.toBeNull();
  });

  it('AC-B4.6: the total counts distinct records, ordered by start then code, and pages after sorting', async () => {
    const all = await schedule(bqlA);
    expect(all.meta.total).toBe(5);
    expect(new Set(idsOf(all.data)).size).toBe(5);
    const starts = all.data.map((row) => `${row.span.start} ${row.record.code}`);
    expect(starts).toEqual([...starts].sort());
    const first = dataOf<Page<Entry>>(await bqlA.get('/api/records/schedule?limit=2&page=2').expect(200));
    expect(first.meta).toMatchObject({ total: 5, page: 2, limit: 2, totalPages: 3 });
    expect(first.data.map((row) => row.record.id)).toEqual(all.data.slice(2, 4).map((row) => row.record.id));
  });

  it('AC-B4.7: a ready record is only in "Chờ xếp lịch", oldest first, until its construction starts', async () => {
    const waiting = await awaiting(bqlA);
    expect(waiting.data.map((row) => row.record.id)).toEqual([rec.readyOld.id, rec.ready.id]);
    expect(waiting.data.every((row) => row.readySince !== null)).toBe(true);
    expect(entryOf(await schedule(bqlA), rec.ready)).toBeUndefined();

    rec.ready = await act(rec.ready, 'start-construction', {
      startDate: today,
      plannedEndDate: shiftDay(today, 1),
      planNote: 'Thi công ban ngày.',
    });
    expect(idsOf((await awaiting(bqlA)).data)).toEqual([rec.readyOld.id]);
    expect(entryOf(await schedule(bqlA, range(today, today)), rec.ready)?.span.start).toBe(today);
  });

  it('AC-B4.9: location and status group select what GET /records selects, among the records in range', async () => {
    const window = range(shiftDay(today, -1), today);
    const inRange = idsOf((await schedule(bqlA, window)).data);
    const listed = async (query: string): Promise<string[]> =>
      dataOf<Page<{ id: string }>>(await bqlA.get(`/api/records?limit=100${query}`).expect(200))
        .data.map((row) => row.id)
        .filter((id) => inRange.includes(id))
        .sort();
    for (const query of [
      `&locationId=${secondLocationId}`,
      '&statusGroup=CONSTRUCTION',
      '&statusGroup=NEEDS_ACTION',
      '&statusGroup=ACCEPTANCE',
      `&buildingId=${buildingId}`,
    ]) {
      expect(idsOf((await schedule(bqlA, `${window}${query}`)).data)).toEqual(await listed(query));
    }
    expect(idsOf((await schedule(bqlA, `&locationId=${secondLocationId}`)).data)).toEqual([rec.running.id]);
  });

  it('AC-B4.10: another building scope sees nothing of building A, even when asking for it', async () => {
    expect((await schedule(bqlB)).data.some((row) => Object.values(rec).some((r) => r.id === row.record.id))).toBe(
      false,
    );
    expect((await schedule(bqlB, `&buildingId=${buildingId}`)).meta.total).toBe(0);
    expect((await awaiting(bqlB, `&buildingId=${buildingId}`)).meta.total).toBe(0);
    expect(idsOf((await awaiting(bqlB)).data)).not.toContain(rec.readyOld.id);
  });
});
