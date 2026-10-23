import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope } from '../../common/auth/scope';
import { assertVersion, conflict, notFound } from '../../common/errors';
import { FieldErrors } from '../../common/validation/field-errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import {
  approvalDefinitionsOf,
  type AssignmentRule,
  type TaskDueDays,
  type WorkflowApprovalStep,
} from '../../domain/building-config';
import type { Role } from '../../domain/permissions';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { BuildingConfig } from '../buildings/entities/building-config.entity';
import { Location } from '../buildings/entities/location.entity';
import { User } from '../users/entities/user.entity';
import type { CreateRecordDto, UpdateRecordDraftDto } from './dto/record.dto';
import { RepairRecord } from './entities/repair-record.entity';

const CODE_PREFIX = 'SC';
const CODE_WIDTH = 3;
const DRAFT_STATUS = 'DRAFT';

export interface RepairRecordView {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  noMaintenanceItem: boolean;
  title: string;
  description: string;
  priority: string;
  status: string;
  managerUserId: string;
  confirmationUserId: string;
  consultantUserId: string;
  boardUserId: string;
  approvalStepKeys: string[];
  workflowApprovalSteps: WorkflowApprovalStep[];
  workflowStageApprovalStepKeys: Partial<Record<string, string[]>>;
  approvalAssigneeUserIds: Record<string, string>;
  /** Snapshot of the building's task due days when the record was created. */
  dueDays: TaskDueDays;
  /** Files arrive in T2; the field stays so the detail screen keeps its shape. */
  attachmentIds: string[];
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordDetailView {
  record: RepairRecordView;
  audit: AuditEventView[];
}

export const toRecordView = (record: RepairRecord): RepairRecordView => ({
  id: record.id,
  code: record.code,
  buildingId: record.buildingId,
  locationId: record.locationId ?? '',
  noMaintenanceItem: record.noMaintenanceItem,
  title: record.title,
  description: record.description,
  priority: record.priority,
  status: record.status,
  managerUserId: record.managerUserId,
  confirmationUserId: record.confirmationUserId ?? '',
  consultantUserId: record.consultantUserId ?? '',
  boardUserId: record.boardUserId ?? '',
  approvalStepKeys: [...record.approvalStepKeys],
  workflowApprovalSteps: record.workflowApprovalSteps.map((step) => ({ ...step })),
  workflowStageApprovalStepKeys: record.workflowStageApprovalStepKeys,
  approvalAssigneeUserIds: { ...record.approvalAssigneeUserIds },
  dueDays: { ...record.taskDueDays },
  attachmentIds: [],
  createdBy: record.createdBy,
  version: record.version,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

interface AssignmentContext {
  users: User[];
  rules: AssignmentRule[];
}

const canAccessLocation = (user: User, buildingId: string, locationId: string | null): boolean => {
  if (!user.buildings.some((building) => building.id === buildingId)) return false;
  const locationIds = user.locations.map((location) => location.id);
  return !locationId || locationIds.length === 0 || locationIds.includes(locationId);
};

const rulesFor = (ctx: AssignmentContext, role: Role, locationId: string | null): AssignmentRule[] =>
  ctx.rules
    .filter((rule) => rule.role === role)
    .filter(
      (rule) =>
        !locationId || !rule.locationIds || rule.locationIds.length === 0 || rule.locationIds.includes(locationId),
    )
    .sort((a, b) => a.priority - b.priority);

const byCode = (a: User, b: User): number => a.code.localeCompare(b.code);

/** Mirrors web `isActiveUserInRole`: active, right role, in the building/location and matching the assignment rules. */
const isActiveUserInRole = (
  ctx: AssignmentContext,
  userId: string | null,
  role: Role,
  buildingId: string,
  locationId: string | null,
): boolean => {
  const user = userId ? ctx.users.find((row) => row.id === userId) : undefined;
  if (!user || !user.isActive || user.role !== role || !canAccessLocation(user, buildingId, locationId)) return false;
  const rules = ctx.rules.filter((rule) => rule.role === role);
  if (rules.length === 0) return true;
  return rulesFor(ctx, role, locationId).some((rule) => rule.departmentId === user.departmentId);
};

/** Mirrors web `firstActiveInRole`: the first active user selected by the building assignment rules. */
const firstActiveInRole = (
  ctx: AssignmentContext,
  role: Role,
  buildingId: string,
  locationId: string | null,
): string | undefined => {
  const candidates = ctx.users
    .filter((user) => user.isActive && user.role === role && canAccessLocation(user, buildingId, locationId))
    .sort(byCode);
  const rules = ctx.rules.filter((rule) => rule.role === role);
  if (rules.length === 0) return candidates[0]?.id;
  for (const rule of rulesFor(ctx, role, locationId)) {
    const match = candidates.find((user) => user.departmentId === rule.departmentId);
    if (match) return match.id;
  }
  return undefined;
};

const firstActiveForApprovalStep = (
  ctx: AssignmentContext,
  step: WorkflowApprovalStep,
  buildingId: string,
  locationId: string | null,
): string | undefined => {
  if (step.roleDefId) {
    return ctx.users
      .filter(
        (user) => user.isActive && user.roleDefId === step.roleDefId && canAccessLocation(user, buildingId, locationId),
      )
      .sort(byCode)[0]?.id;
  }
  return firstActiveInRole(ctx, step.role, buildingId, locationId);
};

const defaultWorkflowApprovers = (
  ctx: AssignmentContext,
  steps: readonly WorkflowApprovalStep[],
  buildingId: string,
  locationId: string | null,
): Record<string, string> =>
  Object.fromEntries(
    steps
      .map((step) => [step.key, firstActiveForApprovalStep(ctx, step, buildingId, locationId)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );

/** Requested approval steps resolved against the library kept on the building configuration. */
const workflowApprovalStepsOf = (config: BuildingConfig): WorkflowApprovalStep[] => {
  const definitions = approvalDefinitionsOf(config.workflowApprovalSteps);
  return config.approvalStepKeys
    .map((key) => definitions.find((step) => step.key === key))
    .filter((step): step is WorkflowApprovalStep => Boolean(step))
    .map((step) => ({ ...step }));
};

/** Snapshot used when the record leaves DRAFT; `taskDueDays` is the field name on the backend. */
const workflowStageApprovalStepKeysOf = (config: BuildingConfig): Partial<Record<string, string[]>> =>
  Object.fromEntries(config.workflowStages.map((stage) => [stage.key, [...stage.approvalStepKeys]]));

@Injectable()
export class RecordsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly codes: CodeCounterService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateRecordDto): Promise<RepairRecordView> {
    assertBuildingInScope(actor, dto.buildingId);
    return this.dataSource.transaction(async (manager) => {
      const config = await this.loadConfig(manager, dto.buildingId);
      const assignment = await this.loadAssignmentContext(manager, dto.buildingId);
      const locationId = dto.locationId ?? null;
      const errors = new FieldErrors();
      await this.validateLocation(manager, errors, dto.buildingId, locationId, null);
      this.validateManager(assignment, errors, actor, dto.buildingId, locationId);

      const steps = workflowApprovalStepsOf(config);
      const defaultConfirmer = firstActiveInRole(assignment, 'TECH_CONFIRMER', dto.buildingId, locationId) ?? null;
      const confirmationUserId = dto.confirmationUserId === undefined ? defaultConfirmer : dto.confirmationUserId;
      this.validateConfirmer(assignment, errors, confirmationUserId, dto.buildingId, locationId);
      errors.throwIfAny();

      const repo = manager.getRepository(RepairRecord);
      const record = repo.create({
        code: await this.codes.next(manager, CODE_PREFIX, CODE_WIDTH),
        buildingId: dto.buildingId,
        locationId,
        noMaintenanceItem: dto.noMaintenanceItem === true,
        title: dto.title ?? '',
        description: dto.description ?? '',
        priority: dto.priority ?? 'NORMAL',
        status: DRAFT_STATUS,
        managerUserId: actor.id,
        confirmationUserId,
        consultantUserId: firstActiveInRole(assignment, 'TECH_CONSULTANT', dto.buildingId, locationId) ?? null,
        boardUserId: firstActiveInRole(assignment, 'OWNERS_BOARD', dto.buildingId, locationId) ?? null,
        approvalStepKeys: [...config.approvalStepKeys],
        workflowApprovalSteps: steps,
        workflowStageApprovalStepKeys: workflowStageApprovalStepKeysOf(config),
        approvalAssigneeUserIds: defaultWorkflowApprovers(assignment, steps, dto.buildingId, locationId),
        taskDueDays: { ...config.taskDueDays },
        createdBy: actor.id,
        version: 1,
      });
      const saved = await repo.save(record);
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action: 'createRecord',
        actorId: actor.id,
        entityVersion: saved.version,
        toStatus: saved.status,
      });
      return toRecordView(saved);
    });
  }

  /** Draft save: only editable fields, version-locked, same audit trail as the demo command. */
  async updateDraft(actor: AuthenticatedUser, id: string, dto: UpdateRecordDraftDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RepairRecord);
      const record = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
      assertVersion(record.version, dto.version);
      if (record.status !== DRAFT_STATUS)
        throw conflict('Hồ sơ đã rời trạng thái nháp. Vui lòng tải lại trước khi thao tác.');

      const assignment = await this.loadAssignmentContext(manager, record.buildingId);
      const locationId = dto.locationId !== undefined ? dto.locationId : record.locationId;
      const confirmationUserId =
        dto.confirmationUserId !== undefined ? dto.confirmationUserId : record.confirmationUserId;
      const errors = new FieldErrors();
      await this.validateLocation(manager, errors, record.buildingId, locationId, record.locationId);
      this.validateManager(assignment, errors, actor, record.buildingId, locationId);
      this.validateConfirmer(assignment, errors, confirmationUserId, record.buildingId, locationId);
      errors.throwIfAny();

      record.locationId = locationId;
      record.confirmationUserId = confirmationUserId;
      if (dto.title !== undefined) record.title = dto.title;
      if (dto.description !== undefined) record.description = dto.description;
      if (dto.priority !== undefined) record.priority = dto.priority;
      if (dto.noMaintenanceItem !== undefined) record.noMaintenanceItem = dto.noMaintenanceItem;
      record.version += 1;
      const saved = await repo.save(record);
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action: 'saveRecordDraft',
        actorId: actor.id,
        entityVersion: saved.version,
        fromStatus: DRAFT_STATUS,
        toStatus: saved.status,
      });
      return toRecordView(saved);
    });
  }

  /** Record + history for the detail screen; another building's record answers 404. */
  async getDetail(actor: AuthenticatedUser, id: string): Promise<RecordDetailView> {
    const record = await this.dataSource.getRepository(RepairRecord).findOneBy({ id });
    if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
    const audit = await this.audit.listForSubject(SUBJECT_TYPE.REPAIR_RECORD, id, { page: 1, limit: 100 });
    return { record: toRecordView(record), audit: audit.data };
  }

  private async loadConfig(manager: EntityManager, buildingId: string): Promise<BuildingConfig> {
    const config = await manager.getRepository(BuildingConfig).findOneBy({ buildingId });
    if (!config) throw notFound('Tòa nhà chưa có cấu hình.');
    return config;
  }

  private async loadAssignmentContext(manager: EntityManager, buildingId: string): Promise<AssignmentContext> {
    const config = await this.loadConfig(manager, buildingId);
    const users = await manager
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.buildings', 'b')
      .leftJoinAndSelect('u.locations', 'l')
      .where('EXISTS (SELECT 1 FROM user_buildings ub WHERE ub.user_id = u.id AND ub.building_id = :buildingId)', {
        buildingId,
      })
      .getMany();
    return { users, rules: config.assignmentRules ?? [] };
  }

  private async validateLocation(
    manager: EntityManager,
    errors: FieldErrors,
    buildingId: string,
    locationId: string | null,
    currentLocationId: string | null,
  ): Promise<void> {
    if (!locationId) return;
    const location = await manager.getRepository(Location).findOneBy({ id: locationId });
    errors.when(!location || location.buildingId !== buildingId, 'locationId', 'Vị trí phải thuộc tòa nhà của hồ sơ.');
    errors.when(
      Boolean(location) &&
        location?.buildingId === buildingId &&
        !location?.isActive &&
        locationId !== currentLocationId,
      'locationId',
      'Vị trí đã ngừng dùng.',
    );
  }

  private validateManager(
    ctx: AssignmentContext,
    errors: FieldErrors,
    actor: AuthenticatedUser,
    buildingId: string,
    locationId: string | null,
  ): void {
    errors.when(
      Boolean(locationId) && !isActiveUserInRole(ctx, actor.id, 'BQL', buildingId, locationId),
      'locationId',
      'Người quản lý không có phạm vi xử lý tại khu vực này.',
    );
  }

  private validateConfirmer(
    ctx: AssignmentContext,
    errors: FieldErrors,
    userId: string | null,
    buildingId: string,
    locationId: string | null,
  ): void {
    if (!userId) return;
    errors.when(
      !isActiveUserInRole(ctx, userId, 'TECH_CONFIRMER', buildingId, locationId),
      'confirmationUserId',
      'Người được chọn phải đúng vai trò, cùng tòa, đúng khu vực và còn hoạt động.',
    );
  }
}
