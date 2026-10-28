import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Clock } from '../src/common/services/clock.service';
import { DatabaseSeedService } from '../src/database/seeds/database-seed.service';
import { createApp, dataOf, errorFields, errorOf, signIn, type Session } from './app-harness';
import { insertActiveContract } from './fund-fixtures';
import { xlsxOf } from './xlsx-fixture';

/**
 * SPEC F-S4 (docs/product/features/F-sao-ke-doi-soat/SPEC.md): statement imports and reconciliation. "Now" is pinned
 * per step. Tòa B's fund gets the D1 November (50 + 15 − 5 = 60) through the F-S3 API; tòa C stays nearly empty.
 */

interface Fund {
  id: string;
  buildingId: string;
  version: number;
}
interface Line {
  id: string;
  code: string;
  txnDate: string;
  amountVnd: string;
  possibleDuplicate: boolean;
}
interface Entry {
  id: string;
  sourceCode: string;
  entryDate: string;
}
interface Month {
  statement: { openingVnd: string | null; inVnd: string | null; outVnd: string | null; closingVnd: string | null };
  asOf: string | null;
  ledgerClosingVnd: string | null;
  differenceVnd: string | null;
  counts: { lines: number; matched: number; gaps: number; duplicates: number };
  matchedMonth: boolean;
  openingWarning: { statementVnd: string; ledgerVnd: string } | null;
  pairs: Array<{ matchId: string; line: Line; entry: Entry }>;
  unmatchedLines: Line[];
  unmatchedEntries: Entry[];
  selfCancelled: Entry[];
  suggestions: Array<{ line: Line; entry: Entry }>;
}
interface Imported {
  import: { id: string; newCount: number; duplicateCount: number };
  suggestions: number;
}

const PDF = Buffer.from('%PDF-1.4\n% chung tu F-S4\n', 'utf8');
const at9 = (date: string): Date => new Date(`${date}T09:00:00+07:00`);
const HEADER = 'Ngày giao dịch,Ghi có,Ghi nợ,Nội dung,Số tham chiếu,Số tài khoản';
const D1_CSV = [
  HEADER,
  '18/11/2026,10000000,,DV-A chuyen tien HD,FT001,',
  '22/11/2026,5000000,,DV-A chuyen tien HD,FT002,',
  '22/11/2026,,2000000,Nop thue thang 11,FT003,',
  '23/11/2026,,3000000,Chi dich vu ve sinh,FT004,',
].join('\n');
const fieldsOf = (from: string, to: string, opening: string, closing: string) => ({
  periodFrom: from,
  periodTo: to,
  openingBalanceVnd: opening,
  closingBalanceVnd: closing,
});
const messageOf = (res: { body: unknown }, field: string): string | undefined =>
  (errorOf(res).details?.fields as Array<{ field: string; message: string }> | undefined)?.find(
    (row) => row.field === field,
  )?.message;

describe('Fund statements and reconciliation, F-S4 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let clock: Clock;
  let dataSource: DataSource;
  let admin: Session;
  let bqt: Session;
  let bqlB: Session;
  let kt: Session;
  let ktoanA: Session;
  let ktoan: Session;
  let buildings: Record<string, string>;
  let fundA: Fund;
  let fundB: Fund;
  let fundC: Fund;
  let small: string;
  let big: string;

  const upload = async (fundId: string, purpose: string): Promise<string> =>
    dataOf<{ id: string }>(
      await ktoan
        .postMultipart(
          '/api/attachments',
          { subjectType: 'FUND', subjectId: fundId, purpose },
          { content: PDF, filename: `${purpose}.pdf`, contentType: 'application/pdf' },
        )
        .expect(201),
    ).id;
  const importFile = (fundId: string, fields: Record<string, string>, content: Buffer, filename = 'sao-ke.csv') =>
    ktoan.postMultipart(`/api/funds/${fundId}/statements`, fields, { content, filename, contentType: 'text/csv' });
  const importLines = (fundId: string, fields: Record<string, string>, lines: object[]) =>
    ktoan.post(`/api/funds/${fundId}/statements`, { ...fields, lines: JSON.stringify(lines) });
  const month = async (fundId: string, value: string, session: Session = ktoan): Promise<Month> =>
    dataOf<Month>(await session.get(`/api/funds/${fundId}/reconciliation?month=${value}`).expect(200));
  const setup = async (fund: Fund, openingBalanceVnd: string): Promise<Fund> =>
    dataOf<Fund>(
      await ktoan
        .put(`/api/funds/${fund.id}/setup`, {
          version: fund.version,
          bankName: 'Vietcombank',
          accountNo: fund === fundB ? '0071000000002' : '0071000000003',
          accountHolder: 'BQT',
          openingDate: '2026-11-01',
          openingBalanceVnd,
        })
        .expect(200),
    );
  const receipt = async (contractId: string, receivedOn: string, amountVnd: string) => {
    const page = dataOf<{ receipts: Array<{ id: string; code: string; version: number }> }>(
      await ktoan
        .post(`/api/exploitation/contracts/${contractId}/receipts`, {
          receivedOn,
          amountVnd,
          attachmentId: await upload(fundB.id, 'RECEIPT_PROOF'),
        })
        .expect(201),
    );
    return page.receipts[page.receipts.length - 1];
  };
  const paidVoucher = async (amountVnd: string, paidOn: string) => {
    let voucher = dataOf<{ id: string; version: number }>(
      await ktoan
        .post(`/api/funds/${fundB.id}/vouchers`, {
          category: 'SERVICE',
          content: 'Chi dịch vụ vệ sinh khu khai thác',
          payeeName: 'Công ty Sạch Xanh',
          amountVnd,
          requestAttachmentId: await upload(fundB.id, 'VOUCHER_REQUEST'),
        })
        .expect(201),
    );
    voucher = dataOf(
      await ktoan.post(`/api/funds/vouchers/${voucher.id}/submit`, { version: voucher.version }).expect(201),
    );
    voucher = dataOf(
      await bqt.post(`/api/funds/vouchers/${voucher.id}/approve`, { version: voucher.version }).expect(201),
    );
    await ktoan
      .post(`/api/funds/vouchers/${voucher.id}/pay`, {
        version: voucher.version,
        paidOn,
        proofAttachmentId: await upload(fundB.id, 'VOUCHER_PROOF'),
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
    bqlB = await signIn(server, 'bql-b');
    kt = await signIn(server, 'kt-a');
    ktoanA = await signIn(server, 'ktoan-a');
    const list = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings').expect(200));
    buildings = Object.fromEntries(list.map((row) => [row.code, row.id]));
    const roles = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/roles').expect(200));
    const departments = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/departments').expect(200));
    await admin
      .post('/api/users', {
        code: 'KTOAN-S4',
        fullName: 'Kế toán tòa B và C',
        password: 'E2e-ktoan-s4',
        roleDefId: (roles.find((row) => row.code === 'KTOAN') as { id: string }).id,
        departmentId: (departments.find((row) => row.code === 'KTOAN') as { id: string }).id,
        buildingIds: [buildings.B, buildings.C],
      })
      .expect(201);
    ktoan = await signIn(server, 'ktoan-s4', 'E2e-ktoan-s4');
    const funds = dataOf<Fund[]>(await bqt.get('/api/funds').expect(200));
    fundA = funds.find((row) => row.buildingId === buildings.A) as Fund;
    fundB = funds.find((row) => row.buildingId === buildings.B) as Fund;
    fundC = funds.find((row) => row.buildingId === buildings.C) as Fund;

    // The D1 November on tòa B: opening 50; PT 10 (18/11), PT 5 (22/11), GNT 2 (22/11), PC 3 (23/11).
    clock.set(at9('2026-11-23'));
    fundB = await setup(fundB, '50000000');
    small = await insertActiveContract(dataSource, buildings.B, 'F4A', {
      startDate: '2026-11-16',
      endDate: '2026-11-30',
      priceVnd: '20000000',
    });
    big = await insertActiveContract(dataSource, buildings.B, 'F4B', {
      startDate: '2026-12-01',
      endDate: '2027-02-28',
      priceVnd: '20000000',
    });
    await receipt(small, '2026-11-18', '10000000');
    await receipt(small, '2026-11-22', '5000000');
    const tax = dataOf<{ id: string }>(
      await ktoan
        .post(`/api/funds/${fundB.id}/taxes`, {
          month: '2026-11',
          amountVnd: '2000000',
          attachmentId: await upload(fundB.id, 'TAX_FILING'),
        })
        .expect(201),
    );
    await ktoan
      .post(`/api/funds/taxes/${tax.id}/payments`, {
        paidOn: '2026-11-22',
        amountVnd: '2000000',
        attachmentId: await upload(fundB.id, 'TAX_PAYMENT_SLIP'),
      })
      .expect(201);
    await paidVoucher('3000000', '2026-11-23');
    clock.set(at9('2026-12-05'));
  });

  afterAll(async () => {
    clock.set(null);
    await app.close();
  });

  it("AC-F4.16: the seed reconciles tòa A's D1 month: 4/4, difference 0, gaps/duplicates 0; once", async () => {
    const funds = dataOf<Array<{ id: string; openingDate: string }>>(await ktoanA.get('/api/funds').expect(200));
    const seeded = funds[0];
    const view = await month(seeded.id, seeded.openingDate.slice(0, 7), ktoanA);
    expect(view.statement).toEqual({
      openingVnd: '50000000',
      inVnd: '15000000',
      outVnd: '5000000',
      closingVnd: '60000000',
    });
    expect(view.counts).toMatchObject({ lines: 4, matched: 4, gaps: 0, duplicates: 0 });
    expect(view.differenceVnd).toBe('0');
    expect(view.matchedMonth).toBe(true);
    expect(view.pairs.map((row) => [row.line.code, row.entry.sourceCode])).toEqual([
      ['GD-001', 'PT-001'],
      ['GD-002', 'PT-002'],
      ['GD-003', 'GNT-001'],
      ['GD-004', 'PC-001'],
    ]);
    const before = await dataSource.query<Array<{ n: string }>>('SELECT count(*)::text AS n FROM bank_statement_lines');
    await app.get(DatabaseSeedService).run();
    expect(
      (await dataSource.query<Array<{ n: string }>>('SELECT count(*)::text AS n FROM bank_statement_lines'))[0].n,
    ).toBe(before[0].n);
  });

  it('AC-F4.2 / AC-F4.3: a statement that does not close, a decimal or a foreign account imports nothing', async () => {
    const open = fieldsOf('2026-11-01', '2026-11-30', '50000000', '61000000');
    const notClosing = await importFile(fundB.id, open, Buffer.from(D1_CSV, 'utf8')).expect(400);
    expect(messageOf(notClosing, 'closingBalanceVnd')).toContain('Sao kê không khép: lệch 1.000.000 đ');
    const decimal = D1_CSV.replace('22/11/2026,,2000000,', '22/11/2026,,"2.000.000,50",');
    const refused = await importFile(
      fundB.id,
      { ...open, closingBalanceVnd: '60000000' },
      Buffer.from(decimal, 'utf8'),
    ).expect(400);
    expect(messageOf(refused, 'rows.4')).toBe('Dòng 4: Ghi nợ có phần thập phân.');
    const xlsx = xlsxOf([
      ['Ngày giao dịch', 'Ghi có', 'Ghi nợ', 'Nội dung'],
      ['18/11/2026', 10000000, null, 'DV-A'],
      ['22/11/2026', null, 2000000.5, 'Nop thue'],
    ]);
    expect(messageOf(await importFile(fundB.id, open, xlsx, 'sao-ke.xlsx').expect(400), 'rows.3')).toBe(
      'Dòng 3: Ghi nợ có phần thập phân.',
    );
    const foreign = D1_CSV.replace('FT001,', 'FT001,1234567890');
    expect(
      errorFields(
        await importFile(fundB.id, { ...open, closingBalanceVnd: '60000000' }, Buffer.from(foreign, 'utf8')).expect(
          400,
        ),
      ),
    ).toContain('rows.2');
    expect(
      (
        await dataSource.query<Array<{ n: string }>>(
          'SELECT count(*)::text AS n FROM bank_statement_lines WHERE fund_id = $1',
          [fundB.id],
        )
      )[0].n,
    ).toBe('0');
  });

  it('AC-F4.1 / AC-F4.4: the D1 file gives GD-001..004 and 4 suggestions; again, all skipped; an overlap adds only the new', async () => {
    const fields = fieldsOf('2026-11-01', '2026-11-30', '50000000', '60000000');
    const first = dataOf<Imported>(await importFile(fundB.id, fields, Buffer.from(D1_CSV, 'utf8')).expect(201));
    expect(first.import).toMatchObject({ newCount: 4, duplicateCount: 0 });
    expect(first.suggestions).toBe(4);
    const again = dataOf<Imported>(await importFile(fundB.id, fields, Buffer.from(D1_CSV, 'utf8')).expect(201));
    expect(again.import).toMatchObject({ newCount: 0, duplicateCount: 4 });
    // From 15/11 the bank starts at 50 (the 10 tr arrives on 18/11): 50 + 10 + 5 − 2 − 3 + 1 = 61.
    const overlapping = [HEADER, ...D1_CSV.split('\n').slice(1), '05/12/2026,1000000,,Tien chuyen nham,FT005,'].join(
      '\n',
    );
    const added = dataOf<Imported>(
      await importFile(
        fundB.id,
        fieldsOf('2026-11-15', '2026-12-15', '50000000', '61000000'),
        Buffer.from(overlapping, 'utf8'),
      ).expect(201),
    );
    expect(added.import).toMatchObject({ newCount: 1, duplicateCount: 4 });
  });

  it('AC-F4.6: confirming every suggestion reconciles November: 50/15/5/60, 4/4, difference 0; TH 1/1', async () => {
    const pending = await month(fundB.id, '2026-11');
    expect(pending.suggestions).toHaveLength(4);
    await ktoan.post(`/api/funds/${fundB.id}/reconciliation/confirm`, { month: '2026-11' }).expect(200);
    const view = await month(fundB.id, '2026-11');
    expect(view.statement).toEqual({
      openingVnd: '50000000',
      inVnd: '15000000',
      outVnd: '5000000',
      closingVnd: '60000000',
    });
    expect(view.counts).toMatchObject({ lines: 4, matched: 4, gaps: 0, duplicates: 0 });
    expect(view).toMatchObject({ differenceVnd: '0', matchedMonth: true, ledgerClosingVnd: '60000000' });
    const tax = dataOf<{
      obligation: { reconciled: { matched: number; total: number } };
      payments: Array<{ statementCode: string }>;
    }>(await ktoan.get(`/api/funds/${fundB.id}/taxes?month=2026-11`).expect(200));
    expect(tax.obligation.reconciled).toEqual({ matched: 1, total: 1 });
    expect(tax.payments[0].statementCode).toBe('GD-003');
    const ledger = dataOf<{ rows: Array<{ statementCode: string | null; reconciliation: string }> }>(
      await ktoan.get(`/api/funds/${fundB.id}/ledger?month=2026-11`).expect(200),
    );
    expect(ledger.rows.map((row) => row.statementCode)).toEqual(['GD-001', 'GD-002', 'GD-003', 'GD-004']);
  });

  it('AC-F4.10 / AC-F4.11: a bank fee recorded from the statement keeps the difference at 0; an unbanked receipt opens +1 tr', async () => {
    clock.set(at9('2026-12-05'));
    // The bank's 30/11: 60 at the start, the SMS fee −11.000.
    const imported = dataOf<Imported>(
      await importLines(fundB.id, fieldsOf('2026-11-30', '2026-11-30', '60000000', '59989000'), [
        { date: '30/11/2026', debit: '11000', description: 'Phi SMS Banking' },
      ]).expect(201),
    );
    expect(imported.import.newCount).toBe(1);
    const fee = (await month(fundB.id, '2026-11')).unmatchedLines[0];
    await ktoan.post(`/api/funds/statement-lines/${fee.id}/record`, { kind: 'INTEREST' }).expect(400);
    await ktoan.post(`/api/funds/statement-lines/${fee.id}/record`, { kind: 'CONTRACT_RECEIPT' }).expect(400);
    await ktoan.post(`/api/funds/statement-lines/${fee.id}/record`, { kind: 'BANK_FEE' }).expect(201);
    let view = await month(fundB.id, '2026-11');
    expect(view).toMatchObject({ differenceVnd: '0', ledgerClosingVnd: '59989000', matchedMonth: true });
    expect(view.statement.closingVnd).toBe('59989000');

    await receipt(big, '2026-11-29', '1000000');
    view = await month(fundB.id, '2026-11');
    expect(view.differenceVnd).toBe('1000000');
    expect(view.counts.gaps).toBe(1);
    expect(view.matchedMonth).toBe(false);
  });

  it('AC-F4.9: a reconciled document is unmatched before cancelling; the pair self-cancels; the bank line is open again', async () => {
    clock.set(at9('2026-12-05'));
    const view = await month(fundB.id, '2026-11');
    const pair = view.pairs.find((row) => row.line.code === 'GD-002') as Month['pairs'][number];
    const page = dataOf<{
      receipts: Array<{ id: string; code: string; version: number; statementCode: string | null }>;
    }>(await ktoan.get(`/api/exploitation/contracts/${small}`).expect(200));
    const pt = page.receipts.find((row) => row.statementCode === 'GD-002') as { id: string; version: number };
    const blocked = await ktoan
      .post(`/api/exploitation/receipts/${pt.id}/cancel`, { version: pt.version, reason: 'Ghi nhầm khoản thu' })
      .expect(409);
    expect(errorOf(blocked).message).toBe('Bỏ ghép GD-002 trước khi hủy chứng từ này.');
    await ktoan.post(`/api/funds/matches/${pair.matchId}/unmatch`, { reason: 'Ngắn' }).expect(400);
    await ktoan
      .post(`/api/funds/matches/${pair.matchId}/unmatch`, { reason: 'Ghép nhầm, cần hủy chứng từ' })
      .expect(200);
    await ktoan
      .post(`/api/exploitation/receipts/${pt.id}/cancel`, { version: pt.version, reason: 'Ghi nhầm khoản thu' })
      .expect(200);
    const after = await month(fundB.id, '2026-11');
    expect(after.selfCancelled.map((row) => row.id)).toContain(pair.entry.id);
    expect(after.unmatchedLines.map((row) => row.code)).toContain('GD-002');
    expect(after.counts.gaps).toBe(view.counts.gaps + 1);
  });

  it('AC-F4.7 / AC-F4.8: two candidates give no suggestion; far or mismatched pairs need a reason or are refused', async () => {
    clock.set(at9('2027-01-25'));
    await paidVoucher('10000000', '2027-01-25');
    clock.set(at9('2027-01-31'));
    await receipt(big, '2027-01-21', '5000000');
    await receipt(big, '2027-01-22', '5000000');
    await receipt(big, '2027-01-18', '10000000');
    await importLines(fundB.id, fieldsOf('2027-01-01', '2027-01-31', '100000000', '115000000'), [
      { date: '22/01/2027', credit: '5000000', description: 'DV-A chuyen tien', reference: 'FTJ1' },
      { date: '30/01/2027', credit: '10000000', description: 'DV-A chuyen tien', reference: 'FTJ2' },
    ]).expect(201);
    const view = await month(fundB.id, '2027-01');
    expect(view.suggestions).toEqual([]);
    const five = view.unmatchedLines.find((row) => row.amountVnd === '5000000') as Line;
    const ten = view.unmatchedLines.find((row) => row.amountVnd === '10000000') as Line;
    const options = dataOf<Array<{ entry: Entry; days: number; needsReason: boolean }>>(
      await ktoan.get(`/api/funds/${fundB.id}/reconciliation/candidates?lineId=${five.id}`).expect(200),
    );
    expect(options.map((row) => row.days)).toEqual([0, 1]);
    await ktoan.post(`/api/funds/statement-lines/${five.id}/match`, { entryId: options[0].entry.id }).expect(201);

    const far = dataOf<Array<{ entry: Entry; days: number; needsReason: boolean }>>(
      await ktoan.get(`/api/funds/${fundB.id}/reconciliation/candidates?lineId=${ten.id}`).expect(200),
    ).find((row) => row.entry.sourceCode.startsWith('PT-')) as { entry: Entry; days: number; needsReason: boolean };
    expect(far).toMatchObject({ days: 12, needsReason: true });
    expect(
      errorFields(
        await ktoan.post(`/api/funds/statement-lines/${ten.id}/match`, { entryId: far.entry.id }).expect(400),
      ),
    ).toContain('reason');
    const voucherLine = view.unmatchedEntries.find((row) => row.sourceCode.startsWith('PC-')) as Entry;
    expect(
      messageOf(
        await ktoan.post(`/api/funds/statement-lines/${ten.id}/match`, { entryId: voucherLine.id }).expect(400),
        'entryId',
      ),
    ).toBe('Khác chiều thu, chi.');
    const otherAmount = view.unmatchedEntries.find((row) => row.entryDate === '2027-01-21') as Entry;
    expect(
      messageOf(
        await ktoan.post(`/api/funds/statement-lines/${ten.id}/match`, { entryId: otherAmount.id }).expect(400),
        'entryId',
      ),
    ).toBe('Khác số tiền.');
    await ktoan
      .post(`/api/funds/statement-lines/${ten.id}/match`, {
        entryId: far.entry.id,
        reason: 'Tiền về sau ngày lập phiếu thu',
      })
      .expect(201);
  });

  it('BR-F4-05: two people matching one line at once — one wins, the other is told to reload', async () => {
    clock.set(at9('2027-01-31'));
    const view = await month(fundB.id, '2027-01');
    const entry = view.unmatchedEntries.find((row) => row.entryDate === '2027-01-21') as Entry;
    await importLines(fundB.id, fieldsOf('2027-01-21', '2027-01-21', '100000000', '105000000'), [
      { date: '21/01/2027', credit: '5000000', description: 'DV-A chuyen tien', reference: 'FTJ3' },
    ]).expect(201);
    const line = (await month(fundB.id, '2027-01')).unmatchedLines.find((row) => row.txnDate === '2027-01-21') as Line;
    const answers = await Promise.all(
      [1, 2].map(() => ktoan.post(`/api/funds/statement-lines/${line.id}/match`, { entryId: entry.id })),
    );
    expect(answers.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(errorOf(answers.find((res) => res.status === 409) as { body: unknown }).message).toBe(
      'Dòng này vừa được ghép bởi người khác. Tải lại.',
    );
  });

  it('AC-F4.5 / AC-F4.14: identical lines of one file are both kept as "Có thể trùng"; an unmatched import is deleted, a matched one not', async () => {
    clock.set(at9('2027-01-31'));
    const sms = { date: '20/12/2026', debit: '11000', description: 'Phi SMS' };
    const imported = dataOf<Imported>(
      await importLines(fundB.id, fieldsOf('2026-12-16', '2026-12-20', '70000000', '69978000'), [
        sms,
        { ...sms, description: '  phi  sms ' },
      ]).expect(201),
    );
    expect(imported.import.newCount).toBe(2);
    const december = await month(fundB.id, '2026-12');
    expect(december.counts.duplicates).toBe(2);
    expect(december.unmatchedLines.filter((row) => row.possibleDuplicate)).toHaveLength(2);
    await ktoan.post(`/api/funds/statement-imports/${imported.import.id}/delete`, { reason: 'Ngắn' }).expect(400);
    await ktoan
      .post(`/api/funds/statement-imports/${imported.import.id}/delete`, { reason: 'Nhập nhầm tệp tháng 12' })
      .expect(200);
    expect((await month(fundB.id, '2026-12')).counts.duplicates).toBe(0);
    const imports = dataOf<Array<{ id: string; periodFrom: string; newCount: number; deletedAt: string | null }>>(
      await ktoan.get(`/api/funds/${fundB.id}/statements`).expect(200),
    );
    const november = imports.find((row) => row.periodFrom === '2026-11-01' && row.newCount > 0) as { id: string };
    expect(
      errorOf(
        await ktoan
          .post(`/api/funds/statement-imports/${november.id}/delete`, { reason: 'Muốn xóa lần nhập này' })
          .expect(409),
      ).message,
    ).toBe('Lần nhập đã có dòng được ghép; không xóa được.');
  });

  it('AC-F4.12 / AC-F4.13: a month without a statement shows nothing by the bank; a different opening is flagged', async () => {
    const february = await month(fundB.id, '2027-02');
    expect(february.statement).toEqual({ openingVnd: null, inVnd: null, outVnd: null, closingVnd: null });
    expect(february.differenceVnd).toBeNull();
    clock.set(at9('2026-12-05'));
    fundC = await setup(fundC, '50000000');
    await importLines(fundC.id, fieldsOf('2026-11-01', '2026-11-30', '49000000', '49001000'), [
      { date: '30/11/2026', credit: '1000', description: 'Lai khong ky han' },
    ]).expect(201);
    expect((await month(fundC.id, '2026-11')).openingWarning).toMatchObject({
      statementVnd: '49000000',
      ledgerVnd: '50000000',
    });
    // A month still running is read on the last day its statement covers.
    await importLines(fundC.id, fieldsOf('2026-12-01', '2026-12-04', '49001000', '48990000'), [
      { date: '03/12/2026', debit: '11000', description: 'Phi SMS' },
    ]).expect(201);
    const running = await month(fundC.id, '2026-12');
    expect(running).toMatchObject({ asOf: '2026-12-04', ledgerClosingVnd: '50000000', differenceVnd: '1010000' });
    expect(running.statement.closingVnd).toBe('48990000');
  });

  it('AC-F4.15: BQT reads but cannot write; BQL and KT get 403; another building answers 404', async () => {
    await month(fundB.id, '2026-11', bqt);
    await bqt.post(`/api/funds/${fundB.id}/reconciliation/confirm`, { month: '2026-11' }).expect(403);
    await bqt
      .post(`/api/funds/${fundB.id}/statements`, { ...fieldsOf('2026-11-01', '2026-11-30', '0', '0'), lines: '[]' })
      .expect(403);
    const denied = await bqlB.get(`/api/funds/${fundB.id}/reconciliation?month=2026-11`).expect(403);
    expect(errorOf(denied).message).toBe('Bạn không có quyền xem đối soát.');
    await bqlB.get(`/api/funds/${fundB.id}/statements`).expect(403);
    await kt.get(`/api/funds/${fundA.id}/reconciliation?month=2026-11`).expect(403);
    await ktoan.get(`/api/funds/${fundA.id}/reconciliation?month=2026-11`).expect(404);
    const template = await ktoan.get('/api/funds/statements/template').expect(200);
    expect(template.text).toContain('Ngày giao dịch,Ghi có,Ghi nợ,Nội dung,Số tham chiếu,Số tài khoản');
  });
});
