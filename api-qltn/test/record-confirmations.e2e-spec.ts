import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-confirmations-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

interface Building {
  id: string;
  code: string;
}

interface Reference {
  locations: Array<{ id: string; buildingId: string }>;
  users: Array<{ id: string; code: string }>;
}

interface RecordView {
  id: string;
  status: string;
  version: number;
  confirmationUserId: string;
  attachmentIds: string[];
}

interface ConfirmationRow {
  recordId: string;
  actorId: string;
  outcome: string;
  note: string;
}

interface AuditRow {
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
}

interface DetailView {
  record: RecordView;
  confirmations: ConfirmationRow[];
  audit: AuditRow[];
}

interface Summary {
  open: number;
  needsUpdate: number;
  total: number;
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('S1 photo', 'utf8'),
]);
const DESCRIPTION = 'Trần hành lang tầng 3 bị thấm, nước nhỏ giọt khi mưa.';

/** The three S1 actions with the route, the target status and the stored outcome (SPEC B03–B09 T01–T03). */
const ACTIONS = [
  { action: 'requestRecordUpdate', route: 'request-record-update', to: 'NEEDS_RECORD_UPDATE', outcome: 'NEEDS_UPDATE' },
  { action: 'confirmRepair', route: 'confirm-repair', to: 'PENDING_PROPOSAL', outcome: 'CONFIRMED' },
  { action: 'closeNoRepair', route: 'close-no-repair', to: 'CLOSED_NO_REPAIR', outcome: 'NO_REPAIR' },
] as const;

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;

describe('Repair record confirmation, slice S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let ktA: Session;
  let ktA2: Session;
  let ktB: Session;
  let buildingA: Building;
  let locationId: string;
  let ktAId: string;
  let sequence = 0;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    ktA2 = await signIn(server, 'kt-a2');
    ktB = await signIn(server, 'kt-b');
    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    const reference = dataOf<Reference>(await bqlA.get('/api/reference'));
    locationId = (reference.locations.find((row) => row.buildingId === buildingA.id) as { id: string }).id;
    ktAId = (reference.users.find((row) => row.code === 'KT-A') as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  const createDraft = async (): Promise<RecordView> => {
    sequence += 1;
    return dataOf<RecordView>(
      await bqlA
        .post('/api/records', {
          buildingId: buildingA.id,
          locationId,
          title: `S1- Hồ sơ xác nhận ${sequence}`,
          description: DESCRIPTION,
          noMaintenanceItem: true,
          confirmationUserId: ktAId,
        })
        .expect(201),
    );
  };

  const attachPhoto = async (recordId: string): Promise<string> =>
    dataOf<{ id: string }>(
      await bqlA
        .postMultipart(
          '/api/attachments',
          { subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'SITE_PHOTO' },
          { content: PNG, filename: 'hien-truong.png', contentType: 'image/png' },
        )
        .expect(201),
    ).id;

  /** A record waiting for kt-a's confirmation. */
  const pendingRecord = async (): Promise<RecordView> => {
    const draft = await createDraft();
    const photoId = await attachPhoto(draft.id);
    return dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photoId] })
        .expect(200),
    );
  };

  const detailOf = async (id: string): Promise<DetailView> =>
    dataOf<DetailView>(await bqlA.get(`/api/records/${id}`).expect(200));

  const summary = async (): Promise<Summary> =>
    dataOf<Summary>(await bqlA.get(`/api/records/summary?buildingId=${buildingA.id}`).expect(200));

  it('AC-1.1: the assigned confirmer runs T01, T02 and T03 and each leaves a conclusion and an audit row', async () => {
    for (const { action, route, to, outcome } of ACTIONS) {
      const record = await pendingRecord();
      expect(record.confirmationUserId).toBe(ktAId);
      const note = `Kết luận cho ${action}: đã kiểm tra tại chỗ.`;

      const updated = dataOf<RecordView>(
        await ktA.post(`/api/records/${record.id}/${route}`, { version: record.version, note }).expect(200),
      );
      expect(updated.status).toBe(to);
      expect(updated.version).toBe(record.version + 1);

      const detail = await detailOf(record.id);
      expect(detail.record.status).toBe(to);
      expect(detail.confirmations).toEqual([
        expect.objectContaining({ recordId: record.id, actorId: ktAId, outcome, note }),
      ]);
      expect(detail.audit.find((row) => row.action === action)).toMatchObject({
        fromStatus: 'PENDING_CONFIRMATION',
        toStatus: to,
        reason: note,
      });
    }
  });

  it('AC-1.2: an unassigned confirmer, a BQL and another building are refused and the record is unchanged', async () => {
    const record = await pendingRecord();
    const body = { version: record.version, note: 'Đã kiểm tra, cần sửa ống cấp.' };

    const unassigned = await ktA2.post(`/api/records/${record.id}/confirm-repair`, body).expect(403);
    expect(reasonOf(unassigned)).toBe('not_step_assignee');
    expect(errorOf(unassigned).message).toBe('Chỉ người xác nhận hiện trạng được giao mới thực hiện được bước này.');

    const bql = await bqlA.post(`/api/records/${record.id}/confirm-repair`, body).expect(403);
    expect(reasonOf(bql)).toBe('missing_capability');

    const otherBuilding = await ktB.post(`/api/records/${record.id}/confirm-repair`, body).expect(404);
    expect(errorOf(otherBuilding).code).toBe('NOT_FOUND');

    const detail = await detailOf(record.id);
    expect(detail.record.status).toBe('PENDING_CONFIRMATION');
    expect(detail.record.version).toBe(record.version);
    expect(detail.confirmations).toEqual([]);
  });

  it('AC-1.3: a record sent back is supplemented, resubmitted and confirmed; both conclusions are kept', async () => {
    const record = await pendingRecord();
    const sentBack = dataOf<RecordView>(
      await ktA
        .post(`/api/records/${record.id}/request-record-update`, {
          version: record.version,
          note: 'Thiếu ảnh cận cảnh vết thấm.',
        })
        .expect(200),
    );
    expect(sentBack.status).toBe('NEEDS_RECORD_UPDATE');

    const photoId = await attachPhoto(record.id);
    const current = await detailOf(record.id);
    const resubmitted = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${record.id}/submit`, {
          version: sentBack.version,
          description: `${DESCRIPTION} Đã bổ sung ảnh cận cảnh.`,
          attachmentIds: [...current.record.attachmentIds, photoId],
        })
        .expect(200),
    );
    expect(resubmitted.status).toBe('PENDING_CONFIRMATION');

    await ktA
      .post(`/api/records/${record.id}/confirm-repair`, {
        version: resubmitted.version,
        note: 'Đã xem ảnh bổ sung, cần sửa.',
      })
      .expect(200);

    const detail = await detailOf(record.id);
    expect(detail.record.status).toBe('PENDING_PROPOSAL');
    expect(detail.confirmations.map((row) => row.outcome)).toEqual(['NEEDS_UPDATE', 'CONFIRMED']);
  });

  it('AC-1.4: a 4-character note answers 400 on note and a stale version answers 409 CONFLICT', async () => {
    const record = await pendingRecord();
    const short = await ktA
      .post(`/api/records/${record.id}/confirm-repair`, { version: record.version, note: 'abcd' })
      .expect(400);
    expect(errorFields(short)).toEqual(['note']);

    const stale = await ktA
      .post(`/api/records/${record.id}/confirm-repair`, { version: record.version - 1, note: 'Kết luận hợp lệ.' })
      .expect(409);
    expect(errorOf(stale).code).toBe('CONFLICT');

    const detail = await detailOf(record.id);
    expect(detail.record.status).toBe('PENDING_CONFIRMATION');
    expect(detail.confirmations).toEqual([]);
  });

  it('AC-0.1: every S1 action from a status outside PENDING_CONFIRMATION answers 409 and writes no audit', async () => {
    const draft = await createDraft();
    const confirmed = await pendingRecord();
    const proposal = dataOf<RecordView>(
      await ktA
        .post(`/api/records/${confirmed.id}/confirm-repair`, { version: confirmed.version, note: 'Cần sửa.' })
        .expect(200),
    );

    for (const record of [draft, proposal]) {
      const before = await detailOf(record.id);
      for (const { route } of ACTIONS) {
        const res = await ktA
          .post(`/api/records/${record.id}/${route}`, { version: record.version, note: 'Thử sai trạng thái.' })
          .expect(409);
        expect(reasonOf(res)).toBe('invalid_status_transition');
      }
      const after = await detailOf(record.id);
      expect(after.audit).toHaveLength(before.audit.length);
      expect(after.confirmations).toHaveLength(before.confirmations.length);
      expect(after.record.version).toBe(record.version);
    }
  });

  it('AC-0.2: the summary and the needs-update list count the S1 statuses', async () => {
    const sentBack = await pendingRecord();
    const closed = await pendingRecord();
    const before = await summary();

    await ktA
      .post(`/api/records/${sentBack.id}/request-record-update`, { version: sentBack.version, note: 'Thiếu ảnh.' })
      .expect(200);
    await ktA
      .post(`/api/records/${closed.id}/close-no-repair`, { version: closed.version, note: 'Không có hư hỏng.' })
      .expect(200);

    const after = await summary();
    expect(after.needsUpdate).toBe(before.needsUpdate + 1);
    expect(after.open).toBe(before.open - 1);
    expect(after.total).toBe(before.total);

    const list = await bqlA.get(`/api/records?buildingId=${buildingA.id}&attention=needs_update&limit=100`).expect(200);
    const ids = dataOf<{ data: RecordView[] }>(list).data.map((row) => row.id);
    expect(ids).toContain(sentBack.id);
    expect(ids).not.toContain(closed.id);
  });
});
