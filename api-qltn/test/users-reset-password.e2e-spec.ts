import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** US-S1 (docs/product/features/US-quan-tri-tai-khoan/SPEC.md): administrator password reset and account history. */
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '';

interface Building {
  id: string;
  code: string;
}

interface UserRow {
  id: string;
  code: string;
  version: number;
}

interface RoleRow {
  id: string;
  code: string;
  isSystem: boolean;
}

interface AuditRow {
  action: string;
  actorName: string | null;
  reason: string | null;
}

interface Page<T> {
  data: T[];
  meta: { total: number };
}

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;

describe('Account password reset and history, US-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let adminA: Session;
  let bqlA: Session;
  let buildingA: Building;
  let users: UserRow[];

  const login = (username: string, password: string) =>
    request(server).post('/api/auth/login').send({ username, password });

  const userByCode = (code: string): UserRow => users.find((row) => row.code === code) as UserRow;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    users = dataOf<Page<UserRow>>(await admin.get('/api/users?limit=100')).data;

    // An administrator whose scope is building A only, for the out-of-scope case.
    const roles = dataOf<RoleRow[]>(await admin.get('/api/roles'));
    const departments = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/departments'));
    await admin
      .post('/api/users', {
        code: 'ADMIN-A',
        fullName: 'Quản trị Tòa A',
        password: 'E2e-admin-a',
        roleDefId: (roles.find((row) => row.code === 'ADMIN' && row.isSystem) as RoleRow).id,
        departmentId: (departments.find((row) => row.code === 'QTHT') as { id: string }).id,
        buildingIds: [buildingA.id],
      })
      .expect(201);
    adminA = await signIn(server, 'admin-a', 'E2e-admin-a');
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-1: resets another account, signs it out everywhere and records resetPassword', async () => {
    const kt = userByCode('KT-A2');
    const session = (await login('kt-a2', PASSWORD).expect(200)).body as { data: { refreshToken: string } };
    const next = 'Dat-lai-US1-kt';

    await admin.post(`/api/users/${kt.id}/reset-password`, { password: next }).expect(200);

    await request(server).post('/api/auth/refresh').send({ refreshToken: session.data.refreshToken }).expect(401);
    await login('kt-a2', PASSWORD).expect(401);
    await login('kt-a2', next).expect(200);
    const history = dataOf<Page<AuditRow>>(await admin.get(`/api/users/${kt.id}/audit`).expect(200));
    expect(history.data[0]).toMatchObject({ action: 'resetPassword', reason: 'KT-A2' });
    expect(JSON.stringify(history.data)).not.toContain(next);
  });

  it('AC-2: answers 404 outside the scope, 403 without ACCOUNT_MANAGE and 400 on a 7-character password', async () => {
    const ktB = userByCode('KT-B');
    const outside = await adminA.post(`/api/users/${ktB.id}/reset-password`, { password: 'Mat-khau-dai' }).expect(404);
    expect(errorOf(outside).code).toBe('NOT_FOUND');

    const ktA = userByCode('KT-A');
    await bqlA.post(`/api/users/${ktA.id}/reset-password`, { password: 'Mat-khau-dai' }).expect(403);

    const short = await admin.post(`/api/users/${ktA.id}/reset-password`, { password: 'Ngan-7c' }).expect(400);
    expect(errorFields(short)).toEqual(['password']);
    await login('kt-a', PASSWORD).expect(200);
  });

  it('AC-3: refuses a reset of the signed-in account itself and keeps its password', async () => {
    const self = userByCode('ADMIN-DEMO');
    const res = await admin.post(`/api/users/${self.id}/reset-password`, { password: 'Tu-dat-lai-1' }).expect(400);
    expect(reasonOf(res)).toBe('self_reset_denied');
    expect(errorOf(res).message).toBe('Dùng chức năng Đổi mật khẩu cho tài khoản của bạn.');
    await login('admin-demo', PASSWORD).expect(200);
  });

  it('AC-4: the history of a created, updated and reset account lists 3 rows, newest first, with actorName', async () => {
    const roles = dataOf<RoleRow[]>(await admin.get('/api/roles'));
    const departments = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/departments'));
    const body = {
      fullName: 'Ngô Lịch Sử',
      roleDefId: (roles.find((row) => row.code === 'KT' && row.isSystem) as RoleRow).id,
      departmentId: (departments.find((row) => row.code === 'KT') as { id: string }).id,
      buildingIds: [buildingA.id],
    };
    const created = dataOf<UserRow>(
      await admin.post('/api/users', { ...body, code: 'KT-LS', password: 'Lich-su-US1' }).expect(201),
    );
    await admin
      .patch(`/api/users/${created.id}`, { ...body, jobTitle: 'Kỹ thuật viên', version: created.version })
      .expect(200);
    await admin.post(`/api/users/${created.id}/reset-password`, { password: 'Lich-su-US1-b' }).expect(200);

    const history = dataOf<Page<AuditRow>>(await admin.get(`/api/users/${created.id}/audit`).expect(200));
    expect(history.meta.total).toBe(3);
    expect(history.data.map((row) => row.action)).toEqual(['resetPassword', 'updateUser', 'createUser']);
    expect(history.data.every((row) => row.actorName === 'Quản trị demo')).toBe(true);
  });
});
