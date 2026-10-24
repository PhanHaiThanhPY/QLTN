import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope } from '../../common/auth/scope';
import { assertVersion, notFound } from '../../common/errors';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, toPaginated } from '../../common/utils/pagination';
import { FieldErrors } from '../../common/validation/field-errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import {
  APPROVAL_STEPS,
  approvalDefinitionsOf,
  type AssignmentRule,
  type TaskDueDays,
  type WorkflowApprovalStep,
} from '../../domain/building-config';
import type { Role } from '../../domain/permissions';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { ATTACHMENT_DRAFT_MESSAGES } from '../attachments/attachments.service';
import { toAttachmentView, type AttachmentView } from '../attachments/attachment-view';
import { Attachment } from '../attachments/entities/attachment.entity';
import { BuildingConfig } from '../buildings/entities/building-config.entity';
import { Location } from '../buildings/entities/location.entity';
import { User } from '../users/entities/user.entity';
import type { ListRecordsQueryDto } from './dto/list-records-query.dto';
import type { CreateRecordDto, SubmitRecordDto, UpdateRecordDraftDto, WithdrawRecordDto } from './dto/record.dto';
import { RepairRecord } from './entities/repair-record.entity';
import { assertRecordAction, type RecordAction } from './record-actions';
import { statusesOfGroup } from './record-status-groups';

const CODE_PREFIX = 'SC';
const CODE_WIDTH = 3;
const DRAFT_STATUS = 'DRAFT';
const PENDING_CONFIRMATION = 'PENDING_CONFIRMATION';
const CLOSED_WITHDRAWN = 'CLOSED_WITHDRAWN';

/** Same bounds as web `LIMITS` (title/description/reason) and the demo submit rules. */
const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;
const REASON_MIN = 5;
const REASON_MAX = 1000;

/** Placeholder scope for an account without buildings, so `IN (:...scope)` stays valid SQL. */
const NO_BUILDING = '00000000-0000-0000-0000-000000000000';

/**
 * Diacritic folding for `search`: the database has no `unaccent` extension, so `translate()` maps Vietnamese
 * letters to their ASCII base before comparing (`lower()` alone does not remove the marks). Upper-case forms
 * are included because `lower()` depends on the database collation.
 */
const FOLD_BASES: ReadonlyArray<readonly [string, string]> = [
  ['a', 'àáạảãâầấậẩẫăằắặẳẵ'],
  ['e', 'èéẹẻẽêềếệểễ'],
  ['i', 'ìíịỉĩ'],
  ['o', 'òóọỏõôồốộổỗơờớợởỡ'],
  ['u', 'ùúụủũưừứựửữ'],
  ['y', 'ỳýỵỷỹ'],
  ['d', 'đ'],
];
const FOLD_FROM = FOLD_BASES.map(([base, marks]) => base + marks + marks.toUpperCase()).join('');
const FOLD_TO = FOLD_BASES.map(([base, marks]) => base.repeat(1 + marks.length * 2)).join('');

/** Escapes LIKE wildcards so a literal `%` or `_` in the search box stays literal. */
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Legacy approval steps that resolve their assignee from a record column; custom steps use the snapshot map. */
const APPROVAL_STEP_SLOT: Partial<Record<string, 'confirmationUserId' | 'consultantUserId' | 'boardUserId'>> = {
  TECH_CONFIRM: 'confirmationUserId',
  TECH: 'consultantUserId',
  BOARD: 'boardUserId',
};

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
  /** Ordered ids of the site photos attached to the record. */
  attachmentIds: string[];
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordDetailView {
  record: RepairRecordView;
  /** Site photos (and later, other files) attached to the record, in the record's order. */
  attachments: AttachmentView[];
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
  attachmentIds: [...record.attachmentIds],
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

/** Mirrors web `isActiveUserForApprovalStep`: active, in the area, and holding the step's role. */
const isActiveUserForApprovalStep = (
  ctx: AssignmentContext,
  userId: string | null | undefined,
  step: WorkflowApprovalStep,
  buildingId: string,
  locationId: string | null,
): boolean => {
  const user = userId ? ctx.users.find((row) => row.id === userId) : undefined;
  if (!user || !user.isActive || !canAccessLocation(user, buildingId, locationId)) return false;
  if (step.roleDefId) return user.roleDefId === step.roleDefId;
  return isActiveUserInRole(ctx, user.id, step.role, buildingId, locationId);
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
      this.validateManager(assignment, errors, actor.id, dto.buildingId, locationId);

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
      const record = await this.loadRecordForAction(manager, actor, id, dto.version, 'saveRecordDraft');
      const assignment = await this.loadAssignmentContext(manager, record.buildingId);
      await this.applyDraftFields(manager, assignment, record, dto);
      const fromStatus = record.status;
      record.version += 1;
      const saved = await manager.getRepository(RepairRecord).save(record);
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action: 'saveRecordDraft',
        actorId: actor.id,
        entityVersion: saved.version,
        fromStatus,
        toStatus: saved.status,
      });
      return toRecordView(saved);
    });
  }

  /**
   * Leaves the draft: applies the optional draft fields sent with the request, then runs the
   * demo's `assertSubmittable` checks (all field errors at once, nothing persisted on failure).
   */
  async submit(actor: AuthenticatedUser, id: string, dto: SubmitRecordDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await this.loadRecordForAction(manager, actor, id, dto.version, 'submitRecord');
      const assignment = await this.loadAssignmentContext(manager, record.buildingId);
      await this.applyDraftFields(manager, assignment, record, dto);
      await this.assertSubmittable(manager, assignment, record);
      const fromStatus = record.status;
      record.status = PENDING_CONFIRMATION;
      record.version += 1;
      const saved = await manager.getRepository(RepairRecord).save(record);
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action: 'submitRecord',
        actorId: actor.id,
        entityVersion: saved.version,
        fromStatus,
        toStatus: saved.status,
      });
      return toRecordView(saved);
    });
  }

  /** Withdraws an editable draft (another status answers 409 `invalid_status_transition`); reason is mandatory. */
  async withdraw(actor: AuthenticatedUser, id: string, dto: WithdrawRecordDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await this.loadRecordForAction(manager, actor, id, dto.version, 'withdrawRecord');
      const reason = (dto.reason ?? '').trim();
      const errors = new FieldErrors();
      this.validateText(errors, 'reason', 'Lý do', reason, REASON_MIN, REASON_MAX);
      errors.throwIfAny();
      const fromStatus = record.status;
      record.status = CLOSED_WITHDRAWN;
      record.version += 1;
      const saved = await manager.getRepository(RepairRecord).save(record);
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action: 'withdrawRecord',
        actorId: actor.id,
        entityVersion: saved.version,
        fromStatus,
        toStatus: saved.status,
        reason,
      });
      return toRecordView(saved);
    });
  }

  /**
   * Paginated record list inside the caller's buildings, newest update first.
   * A `buildingId` outside the scope answers an empty page instead of 404, so the list never reveals
   * whether that building exists. Every filter runs in SQL; `meta.total` is the count after filtering.
   */
  async list(actor: AuthenticatedUser, query: ListRecordsQueryDto): Promise<PaginatedResult<RepairRecordView>> {
    const window = pageWindow(query);
    if (query.buildingId && !actor.buildingIds.includes(query.buildingId)) return toPaginated([], 0, window);

    const qb = this.dataSource.getRepository(RepairRecord).createQueryBuilder('r');
    qb.andWhere(
      query.buildingId ? 'r.building_id = :buildingId' : 'r.building_id IN (:...scope)',
      query.buildingId
        ? { buildingId: query.buildingId }
        : { scope: actor.buildingIds.length > 0 ? actor.buildingIds : [NO_BUILDING] },
    );
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.statusGroup) {
      qb.andWhere('r.status IN (:...statuses)', { statuses: statusesOfGroup(query.statusGroup) });
    }
    if (query.locationId) qb.andWhere('r.location_id = :locationId', { locationId: query.locationId });
    if (query.assigneeId) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('r.manager_user_id = :assigneeId', { assigneeId: query.assigneeId })
            .orWhere('r.confirmation_user_id = :assigneeId')
            .orWhere('r.consultant_user_id = :assigneeId')
            .orWhere('r.board_user_id = :assigneeId'),
        ),
      );
    }
    if (query.search) {
      // Both sides are folded, so "tham tran" and "thấm trần" find the same records.
      const search = escapeLike(query.search);
      const pattern = `'%' || translate(lower(:search), :foldFrom, :foldTo) || '%'`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where(`translate(lower(r.code), :foldFrom, :foldTo) LIKE ${pattern} ESCAPE '\\'`, { search })
            .orWhere(`translate(lower(r.title), :foldFrom, :foldTo) LIKE ${pattern} ESCAPE '\\'`),
        ),
        { foldFrom: FOLD_FROM, foldTo: FOLD_TO },
      );
    }
    if (query.dateFrom) {
      qb.andWhere("(r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= :dateFrom", { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere("(r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= :dateTo", { dateTo: query.dateTo });
    }
    const [page, total] = await qb
      .orderBy('r.updated_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .skip(window.skip)
      .take(window.limit)
      .getManyAndCount();
    return toPaginated(page.map(toRecordView), total, window);
  }

  /** Record + history for the detail screen; another building's record answers 404. */
  async getDetail(actor: AuthenticatedUser, id: string): Promise<RecordDetailView> {
    const record = await this.dataSource.getRepository(RepairRecord).findOneBy({ id });
    if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
    const [attachments, audit] = await Promise.all([
      this.attachmentsOf(record),
      this.audit.listForSubject(SUBJECT_TYPE.REPAIR_RECORD, id, { page: 1, limit: 100 }),
    ]);
    return { record: toRecordView(record), attachments, audit: audit.data };
  }

  /** Locks the record, hides other buildings (404), enforces the version then the shared action rules. */
  private async loadRecordForAction(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
    action: RecordAction,
  ): Promise<RepairRecord> {
    const record = await manager
      .getRepository(RepairRecord)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
    assertVersion(record.version, version);
    assertRecordAction(actor, record, action);
    return record;
  }

  /**
   * Applies the optional draft fields of a PATCH/submit request (same rules as web `applyDraftFields`).
   * References must stay inside the record's building; assignees may not change once the record left DRAFT.
   */
  private async applyDraftFields(
    manager: EntityManager,
    assignment: AssignmentContext,
    record: RepairRecord,
    dto: UpdateRecordDraftDto,
  ): Promise<void> {
    const locationId = dto.locationId !== undefined ? dto.locationId : record.locationId;
    const confirmationUserId =
      dto.confirmationUserId !== undefined ? dto.confirmationUserId : record.confirmationUserId;
    const errors = new FieldErrors();
    await this.validateLocation(manager, errors, record.buildingId, locationId, record.locationId);
    this.validateManager(assignment, errors, record.managerUserId, record.buildingId, locationId);
    this.validateConfirmer(assignment, errors, confirmationUserId, record.buildingId, locationId);
    errors.when(
      Boolean(confirmationUserId) &&
        record.status !== DRAFT_STATUS &&
        (confirmationUserId ?? '') !== (record.confirmationUserId ?? ''),
      'confirmationUserId',
      'Hồ sơ đã gửi: dùng chức năng “Giao lại” để đổi người xử lý.',
    );
    const attachmentIds = await this.validateAttachments(manager, errors, record, dto.attachmentIds);
    errors.throwIfAny();

    if (attachmentIds) record.attachmentIds = attachmentIds;
    record.locationId = locationId;
    record.confirmationUserId = confirmationUserId;
    if (dto.title !== undefined) record.title = dto.title;
    if (dto.description !== undefined) record.description = dto.description;
    if (dto.priority !== undefined) record.priority = dto.priority;
    if (dto.noMaintenanceItem !== undefined) record.noMaintenanceItem = dto.noMaintenanceItem;
  }

  /** Mirrors web `assertSubmittable`; T3 only supports "no specific equipment" (maintenance items are Đợt 3). */
  private async assertSubmittable(manager: EntityManager, ctx: AssignmentContext, record: RepairRecord): Promise<void> {
    const errors = new FieldErrors();
    this.validateText(errors, 'title', 'Tên hồ sơ', record.title, TITLE_MIN, TITLE_MAX);
    this.validateText(errors, 'description', 'Mô tả hư hỏng', record.description, DESCRIPTION_MIN, DESCRIPTION_MAX);
    const location = record.locationId
      ? await manager.getRepository(Location).findOneBy({ id: record.locationId })
      : null;
    errors.when(
      !location || location.buildingId !== record.buildingId,
      'locationId',
      'Vị trí phải thuộc tòa nhà của hồ sơ.',
    );
    errors.when(
      !isActiveUserInRole(ctx, record.managerUserId, 'BQL', record.buildingId, record.locationId),
      'managerUserId',
      'BQL quản lý không còn hoạt động hoặc không đúng khu vực.',
    );
    errors.when(
      !isActiveUserInRole(ctx, record.confirmationUserId, 'TECH_CONFIRMER', record.buildingId, record.locationId),
      'confirmationUserId',
      'Người xác nhận đã ngừng hoạt động, sai khu vực hoặc không hợp lệ. Cần phân công lại.',
    );
    for (const [index, step] of this.approvalStepsOf(record).entries()) {
      const slot = APPROVAL_STEP_SLOT[step.key];
      const userId = slot ? record[slot] : (record.approvalAssigneeUserIds?.[step.key] ?? null);
      if (!isActiveUserForApprovalStep(ctx, userId, step, record.buildingId, record.locationId)) {
        errors.add(
          `approvalStepKeys.${index}`,
          `Người xử lý bước ${step.label} đã ngừng hoạt động hoặc không hợp lệ. Cần kiểm tra lại phân công.`,
        );
      }
    }
    errors.when(
      record.noMaintenanceItem !== true,
      'maintenanceItemId',
      'Chọn thiết bị/hạng mục, hoặc chọn “Không thuộc thiết bị cụ thể”.',
    );
    errors.when(
      Boolean(record.confirmationUserId) && record.confirmationUserId === record.managerUserId,
      'confirmationUserId',
      'Người xác nhận phải khác người quản lý.',
    );
    if (!(await this.hasSitePhoto(manager, record))) {
      errors.add('attachmentIds', 'Cần ít nhất 1 ảnh hiện trường.');
    }
    errors.throwIfAny();
  }

  /** Approval steps in the record's snapshot order (custom steps fall back to the built-in library). */
  private approvalStepsOf(record: RepairRecord): WorkflowApprovalStep[] {
    const available = record.workflowApprovalSteps?.length ? record.workflowApprovalSteps : APPROVAL_STEPS;
    return record.approvalStepKeys
      .map((key) => available.find((step) => step.key === key))
      .filter((step): step is WorkflowApprovalStep => Boolean(step));
  }

  private async hasSitePhoto(manager: EntityManager, record: RepairRecord): Promise<boolean> {
    if (record.attachmentIds.length === 0) return false;
    const rows = await manager.getRepository(Attachment).findBy({ id: In(record.attachmentIds) });
    return rows.some((row) => row.purpose === 'SITE_PHOTO' && row.mimeType.startsWith('image/'));
  }

  private validateText(
    errors: FieldErrors,
    field: string,
    label: string,
    value: string | null | undefined,
    min: number,
    max: number,
  ): void {
    const text = (value ?? '').trim();
    if (text.length < min) errors.add(field, `${label} cần tối thiểu ${min} ký tự.`);
    else if (text.length > max) errors.add(field, `${label} tối đa ${max} ký tự.`);
  }

  private async attachmentsOf(record: RepairRecord): Promise<AttachmentView[]> {
    if (record.attachmentIds.length === 0) return [];
    const rows = await this.dataSource.getRepository(Attachment).findBy({ id: In(record.attachmentIds) });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return record.attachmentIds
      .map((attachmentId) => byId.get(attachmentId))
      .filter((row): row is Attachment => Boolean(row))
      .map(toAttachmentView);
  }

  /** Each id must be a site photo of this very record; duplicates collapse (same as the demo). */
  private async validateAttachments(
    manager: EntityManager,
    errors: FieldErrors,
    record: RepairRecord,
    ids: string[] | undefined,
  ): Promise<string[] | undefined> {
    if (ids === undefined) return undefined;
    const unique = [...new Set(ids)];
    const rows = unique.length > 0 ? await manager.getRepository(Attachment).findBy({ id: In(unique) }) : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const foreign = unique.some((attachmentId) => {
      const row = byId.get(attachmentId);
      return !row || row.subjectType !== SUBJECT_TYPE.REPAIR_RECORD || row.subjectId !== record.id;
    });
    errors.when(foreign, 'attachmentIds', ATTACHMENT_DRAFT_MESSAGES.FOREIGN_FILE);
    const wrongPurpose = unique.some((attachmentId) => byId.get(attachmentId)?.purpose !== 'SITE_PHOTO');
    errors.when(!foreign && wrongPurpose, 'attachmentIds', ATTACHMENT_DRAFT_MESSAGES.WRONG_FILE_PURPOSE);
    return unique;
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
    managerUserId: string,
    buildingId: string,
    locationId: string | null,
  ): void {
    errors.when(
      Boolean(locationId) && !isActiveUserInRole(ctx, managerUserId, 'BQL', buildingId, locationId),
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
