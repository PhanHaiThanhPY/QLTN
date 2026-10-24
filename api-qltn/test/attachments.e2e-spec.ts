import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-attachments-e2e-'));
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
  version: number;
  attachmentIds: string[];
}

interface AttachmentView {
  id: string;
  subjectType: string;
  subjectId: string;
  buildingId: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

interface DetailView {
  record: RecordView;
  attachments: AttachmentView[];
  audit: Array<{ action: string; reason: string | null }>;
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('D2T2 photo', 'utf8'),
]);
const PNG_MIME = 'image/png';
const PNG_NAME = 'hien-truong.png';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const fields = (subjectId: string, overrides: Partial<Record<string, string>> = {}) => ({
  subjectType: 'REPAIR_RECORD',
  subjectId,
  purpose: 'SITE_PHOTO',
  ...overrides,
});

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;

describe('Repair record attachments (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let bqlA2: Session;
  let bqlB: Session;
  let buildingA: Building;
  let referenceA: Reference;
  let record: RecordView;
  let otherRecord: RecordView;
  let uploaded: AttachmentView;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    buildingA = dataOf<Building[]>(await admin.get('/api/buildings')).find((row) => row.code === 'A') as Building;
    referenceA = dataOf<Reference>(await bqlA.get('/api/reference'));

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

    const locationId = referenceA.locations.find((row) => row.buildingId === buildingA.id)?.id;
    record = dataOf<RecordView>(
      await bqlA
        .post('/api/records', { buildingId: buildingA.id, locationId, title: 'D2T2- Rò rỉ hành lang' })
        .expect(201),
    );
    otherRecord = dataOf<RecordView>(
      await bqlA.post('/api/records', { buildingId: buildingA.id, title: 'D2T2- Hồ sơ khác' }).expect(201),
    );
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('uploads a PNG site photo and records the audit event', async () => {
    const res = await bqlA
      .postMultipart('/api/attachments', fields(record.id), {
        content: PNG,
        filename: PNG_NAME,
        contentType: PNG_MIME,
      })
      .expect(201);
    uploaded = dataOf<AttachmentView>(res);

    expect(uploaded).toMatchObject({
      subjectType: 'REPAIR_RECORD',
      subjectId: record.id,
      buildingId: buildingA.id,
      purpose: 'SITE_PHOTO',
      fileName: PNG_NAME,
      mimeType: PNG_MIME,
      sizeBytes: PNG.length,
    });
    expect(uploaded.id).toBeTruthy();
    expect(uploaded.uploadedBy).toBeTruthy();
    expect(uploaded.createdAt).toBeTruthy();

    const detail = dataOf<DetailView>(await bqlA.get(`/api/records/${record.id}`).expect(200));
    expect(detail.audit[0]).toMatchObject({ action: 'uploadAttachment', reason: 'Ảnh hiện trường' });
  });

  it('refuses an oversized, empty, wrong-type or disguised file on the file field', async () => {
    const oversized = await bqlA
      .postMultipart('/api/attachments', fields(record.id), {
        content: Buffer.concat([PNG, Buffer.alloc(MAX_FILE_BYTES + 1 - PNG.length)]),
        filename: 'to.png',
        contentType: PNG_MIME,
      })
      .expect(400);
    expect(errorFields(oversized)).toContain('file');

    const empty = await bqlA
      .postMultipart('/api/attachments', fields(record.id), {
        content: Buffer.alloc(0),
        filename: 'rong.png',
        contentType: PNG_MIME,
      })
      .expect(400);
    expect(errorFields(empty)).toContain('file');

    const wrongType = await bqlA
      .postMultipart('/api/attachments', fields(record.id), {
        content: Buffer.from('ghi chu', 'utf8'),
        filename: 'ghi-chu.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(errorFields(wrongType)).toContain('file');

    const disguised = await bqlA
      .postMultipart('/api/attachments', fields(record.id), {
        content: Buffer.from('day khong phai anh png', 'utf8'),
        filename: 'gia.png',
        contentType: PNG_MIME,
      })
      .expect(400);
    expect(errorFields(disguised)).toContain('file');
  });

  it('refuses a same-building BQL who is not the record manager', async () => {
    const res = await bqlA2
      .postMultipart('/api/attachments', fields(record.id), {
        content: PNG,
        filename: PNG_NAME,
        contentType: PNG_MIME,
      })
      .expect(403);
    expect(reasonOf(res)).toBe('attachment_step_denied');
  });

  it('hides another building upload and masks its content with 404', async () => {
    const upload = await bqlB
      .postMultipart('/api/attachments', fields(record.id), {
        content: PNG,
        filename: PNG_NAME,
        contentType: PNG_MIME,
      })
      .expect(404);
    expect(errorOf(upload).code).toBe('NOT_FOUND');

    await bqlB.get(`/api/attachments/${uploaded.id}/content`).expect(404);
  });

  it('refuses an unsupported purpose or subject type with a reason', async () => {
    const purpose = await bqlA
      .postMultipart('/api/attachments', fields(record.id, { purpose: 'PROPOSAL' }), {
        content: PNG,
        filename: PNG_NAME,
        contentType: PNG_MIME,
      })
      .expect(400);
    expect(reasonOf(purpose)).toBe('attachment_purpose_not_supported');

    const subject = await bqlA
      .postMultipart('/api/attachments', fields(record.id, { subjectType: 'MAINTENANCE_ITEM' }), {
        content: PNG,
        filename: PNG_NAME,
        contentType: PNG_MIME,
      })
      .expect(400);
    expect(reasonOf(subject)).toBe('attachment_purpose_not_supported');
  });

  it('refuses an attachment of another record on the attachmentIds field', async () => {
    const foreign = dataOf<AttachmentView>(
      await bqlA
        .postMultipart('/api/attachments', fields(otherRecord.id), {
          content: PNG,
          filename: 'khac.png',
          contentType: PNG_MIME,
        })
        .expect(201),
    );

    const res = await bqlA
      .patch(`/api/records/${record.id}`, { version: record.version, attachmentIds: [foreign.id] })
      .expect(400);
    expect(errorFields(res)).toContain('attachmentIds');
  });

  it('attaches the photo to the record and serves the same bytes', async () => {
    const saved = dataOf<RecordView>(
      await bqlA
        .patch(`/api/records/${record.id}`, { version: record.version, attachmentIds: [uploaded.id] })
        .expect(200),
    );
    expect(saved.attachmentIds).toEqual([uploaded.id]);
    expect(saved.version).toBe(record.version + 1);

    const detail = dataOf<DetailView>(await bqlA.get(`/api/records/${record.id}`).expect(200));
    expect(detail.record.attachmentIds).toEqual([uploaded.id]);
    expect(detail.attachments).toHaveLength(1);
    expect(detail.attachments[0]).toMatchObject({ id: uploaded.id, fileName: PNG_NAME, mimeType: PNG_MIME });

    const content = await bqlA.getBinary(`/api/attachments/${uploaded.id}/content`).expect(200);
    expect(content.headers['content-type']).toContain(PNG_MIME);
    expect(content.headers['content-disposition']).toContain('inline');
    expect(Buffer.compare(content.body as Buffer, PNG)).toBe(0);
  });

  it('detaches the photo when the list no longer has it, keeping the file readable', async () => {
    const current = dataOf<DetailView>(await bqlA.get(`/api/records/${record.id}`).expect(200));
    const cleared = dataOf<RecordView>(
      await bqlA.patch(`/api/records/${record.id}`, { version: current.record.version, attachmentIds: [] }).expect(200),
    );
    expect(cleared.attachmentIds).toEqual([]);
    const detail = dataOf<DetailView>(await bqlA.get(`/api/records/${record.id}`).expect(200));
    expect(detail.attachments).toEqual([]);
    await bqlA.getBinary(`/api/attachments/${uploaded.id}/content`).expect(200);
  });
});
