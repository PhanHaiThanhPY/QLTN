import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { DatabaseSeedService } from '../src/database/seeds/database-seed.service';
import { createApp, dataOf, errorFields, errorOf, signIn, type Session } from './app-harness';
import { PDF, upload } from './repair-flow';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-items-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC MT-S1 (docs/product/features/MT-thiet-bi-bao-tri/SPEC.md): equipment and its link from repair records. */

interface Item {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  name: string;
  condition: string;
  active: boolean;
  documentIds: string[];
  deactivationReason: string | null;
  version: number;
}

interface Row {
  item: Item;
  repairCount: number;
  openRepairCount: number;
  approvedTotalVnd: string;
  warranty: string;
  needsAttention: boolean;
}

interface AuditRow {
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actorId: string | null;
}

interface Detail extends Omit<Row, 'item'> {
  item: Item;
  repairs: Array<{ id: string; code: string; status: string; approvedAmountVnd: string | null }>;
  documents: Array<{ id: string; fileName: string }>;
  audit: AuditRow[];
}

interface RecordView {
  id: string;
  code: string;
  status: string;
  version: number;
  locationId: string;
  noMaintenanceItem: boolean;
  maintenanceItemId: string | null;
}

interface Reference {
  locations: Array<{ id: string; buildingId: string; floor: string; name: string }>;
  users: Array<{ id: string; code: string }>;
  items: Array<{ id: string; code: string; active: boolean }>;
}

const DUPLICATE = 'Mã thiết bị đã có trong tòa này.';
const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const shiftDay = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

describe('Equipment, MT-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let ktA: Session;
  let viewer: Session;
  let reference: Reference;
  let buildingA: string;
  let buildingB: string;
  let pumpRoom: string;
  let lobby: string;
  let ids: Record<string, string>;
  let pump: Item;

  const building = async (code: string): Promise<string> =>
    (
      dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
        (row) => row.code === code,
      ) as {
        id: string;
      }
    ).id;
  const locationOf = (buildingId: string, name: string): string =>
    (reference.locations.find((row) => row.buildingId === buildingId && row.name === name) as { id: string }).id;
  const list = async (session: Session, query = ''): Promise<Row[]> =>
    dataOf<Row[]>(await session.get(`/api/maintenance-items${query}`).expect(200));
  const detail = async (session: Session, id: string): Promise<Detail> =>
    dataOf<Detail>(await session.get(`/api/maintenance-items/${id}`).expect(200));
  const fields = (overrides: Record<string, unknown> = {}) => ({
    name: 'Bơm tăng áp',
    type: 'Bơm nước',
    locationId: pumpRoom,
    ownerUserId: ids['BQL-A'],
    model: 'Ebara CDX 120/12',
    supplier: 'Công ty CP Cơ điện Sao Việt',
    installDate: shiftDay(vnToday(), -300),
    warrantyUntil: shiftDay(vnToday(), 20),
    description: 'Lưu lượng 8 m³/h, cột áp 30 m.',
    ...overrides,
  });

  /** A draft of building A, through the API as the screen does. */
  const draft = async (body: Record<string, unknown>): Promise<RecordView> =>
    dataOf<RecordView>(
      await bqlA
        .post('/api/records', {
          buildingId: buildingA,
          title: 'MT-S1 Bơm tăng áp kêu to',
          description: 'Bơm tăng áp kêu to và rung khi chạy, cần kiểm tra.',
          ...body,
        })
        .expect(201),
    );
  const submit = async (record: RecordView, status: number) => {
    const photo = await upload(bqlA, record.id, 'SITE_PHOTO');
    return bqlA
      .post(`/api/records/${record.id}/submit`, { version: record.version, attachmentIds: [photo] })
      .expect(status);
  };

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    ktA = await signIn(server, 'kt-a');
    viewer = await signIn(server, 'ktoan-a');
    reference = dataOf<Reference>(await admin.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
    buildingA = await building('A');
    buildingB = await building('B');
    pumpRoom = locationOf(buildingA, 'Phòng bơm & bể nước ngầm');
    lobby = locationOf(buildingA, 'Sảnh chính');
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('AC-MT.15: the demo seed adds the 16 items once, with warranty warnings', async () => {
    const count = async () =>
      Number((await dataSource.query<Array<{ count: string }>>('SELECT count(*) FROM maintenance_items'))[0].count);
    expect(await count()).toBe(16);
    await app.get(DatabaseSeedService).run();
    expect(await count()).toBe(16);
    const rows = await list(admin);
    expect(rows.find((row) => row.item.code === 'CAM-A01')?.warranty).toBe('EXPIRING');
    expect(rows.some((row) => row.warranty === 'EXPIRED')).toBe(true);
  });

  it('AC-MT.1: bql-a creates BOM-A09; unknown condition, warranty ending soon, audited', async () => {
    pump = dataOf<Item>(
      await bqlA.post('/api/maintenance-items', { buildingId: buildingA, code: 'bom-a09', ...fields() }).expect(201),
    );
    expect(pump).toMatchObject({ code: 'BOM-A09', condition: 'UNKNOWN', active: true, version: 1 });
    const row = (await list(bqlA, `?buildingId=${buildingA}`)).find((r) => r.item.id === pump.id);
    expect(row).toMatchObject({ warranty: 'EXPIRING', needsAttention: true, repairCount: 0, approvedTotalVnd: '0' });
    const audit = (await detail(bqlA, pump.id)).audit;
    expect(audit.map((a) => a.action)).toEqual(['createMaintenanceItem']);
    expect(audit[0].actorId).toBe(ids['BQL-A']);
  });

  it('AC-MT.2: a code is unique per building only; the reference lists items for pickers', async () => {
    const duplicate = await bqlA
      .post('/api/maintenance-items', { buildingId: buildingA, code: 'BOM-A09', ...fields() })
      .expect(400);
    expect(errorFields(duplicate)).toEqual(['code']);
    expect(errorOf(duplicate).message).toBe(DUPLICATE);
    const lobbyB = locationOf(buildingB, 'Sảnh & khu thương mại');
    await bqlB
      .post('/api/maintenance-items', {
        buildingId: buildingB,
        code: 'BOM-A09',
        ...fields({ locationId: lobbyB, ownerUserId: ids['BQL-B'] }),
      })
      .expect(201);
    const bad = await bqlA
      .post('/api/maintenance-items', {
        buildingId: buildingA,
        code: 'x',
        ...fields({ name: 'ab', locationId: lobbyB, ownerUserId: ids['KT-A'], warrantyUntil: '2000-01-01' }),
      })
      .expect(400);
    expect(errorFields(bad).sort()).toEqual(['code', 'locationId', 'name', 'ownerUserId', 'warrantyUntil']);
    const items = dataOf<Reference>(await bqlA.get('/api/reference')).items;
    expect(items.some((row) => row.id === pump.id)).toBe(true);
  });

  it('AC-MT.3: an edit that sends another code keeps the code and saves the rest; a stale version conflicts', async () => {
    const saved = dataOf<Item>(
      await bqlA
        .patch(`/api/maintenance-items/${pump.id}`, {
          version: pump.version,
          code: 'BOM-X',
          ...fields({ name: 'Bơm tăng áp số 9' }),
        })
        .expect(200),
    );
    expect(saved).toMatchObject({ code: 'BOM-A09', name: 'Bơm tăng áp số 9', version: pump.version + 1 });
    await bqlA.patch(`/api/maintenance-items/${pump.id}`, { version: pump.version, ...fields() }).expect(409);
    pump = saved;
  });

  it('AC-MT.4: another building scope neither lists nor opens the item', async () => {
    expect((await list(bqlB)).some((row) => row.item.id === pump.id)).toBe(false);
    expect((await list(bqlB, `?buildingId=${buildingA}`)).length).toBe(0);
    await bqlB.get(`/api/maintenance-items/${pump.id}`).expect(404);
    await bqlB.patch(`/api/maintenance-items/${pump.id}`, { version: pump.version, ...fields() }).expect(404);
  });

  it('AC-MT.5: a read-only account reads but every write answers 403', async () => {
    expect((await list(viewer)).some((row) => row.item.id === pump.id)).toBe(true);
    await detail(viewer, pump.id);
    await viewer.post('/api/maintenance-items', { buildingId: buildingA, code: 'XEM-01', ...fields() }).expect(403);
    await viewer.patch(`/api/maintenance-items/${pump.id}`, { version: pump.version, ...fields() }).expect(403);
    await viewer
      .post(`/api/maintenance-items/${pump.id}/deactivate`, { version: pump.version, reason: 'Thử quyền.' })
      .expect(403);
    await viewer
      .post(`/api/maintenance-items/${pump.id}/condition`, {
        version: pump.version,
        condition: 'GOOD',
        note: 'Thử quyền.',
      })
      .expect(403);
    await ktA
      .post(`/api/maintenance-items/${pump.id}/condition`, {
        version: pump.version,
        condition: 'GOOD',
        note: 'Thử quyền.',
      })
      .expect(403);
  });

  it('a BQL limited to one location cannot write an item elsewhere', async () => {
    const roles = dataOf<Array<{ id: string; code: string; isSystem: boolean }>>(await admin.get('/api/roles'));
    const profile = dataOf<{ departmentId: string }>(await admin.get(`/api/users/${ids['BQL-A']}`));
    await admin
      .post('/api/users', {
        code: 'BQL-A7',
        fullName: 'BQL sảnh Tòa A',
        password: 'E2e-bql-a7-1',
        roleDefId: (roles.find((row) => row.code === 'BQL' && row.isSystem) as { id: string }).id,
        departmentId: profile.departmentId,
        buildingIds: [buildingA],
        locationIds: [lobby],
      })
      .expect(201);
    const lobbyBql = await signIn(server, 'bql-a7', 'E2e-bql-a7-1');
    await lobbyBql.patch(`/api/maintenance-items/${pump.id}`, { version: pump.version, ...fields() }).expect(404);
    const outside = await lobbyBql
      .post('/api/maintenance-items', { buildingId: buildingA, code: 'BOM-A08', ...fields() })
      .expect(400);
    expect(errorFields(outside)).toContain('locationId');
  });

  it('AC-MT.7: a condition change keeps old → new, note, who and when; "Cần chú ý" needs attention', async () => {
    const missing = await bqlA
      .post(`/api/maintenance-items/${pump.id}/condition`, {
        version: pump.version,
        condition: 'NEEDS_ATTENTION',
        note: 'ngắn',
      })
      .expect(400);
    expect(errorFields(missing)).toEqual(['note']);
    pump = dataOf<Item>(
      await bqlA
        .post(`/api/maintenance-items/${pump.id}/condition`, {
          version: pump.version,
          condition: 'NEEDS_ATTENTION',
          note: 'Phớt bơm rỉ nước, theo dõi thêm.',
        })
        .expect(200),
    );
    const page = await detail(bqlA, pump.id);
    expect(page.audit[0]).toMatchObject({
      action: 'updateItemCondition',
      fromStatus: 'UNKNOWN',
      toStatus: 'NEEDS_ATTENTION',
      reason: 'Phớt bơm rỉ nước, theo dõi thêm.',
      actorId: ids['BQL-A'],
    });
    expect((await list(bqlA)).find((row) => row.item.id === pump.id)?.needsAttention).toBe(true);
  });

  it('AC-MT.8: a PDF manual goes up as an item document under its original name and opens', async () => {
    const name = 'Hướng dẫn BOM-A09.pdf';
    const fields = { subjectType: 'MAINTENANCE_ITEM', subjectId: pump.id, purpose: 'ITEM_DOCUMENT' };
    const file = { content: PDF, filename: name, contentType: 'application/pdf' };
    await ktA.postMultipart('/api/attachments', fields, file).expect(403);
    await bqlA.postMultipart('/api/attachments', { ...fields, purpose: 'SITE_PHOTO' }, file).expect(400);
    const doc = dataOf<{ id: string; fileName: string }>(
      await bqlA.postMultipart('/api/attachments', fields, file).expect(201),
    );
    expect(doc.fileName).toBe(name);
    pump = dataOf<Item>(
      await bqlA
        .put(`/api/maintenance-items/${pump.id}/documents`, { version: pump.version, documentIds: [doc.id] })
        .expect(200),
    );
    expect((await detail(bqlA, pump.id)).documents).toEqual([expect.objectContaining({ id: doc.id, fileName: name })]);
    const content = await bqlA.getBinary(`/api/attachments/${doc.id}/content`).expect(200);
    expect(Buffer.compare(content.body as Buffer, PDF)).toBe(0);
    const foreign = await upload(bqlA, (await draft({ noMaintenanceItem: true })).id, 'SITE_PHOTO');
    await bqlA
      .put(`/api/maintenance-items/${pump.id}/documents`, { version: pump.version, documentIds: [foreign] })
      .expect(400);
  });

  it('AC-MT.9: choosing the item fills the location, submits, and the detail names the item', async () => {
    const record = await draft({ maintenanceItemId: pump.id });
    expect(record).toMatchObject({ maintenanceItemId: pump.id, noMaintenanceItem: false, locationId: pump.locationId });
    const submitted = dataOf<RecordView>(await submit(record, 200));
    expect(submitted.status).toBe('PENDING_CONFIRMATION');
    const recordDetail = dataOf<{ maintenanceItem: { id: string; code: string; name: string } | null }>(
      await bqlA.get(`/api/records/${record.id}`).expect(200),
    );
    expect(recordDetail.maintenanceItem).toMatchObject({ id: pump.id, code: 'BOM-A09', name: 'Bơm tăng áp số 9' });
  });

  it('AC-MT.10: "no specific equipment" still submits; nothing chosen is refused on the item field', async () => {
    expect((await submit(await draft({ locationId: lobby, noMaintenanceItem: true }), 200)).status).toBe(200);
    const none = await submit(await draft({ locationId: lobby }), 400);
    expect(errorFields(none)).toContain('maintenanceItemId');
  });

  it('AC-MT.11: a draft refuses an item of another building, an inactive item, or both choices at once', async () => {
    const record = await draft({ locationId: lobby, noMaintenanceItem: true });
    const itemB = (await list(bqlB, `?buildingId=${buildingB}`))[0].item;
    const other = await bqlA
      .patch(`/api/records/${record.id}`, { version: record.version, maintenanceItemId: itemB.id })
      .expect(400);
    expect(errorFields(other)).toEqual(['maintenanceItemId']);
    const both = await bqlA
      .patch(`/api/records/${record.id}`, {
        version: record.version,
        maintenanceItemId: pump.id,
        noMaintenanceItem: true,
      })
      .expect(400);
    expect(errorFields(both)).toEqual(['maintenanceItemId']);
  });

  it('AC-MT.6: deactivation hides the item from the default list and new records; reactivation restores it', async () => {
    const short = await bqlA
      .post(`/api/maintenance-items/${pump.id}/deactivate`, { version: pump.version, reason: 'cũ' })
      .expect(400);
    expect(errorFields(short)).toEqual(['reason']);
    pump = dataOf<Item>(
      await bqlA
        .post(`/api/maintenance-items/${pump.id}/deactivate`, {
          version: pump.version,
          reason: 'Thay bằng bơm biến tần mới.',
        })
        .expect(200),
    );
    expect(pump).toMatchObject({ active: false, deactivationReason: 'Thay bằng bơm biến tần mới.' });
    expect((await list(bqlA)).some((row) => row.item.id === pump.id)).toBe(false);
    expect((await list(bqlA, '?includeInactive=1')).some((row) => row.item.id === pump.id)).toBe(true);
    await bqlA.patch(`/api/maintenance-items/${pump.id}`, { version: pump.version, ...fields() }).expect(409);
    const refused = await bqlA
      .post('/api/records', { buildingId: buildingA, title: 'MT-S1 thiết bị đã ngừng', maintenanceItemId: pump.id })
      .expect(400);
    expect(errorFields(refused)).toEqual(['maintenanceItemId']);

    pump = dataOf<Item>(
      await bqlA
        .post(`/api/maintenance-items/${pump.id}/reactivate`, {
          version: pump.version,
          reason: 'Ngừng nhầm, bơm vẫn chạy.',
        })
        .expect(200),
    );
    expect(pump.active).toBe(true);
    await draft({ maintenanceItemId: pump.id });
    const actions = (await detail(bqlA, pump.id)).audit.slice(0, 2);
    expect(actions).toEqual([
      expect.objectContaining({ action: 'reactivateMaintenanceItem', reason: 'Ngừng nhầm, bơm vẫn chạy.' }),
      expect.objectContaining({ action: 'deactivateMaintenanceItem', reason: 'Thay bằng bơm biến tần mới.' }),
    ]);
  });

  it('AC-MT.12: repair count, approved cost and open repairs count each sent record once', async () => {
    const item = dataOf<Item>(
      await bqlA
        .post('/api/maintenance-items', { buildingId: buildingA, code: 'BOM-A10', ...fields({ warrantyUntil: null }) })
        .expect(201),
    );
    const sent = async () => {
      const record = await draft({ maintenanceItemId: item.id });
      await submit(record, 200);
      return record;
    };
    // H1 completed at 12 500 000; H2 in construction at 4 000 000 (its refused first attempt is not on the record);
    // H3 a draft; H4 withdrawn. Statuses and amounts are set directly: the stage flows have their own suites.
    const [h1, h2, h3, h4] = [await sent(), await sent(), await draft({ maintenanceItemId: item.id }), await sent()];
    await dataSource.query(
      `UPDATE repair_records SET status = 'COMPLETED', approved_amount_vnd = 12500000 WHERE id = $1`,
      [h1.id],
    );
    await dataSource.query(
      `UPDATE repair_records SET status = 'IN_CONSTRUCTION', approved_amount_vnd = 4000000 WHERE id = $1`,
      [h2.id],
    );
    await dataSource.query(`UPDATE repair_records SET status = 'CLOSED_WITHDRAWN' WHERE id = $1`, [h4.id]);

    const page = await detail(bqlA, item.id);
    expect(page).toMatchObject({ repairCount: 2, approvedTotalVnd: '16500000', openRepairCount: 1 });
    expect(page.repairs.map((row) => row.id).sort()).toEqual([h1.id, h2.id].sort());
    expect(page.repairs.some((row) => row.id === h3.id)).toBe(false);
    expect((await list(bqlA)).find((row) => row.item.id === item.id)).toMatchObject({
      openRepairCount: 1,
      needsAttention: true,
    });
  });

  it('AC-MT.13: a record without equipment keeps "no specific equipment"', async () => {
    const record = await draft({ locationId: lobby, noMaintenanceItem: true });
    const view = dataOf<{ record: RecordView; maintenanceItem: unknown }>(
      await bqlA.get(`/api/records/${record.id}`).expect(200),
    );
    expect(view.record).toMatchObject({ maintenanceItemId: null, noMaintenanceItem: true });
    expect(view.maintenanceItem).toBeNull();
  });
});
