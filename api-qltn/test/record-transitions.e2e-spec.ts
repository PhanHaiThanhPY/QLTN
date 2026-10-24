import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-transitions-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

interface Building {
  id: string;
  code: string;
}

interface Reference {
  locations: Array<{ id: string; buildingId: string }>;
  users: Array<{ id: string; code: string }>;
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
  status: string;
  title: string;
  version: number;
  attachmentIds: string[];
}

interface AttachmentView {
  id: string;
}

interface AuditRow {
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
}

interface DetailView {
  record: RecordView;
  audit: AuditRow[];
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('D2T3 photo', 'utf8'),
]);
const PNG_NAME = 'hien-truong.png';
const DESCRIPTION = 'Nước nhỏ giọt xuống hành lang, cần kiểm tra ống cấp.';

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;

describe('Repair record transitions (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let bqlA2: Session;
  let bqlB: Session;
  let buildingA: Building;
  let buildingB: Building;
  let referenceA: Reference;
  let locationId: string;
  let sequence = 0;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    buildingB = buildings.find((row) => row.code === 'B') as Building;
    referenceA = dataOf<Reference>(await bqlA.get('/api/reference'));
    locationId = (referenceA.locations.find((row) => row.buildingId === buildingA.id) as { id: string }).id;

    // Same building and RECORD_EDIT, but not the record's manager (the slot rule under test).
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
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  /** Every case starts from its own DRAFT so the acceptance scenarios stay independent. */
  const createDraft = async (overrides: Record<string, unknown> = {}): Promise<RecordView> => {
    sequence += 1;
    return dataOf<RecordView>(
      await bqlA
        .post('/api/records', {
          buildingId: buildingA.id,
          locationId,
          title: `D2T3- Hồ sơ chuyển trạng thái ${sequence}`,
          description: DESCRIPTION,
          priority: 'HIGH',
          noMaintenanceItem: true,
          ...overrides,
        })
        .expect(201),
    );
  };

  const uploadPhoto = async (recordId: string): Promise<AttachmentView> =>
    dataOf<AttachmentView>(
      await bqlA
        .postMultipart(
          '/api/attachments',
          { subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'SITE_PHOTO' },
          { content: PNG, filename: PNG_NAME, contentType: 'image/png' },
        )
        .expect(201),
    );

  const detailOf = async (id: string): Promise<DetailView> =>
    dataOf<DetailView>(await bqlA.get(`/api/records/${id}`).expect(200));

  it('submits a complete draft with one site photo and records the transition', async () => {
    const draft = await createDraft();
    const photo = await uploadPhoto(draft.id);

    const submitted = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo.id] })
        .expect(200),
    );
    expect(submitted.status).toBe('PENDING_CONFIRMATION');
    expect(submitted.version).toBe(draft.version + 1);
    expect(submitted.attachmentIds).toEqual([photo.id]);

    const detail = await detailOf(draft.id);
    expect(detail.record.status).toBe('PENDING_CONFIRMATION');
    expect(detail.audit.find((row) => row.action === 'submitRecord')).toMatchObject({
      fromStatus: 'DRAFT',
      toStatus: 'PENDING_CONFIRMATION',
    });
  });

  it('refuses a draft without a site photo on attachmentIds and keeps the record untouched', async () => {
    const draft = await createDraft();
    const res = await bqlA
      .post(`/api/records/${draft.id}/submit`, { version: draft.version, title: 'D2T3- đổi khi gửi thất bại' })
      .expect(400);
    expect(errorFields(res)).toContain('attachmentIds');
    expect(errorOf(res).message).toBe('Cần ít nhất 1 ảnh hiện trường.');

    const detail = await detailOf(draft.id);
    expect(detail.record.status).toBe('DRAFT');
    expect(detail.record.version).toBe(draft.version);
    expect(detail.record.title).toBe(draft.title);
  });

  it('refuses a confirmer equal to the manager on confirmationUserId', async () => {
    const draft = await createDraft();
    const photo = await uploadPhoto(draft.id);
    const manager = referenceA.users.find((row) => row.code === 'BQL-A') as { id: string };

    const res = await bqlA
      .post(`/api/records/${draft.id}/submit`, {
        version: draft.version,
        confirmationUserId: manager.id,
        attachmentIds: [photo.id],
      })
      .expect(400);
    expect(errorFields(res)).toContain('confirmationUserId');
  });

  it('refuses a draft without the "no specific equipment" flag on maintenanceItemId', async () => {
    const draft = await createDraft({ noMaintenanceItem: undefined });
    const photo = await uploadPhoto(draft.id);

    const res = await bqlA
      .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo.id] })
      .expect(400);
    expect(errorFields(res)).toContain('maintenanceItemId');
    expect(errorOf(res).message).toBe('Chọn thiết bị/hạng mục, hoặc chọn “Không thuộc thiết bị cụ thể”.');
  });

  it('refuses a stale version with 409', async () => {
    const draft = await createDraft();
    const photo = await uploadPhoto(draft.id);
    await bqlA.patch(`/api/records/${draft.id}`, { version: draft.version, description: DESCRIPTION }).expect(200);

    const res = await bqlA
      .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo.id] })
      .expect(409);
    expect(errorOf(res).code).toBe('CONFLICT');
  });

  it('refuses a same-building BQL who is not the record manager', async () => {
    const draft = await createDraft();
    const photo = await uploadPhoto(draft.id);

    const res = await bqlA2
      .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo.id] })
      .expect(403);
    expect(reasonOf(res)).toBe('not_record_manager');
  });

  it('hides another building record with 404', async () => {
    const draft = await createDraft();
    const res = await bqlB.post(`/api/records/${draft.id}/submit`, { version: draft.version }).expect(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
    expect(buildingB.id).not.toBe(buildingA.id);
  });

  it('refuses a second submit and a withdraw once the record waits for confirmation', async () => {
    const draft = await createDraft();
    const photo = await uploadPhoto(draft.id);
    const submitted = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo.id] })
        .expect(200),
    );

    const again = await bqlA
      .post(`/api/records/${draft.id}/submit`, { version: submitted.version, attachmentIds: [photo.id] })
      .expect(409);
    expect(reasonOf(again)).toBe('invalid_status_transition');
    expect(errorOf(again).message).toContain('Chờ xác nhận');
    expect(errorOf(again).message).not.toContain('PENDING_CONFIRMATION');

    const withdraw = await bqlA
      .post(`/api/records/${draft.id}/withdraw`, { version: submitted.version, reason: 'Không làm nữa.' })
      .expect(409);
    expect(reasonOf(withdraw)).toBe('invalid_status_transition');

    const patch = await bqlA
      .patch(`/api/records/${draft.id}`, { version: submitted.version, description: DESCRIPTION })
      .expect(409);
    expect(reasonOf(patch)).toBe('invalid_status_transition');

    const upload = await bqlA
      .postMultipart(
        '/api/attachments',
        { subjectType: 'REPAIR_RECORD', subjectId: draft.id, purpose: 'SITE_PHOTO' },
        { content: PNG, filename: PNG_NAME, contentType: 'image/png' },
      )
      .expect(403);
    expect(reasonOf(upload)).toBe('attachment_step_denied');
  });

  it('withdraws a draft with a reason and records it in the audit trail', async () => {
    const draft = await createDraft();

    const missing = await bqlA
      .post(`/api/records/${draft.id}/withdraw`, { version: draft.version, reason: '' })
      .expect(400);
    expect(errorFields(missing)).toContain('reason');
    expect((await detailOf(draft.id)).record.status).toBe('DRAFT');

    const reason = 'Cư dân đã tự xử lý, không cần sửa nữa.';
    const withdrawn = dataOf<RecordView>(
      await bqlA.post(`/api/records/${draft.id}/withdraw`, { version: draft.version, reason }).expect(200),
    );
    expect(withdrawn.status).toBe('CLOSED_WITHDRAWN');
    expect(withdrawn.version).toBe(draft.version + 1);

    const detail = await detailOf(draft.id);
    expect(detail.record.status).toBe('CLOSED_WITHDRAWN');
    expect(detail.audit.find((row) => row.action === 'withdrawRecord')).toMatchObject({
      fromStatus: 'DRAFT',
      toStatus: 'CLOSED_WITHDRAWN',
      reason,
    });
  });
});
