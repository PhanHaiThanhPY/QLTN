import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { createApp, dataOf, signIn, type Session } from './app-harness';

/**
 * SPEC RM-S2 (docs/product/features/RM-admin-xem-toan-bo/SPEC.md): ADMIN reads every module of its buildings on the
 * demo data and gets 403 on every write, approval or money operation; the fund account stays masked for it.
 */

interface Fund {
  id: string;
  buildingId: string;
  accountNo: string | null;
  accountMasked: string | null;
  openingDate: string;
}

describe('ADMIN sees everything, does nothing, RM-S2 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let ktoan: Session;
  let fund: Fund;
  let month: string;

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    ktoan = await signIn(server, 'ktoan-a');
    const funds = dataOf<Fund[]>(await ktoan.get('/api/funds').expect(200));
    fund = funds[0];
    month = fund.openingDate.slice(0, 7);
    // Boot (migrations and the demo seed) plus the sign-ins outlast 30 s on a loaded machine.
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('AC-RM2.2: ADMIN reads MT-001 with its bids, HĐ-001, the fund month, the report and its XLSX, the reconciliation', async () => {
    const packages = dataOf<Array<{ id: string; code: string }>>(
      await admin.get('/api/exploitation/packages').expect(200),
    );
    const mt001 = packages.find((row) => row.code === 'MT-001') as { id: string };
    const pkg = dataOf<{ bids: unknown[] }>(await admin.get(`/api/exploitation/packages/${mt001.id}`).expect(200));
    expect(pkg.bids.length).toBeGreaterThan(0);
    const contracts = dataOf<{ rows: Array<{ id: string; code: string }> }>(
      await admin.get('/api/exploitation/contracts').expect(200),
    ).rows;
    const hd001 = contracts.find((row) => row.code === 'HĐ-001') as { id: string };
    await admin.get(`/api/exploitation/contracts/${hd001.id}`).expect(200);
    await admin.get(`/api/exploitation/contracts/${hd001.id}/termination`).expect(200);
    await admin.get(`/api/funds/${fund.id}/ledger?month=${month}`).expect(200);
    await admin.get(`/api/funds/${fund.id}/taxes?month=${month}`).expect(200);
    await admin.get(`/api/funds/${fund.id}/vouchers?month=${month}`).expect(200);
    await admin.get(`/api/funds/${fund.id}/reconciliation?month=${month}`).expect(200);
    await admin.get(`/api/exploitation/report?fundId=${fund.id}&kind=MONTH&value=${month}`).expect(200);
    await admin.getBinary(`/api/exploitation/report/export?fundId=${fund.id}&kind=MONTH&value=${month}`).expect(200);
    await admin.get('/api/deposits/invitations').expect(200);
  });

  it('AC-RM2.4: the account number stays masked for ADMIN; Kế toán sees it whole', async () => {
    const seen = dataOf<Fund[]>(await admin.get('/api/funds').expect(200)).find((row) => row.id === fund.id) as Fund;
    expect(seen.accountNo).toBeNull();
    expect(seen.accountMasked).toMatch(/^\*{4}\d{4}$/);
    const whole = dataOf<Fund>(await ktoan.get(`/api/funds/${fund.id}`).expect(200));
    expect(whole.accountNo).toMatch(/^\d+$/);
    const recon = dataOf<{ fund: { accountNo: string | null } }>(
      await admin.get(`/api/funds/${fund.id}/reconciliation?month=${month}`).expect(200),
    );
    expect(recon.fund.accountNo).toBeNull();
  });

  it('AC-RM2.3: approving, recording money, signing and confirming all answer 403 to ADMIN', async () => {
    const contracts = dataOf<{ rows: Array<{ id: string; code: string }> }>(
      await admin.get('/api/exploitation/contracts').expect(200),
    ).rows;
    const hd001 = contracts.find((row) => row.code === 'HĐ-001') as { id: string };
    const vouchers = dataOf<{ rows: Array<{ id: string; version: number }> }>(
      await admin.get(`/api/funds/${fund.id}/vouchers?month=${month}`).expect(200),
    ).rows;
    const records = dataOf<{ data: Array<{ id: string; version: number }> }>(
      await admin.get('/api/records?limit=1').expect(200),
    ).data;
    const occurrences = dataOf<{ rows: Array<{ id: string; version: number }> }>(
      await admin.get('/api/maintenance-occurrences?scope=all').expect(200),
    ).rows;
    const writes = [
      admin.post(`/api/exploitation/contracts/${hd001.id}/receipts`, {
        receivedOn: month + '-15',
        amountVnd: '1',
        attachmentId: hd001.id,
      }),
      admin.post(`/api/funds/${fund.id}/vouchers`, {
        category: 'SERVICE',
        content: 'Quản trị thử lập phiếu chi',
        payeeName: 'X',
        amountVnd: '1',
      }),
      admin.post(`/api/funds/vouchers/${vouchers[0].id}/approve`, { version: vouchers[0].version }),
      admin.post(`/api/funds/${fund.id}/reconciliation/confirm`, { month }),
      admin.post(`/api/records/${records[0].id}/approve-proposal`, { version: records[0].version }),
      admin.post(`/api/maintenance-occurrences/${occurrences[0].id}/confirm`, { version: occurrences[0].version }),
      admin.post('/api/deposits/banks', { name: 'Ngân hàng của quản trị' }),
    ];
    const statuses = (await Promise.all(writes)).map((res) => res.status);
    expect(statuses).toEqual(writes.map(() => 403));
  });

  it('AC-RM2.6: an ADMIN of tòa A only gets 404 on tòa B, like any role', async () => {
    const roles = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/roles').expect(200));
    const departments = dataOf<Array<{ id: string }>>(await admin.get('/api/departments').expect(200));
    const buildings = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings').expect(200));
    const byCode = Object.fromEntries(buildings.map((row) => [row.code, row.id]));
    await admin
      .post('/api/users', {
        code: 'QT-A',
        fullName: 'Quản trị tòa A',
        password: 'E2e-admin-a1',
        roleDefId: (roles.find((row) => row.code === 'ADMIN') as { id: string }).id,
        departmentId: departments[0].id,
        buildingIds: [byCode.A],
      })
      .expect(201);
    const adminA = await signIn(server, 'qt-a', 'E2e-admin-a1');
    const funds = dataOf<Fund[]>(await admin.get('/api/funds').expect(200));
    const fundB = funds.find((row) => row.buildingId === byCode.B) as Fund;
    await adminA.get(`/api/funds/${fundB.id}/ledger?month=${month}`).expect(404);
    const own = dataOf<Fund[]>(await adminA.get('/api/funds').expect(200));
    expect(own.map((row) => row.buildingId)).toEqual([byCode.A]);
  });
});
