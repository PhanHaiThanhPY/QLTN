import { Client } from 'pg';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, signIn, type Session } from './app-harness';

interface Building {
  id: string;
  code: string;
}

interface Reference {
  locations: Array<{ id: string; buildingId: string }>;
}

interface RecordView {
  id: string;
  code: string;
  status: string;
  buildingId: string;
}

interface Summary {
  open: number;
  needsUpdate: number;
  completed: number;
  total: number;
  asOf: string;
}

/**
 * Direct SQL status updates for setup only: the screens that reach `NEEDS_*`/`COMPLETED` arrive in R2+
 * (Đợt 2), so the counters are tested against realistic statuses instead of a single DRAFT bucket.
 */
const client = new Client({
  host: process.env.CONFIG_POSTGRES_HOST_QLTN,
  port: Number(process.env.CONFIG_POSTGRES_PORT_QLTN),
  user: process.env.CONFIG_POSTGRES_USER_QLTN,
  password: process.env.CONFIG_POSTGRES_PASSWORD_QLTN,
  database: process.env.CONFIG_POSTGRES_DB_QLTN,
});

const PREFIX = 'D2T4B-';

/** Index → status applied after creation; indexes not listed stay DRAFT. */
const STATUS_BY_INDEX: ReadonlyArray<readonly [number, string]> = [
  [0, 'COMPLETED'],
  [1, 'COMPLETED'],
  [2, 'NEEDS_RECORD_UPDATE'],
  [3, 'NEEDS_RECORD_UPDATE'],
  [4, 'NEEDS_SUBMISSION_UPDATE'],
  [5, 'NEEDS_REPAIR'],
  [6, 'UNRESOLVED'],
];

const setStatus = async (id: string, status: string): Promise<void> => {
  await client.query('UPDATE repair_records SET status = $1 WHERE id = $2', [status, id]);
};

describe('Repair record summary (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let buildingA: Building;
  let buildingB: Building;
  const ownRecords: RecordView[] = [];
  const buildingBRecords: RecordView[] = [];

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');

    const buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    buildingA = buildings.find((row) => row.code === 'A') as Building;
    buildingB = buildings.find((row) => row.code === 'B') as Building;
    const referenceA = dataOf<Reference>(await bqlA.get('/api/reference'));
    const locationA = referenceA.locations.find((row) => row.buildingId === buildingA.id) as { id: string };

    for (let index = 0; index < 10; index += 1) {
      ownRecords.push(
        dataOf<RecordView>(
          await bqlA
            .post('/api/records', {
              buildingId: buildingA.id,
              title: `${PREFIX} Hồ sơ đếm thẻ ${index}`,
              noMaintenanceItem: true,
              locationId: locationA.id,
            })
            .expect(201),
        ),
      );
    }
    // A final status reachable through the API today, so the card counters ignore it as well.
    await bqlA
      .post(`/api/records/${ownRecords[9].id}/withdraw`, {
        version: 1,
        reason: 'Dữ liệu kiểm thử thẻ đếm, rút để thử trạng thái kết thúc.',
      })
      .expect(200);

    const referenceB = dataOf<Reference>(await bqlB.get('/api/reference'));
    const locationB = referenceB.locations.find((row) => row.buildingId === buildingB.id) as { id: string };
    for (let index = 0; index < 2; index += 1) {
      buildingBRecords.push(
        dataOf<RecordView>(
          await bqlB
            .post('/api/records', {
              buildingId: buildingB.id,
              title: `${PREFIX} Hồ sơ tòa B ${index}`,
              noMaintenanceItem: true,
              locationId: locationB.id,
            })
            .expect(201),
        ),
      );
    }

    await client.connect();
    try {
      for (const [index, status] of STATUS_BY_INDEX) {
        await setStatus(ownRecords[index].id, status);
      }
      await setStatus(buildingBRecords[1].id, 'COMPLETED');
    } finally {
      await client.end();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const summary = async (session: Session, query = ''): Promise<Summary> => {
    const res = await session.get(`/api/records/summary${query ? `?${query}` : ''}`).expect(200);
    return dataOf<Summary>(res);
  };

  const listTotal = async (session: Session, query: string): Promise<number> => {
    const res = await session.get(`/api/records?${query}&limit=1`).expect(200);
    return dataOf<{ meta: { total: number } }>(res).meta.total;
  };

  it('counts open, needs-update, completed and total in one call', async () => {
    const counters = await summary(bqlA);
    expect(counters).toMatchObject({ open: 6, needsUpdate: 5, completed: 2, total: 10 });
    expect(Number.isNaN(Date.parse(counters.asOf))).toBe(false);
  });

  it('matches meta.total of the list call behind each card', async () => {
    const counters = await summary(bqlA);
    expect(await listTotal(bqlA, 'open=1')).toBe(counters.open);
    expect(await listTotal(bqlA, 'attention=needs_update')).toBe(counters.needsUpdate);
    expect(await listTotal(bqlA, 'status=COMPLETED')).toBe(counters.completed);
    expect(await listTotal(bqlA, '')).toBe(counters.total);
  });

  it('keeps another building out of the count and answers zeros outside the scope', async () => {
    const bCounters = await summary(bqlB);
    expect(bCounters).toMatchObject({ open: 1, needsUpdate: 0, completed: 1, total: 2 });
    expect(await listTotal(bqlB, 'search=D2T4B')).toBe(2);

    const outOfScope = await summary(bqlB, `buildingId=${buildingA.id}`);
    expect(outOfScope).toMatchObject({ open: 0, needsUpdate: 0, completed: 0, total: 0 });

    const ownBuilding = await summary(bqlA, `buildingId=${buildingA.id}`);
    expect(ownBuilding).toMatchObject({ open: 6, needsUpdate: 5, completed: 2, total: 10 });
  });

  it('rejects parameters it does not have and a malformed building id', async () => {
    expect(errorFields(await bqlA.get('/api/records/summary?page=1').expect(400))).toContain('page');
    expect(errorFields(await bqlA.get('/api/records/summary?overdue=1').expect(400))).toContain('overdue');
    expect(errorFields(await bqlA.get('/api/records/summary?buildingId=not-a-uuid').expect(400))).toContain(
      'buildingId',
    );
  });
});
