import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

interface Building {
  id: string;
  code: string;
  version: number;
}
interface Location {
  id: string;
  name: string;
  floor: string;
  isActive: boolean;
  version: number;
}
interface Role {
  id: string;
  code: string;
  baseRole: string;
  isSystem: boolean;
  capabilities: string[];
  version: number;
}
interface Department {
  id: string;
  code: string;
  buildingIds: string[];
  version: number;
}
interface Config {
  buildingId: string;
  version: number;
  emergencyLimitVnd: string;
  approvalStepKeys: string[];
  assignmentRules: Array<{ departmentId: string; role: string; priority: number }>;
  taskDueDays: Record<string, number>;
  workflowApprovalSteps: Array<{ key: string }>;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
}
interface Profile {
  id: string;
  capabilities: string[];
  buildingIds: string[];
  version: number;
}

/** Body for PUT /config built from the current config (scalar fields must always be sent). */
const configBody = (config: Config, overrides: Record<string, unknown> = {}) => ({
  taskDueDays: config.taskDueDays,
  emergencyLimitVnd: config.emergencyLimitVnd,
  emergencyDocHours: config.emergencyDocHours,
  recentRepairDays: config.recentRepairDays,
  repeatMinRecords: config.repeatMinRecords,
  priceRatio: config.priceRatio,
  version: config.version,
  ...overrides,
});

describe('Catalog & administration (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let ktA: Session;
  let buildingA: Building;
  let roles: Role[];
  let departments: Department[];

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    buildingA = dataOf<Building[]>(await bqlA.get('/api/buildings'))[0];
    roles = dataOf<Role[]>(await admin.get('/api/roles'));
    departments = dataOf<Department[]>(await admin.get('/api/departments'));
  });

  afterAll(async () => {
    await app.close();
  });

  const role = (code: string) => {
    const found = roles.find((r) => r.code === code);
    if (!found) throw new Error(`role ${code} missing`);
    return found;
  };
  const department = (code: string) => {
    const found = departments.find((d) => d.code === code);
    if (!found) throw new Error(`department ${code} missing`);
    return found;
  };

  describe('reference data', () => {
    it('limits buildings, locations and users to the viewer scope', async () => {
      const ref = dataOf<{
        buildings: Building[];
        locations: Array<{ buildingId: string }>;
        users: Array<{ code: string }>;
      }>(await bqlA.get('/api/reference').expect(200));
      expect(ref.buildings.map((b) => b.code)).toEqual(['A']);
      expect(ref.locations).toHaveLength(7);
      expect(ref.locations.every((l) => l.buildingId === buildingA.id)).toBe(true);
      expect(ref.users.map((u) => u.code)).not.toContain('BQL-B');
      expect(ref.users.map((u) => u.code)).toContain('TVKT');
    });

    it('seeds the system roles and the VT-01 custom role', () => {
      expect(roles.filter((r) => r.isSystem).map((r) => r.code)).toEqual(['ADMIN', 'BQL', 'BQT', 'KT', 'TVKT']);
      expect(role('VT-01').capabilities).not.toContain('EMERGENCY_START');
    });
  });

  describe('roles', () => {
    it('creates a narrowed custom role with the next VT code', async () => {
      const res = await admin
        .post('/api/roles', {
          name: 'Kỹ thuật chỉ nghiệm thu',
          baseRole: 'TECH_CONFIRMER',
          capabilities: ['ACCEPTANCE_DECIDE'],
        })
        .expect(201);
      const created = dataOf<Role>(res);
      expect(created.code).toBe('VT-02');
      expect(created.capabilities).toEqual(['VIEW', 'ACCEPTANCE_DECIDE']);
      roles.push(created);
    });

    it('refuses to grant a capability outside the base role', async () => {
      const res = await admin
        .post('/api/roles', { name: 'BQL duyệt chi', baseRole: 'BQL', capabilities: ['PAYMENT_DECIDE'] })
        .expect(400);
      expect(errorFields(res)).toEqual(['capabilities']);
    });

    it('rejects duplicate names case-insensitively and non-admin callers', async () => {
      await admin.post('/api/roles', { name: 'kỹ thuật CHỈ nghiệm thu', baseRole: 'TECH_CONFIRMER' }).expect(400);
      const res = await bqlA.post('/api/roles', { name: 'Không được', baseRole: 'BQL' }).expect(403);
      expect(errorOf(res).code).toBe('FORBIDDEN');
    });

    it('enforces the optimistic lock and protects system roles', async () => {
      const custom = role('VT-02');
      await admin
        .patch(`/api/roles/${custom.id}`, { name: 'KT nghiệm thu', capabilities: [], version: 99 })
        .expect(409);
      const ok = await admin
        .patch(`/api/roles/${custom.id}`, { name: 'KT nghiệm thu', capabilities: ['ACCEPTANCE_DECIDE'], version: 1 })
        .expect(200);
      expect(dataOf<Role>(ok).version).toBe(2);
      await admin
        .patch(`/api/roles/${role('BQL').id}`, { name: 'Ban quản lý 2', capabilities: ['VIEW'], version: 1 })
        .expect(400);
    });
  });

  describe('accounts', () => {
    let created: Profile;

    it('creates an account whose effective capabilities follow its custom role', async () => {
      const res = await admin
        .post('/api/users', {
          code: 'bql-a3',
          fullName: 'Ngô Minh Châu',
          password: 'Mat-khau-moi-1',
          roleDefId: role('VT-01').id,
          departmentId: department('BQL').id,
          buildingIds: [buildingA.id],
        })
        .expect(201);
      created = dataOf<Profile>(res);
      const session = await signIn(server, 'bql-a3', 'Mat-khau-moi-1');
      const me = dataOf<Profile>(await session.get('/api/auth/me'));
      expect(me.capabilities).toContain('RECORD_EDIT');
      expect(me.capabilities).not.toContain('EMERGENCY_START');
      expect(me.buildingIds).toEqual([buildingA.id]);
    });

    it('validates scope, department coverage and location ownership', async () => {
      const ref = dataOf<{ locations: Array<{ id: string; buildingId: string }> }>(await admin.get('/api/reference'));
      const otherLocation = ref.locations.find((l) => l.buildingId !== buildingA.id);
      const res = await admin
        .post('/api/users', {
          code: 'X-1',
          fullName: 'Thử Nghiệm',
          password: 'Mat-khau-moi-1',
          roleDefId: role('BQL').id,
          buildingIds: [buildingA.id],
          locationIds: [otherLocation?.id],
        })
        .expect(400);
      expect(errorFields(res)).toEqual(expect.arrayContaining(['departmentId']));
      const second = await admin
        .post('/api/users', {
          code: 'X-2',
          fullName: 'Thử Nghiệm',
          password: 'Mat-khau-moi-1',
          roleDefId: role('BQL').id,
          departmentId: department('BQL').id,
          buildingIds: [buildingA.id],
          locationIds: [otherLocation?.id],
        })
        .expect(400);
      expect(errorFields(second)).toEqual(['locationIds']);
    });

    it('refuses to change the system role and to deactivate oneself', async () => {
      const res = await admin
        .patch(`/api/users/${created.id}`, {
          fullName: 'Ngô Minh Châu',
          roleDefId: role('KT').id,
          buildingIds: [buildingA.id],
          version: created.version,
        })
        .expect(400);
      expect(errorFields(res)).toEqual(['roleDefId']);
      const me = dataOf<Profile>(await admin.get('/api/auth/me'));
      const self = await admin
        .patch(`/api/users/${me.id}`, {
          fullName: 'Quản trị demo',
          roleDefId: role('ADMIN').id,
          buildingIds: me.buildingIds,
          active: false,
          version: me.version,
        })
        .expect(400);
      expect(errorFields(self)).toEqual(['active']);
    });

    it('deactivation signs the account out immediately and blocks login', async () => {
      const session = await signIn(server, 'bql-a3', 'Mat-khau-moi-1');
      await admin
        .patch(`/api/users/${created.id}`, {
          fullName: 'Ngô Minh Châu',
          roleDefId: role('VT-01').id,
          buildingIds: [buildingA.id],
          active: false,
          version: created.version,
        })
        .expect(200);
      await session.get('/api/auth/me').expect(401);
      const history = dataOf<{ data: Array<{ action: string }> }>(
        await admin.get(`/api/users/${created.id}/audit`),
      ).data;
      expect(history.map((e) => e.action)).toEqual(['deactivateUser', 'createUser']);
    });

    it('lists accounts for administrators only', async () => {
      const page = dataOf<{ data: Array<{ code: string }>; meta: { total: number } }>(
        await admin.get('/api/users?role=TECH_CONFIRMER&limit=2').expect(200),
      );
      expect(page.data).toHaveLength(2);
      expect(page.meta.total).toBe(4);
      await bqlA.get('/api/users').expect(403);
    });

    it('changes the own password and revokes other sessions', async () => {
      const kt = await signIn(server, 'kt-a2');
      await kt.post('/api/auth/change-password', { currentPassword: 'sai', newPassword: 'Mat-khau-kt-a2' }).expect(400);
      await kt
        .post('/api/auth/change-password', {
          currentPassword: process.env.SEED_DEMO_PASSWORD,
          newPassword: 'Mat-khau-kt-a2',
        })
        .expect(200);
      await signIn(server, 'kt-a2', 'Mat-khau-kt-a2');
    });
  });

  describe('departments', () => {
    it('cannot shrink below the buildings of its members', async () => {
      const kt = department('KT');
      const res = await admin
        .patch(`/api/departments/${kt.id}`, {
          code: 'KT',
          name: 'Kỹ thuật',
          buildingIds: [buildingA.id],
          version: kt.version,
        })
        .expect(400);
      expect(errorFields(res)).toEqual(['buildingIds']);
    });

    it('creates a department in scope', async () => {
      const res = await admin
        .post('/api/departments', { code: 'an-ninh', name: 'An ninh', buildingIds: [buildingA.id] })
        .expect(201);
      expect(dataOf<Department>(res).code).toBe('AN-NINH');
    });
  });

  describe('buildings & locations', () => {
    let buildingE: Building;

    it('creates a building from a template inside the creator scope only', async () => {
      buildingE = dataOf<Building>(
        await admin
          .post('/api/buildings', {
            code: 'e',
            name: 'Tòa E – Đông Á Tower',
            address: '1 Lê Duẩn, Quận 1',
            templateKey: 'OFFICE',
          })
          .expect(201),
      );
      expect(buildingE.code).toBe('E');
      const config = dataOf<Config>(await admin.get(`/api/buildings/${buildingE.id}/config`).expect(200));
      expect(config.emergencyLimitVnd).toBe('50000000');
      expect(config.assignmentRules).toEqual([]);
      await bqlA.get(`/api/buildings/${buildingE.id}`).expect(404);
    });

    it('manages locations with unique names per floor and optimistic locking', async () => {
      const created = dataOf<Location>(
        await bqlA
          .post(`/api/buildings/${buildingA.id}/locations`, { floor: '7', name: 'Hành lang tầng 7' })
          .expect(201),
      );
      await bqlA.post(`/api/buildings/${buildingA.id}/locations`, { floor: '7', name: 'hành lang TẦNG 7' }).expect(400);
      await bqlA
        .patch(`/api/buildings/${buildingA.id}/locations/${created.id}`, {
          floor: '7',
          name: 'Sảnh tầng 7',
          version: 5,
        })
        .expect(409);
      const off = dataOf<Location>(
        await bqlA
          .patch(`/api/buildings/${buildingA.id}/locations/${created.id}/status`, { active: false, version: 1 })
          .expect(200),
      );
      expect(off.isActive).toBe(false);
      const active = dataOf<Location[]>(
        await bqlA.get(`/api/buildings/${buildingA.id}/locations?includeInactive=false`),
      );
      expect(active.map((l) => l.id)).not.toContain(created.id);
      await ktA.post(`/api/buildings/${buildingA.id}/locations`, { floor: '8', name: 'Không có quyền' }).expect(403);
    });
  });

  describe('building configuration', () => {
    const configOf = async (session: Session, buildingId: string) =>
      dataOf<Config>(await session.get(`/api/buildings/${buildingId}/config`).expect(200));

    it('is hidden from roles without BUILDING_CONFIG', async () => {
      await ktA.get(`/api/buildings/${buildingA.id}/config`).expect(403);
    });

    it('saves a change, reports it and writes the audit reason', async () => {
      const config = await configOf(bqlA, buildingA.id);
      expect(config.approvalStepKeys).toEqual(['TECH', 'BOARD']);
      const res = await bqlA
        .put(`/api/buildings/${buildingA.id}/config`, configBody(config, { emergencyLimitVnd: '25000000' }))
        .expect(200);
      const result = dataOf<{ config: Config; changes: Array<{ label: string }> }>(res);
      expect(result.config.version).toBe(config.version + 1);
      expect(result.changes.map((c) => c.label)).toEqual(['Hạn mức sửa chữa khẩn cấp']);
      const audit = dataOf<{ data: Array<{ action: string; reason: string }> }>(
        await bqlA.get(`/api/buildings/${buildingA.id}/audit`),
      ).data;
      expect(audit[0].action).toBe('updateBuildingConfig');
      expect(audit[0].reason).toContain('25.000.000');
      await bqlA.put(`/api/buildings/${buildingA.id}/config`, configBody(config)).expect(409);
    });

    it('rejects a money value that is not a positive integer string', async () => {
      const config = await configOf(bqlA, buildingA.id);
      const res = await bqlA
        .put(`/api/buildings/${buildingA.id}/config`, configBody(config, { emergencyLimitVnd: 1.5 }))
        .expect(400);
      expect(errorFields(res)).toEqual(['emergencyLimitVnd']);
    });

    it('checks custom approval steps against role capabilities', async () => {
      const config = await configOf(bqlA, buildingA.id);
      const res = await bqlA
        .put(
          `/api/buildings/${buildingA.id}/config`,
          configBody(config, {
            workflowApprovalSteps: [{ key: 'BQL_SIGN', label: 'BQL ký duyệt', role: 'BQL' }],
            approvalStepKeys: ['BQL_SIGN'],
          }),
        )
        .expect(400);
      expect(errorFields(res)).toEqual(['workflowApprovalSteps.3.role']);

      const ok = await bqlA
        .put(
          `/api/buildings/${buildingA.id}/config`,
          configBody(config, {
            workflowApprovalSteps: [{ key: 'LEGAL', label: 'Pháp chế duyệt', actor: 'PC', role: 'OWNERS_BOARD' }],
            approvalStepKeys: ['TECH', 'LEGAL', 'BOARD'],
          }),
        )
        .expect(200);
      const saved = dataOf<{ config: Config }>(ok).config;
      expect(saved.workflowApprovalSteps.map((s) => s.key)).toEqual(['TECH_CONFIRM', 'TECH', 'BOARD', 'LEGAL']);
    });

    it('requires assignment-rule departments to cover the building', async () => {
      const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
      const buildingE = buildings.find((b) => b.code === 'E');
      const config = await configOf(admin, buildingE?.id ?? '');
      const res = await admin
        .put(
          `/api/buildings/${config.buildingId}/config`,
          configBody(config, { assignmentRules: [{ departmentId: department('BQL').id, role: 'BQL', priority: 1 }] }),
        )
        .expect(400);
      expect(errorFields(res)).toEqual(['assignmentRules.0.departmentId']);
    });

    it('applies a template but keeps the assignment rules', async () => {
      const config = await configOf(bqlA, buildingA.id);
      const res = await bqlA
        .post(`/api/buildings/${buildingA.id}/config/apply-template`, {
          templateKey: 'RESIDENTIAL',
          version: config.version,
        })
        .expect(201);
      const saved = dataOf<{ config: Config }>(res).config;
      expect(saved.emergencyLimitVnd).toBe('15000000');
      expect(saved.approvalStepKeys).toEqual(['TECH']);
      expect(saved.assignmentRules).toEqual(config.assignmentRules);
    });

    it('bulk workflow update is all-or-nothing', async () => {
      const bqlB = await signIn(server, 'bql-b');
      const configs = dataOf<Config[]>(await bqlB.get('/api/building-configs'));
      expect(configs).toHaveLength(3);
      const [first, second] = configs;
      const res = await bqlB
        .put('/api/building-configs/workflow', {
          targets: [
            {
              buildingId: first.buildingId,
              version: first.version,
              values: configBody(first, { emergencyDocHours: 12, version: undefined }),
            },
            { buildingId: second.buildingId, version: 999, values: configBody(second, { version: undefined }) },
          ],
        })
        .expect(409);
      expect(errorOf(res).code).toBe('CONFLICT');
      const after = dataOf<Config>(await bqlB.get(`/api/buildings/${first.buildingId}/config`));
      expect(after.version).toBe(first.version);
      expect(after.emergencyDocHours).toBe(first.emergencyDocHours);
    });
  });
});
