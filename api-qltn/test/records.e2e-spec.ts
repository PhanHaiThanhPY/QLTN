import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

interface Building {
  id: string;
  code: string;
}

interface Reference {
  locations: Array<{ id: string; buildingId: string }>;
  users: Array<{ id: string; code: string }>;
}

interface Config {
  taskDueDays: Record<string, number>;
}

interface RoleRow {
  id: string;
  code: string;
  isSystem: boolean;
}

interface DepartmentRow {
  id: string;
  code: string;
}

interface RecordView {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  noMaintenanceItem: boolean;
  title: string;
  description: string;
  priority: string;
  status: string;
  managerUserId: string;
  confirmationUserId: string;
  approvalStepKeys: string[];
  workflowApprovalSteps: Array<{ key: string; role: string }>;
  approvalAssigneeUserIds: Record<string, string>;
  dueDays: Record<string, number>;
  attachmentIds: string[];
  version: number;
}

interface DetailView {
  record: RecordView;
  audit: Array<{ action: string; toStatus: string | null; entityVersion: number | null }>;
}

const TITLE = 'D2T1- Rò rỉ nước trần hành lang';

describe('Repair records (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let ktA: Session;
  let bqlA2: Session;
  let buildingA: Building;
  let buildingB: Building;
  let referenceA: Reference;
  let referenceB: Reference;
  let configA: Config;
  let created: RecordView;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    ktA = await signIn(server, 'kt-a');
    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    buildingB = buildings.find((row) => row.code === 'B') as Building;
    referenceA = dataOf<Reference>(await bqlA.get('/api/reference'));
    referenceB = dataOf<Reference>(await bqlB.get('/api/reference'));
    // Since matrix v2 only ADMIN reads the configuration (DF-11).
    configA = dataOf<Config>(await admin.get(`/api/buildings/${buildingA.id}/config`));

    // Same building, holds RECORD_EDIT, but is not the record manager (the slot rule under test).
    const roles = dataOf<RoleRow[]>(await admin.get('/api/roles'));
    const departments = dataOf<DepartmentRow[]>(await admin.get('/api/departments'));
    const bqlRole = roles.find((row) => row.code === 'BQL' && row.isSystem) as RoleRow;
    const bqlDepartment = departments.find((row) => row.code === 'BQL') as DepartmentRow;
    await admin
      .post('/api/users', {
        code: 'BQL-A2',
        fullName: 'Phạm BQL Tòa A',
        password: 'E2e-bql-a2',
        roleDefId: bqlRole.id,
        departmentId: bqlDepartment.id,
        buildingIds: [buildingA.id],
      })
      .expect(201);
    bqlA2 = await signIn(server, 'bql-a2', 'E2e-bql-a2');
  });

  afterAll(async () => {
    await app.close();
  });

  const locationOfA = () => referenceA.locations.find((row) => row.buildingId === buildingA.id) as { id: string };
  const locationOfB = () => referenceB.locations.find((row) => row.buildingId === buildingB.id) as { id: string };
  const userOfA = (code: string) => referenceA.users.find((row) => row.code === code) as { id: string };

  it('creates a DRAFT record with SC code and a snapshot of the building configuration', async () => {
    const res = await bqlA
      .post('/api/records', {
        buildingId: buildingA.id,
        locationId: locationOfA().id,
        title: TITLE,
        description: 'Nước nhỏ giọt xuống hành lang, cần kiểm tra ống cấp.',
        priority: 'HIGH',
        noMaintenanceItem: true,
      })
      .expect(201);
    created = dataOf<RecordView>(res);

    expect(created.code).toMatch(/^SC-\d{3}$/);
    expect(created.status).toBe('DRAFT');
    expect(created.version).toBe(1);
    expect(created.title).toBe(TITLE);
    expect(created.priority).toBe('HIGH');
    expect(created.noMaintenanceItem).toBe(true);
    expect(created.managerUserId).toBeTruthy();
    expect(created.confirmationUserId).toBe(userOfA('KT-A').id);
    expect(created.approvalStepKeys).toEqual(['TECH', 'BOARD']);
    expect(created.workflowApprovalSteps.map((step) => step.key)).toEqual(['TECH', 'BOARD']);
    expect(created.approvalAssigneeUserIds.TECH).toBe(userOfA('TVKT').id);
    expect(created.approvalAssigneeUserIds.BOARD).toBe(userOfA('BQT').id);
    expect(created.dueDays).toEqual(configA.taskDueDays);
    expect(created.attachmentIds).toEqual([]);
  });

  it('returns the detail with its audit trail and hides it from another building', async () => {
    const res = await bqlA.get(`/api/records/${created.id}`).expect(200);
    const detail = dataOf<DetailView>(res);
    expect(detail.record.code).toBe(created.code);
    expect(detail.audit[0]).toMatchObject({ action: 'createRecord', toStatus: 'DRAFT', entityVersion: 1 });

    const denied = await bqlB.get(`/api/records/${created.id}`).expect(404);
    expect(errorOf(denied).code).toBe('NOT_FOUND');
  });

  it('saves the draft and rejects a stale version with 409', async () => {
    const updated = await bqlA
      .patch(`/api/records/${created.id}`, { version: 1, description: 'Đã kiểm tra: rò rỉ tại mối nối ống cấp.' })
      .expect(200);
    const saved = dataOf<RecordView>(updated);
    expect(saved.version).toBe(2);
    expect(saved.description).toBe('Đã kiểm tra: rò rỉ tại mối nối ống cấp.');

    const stale = await bqlA.patch(`/api/records/${created.id}`, { version: 1, title: 'D2T1- bản cũ' }).expect(409);
    expect(errorOf(stale).code).toBe('CONFLICT');

    const detail = dataOf<DetailView>(await bqlA.get(`/api/records/${created.id}`).expect(200));
    expect(detail.audit.find((row) => row.action === 'saveRecordDraft')).toMatchObject({ entityVersion: 2 });
    expect(detail.audit.some((row) => row.action === 'createRecord')).toBe(true);
  });

  it('refuses a same-building BQL who is not the record manager, without changing the record', async () => {
    const res = await bqlA2
      .patch(`/api/records/${created.id}`, { version: 2, description: 'D2T1- sửa bởi người không phải quản lý' })
      .expect(403);
    expect(errorOf(res).code).toBe('FORBIDDEN');
    expect((errorOf(res).details as { reason?: string } | null)?.reason).toBe('not_record_manager');

    const detail = dataOf<DetailView>(await bqlA.get(`/api/records/${created.id}`).expect(200));
    expect(detail.record.version).toBe(2);
    expect(detail.record.description).toBe('Đã kiểm tra: rò rỉ tại mối nối ống cấp.');
  });

  it('refuses admin-demo because the ADMIN role has no RECORD_EDIT (capability guard)', async () => {
    const res = await admin
      .patch(`/api/records/${created.id}`, { version: 2, description: 'D2T1- admin sửa' })
      .expect(403);
    expect(errorOf(res).code).toBe('FORBIDDEN');
  });

  it('refuses a building outside the caller scope with 404', async () => {
    const res = await bqlA.post('/api/records', { buildingId: buildingB.id, title: 'D2T1- ngoài phạm vi' }).expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
  });

  it('refuses a role without RECORD_EDIT with 403', async () => {
    const res = await ktA.post('/api/records', { buildingId: buildingA.id, title: 'D2T1- kt tạo' }).expect(403);
    expect(errorOf(res).code).toBe('FORBIDDEN');
  });

  it('reports a location of another building on the locationId field', async () => {
    const res = await bqlA
      .post('/api/records', {
        buildingId: buildingA.id,
        locationId: locationOfB().id,
        title: 'D2T1- sai tòa',
      })
      .expect(400);
    expect(errorFields(res)).toContain('locationId');
  });

  it('does not accept maintenanceItemId in T1', async () => {
    const res = await bqlA
      .post('/api/records', {
        buildingId: buildingA.id,
        maintenanceItemId: '00000000-0000-4000-8000-000000000000',
        title: 'D2T1- thiết bị',
      })
      .expect(400);
    expect(errorFields(res)).toContain('maintenanceItemId');
  });

  it('hides another building record from an update', async () => {
    await bqlB.patch(`/api/records/${created.id}`, { version: 2, title: 'D2T1- sửa trộm' }).expect(404);
  });
});
