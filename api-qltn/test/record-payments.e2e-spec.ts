import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';
import { readyForConstruction, SIGNATURE, upload, type FlowRecord, type FlowSessions } from './repair-flow';

/** Dedicated storage per run so the suite never touches the dev `storage/` folder. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-payments-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/** SPEC B03–B09 v2 slice S4 (docs/product/features/B03-B09-luong-sua-chua/SPEC.md): advances and settlement. */

interface Building {
  id: string;
}

interface Payment {
  id: string;
  kind: string;
  seqNo: number;
  status: string;
  revisionNo: number;
  amountVnd: string;
  settlementAmountVnd: string | null;
  transferContent: string;
  currentStepKey: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  payeeName: string;
  decisions: Array<{ stepKey: string; outcome: string; revisionNo: number }>;
  signatureDataUrl: string | null;
}

interface Detail {
  record: FlowRecord & { approvedAmountVnd: string | null };
  payment: { approvedAmountVnd: string | null; transferredTotalVnd: string; payments: Payment[] };
  audit: Array<{ action: string; reason?: string | null }>;
}

/** 2 × 5 000 000 ₫: the approved amount of every record here is 10 million, as in SPEC §7 AC-4.x. */
const UNIT_PRICE = '5000000';
const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;
const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

describe('Repair payments in instalments, slice S4 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let ktA: Session;
  let tvkt: Session;
  let bqt: Session;
  let ktoan: Session;
  let buildingA: Building;
  let ids: Record<string, string>;
  let sequence = 0;

  const sessions = (): FlowSessions => ({
    manager: bqlA,
    confirmer: (record) => (record.confirmationUserId === ids.TVKT ? tvkt : ktA),
    approvers: () => [tvkt, bqt],
    board: bqt,
  });

  const act = (session: Session, record: FlowRecord, route: string, body: Record<string, unknown> = {}) =>
    session.post(`/api/records/${record.id}/${route}`, { version: record.version, ...body });
  const ok = async (session: Session, record: FlowRecord, route: string, body: Record<string, unknown> = {}) =>
    dataOf<FlowRecord>(await act(session, record, route, body).expect(200));
  const detailOf = async (id: string): Promise<Detail> =>
    dataOf<Detail>(await bqlA.get(`/api/records/${id}`).expect(200));
  const paymentsOf = async (record: FlowRecord): Promise<Payment[]> => (await detailOf(record.id)).payment.payments;

  /** IN_CONSTRUCTION, approved 10 000 000 ₫. */
  const inConstruction = async (): Promise<FlowRecord> => {
    sequence += 1;
    const ready = await readyForConstruction(sessions(), buildingA.id, `S4- Hồ sơ thanh toán ${sequence}`, UNIT_PRICE);
    return ok(bqlA, ready, 'start-construction', {
      startDate: vnToday(),
      plannedEndDate: vnToday(),
      planNote: 'Thi công trong ngày.',
    });
  };

  /** 100 %, minutes, BQL + BQT + TVKT pass: PENDING_PAYMENT_REQUEST. */
  const accept = async (record: FlowRecord): Promise<FlowRecord> => {
    let current = await ok(bqlA, record, 'update-construction', {
      progressPercent: 100,
      note: 'Hoàn thành khối lượng.',
    });
    current = await ok(bqlA, current, 'submit-acceptance', {
      completedDate: vnToday(),
      inspectedAt: new Date().toISOString(),
      inspectionLocation: 'Hành lang tầng 3',
      content: 'Kiểm tra hạng mục đã thay, chạy thử đạt.',
      photoAttachmentIds: [await upload(bqlA, current.id, 'ACCEPTANCE')],
    });
    for (const member of [bqlA, bqt, tvkt])
      current = await ok(member, current, 'pass-acceptance', { signature: SIGNATURE });
    expect(current.status).toBe('PENDING_PAYMENT_REQUEST');
    return current;
  };

  const payee = { payeeName: 'CONG TY NAM PHAT', accountNo: '0123456789', bankName: 'Vietcombank' };

  const advanceBody = async (record: FlowRecord, amountVnd: string) => ({
    amountVnd,
    ...payee,
    requestAttachmentIds: [await upload(bqlA, record.id, 'PAYMENT_REQUEST')],
    signature: SIGNATURE,
  });

  const settlementBody = async (record: FlowRecord, amountVnd: string, withInvoice = true) => ({
    amountVnd,
    ...payee,
    requestAttachmentIds: [await upload(bqlA, record.id, 'PAYMENT_REQUEST')],
    invoiceAttachmentIds: withInvoice ? [await upload(bqlA, record.id, 'INVOICE')] : [],
    signature: SIGNATURE,
  });

  const transferBody = async (session: Session, record: FlowRecord, amountVnd: string) => ({
    amountVnd,
    transferDate: vnToday(),
    reference: `FT${Date.now()}`,
    proofAttachmentIds: [await upload(session, record.id, 'PAYMENT_PROOF')],
  });

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    ktA = await signIn(server, 'kt-a');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    ktoan = await signIn(server, 'ktoan-a');
    buildingA = dataOf<Array<Building & { code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    ) as Building;
    const reference = dataOf<{ users: Array<{ id: string; code: string }> }>(await bqlA.get('/api/reference'));
    ids = Object.fromEntries(reference.users.map((row) => [row.code, row.id]));
    // SPEC §7: building A on AQUA (PAYMENT = [BOARD]).
    const config = dataOf<{ version: number }>(await admin.get(`/api/buildings/${buildingA.id}/config`));
    await admin
      .post(`/api/buildings/${buildingA.id}/config/apply-template`, { templateKey: 'AQUA', version: config.version })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('AC-4.1/4.2/4.5 → AC-4.3: advance 4 M during construction, then settlement 10 M pays 6 M and the record closes', async () => {
    let record = await inConstruction();
    expect((await detailOf(record.id)).record.approvedAmountVnd).toBe('10000000');

    // AC-4.1: request, BQT approves, Kế toán confirms; the record status never moves.
    record = await ok(bqlA, record, 'submit-advance-request', await advanceBody(record, '4000000'));
    expect(record.status).toBe('IN_CONSTRUCTION');
    let [advance] = await paymentsOf(record);
    expect(advance).toMatchObject({ kind: 'TAM_UNG', status: 'PENDING_APPROVAL', currentStepKey: 'BOARD' });
    expect(advance.transferContent).toBe(`BQT A THANH TOAN CHI PHI ${record.code}`);
    expect(advance.signatureDataUrl).toBe(SIGNATURE);

    // AC-4.2: a second advance while the first is open.
    const second = await act(bqlA, record, 'submit-advance-request', await advanceBody(record, '1000000')).expect(409);
    expect(reasonOf(second)).toBe('open_advance_exists');

    // TVKT has no PAYMENT_DECIDE; in the seed only BQT holds it, as the holder of the PAYMENT step.
    expect(reasonOf(await act(tvkt, record, 'approve-advance').expect(403))).toBe('missing_capability');
    record = await ok(bqt, record, 'approve-advance');
    [advance] = await paymentsOf(record);
    expect(advance.status).toBe('PENDING_TRANSFER');

    // AC-4.5: no PAYMENT_CONFIRM → 403; a wrong amount → 400; confirmed once.
    await act(ktA, record, 'confirm-advance-transfer', {
      amountVnd: '4000000',
      transferDate: vnToday(),
      reference: 'X',
      proofAttachmentIds: [],
    }).expect(403);
    const wrong = await act(
      ktoan,
      record,
      'confirm-advance-transfer',
      await transferBody(ktoan, record, '3000000'),
    ).expect(400);
    expect(errorFields(wrong)).toEqual(['amountVnd']);
    record = await ok(ktoan, record, 'confirm-advance-transfer', await transferBody(ktoan, record, '4000000'));
    expect(record.status).toBe('IN_CONSTRUCTION');
    [advance] = await paymentsOf(record);
    expect(advance).toMatchObject({ status: 'TRANSFERRED', confirmedBy: ids['KTOAN-A'] });
    const twice = await act(
      ktoan,
      record,
      'confirm-advance-transfer',
      await transferBody(ktoan, record, '4000000'),
    ).expect(409);
    expect(reasonOf(twice)).toBe('payment_already_confirmed');

    // AC-4.2: 4 M transferred + 7 M would exceed the approved 10 M.
    const over = await act(bqlA, record, 'submit-advance-request', await advanceBody(record, '7000000')).expect(400);
    expect(errorFields(over)).toEqual(['amountVnd']);

    // AC-4.3: settlement 10 M after acceptance; the instalment is 6 M.
    record = await accept(record);
    const noInvoice = await act(
      bqlA,
      record,
      'submit-payment-request',
      await settlementBody(record, '10000000', false),
    ).expect(400);
    expect(errorFields(noInvoice)).toEqual(['invoiceAttachmentIds']);
    record = await ok(bqlA, record, 'submit-payment-request', await settlementBody(record, '10000000'));
    expect(record.status).toBe('PENDING_PAYMENT_APPROVAL');
    const settlement = (await paymentsOf(record)).find((row) => row.kind === 'QUYET_TOAN') as Payment;
    expect(settlement).toMatchObject({ amountVnd: '6000000', settlementAmountVnd: '10000000', seqNo: 2 });

    const early = await act(bqlA, record, 'complete').expect(409);
    expect(reasonOf(early)).toBe('invalid_status_transition');
    record = await ok(bqt, record, 'approve-payment');
    expect(record.status).toBe('PENDING_PAYMENT');
    record = await ok(bqt, record, 'confirm-payment-transfer', await transferBody(bqt, record, '6000000'));
    expect(record.status).toBe('PENDING_PAYMENT');
    record = await ok(bqlA, record, 'complete');
    expect(record.status).toBe('COMPLETED');
    const detail = await detailOf(record.id);
    expect(detail.payment.transferredTotalVnd).toBe('10000000');
    expect(detail.audit.map((row) => row.action)).toEqual(
      expect.arrayContaining(['submitAdvanceRequest', 'approveAdvance', 'confirmAdvanceTransfer', 'completeRecord']),
    );
  });

  it('AC-4.4: a settlement above the approved amount is refused; 9 M closes once 9 M was transferred', async () => {
    let record = await accept(await inConstruction());
    const above = await act(bqlA, record, 'submit-payment-request', await settlementBody(record, '11000000')).expect(
      400,
    );
    expect(errorFields(above)).toEqual(['amountVnd']);
    expect(errorOf(above).message).toBe('Số quyết toán không được vượt số được duyệt.');

    record = await ok(bqlA, record, 'submit-payment-request', await settlementBody(record, '9000000'));
    // A step holder may send it back; the resubmission is the same instalment, next revision.
    const noReason = await act(bqt, record, 'request-payment-update').expect(400);
    expect(errorFields(noReason)).toEqual(['reason']);
    record = await ok(bqt, record, 'request-payment-update', { reason: 'Thiếu dấu trên hóa đơn.' });
    expect(record.status).toBe('NEEDS_PAYMENT_UPDATE');
    record = await ok(bqlA, record, 'submit-payment-request', await settlementBody(record, '9000000'));
    const [settlement] = await paymentsOf(record);
    expect(settlement).toMatchObject({ revisionNo: 2, status: 'PENDING_APPROVAL', amountVnd: '9000000' });
    expect(settlement.decisions.map((row) => [row.revisionNo, row.outcome])).toEqual([[1, 'NEEDS_UPDATE']]);

    record = await ok(bqt, record, 'approve-payment');
    record = await ok(ktoan, record, 'confirm-payment-transfer', await transferBody(ktoan, record, '9000000'));
    record = await ok(bqlA, record, 'complete');
    expect(record.status).toBe('COMPLETED');
  });

  it('AC-4.6 + A1b/A2/A3: an advance still open at acceptance blocks the settlement until it is decided and transferred', async () => {
    let record = await inConstruction();
    record = await ok(bqlA, record, 'submit-advance-request', await advanceBody(record, '3000000'));
    record = await accept(record);

    const blocked = await act(bqlA, record, 'submit-payment-request', await settlementBody(record, '10000000')).expect(
      409,
    );
    expect(reasonOf(blocked)).toBe('open_advance_exists');
    // A new advance is no longer allowed after acceptance (A1)…
    expect(
      reasonOf(await act(bqlA, record, 'submit-advance-request', await advanceBody(record, '1000000')).expect(409)),
    ).toBe('invalid_status_transition');
    // …but the open one can still be sent back, resubmitted (A1b), approved (A2) and confirmed (A3).
    record = await ok(bqt, record, 'request-advance-update', { reason: 'Bổ sung đề nghị có dấu.' });
    record = await ok(bqlA, record, 'resubmit-advance-request', await advanceBody(record, '3000000'));
    let [advance] = await paymentsOf(record);
    expect(advance).toMatchObject({ revisionNo: 2, status: 'PENDING_APPROVAL' });
    record = await ok(bqt, record, 'approve-advance');
    record = await ok(ktoan, record, 'confirm-advance-transfer', await transferBody(ktoan, record, '3000000'));
    [advance] = await paymentsOf(record);
    expect(advance.status).toBe('TRANSFERRED');
    expect(record.status).toBe('PENDING_PAYMENT_REQUEST');

    record = await ok(bqlA, record, 'submit-payment-request', await settlementBody(record, '10000000'));
    expect((await paymentsOf(record)).find((row) => row.kind === 'QUYET_TOAN')?.amountVnd).toBe('7000000');
  });

  it('BR-S4-05: closing before the settlement is transferred answers 400 payment', async () => {
    let record = await accept(await inConstruction());
    record = await ok(bqlA, record, 'submit-payment-request', await settlementBody(record, '10000000'));
    record = await ok(bqt, record, 'approve-payment');
    const notYet = await act(bqlA, record, 'complete').expect(400);
    expect(errorFields(notYet)).toEqual(['payment']);
  });

  describe('FX-S2: a settlement equal to the transferred advances', () => {
    /** 10 M advance approved and transferred, then acceptance passed: PENDING_PAYMENT_REQUEST. */
    const fullyAdvanced = async (): Promise<FlowRecord> => {
      let record = await inConstruction();
      record = await ok(bqlA, record, 'submit-advance-request', await advanceBody(record, '10000000'));
      record = await ok(bqt, record, 'approve-advance');
      record = await ok(ktoan, record, 'confirm-advance-transfer', await transferBody(ktoan, record, '10000000'));
      return accept(record);
    };

    /** The settlement body without any payee field (BR-FX2-03). */
    const withoutPayee = async (record: FlowRecord, amountVnd: string) => {
      const { payeeName, accountNo, bankName, ...rest } = await settlementBody(record, amountVnd);
      expect([payeeName, accountNo, bankName]).toHaveLength(3);
      return rest;
    };

    it('AC-FX2.1/2.3: 10 M after 10 M advanced is a 0-đồng instalment that skips the transfer and closes', async () => {
      let record = await fullyAdvanced();
      // BR-FX2-03: both files and the signature are still required.
      const { invoiceAttachmentIds, ...noInvoice } = await withoutPayee(record, '10000000');
      expect(invoiceAttachmentIds).toHaveLength(1);
      const missing = await act(bqlA, record, 'submit-payment-request', noInvoice).expect(400);
      expect(errorFields(missing)).toEqual(['invoiceAttachmentIds']);
      // A payee value that is sent must still be valid.
      const badAccount = await act(bqlA, record, 'submit-payment-request', {
        ...(await withoutPayee(record, '10000000')),
        accountNo: '12',
      }).expect(400);
      expect(errorFields(badAccount)).toEqual(['accountNo']);

      record = await ok(bqlA, record, 'submit-payment-request', await withoutPayee(record, '10000000'));
      expect(record.status).toBe('PENDING_PAYMENT_APPROVAL');
      let settlement = (await paymentsOf(record)).find((row) => row.kind === 'QUYET_TOAN') as Payment;
      expect(settlement).toMatchObject({
        amountVnd: '0',
        settlementAmountVnd: '10000000',
        status: 'PENDING_APPROVAL',
        payeeName: '',
      });

      record = await ok(bqt, record, 'approve-payment');
      expect(record.status).toBe('PENDING_PAYMENT');
      settlement = (await paymentsOf(record)).find((row) => row.kind === 'QUYET_TOAN') as Payment;
      expect(settlement).toMatchObject({ status: 'TRANSFERRED', confirmedBy: null, confirmedAt: null });
      const approval = (await detailOf(record.id)).audit.find((row) => row.action === 'approvePayment');
      expect(approval?.reason).toContain('Không cần chuyển khoản: số của đợt bằng 0');

      // AC-FX2.3: no transfer to confirm; 409 and no audit (the proof upload is audited before counting).
      const proof = await transferBody(bqt, record, '0');
      const audits = (await detailOf(record.id)).audit.length;
      const confirm = await act(bqt, record, 'confirm-payment-transfer', proof).expect(409);
      expect(reasonOf(confirm)).toBe('payment_already_confirmed');
      expect((await detailOf(record.id)).audit).toHaveLength(audits);

      record = await ok(bqlA, record, 'complete');
      expect(record.status).toBe('COMPLETED');
      expect((await detailOf(record.id)).payment.transferredTotalVnd).toBe('10000000');
    });

    it('AC-FX2.2: 9 M after 10 M advanced is refused on amountVnd', async () => {
      const record = await fullyAdvanced();
      const below = await act(bqlA, record, 'submit-payment-request', await settlementBody(record, '9000000')).expect(
        400,
      );
      expect(errorFields(below)).toEqual(['amountVnd']);
      expect(errorOf(below).message).toBe(
        'Số quyết toán nhỏ hơn tổng tạm ứng đã chuyển khoản (10.000.000 ₫). Hệ thống chưa hỗ trợ trường hợp nhà thầu hoàn lại tiền.',
      );
    });

    it('BR-FX2-03: the payee stays required when the instalment is above 0', async () => {
      const record = await accept(await inConstruction());
      const res = await act(bqlA, record, 'submit-payment-request', await withoutPayee(record, '10000000')).expect(400);
      expect(errorFields(res).sort()).toEqual(['accountNo', 'bankName', 'payeeName']);
    });
  });

  it('AC-0.1: a wrong source status answers 409 invalid_status_transition and writes no audit', async () => {
    const record = await inConstruction();
    const before = (await detailOf(record.id)).audit.length;
    const cases: Array<[Session, string, Record<string, unknown>]> = [
      [bqlA, 'save-payment-draft', {}],
      [bqlA, 'submit-payment-request', { signature: SIGNATURE }],
      [bqt, 'approve-payment', {}],
      [bqt, 'request-payment-update', { reason: 'Không hợp lệ.' }],
      [
        ktoan,
        'confirm-payment-transfer',
        { amountVnd: '1', transferDate: vnToday(), reference: 'X', proofAttachmentIds: [] },
      ],
      [bqlA, 'complete', {}],
    ];
    for (const [session, route, body] of cases) {
      const res = await act(session, record, route, body);
      expect([route, res.status, reasonOf(res)]).toEqual([route, 409, 'invalid_status_transition']);
    }
    expect((await detailOf(record.id)).audit).toHaveLength(before);
  });
});
