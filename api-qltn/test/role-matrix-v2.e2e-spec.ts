import type { NestExpressApplication } from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorOf, type Session, signIn } from './app-harness';

/** SPEC RM-S1 (docs/product/features/RM-ma-tran-quyen-v2/SPEC.md): role matrix v2 on the real API. */
const MIGRATION = path.join(__dirname, '../src/database/migrations/2026-10-26b-role-matrix-v2.sql');

interface Building {
  id: string;
  code: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
  baseRole: string;
  capabilities: string[];
  isSystem: boolean;
  newBaseCapabilities: string[];
}

interface Department {
  id: string;
  code: string;
}

interface Profile {
  capabilities: string[];
}

interface Location {
  id: string;
  version: number;
  isActive: boolean;
}

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;

describe('Role matrix v2, RM-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let ktA: Session;
  let buildingA: Building;
  let departments: Department[];

  const roles = async (): Promise<Role[]> => dataOf<Role[]>(await admin.get('/api/roles').expect(200));
  const departmentId = (code: string): string => (departments.find((row) => row.code === code) as Department).id;

  /** Creates an account in building A and signs it in. */
  const accountWith = async (code: string, roleDefId: string, departmentCode: string): Promise<Session> => {
    const password = `E2e-${code.toLowerCase()}`;
    await admin
      .post('/api/users', {
        code,
        fullName: `Tài khoản ${code}`,
        password,
        roleDefId,
        departmentId: departmentId(departmentCode),
        buildingIds: [buildingA.id],
      })
      .expect(201);
    return signIn(server, code.toLowerCase(), password);
  };

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    departments = dataOf<Department[]>(await admin.get('/api/departments'));
  });

  afterAll(async () => {
    await app.close();
  });

  // F-S2 BR-F2-13 adds EXPLOITATION_CONTRACT_VIEW, F-S3 BR-F3-14 FUND_VIEW and T-S1 BR-T1-12 DEPOSIT_VIEW to RM-S1's 4.
  it('AC-1.2: seeds the Kế toán system role with exactly its capabilities and the KTOAN-A account', async () => {
    const accountant = (await roles()).find((row) => row.code === 'KTOAN') as Role;
    expect(accountant).toMatchObject({ name: 'Kế toán', baseRole: 'ACCOUNTANT', isSystem: true });
    expect([...accountant.capabilities].sort()).toEqual([
      'DEPOSIT_VIEW',
      'EXPLOITATION_CONTRACT_VIEW',
      'FUND_OPERATE',
      'FUND_REPORT',
      'FUND_VIEW',
      'PAYMENT_CONFIRM',
      'REPORT_VIEW',
      'VIEW',
    ]);

    const session = await signIn(server, 'ktoan-a');
    const me = dataOf<Profile>(await session.get('/api/auth/me').expect(200));
    expect(me.capabilities).toContain('PAYMENT_CONFIRM');
  });

  it('AC-1.3: refuses every configuration route to BQL and keeps them open to ADMIN (DF-11)', async () => {
    const config = (path: string) => `/api/buildings/${buildingA.id}${path}`;
    await bqlA.put(config('/config'), {}).expect(403);
    await bqlA.post(config('/config/apply-template'), { templateKey: 'STANDARD', version: 1 }).expect(403);
    await bqlA.put('/api/building-configs/workflow', { targets: [] }).expect(403);
    await bqlA.get('/api/building-configs').expect(403);

    await admin.get('/api/building-configs').expect(200);
    await admin.get(config('/audit')).expect(200);
    const current = dataOf<{ version: number }>(await admin.get(config('/config')).expect(200));
    await admin
      .post(config('/config/apply-template'), { templateKey: 'RESIDENTIAL', version: current.version })
      .expect(201);
  });

  it('AC-1.3 (PD-13): BQL and ADMIN read the building history in scope, out of scope is 404, KT is 403', async () => {
    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    const buildingB = buildings.find((row) => row.code === 'B') as Building;
    const history = (session: Session, building: Building) => session.get(`/api/buildings/${building.id}/audit`);

    const asAdmin = dataOf<{ data: unknown[] }>(await history(admin, buildingA).expect(200));
    const asBql = dataOf<{ data: unknown[] }>(await history(bqlA, buildingA).expect(200));
    expect(asBql.data).toEqual(asAdmin.data);
    const outside = await history(bqlA, buildingB).expect(404);
    expect(errorOf(outside).code).toBe('NOT_FOUND');
    await history(ktA, buildingA).expect(403);
    // Reading the history does not open the configuration itself.
    await bqlA.get(`/api/buildings/${buildingA.id}/config`).expect(403);
  });

  it('AC-1.4: lets BQL create, edit and stop using a location of building A; KT is refused', async () => {
    const locations = `/api/buildings/${buildingA.id}/locations`;
    const created = dataOf<Location>(await bqlA.post(locations, { floor: '9', name: 'Hành lang RM-S1' }).expect(201));
    const renamed = dataOf<Location>(
      await bqlA
        .patch(`${locations}/${created.id}`, { floor: '9', name: 'Sảnh RM-S1', version: created.version })
        .expect(200),
    );
    const off = dataOf<Location>(
      await bqlA.patch(`${locations}/${created.id}/status`, { active: false, version: renamed.version }).expect(200),
    );
    expect(off.isActive).toBe(false);

    await ktA.post(locations, { floor: '9', name: 'Không có quyền' }).expect(403);
  });

  it('AC-1.5: a Kế toán account lists records in scope but cannot create or confirm one', async () => {
    const system = (await roles()).find((row) => row.code === 'KTOAN') as Role;
    const accountant = await accountWith('KTOAN-E2E', system.id, 'KTOAN');

    await accountant.get(`/api/records?buildingId=${buildingA.id}`).expect(200);
    await accountant.post('/api/records', { buildingId: buildingA.id, title: 'Không được tạo' }).expect(403);

    const draft = dataOf<{ id: string; version: number }>(
      await bqlA.post('/api/records', { buildingId: buildingA.id, title: 'RM-S1 hồ sơ thử' }).expect(201),
    );
    const confirm = await accountant
      .post(`/api/records/${draft.id}/confirm-repair`, { version: draft.version, note: 'Không có quyền xác nhận.' })
      .expect(403);
    expect(reasonOf(confirm)).toBe('missing_capability');
  });

  it('AC-1.6: a custom BQT role saved before v2 gains nothing new and lists it; VT-01 drops BUILDING_CONFIG', async () => {
    // A custom role as it was stored under matrix v1, then the migration's backfill run again (idempotent).
    await dataSource.query(
      `INSERT INTO role_definitions (code, name, base_role, capabilities, is_system)
       VALUES ('VT-90', 'BQT trước ma trận v2', 'OWNERS_BOARD', ARRAY['VIEW','PROPOSAL_DECIDE','PAYMENT_DECIDE','REPORT_VIEW'], false)`,
    );
    await dataSource.query(await fs.readFile(MIGRATION, 'utf8'));

    const legacy = (await roles()).find((row) => row.code === 'VT-90') as Role;
    // AUDIT_VIEW (AD-S1) and EXPLOITATION_VIEW (F-S1) are also new to a role saved before they existed, not granted.
    const gained = [
      'RECORD_CONFIRM',
      'ACCEPTANCE_DECIDE',
      'PAYMENT_CONFIRM',
      'AUDIT_VIEW',
      'EXPLOITATION_VIEW',
      'EXPLOITATION_APPROVE',
      'EXPLOITATION_CONTRACT_VIEW',
      'FUND_VIEW',
      'FUND_APPROVE',
      'FUND_REPORT',
      'DEPOSIT_VIEW',
      'DEPOSIT_APPROVE',
    ];
    expect(legacy.newBaseCapabilities).toEqual(gained);
    const holder = await accountWith('BQT-CU', legacy.id, 'BQT');
    const me = dataOf<Profile>(await holder.get('/api/auth/me').expect(200));
    for (const capability of gained) {
      expect(me.capabilities).not.toContain(capability);
    }

    // Saving the role (here without the new capabilities) acknowledges them: the notice disappears.
    const saved = dataOf<Role>(
      await admin
        .patch(`/api/roles/${legacy.id}`, {
          name: legacy.name,
          capabilities: legacy.capabilities,
          version: (legacy as Role & { version: number }).version,
        })
        .expect(200),
    );
    expect(saved.newBaseCapabilities).toEqual([]);

    const vt01 = (await roles()).find((row) => row.code === 'VT-01') as Role;
    expect(vt01.capabilities).not.toContain('BUILDING_CONFIG');
    const staff = await accountWith('BQL-VT01', vt01.id, 'BQL');
    const staffMe = dataOf<Profile>(await staff.get('/api/auth/me').expect(200));
    expect(staffMe.capabilities).not.toContain('BUILDING_CONFIG');
    expect(staffMe.capabilities).toContain('LOCATION_MANAGE');
    await staff.get(`/api/buildings/${buildingA.id}/config`).expect(403);
  });
});
