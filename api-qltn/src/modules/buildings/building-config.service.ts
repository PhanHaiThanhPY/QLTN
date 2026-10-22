import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope } from '../../common/auth/scope';
import { assertVersion, notFound } from '../../common/errors';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import {
  APPROVAL_STEPS,
  approvalDefinitionsOf,
  ASSIGNMENT_ROLES,
  BUSINESS_WORKFLOW_STEPS,
  CONFIG_DUE_KINDS,
  CONFIG_LIMITS,
  CONFIG_TEMPLATES,
  type ConfigChange,
  type ConfigValues,
  CUSTOM_APPROVAL_STATUS,
  DEFAULT_APPROVAL_STEP_KEYS,
  defaultWorkflowStages,
  diffConfig,
  requiredStepCapabilities,
  sortAssignmentRules,
  stepBindingsOf,
  templateValues,
  validateConfigRules,
  type WorkflowApprovalStep,
  type WorkflowStageConfig,
} from '../../domain/building-config';
import { effectiveCapabilities } from '../../domain/permissions';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { Department } from '../organization/entities/department.entity';
import { RoleDefinition } from '../roles/entities/role-definition.entity';
import type {
  ApplyTemplateDto,
  ApprovalStepDto,
  BulkWorkflowUpdateDto,
  ConfigValuesDto,
  UpdateBuildingConfigDto,
  WorkflowStageDto,
} from './dto/building-config.dto';
import { BuildingConfig } from './entities/building-config.entity';
import { Location } from './entities/location.entity';

export interface BuildingConfigView extends ConfigValues {
  buildingId: string;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface ConfigSaveResult {
  config: BuildingConfigView;
  changes: ConfigChange[];
}

/** Static catalog the workflow designer needs (steps, templates, limits). */
export const WORKFLOW_CATALOG = {
  approvalSteps: APPROVAL_STEPS,
  defaultApprovalStepKeys: DEFAULT_APPROVAL_STEP_KEYS,
  businessSteps: BUSINESS_WORKFLOW_STEPS,
  defaultStages: defaultWorkflowStages(),
  dueKinds: CONFIG_DUE_KINDS,
  assignmentRoles: ASSIGNMENT_ROLES,
  limits: CONFIG_LIMITS,
  templates: CONFIG_TEMPLATES,
} as const;

export function toConfigValues(row: BuildingConfig): ConfigValues {
  return {
    templateKey: row.templateKey,
    workflowName: row.workflowName,
    workflowDescription: row.workflowDescription,
    taskDueDays: { ...row.taskDueDays },
    approvalStepKeys: [...row.approvalStepKeys],
    workflowApprovalSteps: approvalDefinitionsOf(row.workflowApprovalSteps),
    workflowStages: row.workflowStages.map((stage) => ({ ...stage })),
    assignmentRules: sortAssignmentRules(row.assignmentRules),
    emergencyLimitVnd: row.emergencyLimitVnd,
    emergencyDocHours: row.emergencyDocHours,
    recentRepairDays: row.recentRepairDays,
    repeatMinRecords: row.repeatMinRecords,
    priceRatio: row.priceRatio,
  };
}

const toView = (row: BuildingConfig): BuildingConfigView => ({
  buildingId: row.buildingId,
  ...toConfigValues(row),
  version: row.version,
  updatedAt: row.updatedAt,
  updatedBy: row.updatedBy,
});

/** Steps from the request: system keys map to the built-in definition, others become custom steps. */
function normalizeSteps(input: readonly ApprovalStepDto[], errors: FieldErrors): WorkflowApprovalStep[] {
  errors.when(input.length === 0, 'workflowApprovalSteps', 'Cần ít nhất một bước duyệt.');
  const custom = input.flatMap((step, index): WorkflowApprovalStep[] => {
    const fixed = APPROVAL_STEPS.find((s) => s.key === step.key);
    if (fixed) {
      errors.when(
        step.roleDefId !== undefined,
        `workflowApprovalSteps.${index}.roleDefId`,
        'Bước hệ thống không dùng roleDefId.',
      );
      return [];
    }
    return [
      {
        key: step.key,
        label: step.label,
        actor: step.actor ?? step.role,
        role: step.role,
        ...(step.roleDefId ? { roleDefId: step.roleDefId } : {}),
        status: CUSTOM_APPROVAL_STATUS,
      },
    ];
  });
  errors.when(
    new Set(input.map((s) => s.key)).size !== input.length,
    'workflowApprovalSteps',
    'Mã bước duyệt không được trùng nhau.',
  );
  return approvalDefinitionsOf(custom);
}

const normalizeStages = (input: readonly WorkflowStageDto[]): WorkflowStageConfig[] =>
  input.map((stage) => ({
    key: stage.key,
    label: stage.label,
    description: stage.description,
    approvalStepKeys: [...stage.approvalStepKeys],
    businessStepKeys: [...stage.businessStepKeys],
    stepBindings: stage.stepBindings
      ? stage.stepBindings.map((b) => (b.approvalStepKey ? { ...b } : { businessStepKey: b.businessStepKey }))
      : stepBindingsOf(stage),
    enabled: stage.enabled ?? true,
  }));

/** Request values merged over the current configuration (omitted workflow parts are kept). */
function mergeValues(current: ConfigValues, dto: ConfigValuesDto, errors: FieldErrors): ConfigValues {
  return {
    templateKey: dto.templateKey !== undefined ? dto.templateKey : current.templateKey,
    workflowName: dto.workflowName !== undefined ? dto.workflowName : current.workflowName,
    workflowDescription: dto.workflowDescription !== undefined ? dto.workflowDescription : current.workflowDescription,
    taskDueDays: { ...dto.taskDueDays },
    approvalStepKeys: dto.approvalStepKeys ? [...dto.approvalStepKeys] : current.approvalStepKeys,
    workflowApprovalSteps: dto.workflowApprovalSteps
      ? normalizeSteps(dto.workflowApprovalSteps, errors)
      : current.workflowApprovalSteps,
    workflowStages: dto.workflowStages ? normalizeStages(dto.workflowStages) : current.workflowStages,
    assignmentRules: dto.assignmentRules
      ? sortAssignmentRules(
          dto.assignmentRules.map((rule) => ({
            departmentId: rule.departmentId,
            role: rule.role,
            ...(rule.locationIds && rule.locationIds.length > 0 ? { locationIds: [...rule.locationIds] } : {}),
            priority: rule.priority,
          })),
        )
      : current.assignmentRules,
    emergencyLimitVnd: dto.emergencyLimitVnd,
    emergencyDocHours: dto.emergencyDocHours,
    recentRepairDays: dto.recentRepairDays,
    repeatMinRecords: dto.repeatMinRecords,
    priceRatio: dto.priceRatio,
  };
}

@Injectable()
export class BuildingConfigService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async get(viewer: AuthenticatedUser, buildingId: string): Promise<BuildingConfigView> {
    assertBuildingInScope(viewer, buildingId);
    const row = await this.dataSource.getRepository(BuildingConfig).findOneBy({ buildingId });
    if (!row) throw notFound('Tòa nhà chưa có cấu hình.');
    return toView(row);
  }

  async list(viewer: AuthenticatedUser): Promise<BuildingConfigView[]> {
    if (viewer.buildingIds.length === 0) return [];
    const rows = await this.dataSource.getRepository(BuildingConfig).findBy({ buildingId: In(viewer.buildingIds) });
    return rows.map(toView);
  }

  async update(actor: AuthenticatedUser, buildingId: string, dto: UpdateBuildingConfigDto): Promise<ConfigSaveResult> {
    assertBuildingInScope(actor, buildingId);
    return this.dataSource.transaction((manager) =>
      this.save(manager, actor, buildingId, dto.version, 'updateBuildingConfig', (current, errors) =>
        mergeValues(current, dto, errors),
      ),
    );
  }

  /** Applies workflow values to several buildings in one transaction: all or none. */
  async bulkUpdate(actor: AuthenticatedUser, dto: BulkWorkflowUpdateDto): Promise<{ updated: number }> {
    const ids = dto.targets.map((t) => t.buildingId);
    const errors = new FieldErrors()
      .when(ids.length === 0, 'targets', 'Cần có ít nhất một tòa nhà để áp dụng workflow.')
      .when(new Set(ids).size !== ids.length, 'targets', 'Danh sách tòa nhà áp dụng workflow không hợp lệ.');
    errors.throwIfAny();
    for (const id of ids) assertBuildingInScope(actor, id);
    await this.dataSource.transaction(async (manager) => {
      for (const target of dto.targets) {
        await this.save(manager, actor, target.buildingId, target.version, 'updateWorkflowConfig', (current, e) =>
          mergeValues(current, target.values, e),
        );
      }
    });
    return { updated: dto.targets.length };
  }

  /**
   * A shared template replaces due days, thresholds and the proposal chain but keeps the building's
   * workflow stages, steps and assignment rules. Copying another building copies everything.
   */
  async applyTemplate(actor: AuthenticatedUser, buildingId: string, dto: ApplyTemplateDto): Promise<ConfigSaveResult> {
    assertBuildingInScope(actor, buildingId);
    if (Boolean(dto.templateKey) === Boolean(dto.sourceBuildingId)) {
      throw fieldError('templateKey', 'Chọn đúng một nguồn: cấu hình mẫu hoặc tòa nhà khác.');
    }
    if (dto.sourceBuildingId && !actor.buildingIds.includes(dto.sourceBuildingId)) {
      throw fieldError('sourceBuildingId', 'Chỉ sao chép từ tòa trong phạm vi của bạn.');
    }
    return this.dataSource.transaction(async (manager) => {
      const source = dto.sourceBuildingId
        ? await manager.getRepository(BuildingConfig).findOneBy({ buildingId: dto.sourceBuildingId })
        : null;
      if (dto.sourceBuildingId && !source) throw fieldError('sourceBuildingId', 'Tòa nguồn chưa có cấu hình.');
      return this.save(manager, actor, buildingId, dto.version, 'applyConfigTemplate', (current) => {
        if (source) return toConfigValues(source);
        const template = templateValues(dto.templateKey ?? '');
        if (!template) throw fieldError('templateKey', 'Cần chọn cấu hình mẫu.');
        return {
          ...current,
          templateKey: template.templateKey,
          taskDueDays: template.taskDueDays,
          approvalStepKeys: template.approvalStepKeys,
          emergencyLimitVnd: template.emergencyLimitVnd,
          emergencyDocHours: template.emergencyDocHours,
          recentRepairDays: template.recentRepairDays,
          repeatMinRecords: template.repeatMinRecords,
          priceRatio: template.priceRatio,
        };
      });
    });
  }

  /** Inserts the first configuration of a new building (inside the creating transaction). */
  async createInitial(manager: EntityManager, actor: AuthenticatedUser, buildingId: string, values: ConfigValues) {
    const repo = manager.getRepository(BuildingConfig);
    await repo.insert(repo.create({ buildingId, ...values, version: 1, updatedBy: actor.id }));
  }

  private async save(
    manager: EntityManager,
    actor: AuthenticatedUser,
    buildingId: string,
    expectedVersion: number,
    action: string,
    build: (current: ConfigValues, errors: FieldErrors) => ConfigValues,
  ): Promise<ConfigSaveResult> {
    const repo = manager.getRepository(BuildingConfig);
    const row = await repo.findOne({ where: { buildingId }, lock: { mode: 'pessimistic_write' } });
    if (!row) throw notFound('Tòa nhà chưa có cấu hình.');
    assertVersion(row.version, expectedVersion);

    const current = toConfigValues(row);
    const errors = new FieldErrors();
    const next = build(current, errors);
    errors.merge(validateConfigRules(next));
    errors.throwIfAny();
    await this.validateReferences(manager, buildingId, next);

    const changes = diffConfig(current, next);
    Object.assign(row, next, { version: row.version + 1, updatedBy: actor.id });
    const saved = await repo.save(row);
    await this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.BUILDING,
      subjectId: buildingId,
      buildingId,
      action,
      actorId: actor.id,
      entityVersion: saved.version,
      reason:
        changes.length === 0
          ? 'Không có thay đổi giá trị.'
          : changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join('\n'),
    });
    return { config: toView(saved), changes };
  }

  /** Rules that need the database: departments and locations of the building, custom roles of custom steps. */
  private async validateReferences(manager: EntityManager, buildingId: string, values: ConfigValues): Promise<void> {
    const errors = new FieldErrors();
    const departmentIds = [...new Set(values.assignmentRules.map((r) => r.departmentId))];
    const roleIds = [...new Set(values.workflowApprovalSteps.flatMap((s) => (s.roleDefId ? [s.roleDefId] : [])))];
    const [departments, locations, roles] = await Promise.all([
      departmentIds.length
        ? manager.getRepository(Department).find({ where: { id: In(departmentIds) }, relations: { buildings: true } })
        : Promise.resolve([]),
      manager.getRepository(Location).find({ where: { buildingId }, select: { id: true } }),
      roleIds.length ? manager.getRepository(RoleDefinition).findBy({ id: In(roleIds) }) : Promise.resolve([]),
    ]);
    const locationIds = new Set(locations.map((l) => l.id));

    values.assignmentRules.forEach((rule, index) => {
      const department = departments.find((d) => d.id === rule.departmentId);
      errors.when(!department, `assignmentRules.${index}.departmentId`, 'Bộ phận không tồn tại.');
      errors.when(
        Boolean(department) && !department?.buildings.some((b) => b.id === buildingId),
        `assignmentRules.${index}.departmentId`,
        'Bộ phận chưa được gán vào tòa nhà này.',
      );
      errors.when(
        (rule.locationIds ?? []).some((id) => !locationIds.has(id)),
        `assignmentRules.${index}.locationIds`,
        'Vị trí phải thuộc tòa nhà đang cấu hình.',
      );
    });

    values.workflowApprovalSteps.forEach((step, index) => {
      if (!step.roleDefId) return;
      const field = `workflowApprovalSteps.${index}.roleDefId`;
      const role = roles.find((r) => r.id === step.roleDefId);
      if (!role) {
        errors.add(field, 'Vai trò tùy chỉnh không tồn tại.');
        return;
      }
      errors.when(role.baseRole !== step.role, field, 'Vai trò tùy chỉnh không khớp vai trò gốc của bước.');
      const granted = effectiveCapabilities(role.baseRole, role.isSystem ? null : role.capabilities);
      for (const capability of requiredStepCapabilities(values.workflowStages, step.key)) {
        errors.when(!granted.includes(capability), field, `Vai trò được chọn cần có quyền ${capability}.`);
      }
    });
    errors.throwIfAny();
  }
}
