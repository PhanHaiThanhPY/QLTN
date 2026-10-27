import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Clock } from '../src/common/services/clock.service';
import { DatabaseSeedService } from '../src/database/seeds/database-seed.service';
import { ContractsService } from '../src/modules/exploitation/contracts.service';
import { readXlsx } from '../src/modules/fund/statement-file';
import { createApp, dataOf, errorFields, errorOf, signIn, type Session } from './app-harness';
import { insertActiveContract, type ContractTerms } from './fund-fixtures';

/**
 * SPEC F-S5 (docs/product/features/F-bao-cao-thanh-ly/SPEC.md): the fund report and contract termination. "Now" is
 * pinned per step. Tòa B gets the D1 November (opening 50; PT 10 + 5; GNT 2; PC 3; statement reconciled 4/4).
 */

interface Fund {
  id: string;
  buildingId: string;
  version: number;
}
interface Report {
  source: 'STATEMENT' | 'LEDGER';
  unreconciled: Array<{ month: string; differenceVnd: string | null }>;
  figures: { openingVnd: string; inVnd: string; outVnd: string; closingVnd: string };
  sources: Array<{ direction: string; category: string; amountVnd: string }>;
  byContract: Array<{ code: string; amountVnd: string }>;
  outstandingVnd: string;
  depositHeldVnd: string;
  writeOffVnd: string;
}
interface Termination {
  termination: { id: string; code: string; status: string; version: number } | null;
  handovers: Array<{ code: string; result: string }>;
  offsets: Array<{ id: string; code: string; version: number }>;
  writeOffs: Array<{ id: string; code: string; status: string; version: number }>;
  checks: Array<{ key: string; ok: boolean; detail: string }>;
  canClose: boolean;
  remainingVnd: string;
  depositHeldVnd: string;
}

const PDF = Buffer.from('%PDF-1.4\n% thanh ly F-S5\n', 'utf8');
const at9 = (date: string): Date => new Date(`${date}T09:00:00+07:00`);
const D1_CSV = [
  'Ngày giao dịch,Ghi có,Ghi nợ,Nội dung,Số tham chiếu,Số tài khoản',
  '18/11/2026,10000000,,DV-A chuyen tien,FT001,',
  '22/11/2026,5000000,,DV-A chuyen tien,FT002,',
  '22/11/2026,,2000000,Nop thue thang 11,FT003,',
  '23/11/2026,,3000000,Chi dich vu ve sinh,FT004,',
].join('\n');
const check = (view: Termination, key: string) =>
  view.checks.find((row) => row.key === key) as Termination['checks'][number];

describe('Fund report and contract termination, F-S5 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let clock: Clock;
  let dataSource: DataSource;
  let admin: Session;
  let bqt: Session;
  let bqlA: Session;
  let bqlB: Session;
  let ktoanA: Session;
  let ktoan: Session;
  let buildings: Record<string, string>;
  let fundA: Fund;
  let fundB: Fund;
  let small: string;
  let big: string;
  let seq = 0;

  const contract = (terms: ContractTerms) => {
    seq += 1;
    return insertActiveContract(dataSource, buildings.B, `F5${seq}`, terms);
  };
  const upload = async (session: Session, subjectType: string, subjectId: string, purpose: string): Promise<string> =>
    dataOf<{ id: string }>(
      await session
        .postMultipart(
          '/api/attachments',
          { subjectType, subjectId, purpose },
          { content: PDF, filename: `${purpose}.pdf`, contentType: 'application/pdf' },
        )
        .expect(201),
    ).id;
  const packageOf = async (contractId: string): Promise<string> =>
    (
      await dataSource.query<Array<{ package_id: string }>>(
        'SELECT package_id FROM exploitation_contracts WHERE id = $1',
        [contractId],
      )
    )[0].package_id;
  const fundFile = (purpose: string) => upload(ktoan, 'FUND', fundB.id, purpose);
  const termFile = async (contractId: string) =>
    upload(bqlB, 'EXPLOITATION_PACKAGE', await packageOf(contractId), 'TERMINATION_DOCUMENT');
  const receipt = async (contractId: string, receivedOn: string, amountVnd: string) =>
    ktoan
      .post(`/api/exploitation/contracts/${contractId}/receipts`, {
        receivedOn,
        amountVnd,
        attachmentId: await fundFile('RECEIPT_PROOF'),
      })
      .expect(201);
  const report = async (kind: string, value: string, session: Session = bqt, fundId = fundB.id): Promise<Report> =>
    dataOf<Report>(
      await session.get(`/api/exploitation/report?fundId=${fundId}&kind=${kind}&value=${value}`).expect(200),
    );
  const termination = async (contractId: string, session: Session = bqlB): Promise<Termination> =>
    dataOf<Termination>(await session.get(`/api/exploitation/contracts/${contractId}/termination`).expect(200));
  const terminate = async (
    contractId: string,
    reason = 'EXPIRED',
    terminationDate: string | null = null,
  ): Promise<Termination> =>
    dataOf<Termination>(
      await bqlB
        .post(`/api/exploitation/contracts/${contractId}/termination`, {
          reason,
          note: 'Hai bên thống nhất thanh lý hợp đồng.',
          terminationDate,
        })
        .expect(201),
    );
  const handover = async (view: Termination, contractId: string, result = 'PASSED', note: string | null = null) =>
    bqlB
      .post(`/api/exploitation/terminations/${view.termination?.id}/handovers`, {
        handedOn: '2026-12-01',
        result,
        note,
        attachmentId: await termFile(contractId),
      })
      .expect(201);
  const minutes = async (contractId: string) => {
    const view = await termination(contractId);
    return bqlB
      .post(`/api/exploitation/terminations/${view.termination?.id}/minutes`, {
        version: view.termination?.version,
        attachmentId: await termFile(contractId),
        signedOn: '2026-12-02',
      })
      .expect(200);
  };
  const voucher = async (fields: object): Promise<{ id: string; version: number }> => {
    let row = dataOf<{ id: string; version: number }>(
      await ktoan
        .post(`/api/funds/${fundB.id}/vouchers`, {
          content: 'Chi theo đề nghị đã duyệt',
          payeeName: 'DV-A',
          requestAttachmentId: await fundFile('VOUCHER_REQUEST'),
          ...fields,
        })
        .expect(201),
    );
    row = dataOf(await ktoan.post(`/api/funds/vouchers/${row.id}/submit`, { version: row.version }).expect(201));
    return row;
  };
  const approveAndPay = async (row: { id: string; version: number }, paidOn: string) => {
    const approved = dataOf<{ id: string; version: number }>(
      await bqt.post(`/api/funds/vouchers/${row.id}/approve`, { version: row.version }).expect(201),
    );
    await ktoan
      .post(`/api/funds/vouchers/${row.id}/pay`, {
        version: approved.version,
        paidOn,
        proofAttachmentId: await fundFile('VOUCHER_PROOF'),
      })
      .expect(201);
  };

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    clock = app.get(Clock);
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqt = await signIn(server, 'bqt');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    ktoanA = await signIn(server, 'ktoan-a');
    const list = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings').expect(200));
    buildings = Object.fromEntries(list.map((row) => [row.code, row.id]));
    const roles = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/roles').expect(200));
    const departments = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/departments').expect(200));
    await admin
      .post('/api/users', {
        code: 'KTOAN-S5',
        fullName: 'Kế toán tòa B',
        password: 'E2e-ktoan-s5',
        roleDefId: (roles.find((row) => row.code === 'KTOAN') as { id: string }).id,
        departmentId: (departments.find((row) => row.code === 'KTOAN') as { id: string }).id,
        buildingIds: [buildings.B],
      })
      .expect(201);
    ktoan = await signIn(server, 'ktoan-s5', 'E2e-ktoan-s5');
    const funds = dataOf<Fund[]>(await bqt.get('/api/funds').expect(200));
    fundA = funds.find((row) => row.buildingId === buildings.A) as Fund;
    fundB = funds.find((row) => row.buildingId === buildings.B) as Fund;

    // D1 November on tòa B, reconciled with its statement.
    clock.set(at9('2026-11-23'));
    fundB = dataOf<Fund>(
      await ktoan
        .put(`/api/funds/${fundB.id}/setup`, {
          version: fundB.version,
          bankName: 'Vietcombank',
          accountNo: '0071000000002',
          accountHolder: 'BQT Tòa B',
          openingDate: '2026-11-01',
          openingBalanceVnd: '50000000',
        })
        .expect(200),
    );
    small = await contract({ startDate: '2026-11-16', endDate: '2026-11-30', priceVnd: '20000000' });
    big = await contract({ startDate: '2026-12-01', endDate: '2027-02-28', priceVnd: '20000000' });
    await receipt(small, '2026-11-18', '10000000');
    await receipt(small, '2026-11-22', '5000000');
    const tax = dataOf<{ id: string }>(
      await ktoan
        .post(`/api/funds/${fundB.id}/taxes`, {
          month: '2026-11',
          amountVnd: '2000000',
          attachmentId: await fundFile('TAX_FILING'),
        })
        .expect(201),
    );
    await ktoan
      .post(`/api/funds/taxes/${tax.id}/payments`, {
        paidOn: '2026-11-22',
        amountVnd: '2000000',
        attachmentId: await fundFile('TAX_PAYMENT_SLIP'),
      })
      .expect(201);
    await approveAndPay(await voucher({ category: 'SERVICE', amountVnd: '3000000' }), '2026-11-23');
    clock.set(at9('2026-12-05'));
    await ktoan
      .postMultipart(
        `/api/funds/${fundB.id}/statements`,
        {
          periodFrom: '2026-11-01',
          periodTo: '2026-11-30',
          openingBalanceVnd: '50000000',
          closingBalanceVnd: '60000000',
        },
        { content: Buffer.from(D1_CSV, 'utf8'), filename: 'sao-ke.csv', contentType: 'text/csv' },
      )
      .expect(201);
    await ktoan.post(`/api/funds/${fundB.id}/reconciliation/confirm`, { month: '2026-11' }).expect(200);
  });

  afterAll(async () => {
    clock.set(null);
    await app.close();
  });

  it('AC-F5.1 / AC-F5.4: November by the statement — 50 + 15 − 5 = 60, its sources, 5 tr owed apart; the XLSX says the same', async () => {
    const view = await report('MONTH', '2026-11');
    expect(view.source).toBe('STATEMENT');
    expect(view.figures).toEqual({
      openingVnd: '50000000',
      inVnd: '15000000',
      outVnd: '5000000',
      closingVnd: '60000000',
    });
    expect(view.sources.map((row) => [row.direction, row.category, row.amountVnd])).toEqual([
      ['IN', 'CONTRACT_RECEIPT', '15000000'],
      ['OUT', 'TAX', '2000000'],
      ['OUT', 'SERVICE', '3000000'],
    ]);
    expect(view.outstandingVnd).toBe('5000000');
    expect(view.byContract.map((row) => row.amountVnd)).toEqual(['15000000']);

    const res = await ktoan
      .get(`/api/exploitation/report/export?fundId=${fundB.id}&kind=MONTH&value=2026-11`)
      .buffer(true)
      .parse((stream, done) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('bao-cao-thu-chi-b-2026-11.xlsx');
    const file = res.body as Buffer;
    const summary = readXlsx(file, 0);
    const value = (label: string) => summary.find((row) => row[0] === label)?.[1];
    expect([value('Đầu kỳ'), value('Tổng thu'), value('Tổng chi'), value('Cuối kỳ'), value('Còn phải thu')]).toEqual([
      50000000, 15000000, 5000000, 60000000, 5000000,
    ]);
    expect(value('Nguồn số')).toBe('Theo sao kê · Đã đối soát');
    const detail = readXlsx(file, 1);
    expect(detail.slice(1).map((row) => String(row[1] || row[2]).replace(/-\d+$/, ''))).toEqual([
      'Số dư đầu',
      'PT',
      'PT',
      'GNT',
      'PC',
    ]);
    expect(detail.slice(2).map((row) => row[5])).toEqual(['GD-001', 'GD-002', 'GD-003', 'GD-004']);
    expect(typeof detail[2][4]).toBe('number');
    expect(readXlsx(file, 2)[1]?.[4]).toBe(5000000);
  });

  it('AC-F5.2 / AC-F5.3: an unbanked receipt turns the month back to the ledger; a quarter adds its months up', async () => {
    await receipt(big, '2026-11-29', '1000000');
    const view = await report('MONTH', '2026-11');
    expect(view.source).toBe('LEDGER');
    expect(view.unreconciled).toEqual([{ month: '2026-11', differenceVnd: '1000000' }]);
    expect(view.figures.closingVnd).toBe('61000000');
    const quarter = await report('QUARTER', '2026-Q4');
    expect(quarter.figures.openingVnd).toBe('50000000');
    expect(BigInt(quarter.figures.openingVnd) + BigInt(quarter.figures.inVnd) - BigInt(quarter.figures.outVnd)).toBe(
      BigInt(quarter.figures.closingVnd),
    );
  });

  it('AC-F5.6: BQL gets 403; another building answers 404', async () => {
    const denied = await bqlB.get(`/api/exploitation/report?fundId=${fundB.id}&kind=MONTH&value=2026-11`).expect(403);
    expect(errorOf(denied).message).toBe('Bạn không có quyền xem báo cáo quỹ.');
    await ktoan.get(`/api/exploitation/report?fundId=${fundA.id}&kind=MONTH&value=2026-11`).expect(404);
  });

  it('AC-F5.7 / AC-F5.8: handed over and signed, 5 tr still owed — not closable; once collected, closed and read-only', async () => {
    let view = await terminate(small);
    expect(view.termination?.code).toMatch(/^TL-\d{3}$/);
    await handover(view, small);
    await minutes(small);
    view = await termination(small);
    expect(check(view, 'HANDOVER')).toMatchObject({ ok: true, detail: 'Đạt' });
    expect(check(view, 'MINUTES')).toMatchObject({ ok: true, detail: 'Đã lập' });
    expect(check(view, 'RECEIVABLES')).toMatchObject({ ok: false, detail: 'Còn 5.000.000 đ' });
    expect(view.canClose).toBe(false);
    const refused = await bqlB
      .post(`/api/exploitation/terminations/${view.termination?.id}/close`, { version: view.termination?.version })
      .expect(400);
    expect(errorFields(refused)).toEqual(['checks.RECEIVABLES']);

    const spare = await termFile(small);
    await receipt(small, '2026-12-05', '5000000');
    view = await termination(small);
    expect(view.canClose).toBe(true);
    view = dataOf<Termination>(
      await bqlB
        .post(`/api/exploitation/terminations/${view.termination?.id}/close`, { version: view.termination?.version })
        .expect(200),
    );
    expect(view.termination?.status).toBe('CLOSED');
    const [row] = await dataSource.query<Array<{ status: string; pkg: string }>>(
      'SELECT c.status, p.status AS pkg FROM exploitation_contracts c JOIN exploitation_packages p ON p.id = c.package_id WHERE c.id = $1',
      [small],
    );
    expect(row).toEqual({ status: 'TERMINATED', pkg: 'FINISHED' });
    await ktoan
      .post(`/api/exploitation/contracts/${small}/receipts`, {
        receivedOn: '2026-12-05',
        amountVnd: '1',
        attachmentId: await fundFile('RECEIPT_PROOF'),
      })
      .expect(409);
    await bqlB
      .post(`/api/exploitation/terminations/${view.termination?.id}/handovers`, {
        handedOn: '2026-12-05',
        result: 'PASSED',
        attachmentId: spare,
      })
      .expect(409);
  });

  it('AC-F5.9: a write-off approved by BQT (never its proposer) settles the debt with no ledger line', async () => {
    const third = await contract({ startDate: '2026-11-16', endDate: '2026-11-30', priceVnd: '20000000' });
    await receipt(third, '2026-12-05', '15000000');
    const view = await terminate(third);
    const lines = async () =>
      (await dataSource.query<Array<{ n: string }>>('SELECT count(*)::text AS n FROM fund_ledger_entries'))[0].n;
    const before = await lines();
    const proposed = dataOf<Termination>(
      await ktoan
        .post(`/api/exploitation/terminations/${view.termination?.id}/write-offs`, {
          amountVnd: '5000000',
          reason: 'Đơn vị đã giải thể, không còn khả năng trả nợ.',
        })
        .expect(201),
    );
    const writeOff = proposed.writeOffs[0];
    expect(check(proposed, 'PENDING').ok).toBe(false);
    await ktoan.post(`/api/exploitation/write-offs/${writeOff.id}/approve`, { version: writeOff.version }).expect(403);
    const approved = dataOf<Termination>(
      await bqt.post(`/api/exploitation/write-offs/${writeOff.id}/approve`, { version: writeOff.version }).expect(200),
    );
    expect(approved.remainingVnd).toBe('0');
    expect(check(approved, 'RECEIVABLES').ok).toBe(true);
    expect(await lines()).toBe(before);
    const [period] = await dataSource.query<Array<{ status: string }>>(
      'SELECT status FROM exploitation_receivables WHERE contract_id = $1',
      [third],
    );
    expect(period.status).toBe('WRITTEN_OFF');
    expect((await report('MONTH', '2026-12')).writeOffVnd).toBe('5000000');
  });

  it('AC-F5.10 / AC-F5.13: a deposit offset moves no money and is no gap; the rest is refunded — a pending refund blocks', async () => {
    const fourth = await contract({
      startDate: '2026-11-16',
      endDate: '2026-11-30',
      priceVnd: '20000000',
      depositVnd: '40000000',
    });
    await ktoan
      .post(`/api/exploitation/contracts/${fourth}/deposits`, {
        receivedOn: '2026-12-05',
        amountVnd: '40000000',
        attachmentId: await fundFile('DEPOSIT_PROOF'),
      })
      .expect(201);
    await receipt(fourth, '2026-12-05', '15000000');
    let view = await terminate(fourth);
    const closingBefore = (await report('MONTH', '2026-12', ktoan)).figures.closingVnd;
    view = dataOf<Termination>(
      await ktoan
        .post(`/api/exploitation/terminations/${view.termination?.id}/offsets`, { amountVnd: '5000000' })
        .expect(201),
    );
    expect(view).toMatchObject({ remainingVnd: '0', depositHeldVnd: '35000000' });
    const december = await report('MONTH', '2026-12', ktoan);
    expect(december.figures.closingVnd).toBe(closingBefore);
    const internal = await dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM fund_ledger_entries WHERE internal AND source_type = 'DEPOSIT_OFFSET'`,
    );
    expect(internal).toHaveLength(2);
    const recon = dataOf<{ unmatchedEntries: Array<{ id: string }> }>(
      await ktoan.get(`/api/funds/${fundB.id}/reconciliation?month=2026-12`).expect(200),
    );
    expect(recon.unmatchedEntries.map((row) => row.id)).not.toEqual(
      expect.arrayContaining(internal.map((row) => row.id)),
    );

    const fields = { category: 'DEPOSIT_REFUND', contractId: fourth, payeeName: 'DV-A' };
    const tooMuch = await ktoan
      .post(`/api/funds/${fundB.id}/vouchers`, {
        ...fields,
        content: 'Hoàn cọc còn lại',
        amountVnd: '36000000',
        requestAttachmentId: await fundFile('VOUCHER_REQUEST'),
      })
      .expect(400);
    expect(errorFields(tooMuch)).toContain('amountVnd');
    const refund = await voucher({ ...fields, amountVnd: '35000000' });
    await handover(view, fourth);
    await minutes(fourth);
    view = await termination(fourth);
    expect(check(view, 'PENDING').ok).toBe(false);
    expect(view.canClose).toBe(false);
    await approveAndPay(refund, '2026-12-05');
    view = await termination(fourth);
    expect(view).toMatchObject({ depositHeldVnd: '0', canClose: true });

    // AC-F5.15: money was handled — the file cannot be cancelled.
    await bqlB
      .post(`/api/exploitation/terminations/${view.termination?.id}/cancel`, {
        version: view.termination?.version,
        reason: 'Muốn tiếp tục hợp đồng',
      })
      .expect(409);
  });

  it('AC-F5.11 / AC-F5.12 / AC-F5.15: early end keeps the running period and cancels later ones; latest handover counts; cancel restores', async () => {
    const paidAhead = await contract({ startDate: '2026-12-01', endDate: '2027-02-28', priceVnd: '20000000' });
    await ktoan
      .post(`/api/exploitation/contracts/${paidAhead}/receipts`, {
        receivedOn: '2026-12-05',
        amountVnd: '1000000',
        attachmentId: await fundFile('RECEIPT_PROOF'),
        allocations: [
          {
            receivableId: (
              await dataSource.query<Array<{ id: string }>>(
                'SELECT id FROM exploitation_receivables WHERE contract_id = $1 AND period_no = 3',
                [paidAhead],
              )
            )[0].id,
            amountVnd: '1000000',
          },
        ],
      })
      .expect(201);
    const refused = await bqlB
      .post(`/api/exploitation/contracts/${paidAhead}/termination`, {
        reason: 'EARLY_AGREED',
        note: 'Chấm dứt sớm theo thỏa thuận.',
        terminationDate: '2027-01-10',
      })
      .expect(400);
    expect(errorOf(refused).details?.fields?.[0]).toMatchObject({ field: 'terminationDate' });
    expect(JSON.stringify(errorOf(refused))).toContain('Kỳ 3');

    const view = await terminate(big, 'EARLY_AGREED', '2027-01-10');
    const periods = await dataSource.query<Array<{ period_no: number; status: string; amount_vnd: string }>>(
      'SELECT period_no, status, amount_vnd FROM exploitation_receivables WHERE contract_id = $1 AND superseded_at IS NULL ORDER BY period_no',
      [big],
    );
    expect(periods.map((row) => [row.period_no, row.status === 'TERMINATED', row.amount_vnd])).toEqual([
      [1, false, '20000000'],
      [2, false, '20000000'],
      [3, true, '20000000'],
    ]);
    await handover(view, big, 'FAILED', 'Còn đồ đạc chưa dọn khỏi khu vực.');
    expect(check(await termination(big), 'HANDOVER')).toMatchObject({ ok: false, detail: 'Không đạt' });
    await handover(view, big, 'PASSED');
    const after = await termination(big);
    expect(check(after, 'HANDOVER').ok).toBe(true);
    expect(after.handovers.map((row) => row.result)).toEqual(['FAILED', 'PASSED']);

    await bqlB
      .post(`/api/exploitation/terminations/${after.termination?.id}/cancel`, {
        version: after.termination?.version,
        reason: 'Hai bên tiếp tục hợp đồng',
      })
      .expect(200);
    const [third] = await dataSource.query<Array<{ status: string }>>(
      'SELECT status FROM exploitation_receivables WHERE contract_id = $1 AND period_no = 3 AND superseded_at IS NULL',
      [big],
    );
    expect(third.status).not.toBe('TERMINATED');
    const [contractRow] = await dataSource.query<Array<{ status: string }>>(
      'SELECT status FROM exploitation_contracts WHERE id = $1',
      [big],
    );
    expect(contractRow.status).toBe('ACTIVE');
  });

  it('AC-F5.14: the daily run flags an active contract past its end; its status does not move', async () => {
    const expired = await contract({ startDate: '2026-11-01', endDate: '2026-11-30', priceVnd: '1000000' });
    await app.get(ContractsService).flagExpired(at9('2026-12-01'));
    const [row] = await dataSource.query<Array<{ status: string; expired_unterminated: boolean }>>(
      'SELECT status, expired_unterminated FROM exploitation_contracts WHERE id = $1',
      [expired],
    );
    expect(row).toEqual({ status: 'ACTIVE', expired_unterminated: true });
  });

  it('AC-F5.16: the seed opens TL-001 on HĐ-001, handed over and signed, 5 tr owed — not closable; once', async () => {
    const contracts = dataOf<{ rows: Array<{ id: string; code: string }> }>(
      await bqlA.get('/api/exploitation/contracts').expect(200),
    ).rows;
    const hd = contracts.find((row) => row.code === 'HĐ-001') as { id: string };
    const view = await termination(hd.id, bqlA);
    expect(view.termination?.code).toBe('TL-001');
    expect(view.checks.map((row) => [row.key, row.ok, row.detail])).toEqual([
      ['HANDOVER', true, 'Đạt'],
      ['MINUTES', true, 'Đã lập'],
      ['RECEIVABLES', false, 'Còn 5.000.000 đ'],
      ['DEPOSIT', true, 'Đã xử lý'],
      ['PENDING', true, 'Không'],
    ]);
    const funds = dataOf<Array<{ id: string; openingDate: string }>>(await ktoanA.get('/api/funds').expect(200));
    const seeded = await report('MONTH', funds[0].openingDate.slice(0, 7), ktoanA, funds[0].id);
    expect(seeded).toMatchObject({
      source: 'STATEMENT',
      figures: { openingVnd: '50000000', inVnd: '15000000', outVnd: '5000000', closingVnd: '60000000' },
    });
    const before = await dataSource.query<Array<{ n: string }>>(
      'SELECT count(*)::text AS n FROM exploitation_terminations',
    );
    await app.get(DatabaseSeedService).run();
    expect(
      (await dataSource.query<Array<{ n: string }>>('SELECT count(*)::text AS n FROM exploitation_terminations'))[0].n,
    ).toBe(before[0].n);
  });
});
