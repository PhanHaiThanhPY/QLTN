import type { NestExpressApplication } from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import * as path from 'path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** SPEC AD-S1 (docs/product/features/AD-nhat-ky-thao-tac/SPEC.md): operation log, role/department history, health. */

interface Building {
  id: string;
  code: string;
}

interface LogRow {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectCode: string | null;
  buildingId: string | null;
  buildingCode: string | null;
  action: string;
  actorId: string | null;
  actorCode: string | null;
  reason: string | null;
  createdAt: string;
}

interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

const MIGRATION = path.join(__dirname, '../src/database/migrations/2026-10-26e-audit-log.sql');
/** A past day used only by the rows this suite inserts, so filters on it see nothing else. */
const OLD_DAY = '2025-01-15';

describe('Operation log, slice AD-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let bqt: Session;
  let ktA: Session;
  let ktoan: Session;
  let buildings: Building[];
  let bqlAId: string;
  let recordCode: string;
  let roleId: string;
  let departmentId: string;

  const building = (code: string): Building => buildings.find((row) => row.code === code) as Building;
  const log = async (session: Session, query = ''): Promise<Page<LogRow>> =>
    dataOf<Page<LogRow>>(await session.get(`/api/audit-events?limit=100${query}`).expect(200));

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqt = await signIn(server, 'bqt');
    ktA = await signIn(server, 'kt-a');
    ktoan = await signIn(server, 'ktoan-a');
    buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    const reference = dataOf<{
      users: Array<{ id: string; code: string }>;
      locations: Array<{ id: string; buildingId: string }>;
    }>(await bqlA.get('/api/reference'));
    bqlAId = (reference.users.find((row) => row.code === 'BQL-A') as { id: string }).id;
    const locationId = (reference.locations.find((row) => row.buildingId === building('A').id) as { id: string }).id;

    // One change per kind of subject: a record of building A, then system-wide role and department changes.
    recordCode = dataOf<{ code: string }>(
      await bqlA
        .post('/api/records', {
          buildingId: building('A').id,
          locationId,
          title: 'AD-S1 hồ sơ nhật ký',
          description: 'Hồ sơ dùng để kiểm nhật ký thao tác.',
          noMaintenanceItem: true,
        })
        .expect(201),
    ).code;
    roleId = dataOf<{ id: string }>(
      await admin.post('/api/roles', { name: 'AD-S1 vai trò', baseRole: 'BQL' }).expect(201),
    ).id;
    departmentId = dataOf<{ id: string }>(
      await admin
        .post('/api/departments', { code: 'ad-s1', name: 'AD-S1 bộ phận', buildingIds: [building('A').id] })
        .expect(201),
    ).id;
    // A change of building B made by the system (no actor).
    await dataSource.query(
      `INSERT INTO audit_events (subject_type, subject_id, building_id, action, actor_id, reason)
       VALUES ('BUILDING', $1, $1, 'migrateApprovalChain', NULL, 'AD-S1 hệ thống')`,
      [building('B').id],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-1: ADMIN sees building rows in scope plus system-wide rows, newest first', async () => {
    const page = await log(admin);
    const actions = page.data.map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['createRecord', 'createRoleDef', 'createDepartment']));
    expect(page.data.some((row) => row.buildingId === null)).toBe(true);
    const times = page.data.map((row) => Date.parse(row.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('AC-2: BQL sees only its building, never system-wide rows; KT and Kế toán are refused', async () => {
    const own = await log(bqlA);
    expect(own.meta.total).toBeGreaterThan(0);
    expect(own.data.every((row) => row.buildingId === building('A').id)).toBe(true);
    expect((await log(bqlA, `&buildingId=${building('B').id}`)).meta.total).toBe(0);

    const board = await log(bqt);
    const boardScope = dataOf<{ buildingIds: string[] }>(await bqt.get('/api/auth/me')).buildingIds;
    expect(board.data.every((row) => row.buildingId !== null && boardScope.includes(row.buildingId))).toBe(true);

    await ktA.get('/api/audit-events').expect(403);
    await ktoan.get('/api/audit-events').expect(403);
    await ktoan.get('/api/audit-events/export').expect(403);
  });

  it('AC-3: filters by period, actor, subject type, action and subject code; bad ranges answer 400', async () => {
    const byActor = await log(admin, `&actorId=${bqlAId}`);
    expect(byActor.data.length).toBeGreaterThan(0);
    expect(byActor.data.every((row) => row.actorId === bqlAId)).toBe(true);
    const roles = await log(admin, '&subjectType=ROLE');
    expect(roles.data.map((row) => row.subjectId)).toContain(roleId);
    expect(roles.data.every((row) => row.subjectType === 'ROLE')).toBe(true);
    const created = await log(admin, '&action=createRecord');
    expect(created.data.every((row) => row.action === 'createRecord')).toBe(true);
    const byCode = await log(admin, `&subjectCode=${recordCode.toLowerCase()}`);
    expect(byCode.data.length).toBeGreaterThan(0);
    expect(byCode.data.every((row) => row.subjectCode === recordCode)).toBe(true);
    expect((await log(admin, '&dateFrom=2024-01-01&dateTo=2024-01-31')).meta.total).toBe(0);

    const tooLong = await admin.get('/api/audit-events?dateFrom=2025-01-01&dateTo=2026-01-02').expect(400);
    expect(errorFields(tooLong)).toEqual(['dateTo']);
    await admin.get('/api/audit-events?dateFrom=2025-01-01&dateTo=2026-01-01').expect(200);
    await admin.get('/api/audit-events?dateFrom=2026-02-01&dateTo=2026-01-01').expect(400);
    await admin.get('/api/audit-events?limit=101').expect(400);
    await admin.get('/api/audit-events?subjectType=SOMETHING').expect(400);
  });

  it('AC-4: each row carries subject, building and actor codes; a system row has no actor', async () => {
    const page = await log(admin);
    const record = page.data.find((row) => row.action === 'createRecord' && row.subjectCode === recordCode);
    expect(record).toMatchObject({ subjectType: 'REPAIR_RECORD', buildingCode: 'A', actorCode: 'BQL-A' });
    const role = page.data.find((row) => row.subjectId === roleId);
    expect(role).toMatchObject({ subjectType: 'ROLE', buildingCode: null, actorCode: 'ADMIN-DEMO' });
    expect(role?.subjectCode).toMatch(/^VT-\d+$/);
    expect(page.data.find((row) => row.subjectId === departmentId)?.subjectCode).toBe('AD-S1');
    const system = page.data.find((row) => row.reason === 'AD-S1 hệ thống');
    expect(system).toMatchObject({ actorId: null, actorCode: null, buildingCode: 'B', subjectCode: 'B' });
  });

  it('AC-5: CSV export with BOM, header and the same rows as the list; audited; refused above 10 000 rows', async () => {
    const filter = `buildingId=${building('A').id}`;
    const total = (await log(admin, `&${filter}`)).meta.total;
    const res = await admin.getBinary(`/api/audit-events/export?${filter}`).expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/nhat-ky-thao-tac-\d{8}-\d{4}\.csv/);
    const bytes = res.body as Buffer;
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = bytes.subarray(3).toString('utf8').trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Thời điểm,Tòa,Người thực hiện,Loại đối tượng,Mã đối tượng,Hành động,Trạng thái trước,Trạng thái sau,Lý do / ghi chú,correlationId',
    );
    expect(lines).toHaveLength(total + 1);
    expect(lines.some((line) => line.includes('Tạo hồ sơ') && line.includes(recordCode))).toBe(true);

    const exported = (await log(admin, '&action=exportAuditLog')).data;
    expect(exported[0]).toMatchObject({ subjectType: 'ACCOUNT', buildingId: null });
    expect((await log(bqlA, '&action=exportAuditLog')).meta.total).toBe(0);

    await dataSource.query(
      `INSERT INTO audit_events (subject_type, subject_id, building_id, action, actor_id, created_at)
       SELECT 'BUILDING', $1, $1, 'updateBuildingConfig', NULL, $2::timestamptz + n * interval '1 second'
       FROM generate_series(1, 10001) AS n`,
      [building('A').id, `${OLD_DAY}T03:00:00Z`],
    );
    const tooMany = await admin.get(`/api/audit-events/export?dateFrom=${OLD_DAY}&dateTo=${OLD_DAY}`).expect(400);
    expect(errorOf(tooMany).details).toMatchObject({ reason: 'too_many_rows', total: 10001 });
    expect((await log(admin, `&dateFrom=${OLD_DAY}&dateTo=${OLD_DAY}`)).meta.total).toBe(10001);
  });

  it('AC-6: roles and departments write their own subject type, have a history, and old rows are migrated', async () => {
    const roleHistory = dataOf<Page<{ action: string; subjectType: string }>>(
      await admin.get(`/api/roles/${roleId}/audit`).expect(200),
    );
    expect(roleHistory.data).toEqual([expect.objectContaining({ action: 'createRoleDef', subjectType: 'ROLE' })]);
    const departmentHistory = dataOf<Page<{ action: string; subjectType: string }>>(
      await admin.get(`/api/departments/${departmentId}/audit`).expect(200),
    );
    expect(departmentHistory.data).toEqual([
      expect.objectContaining({ action: 'createDepartment', subjectType: 'DEPARTMENT' }),
    ]);
    await bqlA.get(`/api/roles/${roleId}/audit`).expect(403);
    await bqlA.get(`/api/departments/${departmentId}/audit`).expect(403);
    await admin.get(`/api/roles/${bqlAId}/audit`).expect(404);

    // Rows written before AD-S1 used ACCOUNT for roles and departments.
    await dataSource.query(
      `INSERT INTO audit_events (subject_type, subject_id, building_id, action, actor_id)
       VALUES ('ACCOUNT', $1, NULL, 'updateRoleDef', NULL), ('ACCOUNT', $2, NULL, 'updateDepartment', NULL)`,
      [roleId, departmentId],
    );
    const sql = await fs.readFile(MIGRATION, 'utf8');
    const typesOf = async (): Promise<string[]> =>
      (
        await dataSource.query<Array<{ subject_type: string }>>(
          `SELECT subject_type FROM audit_events WHERE subject_id IN ($1, $2) ORDER BY subject_type`,
          [roleId, departmentId],
        )
      ).map((row) => row.subject_type);
    await dataSource.query(sql);
    const once = await typesOf();
    expect(once).toEqual(['DEPARTMENT', 'DEPARTMENT', 'ROLE', 'ROLE']);
    await dataSource.query(sql);
    expect(await typesOf()).toEqual(once);
    // Accounts keep ACCOUNT.
    const [accounts] = await dataSource.query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM audit_events WHERE subject_type = 'ACCOUNT'`,
    );
    expect(accounts.n).toBeGreaterThan(0);
  });

  it('AC-7: health check answers 200 when the database is up and 503 with the same body when it is down', async () => {
    const up = await request(server).get('/api/public/health-check').expect(200);
    expect(dataOf<{ database: string }>(up).database).toBe('up');
    const spy = jest.spyOn(dataSource, 'query').mockRejectedValueOnce(new Error('connection refused'));
    try {
      const down = await request(server).get('/api/public/health-check').expect(503);
      expect(dataOf<{ status: string; database: string }>(down)).toMatchObject({ status: 'ok', database: 'down' });
    } finally {
      spy.mockRestore();
    }
  });
});
