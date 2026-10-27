import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { createApp, dataOf, errorOf, type Session, signIn } from './app-harness';
import { readyForConstruction, SIGNATURE, upload, type FlowRecord, type FlowSessions } from './repair-flow';

// Before createApp: the attachment storage reads STORAGE_DIR when the module boots.
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-stage-holders-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;

/**
 * FX-S3 R-03 (docs/product/features/FX-sua-loi-review-27-10/SPEC.md §5.1): a record snapshots a holder for every step
 * of every stage, so a custom step used only in ACCEPTANCE or PAYMENT can be decided (BR-FX3-01); a stage whose step
 * has no valid holder answers 409 step_holder_missing instead of leaving the record stuck (BR-FX3-02).
 */

interface Stage {
  key: string;
  approvalStepKeys: string[];
  stepBindings: Array<{ businessStepKey: string; approvalStepKey?: string }>;
}

interface Config {
  version: number;
  taskDueDays: Record<string, number>;
  emergencyLimitVnd: string;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
  approvalStepKeys: string[];
  workflowApprovalSteps: Array<{ key: string; label: string; role: string; roleDefId?: string; actor?: string }>;
  workflowStages: Stage[];
}

interface Payment {
  kind: string;
  status: string;
  currentStepKey: string | null;
}

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;
const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** The stage gets these steps; a business step bound to a removed step moves to the first one. */
const withStageSteps = (stages: Stage[], key: string, keys: string[]): Stage[] =>
  stages.map((stage) =>
    stage.key !== key
      ? stage
      : {
          ...stage,
          approvalStepKeys: keys,
          stepBindings: stage.stepBindings.map((binding) =>
            binding.approvalStepKey && !keys.includes(binding.approvalStepKey)
              ? { ...binding, approvalStepKey: keys[0] }
              : binding,
          ),
        },
  );

describe('Holders of every stage step, FX-S3 R-03 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let admin: Session;
  let bqlA: Session;
  let tvkt: Session;
  let bqt: Session;
  let controller: Session;
  let controllerId: string;
  let buildingId: string;
  let sequence = 0;

  const sessions = (): FlowSessions => ({
    manager: bqlA,
    confirmer: () => tvkt,
    approvers: () => [tvkt, bqt],
    board: bqt,
  });

  const ok = async (session: Session, record: FlowRecord, route: string, body: Record<string, unknown> = {}) =>
    dataOf<FlowRecord>(
      await session.post(`/api/records/${record.id}/${route}`, { version: record.version, ...body }).expect(200),
    );
  const paymentsOf = async (record: FlowRecord): Promise<Payment[]> =>
    dataOf<{ payment: { payments: Payment[] } }>(await bqlA.get(`/api/records/${record.id}`).expect(200)).payment
      .payments;

  /** IN_CONSTRUCTION on the configuration of the suite (approved 1 000 000 ₫). */
  const inConstruction = async (): Promise<FlowRecord> => {
    sequence += 1;
    const ready = await readyForConstruction(sessions(), buildingId, `FX-S3 bước tùy chỉnh ${sequence}`);
    return ok(bqlA, ready, 'start-construction', {
      startDate: vnToday(),
      plannedEndDate: vnToday(),
      planNote: 'Thi công trong ngày.',
    });
  };

  const submitAcceptance = async (record: FlowRecord): Promise<FlowRecord> => {
    const done = await ok(bqlA, record, 'update-construction', { progressPercent: 100, note: 'Hoàn thành.' });
    return ok(bqlA, done, 'submit-acceptance', {
      completedDate: vnToday(),
      inspectedAt: new Date().toISOString(),
      inspectionLocation: 'Hành lang tầng 3',
      content: 'Kiểm tra hạng mục đã thay, chạy thử đạt.',
      photoAttachmentIds: [await upload(bqlA, done.id, 'ACCEPTANCE')],
    });
  };

  const settlementBody = async (record: FlowRecord) => ({
    amountVnd: '1000000',
    payeeName: 'CONG TY THUY TIN',
    accountNo: '0123456789',
    bankName: 'Vietcombank',
    requestAttachmentIds: [await upload(bqlA, record.id, 'PAYMENT_REQUEST')],
    invoiceAttachmentIds: [await upload(bqlA, record.id, 'INVOICE')],
    signature: SIGNATURE,
  });

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    buildingId = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/buildings')).find(
      (row) => row.code === 'A',
    )?.id as string;

    // A custom role derived from BQT (PAYMENT_DECIDE and ACCEPTANCE_DECIDE) and the one account holding it.
    const role = dataOf<{ id: string }>(
      await admin.post('/api/roles', { name: 'Kiểm soát chi FX-S3', baseRole: 'OWNERS_BOARD' }).expect(201),
    );
    const departments = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/departments'));
    controllerId = dataOf<{ id: string }>(
      await admin
        .post('/api/users', {
          code: 'KSC-A',
          fullName: 'Kiểm soát chi Tòa A',
          password: 'E2e-ksc-a-1',
          roleDefId: role.id,
          departmentId: (departments.find((row) => row.code === 'QTHT') as { id: string }).id,
          buildingIds: [buildingId],
        })
        .expect(201),
    ).id;
    controller = await signIn(server, 'ksc-a', 'E2e-ksc-a-1');

    // AQUA, then PAYMENT = [CUSTOM_X, BOARD] and ACCEPTANCE = [MANAGER, CUSTOM_Y], both custom steps on that role.
    let config = dataOf<Config>(await admin.get(`/api/buildings/${buildingId}/config`));
    await admin
      .post(`/api/buildings/${buildingId}/config/apply-template`, { templateKey: 'AQUA', version: config.version })
      .expect(201);
    config = dataOf<Config>(await admin.get(`/api/buildings/${buildingId}/config`));
    const custom = [
      { key: 'CUSTOM_X', label: 'Kiểm soát chi duyệt', actor: 'KSC', role: 'OWNERS_BOARD', roleDefId: role.id },
      { key: 'CUSTOM_Y', label: 'Kiểm soát chi nghiệm thu', actor: 'KSC', role: 'OWNERS_BOARD', roleDefId: role.id },
    ];
    let stages = withStageSteps(config.workflowStages, 'PAYMENT', ['CUSTOM_X', 'BOARD']);
    stages = withStageSteps(stages, 'ACCEPTANCE', ['MANAGER', 'CUSTOM_Y']);
    await admin
      .put(`/api/buildings/${buildingId}/config`, {
        taskDueDays: config.taskDueDays,
        emergencyLimitVnd: config.emergencyLimitVnd,
        emergencyDocHours: config.emergencyDocHours,
        recentRepairDays: config.recentRepairDays,
        repeatMinRecords: config.repeatMinRecords,
        priceRatio: config.priceRatio,
        version: config.version,
        workflowApprovalSteps: [
          ...config.workflowApprovalSteps.filter(
            (step) => !['TECH_CONFIRM', 'TECH', 'BOARD', 'MANAGER'].includes(step.key),
          ),
          ...custom,
        ],
        approvalStepKeys: config.approvalStepKeys,
        workflowStages: stages,
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('AC-FX3.3 → AC-FX3.1: CUSTOM_Y passes acceptance, then CUSTOM_X and BQT approve the settlement', async () => {
    let record = await submitAcceptance(await inConstruction());
    expect(record.status).toBe('PENDING_ACCEPTANCE');
    record = await ok(bqlA, record, 'pass-acceptance', { signature: SIGNATURE });
    expect(record.status).toBe('PENDING_ACCEPTANCE');
    record = await ok(controller, record, 'pass-acceptance', { signature: SIGNATURE });
    expect(record.status).toBe('PENDING_PAYMENT_REQUEST');

    record = await ok(bqlA, record, 'submit-payment-request', await settlementBody(record));
    expect((await paymentsOf(record))[0]).toMatchObject({ status: 'PENDING_APPROVAL', currentStepKey: 'CUSTOM_X' });
    const early = await bqt.post(`/api/records/${record.id}/approve-payment`, { version: record.version }).expect(403);
    expect(reasonOf(early)).toBe('not_step_assignee');
    record = await ok(controller, record, 'approve-payment');
    expect((await paymentsOf(record))[0].currentStepKey).toBe('BOARD');
    record = await ok(bqt, record, 'approve-payment');
    expect(record.status).toBe('PENDING_PAYMENT');
  });

  it('AC-FX3.2: with the CUSTOM_X holder deactivated, the settlement answers 409 step_holder_missing', async () => {
    let record = await submitAcceptance(await inConstruction());
    record = await ok(bqlA, record, 'pass-acceptance', { signature: SIGNATURE });
    record = await ok(controller, record, 'pass-acceptance', { signature: SIGNATURE });
    expect(record.status).toBe('PENDING_PAYMENT_REQUEST');

    const profile = dataOf<{ version: number; roleDefId: string; departmentId: string; fullName: string }>(
      await admin.get(`/api/users/${controllerId}`),
    );
    await admin
      .patch(`/api/users/${controllerId}`, {
        fullName: profile.fullName,
        roleDefId: profile.roleDefId,
        departmentId: profile.departmentId,
        buildingIds: [buildingId],
        active: false,
        version: profile.version,
      })
      .expect(200);

    const refused = await bqlA
      .post(`/api/records/${record.id}/submit-payment-request`, {
        version: record.version,
        ...(await settlementBody(record)),
      })
      .expect(409);
    expect(reasonOf(refused)).toBe('step_holder_missing');
    expect(errorOf(refused).message).toBe(
      'Bước «Kiểm soát chi duyệt» chưa có người xử lý hợp lệ. Liên hệ quản trị để giao người.',
    );
    const after = dataOf<{ record: FlowRecord }>(await bqlA.get(`/api/records/${record.id}`)).record;
    expect(after).toMatchObject({ status: 'PENDING_PAYMENT_REQUEST', version: record.version });
  });
});
