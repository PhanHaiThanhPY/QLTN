import type { NestExpressApplication } from '@nestjs/platform-express';
import { promises as fs, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createApp, dataOf, errorFields, errorOf, type Session, signIn } from './app-harness';

/** SPEC RM-S2 (docs/product/features/RM-ma-tran-quyen-v2/SPEC.md): confirmer from INTAKE, AQUA, single chain. */
const STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'qltn-rm-s2-e2e-'));
process.env.STORAGE_DIR = STORAGE_DIR;
const MIGRATION = path.join(__dirname, '../src/database/migrations/2026-10-26c-approval-chain-single-source.sql');

interface Building {
  id: string;
  code: string;
}
interface Stage {
  key: string;
  approvalStepKeys: string[];
  stepBindings: Array<{ businessStepKey: string; approvalStepKey?: string }>;
}
interface Config {
  buildingId: string;
  version: number;
  templateKey: string | null;
  approvalStepKeys: string[];
  workflowStages: Stage[];
  workflowApprovalSteps: Array<{ key: string }>;
  taskDueDays: Record<string, number>;
  emergencyLimitVnd: string;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
}
interface UserRow {
  id: string;
  code: string;
  fullName: string;
  roleDefId: string;
  departmentId: string;
  buildingIds: string[];
  locationIds: string[];
  version: number;
}
interface RecordView {
  id: string;
  version: number;
  status: string;
  confirmationUserId: string;
  approvalStepKeys: string[];
}
interface AuditRow {
  action: string;
  reason: string | null;
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rm-s2')]);

const proposalOf = (config: Config): string[] =>
  config.workflowStages.find((stage) => stage.key === 'PROPOSAL')?.approvalStepKeys ?? [];

const withStage = (stages: Stage[], key: string, keys: string[]): Stage[] =>
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

const configBody = (config: Config, overrides: Record<string, unknown> = {}) => ({
  taskDueDays: config.taskDueDays,
  emergencyLimitVnd: config.emergencyLimitVnd,
  emergencyDocHours: config.emergencyDocHours,
  recentRepairDays: config.recentRepairDays,
  repeatMinRecords: config.repeatMinRecords,
  priceRatio: config.priceRatio,
  version: config.version,
  ...overrides,
});

const reasonOf = (res: { body: unknown }): string | undefined =>
  (errorOf(res).details as { reason?: string } | null)?.reason;

describe('Confirmer from configuration and single proposal chain, RM-S2 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;
  let admin: Session;
  let bqlA: Session;
  let bqlB: Session;
  let ktA: Session;
  let ktB: Session;
  let tvkt: Session;
  let bqt: Session;
  let buildings: Building[];
  let users: UserRow[];

  const building = (code: string): Building => buildings.find((row) => row.code === code) as Building;
  const user = (code: string): UserRow => users.find((row) => row.code === code) as UserRow;
  const configOf = async (buildingId: string): Promise<Config> =>
    dataOf<Config>(await admin.get(`/api/buildings/${buildingId}/config`).expect(200));
  const applyTemplate = async (buildingId: string, templateKey: string): Promise<Config> => {
    const current = await configOf(buildingId);
    return dataOf<{ config: Config }>(
      await admin
        .post(`/api/buildings/${buildingId}/config/apply-template`, { templateKey, version: current.version })
        .expect(201),
    ).config;
  };

  /** A submitted record (waiting for confirmation) created by `manager` in the first location of the building. */
  const pendingRecord = async (manager: Session, buildingId: string): Promise<RecordView> => {
    const reference = dataOf<{ locations: Array<{ id: string; buildingId: string }> }>(
      await manager.get('/api/reference'),
    );
    const locationId = (reference.locations.find((row) => row.buildingId === buildingId) as { id: string }).id;
    const draft = dataOf<RecordView>(
      await manager
        .post('/api/records', {
          buildingId,
          locationId,
          title: 'RM-S2 hồ sơ xác nhận',
          description: 'Thấm trần hành lang, cần người xác nhận theo cấu hình.',
          noMaintenanceItem: true,
        })
        .expect(201),
    );
    const photo = dataOf<{ id: string }>(
      await manager
        .postMultipart(
          '/api/attachments',
          { subjectType: 'REPAIR_RECORD', subjectId: draft.id, purpose: 'SITE_PHOTO' },
          { content: PNG, filename: 'p.png', contentType: 'image/png' },
        )
        .expect(201),
    );
    return dataOf<RecordView>(
      await manager
        .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo.id] })
        .expect(200),
    );
  };

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    admin = await signIn(server, 'admin-demo');
    bqlA = await signIn(server, 'bql-a');
    bqlB = await signIn(server, 'bql-b');
    ktA = await signIn(server, 'kt-a');
    ktB = await signIn(server, 'kt-b');
    tvkt = await signIn(server, 'tvkt');
    bqt = await signIn(server, 'bqt');
    buildings = dataOf<Building[]>(await admin.get('/api/buildings'));
    users = dataOf<{ data: UserRow[] }>(await admin.get('/api/users?limit=100')).data;
  });

  afterAll(async () => {
    await app.close();
    rmSync(STORAGE_DIR, { recursive: true, force: true });
  });

  it('AC-2.1: refuses an INTAKE stage with 0 steps, 2 steps or a step whose role cannot confirm', async () => {
    const config = await configOf(building('B').id);
    const intakeIndex = config.workflowStages.findIndex((stage) => stage.key === 'INTAKE');
    const field = `workflowStages.${intakeIndex}.approvalStepKeys`;
    const save = (overrides: Record<string, unknown>) =>
      admin.put(`/api/buildings/${building('B').id}/config`, configBody(config, overrides)).expect(400);

    expect(errorFields(await save({ workflowStages: withStage(config.workflowStages, 'INTAKE', []) }))).toContain(
      field,
    );
    expect(
      errorFields(await save({ workflowStages: withStage(config.workflowStages, 'INTAKE', ['TECH', 'BOARD']) })),
    ).toContain(field);
    const bqlStep = await save({
      workflowApprovalSteps: [{ key: 'BQL_CONFIRM', label: 'BQL xác nhận', role: 'BQL' }],
      workflowStages: withStage(config.workflowStages, 'INTAKE', ['BQL_CONFIRM']),
    });
    expect(errorFields(bqlStep)).toContain(field);
  });

  it('AC-2.2: on an AQUA building the new record goes to TVKT, who confirms; KT is refused', async () => {
    const aqua = await applyTemplate(building('A').id, 'AQUA');
    expect(aqua.workflowStages.find((stage) => stage.key === 'INTAKE')?.approvalStepKeys).toEqual(['TECH']);
    expect(aqua.approvalStepKeys).toEqual(['TECH', 'BOARD']);
    // B03–B09 v2 S3: the manager joins the AQUA acceptance (ADR-0001 R3).
    expect(aqua.workflowStages.find((stage) => stage.key === 'ACCEPTANCE')?.approvalStepKeys).toEqual([
      'MANAGER',
      'BOARD',
      'TECH',
    ]);

    const first = await pendingRecord(bqlA, building('A').id);
    expect(first.confirmationUserId).toBe(user('TVKT').id);
    const confirmed = dataOf<RecordView>(
      await tvkt
        .post(`/api/records/${first.id}/confirm-repair`, { version: first.version, note: 'TVKT đã kiểm tra, cần sửa.' })
        .expect(200),
    );
    expect(confirmed.status).toBe('PENDING_PROPOSAL');

    const second = await pendingRecord(bqlA, building('A').id);
    const refused = await ktA
      .post(`/api/records/${second.id}/confirm-repair`, { version: second.version, note: 'KT không được giao.' })
      .expect(403);
    expect(reasonOf(refused)).toBe('not_step_assignee');
    expect(errorOf(refused).message).toBe('Chỉ người xác nhận hiện trạng được giao mới thực hiện được bước này.');
  });

  it('AC-2.4: on a STANDARD-style building KT still confirms (S1 unchanged)', async () => {
    const config = await configOf(building('B').id);
    expect(config.workflowStages.find((stage) => stage.key === 'INTAKE')?.approvalStepKeys).toEqual(['TECH_CONFIRM']);
    const record = await pendingRecord(bqlB, building('B').id);
    expect(record.confirmationUserId).toBe(user('KT-B').id);
    await ktB
      .post(`/api/records/${record.id}/confirm-repair`, { version: record.version, note: 'KT xác nhận cần sửa.' })
      .expect(200);
  });

  it('AC-2.5: approvalStepKeys always equals the PROPOSAL stage on every write path', async () => {
    const b = building('B').id;
    let config = await configOf(b);
    const mismatch = await admin
      .put(`/api/buildings/${b}/config`, configBody(config, { approvalStepKeys: ['BOARD'] }))
      .expect(400);
    expect(errorFields(mismatch)).toEqual(['approvalStepKeys']);
    expect(errorOf(mismatch).message).toBe('Chuỗi phê duyệt phải trùng các bước của giai đoạn Tờ trình.');

    const inSync = (row: Config) => expect(row.approvalStepKeys).toEqual(proposalOf(row));

    // 1. PUT config without approvalStepKeys: derived from the stages.
    config = dataOf<{ config: Config }>(
      await admin
        .put(
          `/api/buildings/${b}/config`,
          configBody(config, { workflowStages: withStage(config.workflowStages, 'PROPOSAL', ['BOARD']) }),
        )
        .expect(200),
    ).config;
    expect(config.approvalStepKeys).toEqual(['BOARD']);
    inSync(config);

    // 2. Apply a template.
    inSync(await applyTemplate(b, 'OFFICE'));

    // 3. Copy from another building.
    const current = await configOf(b);
    inSync(
      dataOf<{ config: Config }>(
        await admin
          .post(`/api/buildings/${b}/config/apply-template`, {
            sourceBuildingId: building('A').id,
            version: current.version,
          })
          .expect(201),
      ).config,
    );

    // 4. Bulk workflow update, sending only stages.
    const before = await configOf(b);
    await admin
      .put('/api/building-configs/workflow', {
        targets: [
          {
            buildingId: b,
            version: before.version,
            values: {
              ...configBody(before, { version: undefined }),
              workflowStages: withStage(before.workflowStages, 'PROPOSAL', ['TECH', 'BOARD']),
            },
          },
        ],
      })
      .expect(200);
    inSync(await configOf(b));

    // 5. Create a building from the default template.
    const created = dataOf<Building>(
      await admin.post('/api/buildings', { code: 'RM2', name: 'Tòa RM-S2', address: 'Thử nghiệm' }).expect(201),
    );
    const fresh = await configOf(created.id);
    inSync(fresh);
    expect(fresh.approvalStepKeys).toEqual(['TECH', 'BOARD']);
  });

  it('AC-2.6: a record on a default-template building snapshots the chain TVKT → BQT', async () => {
    await applyTemplate(building('B').id, 'STANDARD');
    const record = await pendingRecord(bqlB, building('B').id);
    expect(record.approvalStepKeys).toEqual(['TECH', 'BOARD']);
  });

  it('AC-2.7: the migration keeps the running chain, audits each building and runs twice without change', async () => {
    const c = building('C').id;
    const d = building('D').id;
    const record = await pendingRecord(bqlB, building('C').id);
    const threeSteps = JSON.stringify(
      withStage((await configOf(c)).workflowStages, 'PROPOSAL', ['TECH_CONFIRM', 'TECH', 'BOARD']),
    );
    await dataSource.query(
      `UPDATE building_configs SET approval_step_keys = '{TECH,BOARD}', workflow_stages = $1::jsonb WHERE building_id = $2`,
      [threeSteps, c],
    );
    const threeStepsD = JSON.stringify(
      withStage((await configOf(d)).workflowStages, 'PROPOSAL', ['TECH_CONFIRM', 'TECH', 'BOARD']),
    );
    await dataSource.query(
      `UPDATE building_configs SET approval_step_keys = '{TECH}', workflow_stages = $1::jsonb WHERE building_id = $2`,
      [threeStepsD, d],
    );
    await dataSource.query(`UPDATE repair_records SET approval_step_keys = '{TECH_CONFIRM,TECH,BOARD}' WHERE id = $1`, [
      record.id,
    ]);
    const versionC = (await configOf(c)).version;

    const sql = await fs.readFile(MIGRATION, 'utf8');
    await dataSource.query(sql);
    const afterC = await configOf(c);
    const afterD = await configOf(d);
    expect(proposalOf(afterC)).toEqual(['TECH', 'BOARD']);
    expect(afterC.version).toBe(versionC + 1);
    expect(proposalOf(afterD)).toEqual(['TECH']);
    const auditOf = async (id: string) =>
      dataOf<{ data: AuditRow[] }>(await admin.get(`/api/buildings/${id}/audit?limit=100`)).data.filter(
        (row) => row.action === 'migrateApprovalChain',
      );
    expect(await auditOf(c)).toHaveLength(1);
    const auditD = await auditOf(d);
    expect(auditD).toHaveLength(1);
    expect(auditD[0].reason).toContain('Thiếu BQT');

    await dataSource.query(sql);
    expect((await configOf(c)).version).toBe(afterC.version);
    expect(await auditOf(c)).toHaveLength(1);
    expect(await auditOf(d)).toHaveLength(1);
    const kept = dataOf<{ record: RecordView }>(await bqlB.get(`/api/records/${record.id}`)).record;
    expect(kept.approvalStepKeys).toEqual(['TECH_CONFIRM', 'TECH', 'BOARD']);
  });

  it('AC-2.3: with no active TVKT, an AQUA building gives the record to BQT and audits why', async () => {
    const tvktUser = user('TVKT');
    const profile = dataOf<UserRow>(await admin.get(`/api/users/${tvktUser.id}`));
    const roles = dataOf<Array<{ id: string; code: string }>>(await admin.get('/api/roles'));
    const deactivated = await admin.patch(`/api/users/${tvktUser.id}`, {
      fullName: profile.fullName,
      roleDefId: profile.roleDefId ?? (roles.find((row) => row.code === 'TVKT') as { id: string }).id,
      departmentId: profile.departmentId,
      buildingIds: profile.buildingIds,
      active: false,
      version: profile.version,
    });
    expect(deactivated.status).toBe(200);
    // Unchanged AQUA (PROPOSAL [TECH, BOARD]); BR-07a: submit needs only the INTAKE holder, here the BQT fallback.
    const aqua = await applyTemplate(building('A').id, 'AQUA');
    expect(aqua.approvalStepKeys).toEqual(['TECH', 'BOARD']);

    const record = await pendingRecord(bqlA, building('A').id);
    expect(record.confirmationUserId).toBe(user('BQT').id);
    const detail = dataOf<{ audit: AuditRow[] }>(await bqlA.get(`/api/records/${record.id}`));
    expect(detail.audit.find((row) => row.action === 'createRecord')?.reason).toBe(
      'Không có người xác nhận theo cấu hình, dùng BQT',
    );
    await bqt
      .post(`/api/records/${record.id}/confirm-repair`, { version: record.version, note: 'BQT xác nhận thay TVKT.' })
      .expect(200);
  });
});
