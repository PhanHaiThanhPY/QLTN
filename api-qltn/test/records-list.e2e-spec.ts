import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, signIn, type Session } from './app-harness';

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
  code: string;
  title: string;
  status: string;
  version: number;
  buildingId: string;
  locationId: string;
}

interface ListView {
  data: RecordView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const ACCENTED_TITLE = 'D2T4-Thấm trần hành lang tầng 5';
const RECORD_COUNT = 25;
const LOCATION_COUNT = 13;
const ASSIGNEE_COUNT = 5;

const vnToday = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const shiftDay = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
};

describe('Repair record list (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let bqlA: Session;
  let bqlB: Session;
  let buildingA: Building;
  let locationId: string;
  let confirmationUserId: string;
  let withdrawnRecord: RecordView;
  let codeOfAccented: string;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');

    const buildings = dataOf<Building[]>(await bqlA.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    const reference = dataOf<Reference>(await bqlA.get('/api/reference'));
    locationId = (reference.locations.find((row) => row.buildingId === buildingA.id) as { id: string }).id;
    confirmationUserId = (reference.users.find((row) => row.code === 'KT-A2') as { id: string }).id;

    const created: RecordView[] = [];
    for (let index = 0; index < RECORD_COUNT; index += 1) {
      const body: Record<string, unknown> = {
        buildingId: buildingA.id,
        title: index === 0 ? ACCENTED_TITLE : `D2T4- Hồ sơ kiểm thử danh sách ${index}`,
        noMaintenanceItem: true,
      };
      if (index < LOCATION_COUNT) body.locationId = locationId;
      if (index < ASSIGNEE_COUNT) body.confirmationUserId = confirmationUserId;
      created.push(dataOf<RecordView>(await bqlA.post('/api/records', body).expect(201)));
    }
    codeOfAccented = created[0].code;

    // A second status and group so `status` / `statusGroup` have something to differ from.
    withdrawnRecord = dataOf<RecordView>(
      await bqlA
        .post(`/api/records/${created[0].id}/withdraw`, {
          version: created[0].version,
          reason: 'Dữ liệu kiểm thử danh sách, rút để thử bộ lọc trạng thái.',
        })
        .expect(200),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const list = async (session: Session, query: string): Promise<ListView> => {
    const res = await session.get(`/api/records?${query}`).expect(200);
    return dataOf<ListView>(res);
  };

  it('paginates on the server with meta.total and page 2 holding different rows', async () => {
    const first = await list(bqlA, 'page=1&limit=10');
    expect(first.meta).toEqual({ page: 1, limit: 10, total: RECORD_COUNT, totalPages: 3 });
    expect(first.data).toHaveLength(10);
    expect(first.data[0]?.id).toBe(withdrawnRecord.id);

    const second = await list(bqlA, 'page=2&limit=10');
    expect(second.meta.page).toBe(2);
    expect(second.meta.total).toBe(RECORD_COUNT);
    expect(second.data).toHaveLength(10);
    expect(second.data.map((row) => row.id)).not.toEqual(expect.arrayContaining(first.data.map((row) => row.id)));
  });

  it('rejects a limit above 100 instead of clamping it', async () => {
    const res = await bqlA.get('/api/records?limit=101').expect(400);
    expect(errorFields(res)).toContain('limit');
  });

  it('searches by code and by an unaccented title', async () => {
    const byName = await list(bqlA, 'search=tham%20tran');
    expect(byName.meta.total).toBe(1);
    expect(byName.data[0]?.title).toBe(ACCENTED_TITLE);

    const byCode = await list(bqlA, `search=${encodeURIComponent(codeOfAccented)}`);
    expect(byCode.data.map((row) => row.code)).toContain(codeOfAccented);
  });

  it('filters by status group, status, location and assignee', async () => {
    const draft = await list(bqlA, 'status=DRAFT');
    expect(draft.meta.total).toBe(RECORD_COUNT - 1);

    const closed = await list(bqlA, 'status=CLOSED_WITHDRAWN');
    expect(closed.meta.total).toBe(1);
    expect(closed.data[0]?.id).toBe(withdrawnRecord.id);

    const intake = await list(bqlA, 'statusGroup=INTAKE');
    expect(intake.meta.total).toBe(RECORD_COUNT - 1);

    const closedGroup = await list(bqlA, 'statusGroup=CLOSED');
    expect(closedGroup.meta.total).toBe(1);

    const byLocation = await list(bqlA, `locationId=${locationId}`);
    expect(byLocation.meta.total).toBe(LOCATION_COUNT);

    const byAssignee = await list(bqlA, `assigneeId=${confirmationUserId}`);
    expect(byAssignee.meta.total).toBe(ASSIGNEE_COUNT);
  });

  it('filters by creation date in Vietnam time', async () => {
    const today = vnToday();
    const sameDay = await list(bqlA, `dateFrom=${today}&dateTo=${today}`);
    expect(sameDay.meta.total).toBe(RECORD_COUNT);

    const fromTomorrow = await list(bqlA, `dateFrom=${shiftDay(today, 1)}`);
    expect(fromTomorrow.meta.total).toBe(0);

    const untilYesterday = await list(bqlA, `dateTo=${shiftDay(today, -1)}`);
    expect(untilYesterday.meta.total).toBe(0);
  });

  it('answers meta with total 0 when nothing matches', async () => {
    const empty = await list(bqlA, 'search=khong-he-co-ho-so-nay');
    expect(empty).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('keeps another building out of scope: its own list is empty and building A answers total 0', async () => {
    const bScope = await list(bqlB, 'search=D2T4');
    expect(bScope.meta.total).toBe(0);

    const outOfScope = await list(bqlB, `buildingId=${buildingA.id}`);
    expect(outOfScope).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    const ownBuilding = await list(bqlA, `buildingId=${buildingA.id}`);
    expect(ownBuilding.meta.total).toBe(RECORD_COUNT);
    expect(ownBuilding.data.every((row) => row.buildingId === buildingA.id)).toBe(true);
  });

  it('rejects filters the backend does not have (overdue)', async () => {
    const res = await bqlA.get('/api/records?overdue=true').expect(400);
    expect(errorFields(res)).toContain('overdue');
  });

  it('rejects a malformed building id', async () => {
    const res = await bqlA.get('/api/records?buildingId=not-a-uuid').expect(400);
    expect(errorFields(res)).toContain('buildingId');
  });
});
