import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { DatabaseSeedService } from '../src/database/seeds/database-seed.service';
import { MaintenanceGenerationService } from '../src/modules/maintenance/maintenance-generation.service';
import { createApp, dataOf, errorFields, errorOf, signIn, type Session } from './app-harness';

/** SPEC MT-S2 (docs/product/features/MT-ke-hoach-bao-tri/SPEC.md): plans and server-side generation. */

interface Plan {
  id: string;
  code: string;
  status: string;
  version: number;
  performerUserId: string;
}

interface Occurrence {
  id: string;
  code: string;
  scheduledDate: string;
  periodDate: string | null;
  status: string;
  isMakeup: boolean;
  scheduleChanged: boolean;
  cancelReason: string | null;
  performerUserId: string;
  version: number;
}

interface Detail {
  plan: Plan;
  versions: Array<{ id: string; effectiveFrom: string; supersededBy: string | null }>;
  occurrences: Occurrence[];
  skipped: string[];
}

const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const shift = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
const addMonths = (date: string, months: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, last))).toISOString().slice(0, 10);
};

const CHECKLIST = [
  { label: 'Vận hành', kind: 'CHECK', required: true },
  { label: 'Rò rỉ', kind: 'CHECK', required: false, photoRequired: true },
  { label: 'Áp suất', kind: 'MEASUREMENT', required: true, unit: 'bar', min: 2, max: 6 },
];

describe('Maintenance plans, MT-S2 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let generation: MaintenanceGenerationService;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let viewer: Session;
  let ids: Record<string, string>;
  let itemId: string;
  const T = vnToday();
  let itemSeq = 0;

  const scheduled = (detail: Detail): Occurrence[] =>
    detail.occurrences
      .filter((row) => row.status === 'SCHEDULED')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const detail = async (plan: { id: string }, session: Session = bqlA): Promise<Detail> =>
    dataOf<Detail>(await session.get(`/api/maintenance-plans/${plan.id}`).expect(200));
  const body = (overrides: Record<string, unknown> = {}) => ({
    itemId,
    name: 'Kiểm tra bơm hằng tháng',
    unit: 'MONTH',
    every: 1,
    startDate: shift(T, 16),
    performerUserId: ids['KT-A'],
    reviewerUserId: ids['KT-A2'],
    contractorName: 'Công ty CP Cơ điện Sao Việt',
    checklist: CHECKLIST,
    ...overrides,
  });
  const create = async (overrides: Record<string, unknown> = {}): Promise<Plan> =>
    dataOf<Plan>(await bqlA.post('/api/maintenance-plans', body(overrides)).expect(201));
  const act = async (plan: Plan, route: string, extra: object = {}, status = 200): Promise<Plan> => {
    const res = await bqlA
      .post(`/api/maintenance-plans/${plan.id}/${route}`, { version: plan.version, ...extra })
      .expect(status);
    return dataOf<Plan>(res);
  };
  const active = async (overrides: Record<string, unknown> = {}): Promise<Plan> =>
    act(await create(overrides), 'activate');
  const occ = async (row: Occurrence, route: string, extra: object = {}, status = 200) =>
    bqlA.post(`/api/maintenance-occurrences/${row.id}/${route}`, { version: row.version, ...extra }).expect(status);
  /** A fresh item per scenario, so plans and the deactivation rule never interfere. */
  const newItem = async (): Promise<string> => {
    itemSeq += 1;
    const reference = dataOf<{ locations: Array<{ id: string; buildingId: string; name: string }> }>(
      await admin.get('/api/reference'),
    );
    const buildingA = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    ) as {
      id: string;
    };
    const location = reference.locations.find(
      (row) => row.buildingId === buildingA.id && row.name === 'Phòng bơm & bể nước ngầm',
    ) as { id: string };
    return dataOf<{ id: string }>(
      await bqlA
        .post('/api/maintenance-items', {
          buildingId: buildingA.id,
          code: `BOM-T${String(itemSeq).padStart(2, '0')}`,
          name: 'Bơm thử MT-S2',
          type: 'Bơm nước',
          locationId: location.id,
          ownerUserId: ids['BQL-A'],
        })
        .expect(201),
    ).id;
  };

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    generation = app.get(MaintenanceGenerationService);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    viewer = await signIn(server, 'ktoan-a');
    const reference = dataOf<{ users: Array<{ id: string; code: string }> }>(await admin.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
  });

  beforeEach(async () => {
    itemId = await newItem();
  });

  afterAll(async () => {
    await app.close();
  });

  it('BR-MT2-10: the demo seed adds six running plans once; a generation run gives them occurrences', async () => {
    const count = async () =>
      Number(
        (
          await dataSource.query<Array<{ count: string }>>(
            `SELECT count(*) FROM maintenance_plans WHERE name LIKE 'Bảo trì định kỳ %'`,
          )
        )[0].count,
      );
    expect(await count()).toBe(6);
    await app.get(DatabaseSeedService).run();
    expect(await count()).toBe(6);
    await generation.runDaily(T);
    const plans = dataOf<Array<{ name: string; status: string; nextDate: string | null }>>(
      await admin.get('/api/maintenance-plans').expect(200),
    );
    const seeded = plans.filter((row) => row.name.startsWith('Bảo trì định kỳ'));
    expect(seeded.every((row) => row.status === 'ACTIVE')).toBe(true);
    expect(seeded.some((row) => row.nextDate)).toBe(true);
  });

  it('AC-MT2.1: a new plan is a draft with a KH code and no occurrence', async () => {
    const plan = await create();
    expect(plan).toMatchObject({ status: 'DRAFT' });
    expect(plan.code).toMatch(/^KH-\d{3,}$/);
    expect((await detail(plan)).occurrences).toEqual([]);
  });

  it('AC-MT2.2: people and checklist rules', async () => {
    const same = await bqlA.post('/api/maintenance-plans', body({ reviewerUserId: ids['KT-A'] })).expect(400);
    expect(errorFields(same)).toEqual(['reviewerUserId']);
    const bqlReviewer = await bqlA.post('/api/maintenance-plans', body({ reviewerUserId: ids['BQL-A'] })).expect(400);
    expect(errorFields(bqlReviewer)).toEqual(['reviewerUserId']);
    const noRequired = await bqlA
      .post('/api/maintenance-plans', body({ checklist: [{ label: 'Vận hành', kind: 'CHECK', required: false }] }))
      .expect(400);
    expect(errorOf(noRequired).message).toBe('Danh mục kiểm cần ít nhất 1 mục bắt buộc.');
    const noUnit = await bqlA
      .post('/api/maintenance-plans', body({ checklist: [{ label: 'Áp suất', kind: 'MEASUREMENT', required: true }] }))
      .expect(400);
    expect(errorOf(noUnit).message).toBe('Mục 1: cần đơn vị.');
  });

  it('AC-MT2.3 / AC-MT2.8: activation generates within 30 days; the daily run adds the next period later', async () => {
    const plan = await active();
    expect(scheduled(await detail(plan)).map((row) => row.scheduledDate)).toEqual([shift(T, 16)]);
    await generation.runDaily(shift(T, 29));
    expect(scheduled(await detail(plan)).map((row) => row.scheduledDate)).toEqual([
      shift(T, 16),
      addMonths(shift(T, 16), 1),
    ]);
  });

  it('AC-MT2.4: a draft whose start has passed cannot be activated until the start is moved', async () => {
    const plan = await create();
    await dataSource.query(
      `UPDATE maintenance_schedule_versions SET effective_from = $2, anchor_date = $2 WHERE plan_id = $1`,
      [plan.id, shift(T, -7)],
    );
    const late = await bqlA.post(`/api/maintenance-plans/${plan.id}/activate`, { version: plan.version }).expect(400);
    expect(errorFields(late)).toEqual(['startDate']);
    const moved = dataOf<Plan>(
      await bqlA
        .patch(`/api/maintenance-plans/${plan.id}`, { version: plan.version, ...body({ startDate: shift(T, 5) }) })
        .expect(200),
    );
    expect((await act(moved, 'activate')).status).toBe('ACTIVE');
  });

  it('AC-MT2.5 / AC-MT2.6: every two weeks; repeated and parallel daily runs add nothing', async () => {
    const plan = await active({ unit: 'WEEK', every: 2, startDate: shift(T, 1) });
    const dates = [shift(T, 1), shift(T, 15), shift(T, 29)];
    expect(scheduled(await detail(plan)).map((row) => row.scheduledDate)).toEqual(dates);
    await generation.runDaily(T);
    await generation.runDaily(T);
    await Promise.all([generation.runDaily(T), generation.runDaily(T)]);
    expect(scheduled(await detail(plan)).map((row) => row.scheduledDate)).toEqual(dates);
  });

  it('AC-MT2.9: a broken plan is logged and never stops the others', async () => {
    const broken = await active({ startDate: shift(T, 2) });
    const healthy = await active({ unit: 'WEEK', every: 1, startDate: shift(T, 1) });
    await dataSource.query(
      `UPDATE maintenance_plans SET building_id = (SELECT id FROM buildings WHERE code = 'B') WHERE id = $1`,
      [broken.id],
    );
    const result = await generation.runDaily(shift(T, 7));
    expect(result.failedPlans).toContain(broken.code);
    expect(scheduled(await detail(healthy)).length).toBeGreaterThan(4);
    await dataSource.query(
      `UPDATE maintenance_plans SET building_id = (SELECT id FROM buildings WHERE code = 'A') WHERE id = $1`,
      [broken.id],
    );
  });

  it('AC-MT2.10: pausing cancels scheduled occurrences; resuming records the skipped periods and starts today', async () => {
    let plan = await active({ unit: 'WEEK', every: 1, startDate: shift(T, 1) });
    plan = await act(plan, 'pause', { reason: 'Chờ thay bơm mới.' });
    const cancelled = (await detail(plan)).occurrences;
    expect(
      cancelled.every(
        (row) => row.status === 'CANCELLED' && row.cancelReason === 'Tạm dừng kế hoạch: Chờ thay bơm mới.',
      ),
    ).toBe(true);
    // 40 days of pause: the schedule and the pause are moved back.
    await dataSource.query(
      `UPDATE maintenance_schedule_versions SET effective_from = $2, anchor_date = $2 WHERE plan_id = $1`,
      [plan.id, shift(T, -60)],
    );
    await dataSource.query(`UPDATE maintenance_plans SET paused_on = $2 WHERE id = $1`, [plan.id, shift(T, -40)]);
    plan = await act(plan, 'resume');
    const after = await detail(plan);
    expect(after.skipped.length).toBeGreaterThanOrEqual(5);
    expect(after.skipped.every((date) => date >= shift(T, -40) && date < T)).toBe(true);
    expect(scheduled(after).every((row) => row.scheduledDate >= T)).toBe(true);
    expect(scheduled(after).length).toBeGreaterThan(0);
  });

  it('AC-MT2.11: ending cancels, cannot resume, and the daily run adds nothing', async () => {
    let plan = await active({ unit: 'WEEK', every: 1, startDate: shift(T, 1) });
    plan = await act(plan, 'end', { reason: 'Thiết bị sẽ thay mới.' });
    expect(scheduled(await detail(plan))).toEqual([]);
    await bqlA.post(`/api/maintenance-plans/${plan.id}/resume`, { version: plan.version }).expect(409);
    await bqlA.post(`/api/maintenance-plans/${plan.id}/activate`, { version: plan.version }).expect(409);
    await generation.runDaily(shift(T, 10));
    expect(scheduled(await detail(plan))).toEqual([]);
  });

  it('AC-MT2.12 / AC-MT2.13: a schedule change flags old occurrences, generates the new ones, and replaces later changes', async () => {
    let plan = await active();
    plan = await act(plan, 'change-schedule', {
      unit: 'WEEK',
      every: 2,
      effectiveFrom: shift(T, 14),
      anchorDate: shift(T, 14),
      reason: 'Nhà cung cấp đổi khuyến nghị.',
    });
    let rows = scheduled(await detail(plan));
    expect(rows.map((row) => [row.scheduledDate, row.scheduleChanged])).toEqual([
      [shift(T, 14), false],
      [shift(T, 16), true],
      [shift(T, 28), false],
    ]);
    const flagged = rows.find((row) => row.scheduleChanged) as Occurrence;
    await occ(flagged, 'keep');
    rows = scheduled(await detail(plan));
    expect(rows.find((row) => row.id === flagged.id)?.scheduleChanged).toBe(false);

    plan = (await detail(plan)).plan;
    plan = await act(plan, 'change-schedule', {
      unit: 'WEEK',
      every: 1,
      effectiveFrom: shift(T, 20),
      anchorDate: shift(T, 20),
      reason: 'Thử lần đổi muộn.',
    });
    plan = await act(plan, 'change-schedule', {
      unit: 'MONTH',
      every: 1,
      effectiveFrom: shift(T, 18),
      anchorDate: shift(T, 18),
      reason: 'Đổi lại sớm hơn.',
    });
    const versions = (await detail(plan)).versions;
    expect(versions.find((row) => row.effectiveFrom === shift(T, 20))?.supersededBy).not.toBeNull();
    const live = scheduled(await detail(plan)).filter(
      (row) => !row.scheduleChanged && row.periodDate && row.periodDate >= shift(T, 18),
    );
    expect(live.map((row) => row.periodDate)).toEqual([shift(T, 18)]);
  });

  it('AC-MT2.14 / AC-MT2.15 / AC-MT2.16: reschedule before the next period, people follow, make-up occurrence', async () => {
    let plan = await active();
    const [first] = scheduled(await detail(plan));
    const moved = dataOf<Occurrence>(
      await occ(first, 'reschedule', { date: shift(T, 19), reason: 'Nhà thầu bận ngày gốc.' }),
    );
    expect(moved).toMatchObject({ scheduledDate: shift(T, 19), periodDate: shift(T, 16) });
    await generation.runDaily(T);
    expect(scheduled(await detail(plan)).filter((row) => row.periodDate === shift(T, 16))).toHaveLength(1);
    const tooLate = await occ(
      moved,
      'reschedule',
      { date: addMonths(shift(T, 16), 1), reason: 'Lùi quá kỳ kế tiếp.' },
      400,
    );
    expect(errorFields(tooLate)).toEqual(['date']);

    plan = dataOf<Plan>(
      await bqlA
        .patch(`/api/maintenance-plans/${plan.id}`, {
          version: plan.version,
          ...body({ performerUserId: ids['BQL-A'] }),
        })
        .expect(200),
    );
    expect(scheduled(await detail(plan)).every((row) => row.performerUserId === ids['BQL-A'])).toBe(true);

    const makeup = dataOf<Occurrence>(
      await bqlA
        .post(`/api/maintenance-plans/${plan.id}/makeup`, {
          version: plan.version,
          date: shift(T, 5),
          reason: 'Kiểm tra thêm sau mưa lớn.',
        })
        .expect(201),
    );
    expect(makeup).toMatchObject({ scheduledDate: shift(T, 5), isMakeup: true, periodDate: null });
  });

  it('AC-MT2.17: an item with a running plan cannot be stopped until the plan ends', async () => {
    let plan = await active();
    const item = dataOf<{ item: { version: number } }>(await bqlA.get(`/api/maintenance-items/${itemId}`)).item;
    const refused = await bqlA
      .post(`/api/maintenance-items/${itemId}/deactivate`, { version: item.version, reason: 'Thay bơm mới.' })
      .expect(409);
    expect(errorOf(refused).message).toContain('Kết thúc các kế hoạch bảo trì của thiết bị trước khi ngừng dùng.');
    expect(errorOf(refused).message).toContain(plan.code);
    plan = await act(plan, 'end', { reason: 'Thay bơm mới.' });
    await bqlA
      .post(`/api/maintenance-items/${itemId}/deactivate`, { version: item.version, reason: 'Thay bơm mới.' })
      .expect(200);
    await bqlA
      .post(`/api/maintenance-plans/${plan.id}/makeup`, {
        version: plan.version,
        date: shift(T, 5),
        reason: 'Không được.',
      })
      .expect(409);
  });

  it('AC-MT2.18: building scope, read-only accounts and the version lock', async () => {
    const plan = await create();
    expect(dataOf<Plan[]>(await bqlB.get('/api/maintenance-plans').expect(200)).some((row) => row.id === plan.id)).toBe(
      false,
    );
    await bqlB.get(`/api/maintenance-plans/${plan.id}`).expect(404);
    expect(
      dataOf<Plan[]>(await viewer.get('/api/maintenance-plans').expect(200)).some((row) => row.id === plan.id),
    ).toBe(true);
    await viewer.post('/api/maintenance-plans', body()).expect(403);
    await viewer.post(`/api/maintenance-plans/${plan.id}/activate`, { version: plan.version }).expect(403);
    await act(plan, 'activate');
    await bqlA
      .post(`/api/maintenance-plans/${plan.id}/pause`, { version: plan.version, reason: 'Phiên bản cũ.' })
      .expect(409);
  });
});
