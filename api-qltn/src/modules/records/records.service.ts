import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope } from '../../common/auth/scope';
import { notFound } from '../../common/errors';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, toPaginated } from '../../common/utils/pagination';
import { FieldErrors } from '../../common/validation/field-errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import {
  APPROVAL_STEPS,
  approvalDefinitionsOf,
  intakeStepKeyOf,
  type WorkflowApprovalStep,
} from '../../domain/building-config';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { ATTACHMENT_DRAFT_MESSAGES } from '../attachments/attachments.service';
import { toAttachmentView, type AttachmentView } from '../attachments/attachment-view';
import { Attachment } from '../attachments/entities/attachment.entity';
import { BuildingConfig } from '../buildings/entities/building-config.entity';
import { Location } from '../buildings/entities/location.entity';
import type { ListRecordsQueryDto } from './dto/list-records-query.dto';
import type { RecordSummaryQueryDto } from './dto/record-summary-query.dto';
import type {
  ConfirmRecordDto,
  CreateRecordDto,
  SubmitRecordDto,
  UpdateRecordDraftDto,
  WithdrawRecordDto,
} from './dto/record.dto';
import { RepairConfirmation, type ConfirmationOutcome } from './entities/repair-confirmation.entity';
import { RepairRecord } from './entities/repair-record.entity';
import { toRecordView, type RepairRecordView } from './record-view';
import { ConstructionService, type ExecutionHistoryView } from './construction.service';
import { PaymentsService, type PaymentHistoryView } from './payments.service';
import { ProposalsService, type ProposalHistoryView } from './proposals.service';

export { toRecordView, type RepairRecordView } from './record-view';
import {
  type AssignmentContext,
  defaultWorkflowApprovers,
  firstActiveForApprovalStep,
  firstActiveInRole,
  isActiveUserForApprovalStep,
  isActiveUserInRole,
  loadAssignmentContext,
} from './record-assignment';
import { resolveItemChoice, recordItemSummary, validateItemOnSubmit, type RecordItemSummary } from './record-item-link';
import { loadRecordForAction, validateText } from './record-loader';
import { applyRecordScope, isOutOfScope, NO_BUILDING } from './record-scope-query';
import { RECORD_FINAL_STATUSES, RECORD_NEEDS_UPDATE_STATUSES } from './record-status-groups';

/** MT-S3 BR-MT3-08: where a record made from a failed maintenance item comes from. */
export interface RecordOrigin {
  sourceOccurrenceId: string;
  sourceChecklistItemId: string;
  /** Copies the item's photos onto the new record as SITE_PHOTO files; answers their ids in order. */
  sitePhotos: (manager: EntityManager, record: RepairRecord) => Promise<string[]>;
  auditReason: string;
}

const CODE_PREFIX = 'SC';
const CODE_WIDTH = 3;
const DRAFT_STATUS = 'DRAFT';
const PENDING_CONFIRMATION = 'PENDING_CONFIRMATION';
const CLOSED_WITHDRAWN = 'CLOSED_WITHDRAWN';
const PROPOSAL_FILE_PURPOSES = [
  'QUOTATION',
  'INCIDENT_MINUTES',
  'BOARD_MINUTES',
  'CONSTRUCTION',
  'ACCEPTANCE',
  'PAYMENT_REQUEST',
  'INVOICE',
  'PAYMENT_PROOF',
  'BOARD_DECISION',
] as const;

/** The three confirmer actions of S1 (SPEC B03–B09 T01–T03): outcome stored, target status, label of `note`. */
type ConfirmationAction = 'requestRecordUpdate' | 'confirmRepair' | 'closeNoRepair';
const CONFIRMATION_RULES: Record<
  ConfirmationAction,
  { outcome: ConfirmationOutcome; toStatus: string; noteLabel: string }
> = {
  requestRecordUpdate: { outcome: 'NEEDS_UPDATE', toStatus: 'NEEDS_RECORD_UPDATE', noteLabel: 'Lý do' },
  confirmRepair: { outcome: 'CONFIRMED', toStatus: 'PENDING_PROPOSAL', noteLabel: 'Kết luận hiện trạng' },
  closeNoRepair: { outcome: 'NO_REPAIR', toStatus: 'CLOSED_NO_REPAIR', noteLabel: 'Lý do' },
};

/** Same bounds as web `LIMITS` (title/description/reason) and the demo submit rules. */
const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;
const REASON_MIN = 5;
const REASON_MAX = 1000;

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

export interface RepairConfirmationView {
  id: string;
  recordId: string;
  actorId: string;
  outcome: ConfirmationOutcome;
  note: string;
  createdAt: Date;
}

export interface RecordDetailView {
  record: RepairRecordView;
  /** Confirmer conclusions, oldest first (S1). */
  confirmations: RepairConfirmationView[];
  /** Site photos (and later, other files) attached to the record, in the record's order. */
  attachments: AttachmentView[];
  /** Proposal draft and every submission with decisions and signatures (S2). */
  proposal: ProposalHistoryView;
  /** Proposal (S2) and construction/acceptance (S3) files of the record, oldest first. */
  proposalAttachments: AttachmentView[];
  /** Construction, acceptance rounds (minutes, decisions, signatures) and saved repair work (S3). */
  execution: ExecutionHistoryView;
  /** Payment instalments, approved amount and transferred total (S4). */
  payment: PaymentHistoryView;
  /**
   * The building's current emergency limit and document hours, shown in the E-T1 dialog (B06-S1 ui-brief §2.2): the
   * manager cannot read the building configuration itself (DF-11). A started emergency keeps its own snapshot.
   */
  emergencyPolicy: { limitVnd: string; docHours: number } | null;
  /** The record's equipment for the detail line and its link (MT-S1 BR-MT-10); null for "no specific equipment". */
  maintenanceItem: RecordItemSummary | null;
  audit: AuditEventView[];
}

/** Counters behind the card row on `/records` (one SQL query, same building scope as the list). */
export interface RecordSummaryView {
  /** Not in any final status. */
  open: number;
  /** Statuses in `RECORD_NEEDS_UPDATE_STATUSES`. */
  needsUpdate: number;
  completed: number;
  /** Every record in scope (denominator on the cards). */
  total: number;
  asOf: Date;
}

const toConfirmationView = (row: RepairConfirmation): RepairConfirmationView => ({
  id: row.id,
  recordId: row.recordId,
  actorId: row.actorId,
  outcome: row.outcome,
  note: row.note,
  createdAt: row.createdAt,
});

/**
 * Steps of the proposal chain and of every stage (INTAKE, PROPOSAL, ACCEPTANCE, PAYMENT), resolved against the library
 * kept on the building configuration: the record snapshots a definition and a holder for each (FX-S3 BR-FX3-01). A
 * step used in several stages appears once, so it keeps one holder.
 */
const workflowApprovalStepsOf = (config: BuildingConfig): WorkflowApprovalStep[] => {
  const definitions = approvalDefinitionsOf(config.workflowApprovalSteps);
  const keys = [...config.approvalStepKeys, ...config.workflowStages.flatMap((stage) => stage.approvalStepKeys)];
  return [...new Set(keys)]
    .map((key) => definitions.find((step) => step.key === key))
    .filter((step): step is WorkflowApprovalStep => Boolean(step))
    .map((step) => ({ ...step }));
};

/**
 * Confirmer step (BR-06): the INTAKE step of the stage snapshot, looked up in the given steps then the built-in
 * ones; KT for records created before RM-S2. A custom INTAKE step outside the proposal chain is only known at
 * creation, where the configuration library is passed in.
 */
const intakeStepOf = (
  stageKeys: Partial<Record<string, readonly string[]>> | undefined,
  steps: readonly WorkflowApprovalStep[] | undefined,
): WorkflowApprovalStep => {
  const key = intakeStepKeyOf(stageKeys);
  const library = steps?.length ? [...steps, ...APPROVAL_STEPS] : APPROVAL_STEPS;
  return library.find((step) => step.key === key) ?? APPROVAL_STEPS[0];
};

const BOARD_FALLBACK_REASON = 'Không có người xác nhận theo cấu hình, dùng BQT';

/**
 * BR-07: a confirmer is valid when eligible for the INTAKE step, or, when nobody is eligible for it, when active
 * as BQT in the record's area (the fallback picked at creation).
 */
const isValidConfirmer = (
  ctx: AssignmentContext,
  userId: string | null,
  intakeStep: WorkflowApprovalStep,
  buildingId: string,
  locationId: string | null,
): boolean => {
  if (isActiveUserForApprovalStep(ctx, userId, intakeStep, buildingId, locationId)) return true;
  const nobodyEligible = !firstActiveForApprovalStep(ctx, intakeStep, buildingId, locationId);
  return nobodyEligible && isActiveUserInRole(ctx, userId, 'OWNERS_BOARD', buildingId, locationId);
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
    private readonly proposals: ProposalsService,
    private readonly construction: ConstructionService,
    private readonly payments: PaymentsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateRecordDto): Promise<RepairRecordView> {
    assertBuildingInScope(actor, dto.buildingId);
    return this.dataSource.transaction(async (manager) => toRecordView(await this.createDraft(manager, actor, dto)));
  }

  /**
   * The one way a draft record is made, inside the caller's transaction: `POST /records`, and MT-S3 BR-MT3-08 (a
   * record from a failed maintenance item, which passes its `origin`: source item and site photos already copied).
   */
  async createDraft(
    manager: EntityManager,
    actor: AuthenticatedUser,
    dto: CreateRecordDto,
    origin?: RecordOrigin,
  ): Promise<RepairRecord> {
    {
      const config = await this.loadConfig(manager, dto.buildingId);
      const assignment = await loadAssignmentContext(manager, dto.buildingId);
      const errors = new FieldErrors();
      const itemChoice = await resolveItemChoice(
        manager,
        errors,
        dto.buildingId,
        { maintenanceItemId: null, noMaintenanceItem: false },
        dto,
      );
      // BR-MT-09: an item chosen without a location gives the record the item's location.
      const locationId = dto.locationId ?? itemChoice.itemLocationId;
      await this.validateLocation(manager, errors, dto.buildingId, locationId, null);
      this.validateManager(assignment, errors, actor.id, dto.buildingId, locationId);

      const steps = workflowApprovalStepsOf(config);
      const stageKeys = workflowStageApprovalStepKeysOf(config);
      const intakeStep = intakeStepOf(stageKeys, approvalDefinitionsOf(config.workflowApprovalSteps));
      // BR-07: the first eligible holder of the INTAKE step, else the BQT holder (audited), else nobody.
      const configured = firstActiveForApprovalStep(assignment, intakeStep, dto.buildingId, locationId);
      const boardFallback = configured
        ? undefined
        : firstActiveInRole(assignment, 'OWNERS_BOARD', dto.buildingId, locationId);
      const defaultConfirmer = configured ?? boardFallback ?? null;
      const confirmationUserId = dto.confirmationUserId === undefined ? defaultConfirmer : dto.confirmationUserId;
      this.validateConfirmer(assignment, errors, confirmationUserId, intakeStep, dto.buildingId, locationId);
      errors.throwIfAny();

      const repo = manager.getRepository(RepairRecord);
      const record = repo.create({
        code: await this.codes.next(manager, CODE_PREFIX, CODE_WIDTH),
        buildingId: dto.buildingId,
        locationId,
        noMaintenanceItem: itemChoice.noMaintenanceItem,
        maintenanceItemId: itemChoice.maintenanceItemId,
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
        workflowStageApprovalStepKeys: stageKeys,
        approvalAssigneeUserIds: defaultWorkflowApprovers(assignment, steps, dto.buildingId, locationId),
        taskDueDays: { ...config.taskDueDays },
        createdBy: actor.id,
        version: 1,
        sourceOccurrenceId: origin?.sourceOccurrenceId ?? null,
        sourceChecklistItemId: origin?.sourceChecklistItemId ?? null,
      });
      const saved = await repo.save(record);
      if (origin) {
        saved.attachmentIds = await origin.sitePhotos(manager, saved);
        await repo.save(saved);
      }
      const reason =
        boardFallback && confirmationUserId === boardFallback ? BOARD_FALLBACK_REASON : origin?.auditReason;
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action: origin ? 'createRepairFromMaintenance' : 'createRecord',
        actorId: actor.id,
        entityVersion: saved.version,
        toStatus: saved.status,
        ...(reason ? { reason } : {}),
      });
      return saved;
    }
  }

  /** Draft save: only editable fields, version-locked, same audit trail as the demo command. */
  async updateDraft(actor: AuthenticatedUser, id: string, dto: UpdateRecordDraftDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'saveRecordDraft');
      const assignment = await loadAssignmentContext(manager, record.buildingId);
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
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'submitRecord');
      const assignment = await loadAssignmentContext(manager, record.buildingId);
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
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'withdrawRecord');
      const reason = (dto.reason ?? '').trim();
      const errors = new FieldErrors();
      validateText(errors, 'reason', 'Lý do', reason, REASON_MIN, REASON_MAX);
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
   * Confirmer decision on a record waiting for confirmation (S1: T01 trả bổ sung, T02 xác nhận cần sửa,
   * T03 đóng không cần sửa). The conclusion row, the status change and the audit share one transaction.
   */
  async confirm(
    actor: AuthenticatedUser,
    id: string,
    action: ConfirmationAction,
    dto: ConfirmRecordDto,
  ): Promise<RepairRecordView> {
    const rule = CONFIRMATION_RULES[action];
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, action);
      const note = (dto.note ?? '').trim();
      const errors = new FieldErrors();
      validateText(errors, 'note', rule.noteLabel, note, REASON_MIN, REASON_MAX);
      errors.throwIfAny();
      await manager
        .getRepository(RepairConfirmation)
        .save({ recordId: record.id, actorId: actor.id, outcome: rule.outcome, note });
      const fromStatus = record.status;
      record.status = rule.toStatus;
      record.version += 1;
      const saved = await manager.getRepository(RepairRecord).save(record);
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: saved.id,
        buildingId: saved.buildingId,
        action,
        actorId: actor.id,
        entityVersion: saved.version,
        fromStatus,
        toStatus: saved.status,
        reason: note,
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
    if (isOutOfScope(actor, query.buildingId)) return toPaginated([], 0, window);

    const qb = applyRecordScope(this.dataSource.getRepository(RepairRecord).createQueryBuilder('r'), actor, query);
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.open) {
      qb.andWhere('r.status NOT IN (:...finalStatuses)', { finalStatuses: [...RECORD_FINAL_STATUSES] });
    }
    if (query.attention === 'needs_update') {
      qb.andWhere('r.status IN (:...needsStatuses)', { needsStatuses: [...RECORD_NEEDS_UPDATE_STATUSES] });
    }
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

  /**
   * Card counters for the record list, in one query with `COUNT(*) FILTER (WHERE …)`.
   * The scope is the caller's buildings (or the requested building inside it); a building outside the
   * scope answers zeros, matching the list's empty page. No per-status round trips.
   */
  async summary(actor: AuthenticatedUser, query: RecordSummaryQueryDto): Promise<RecordSummaryView> {
    if (query.buildingId && !actor.buildingIds.includes(query.buildingId)) {
      return { open: 0, needsUpdate: 0, completed: 0, total: 0, asOf: new Date() };
    }
    const qb = this.dataSource.getRepository(RepairRecord).createQueryBuilder('r');
    if (query.buildingId) qb.where('r.building_id = :buildingId', { buildingId: query.buildingId });
    else
      qb.where('r.building_id IN (:...scope)', {
        scope: actor.buildingIds.length > 0 ? actor.buildingIds : [NO_BUILDING],
      });
    qb.select('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE r.status NOT IN (:...finalStatuses))', 'open')
      .addSelect('COUNT(*) FILTER (WHERE r.status IN (:...needsStatuses))', 'needsUpdate')
      .addSelect('COUNT(*) FILTER (WHERE r.status = :completedStatus)', 'completed')
      .setParameters({
        finalStatuses: [...RECORD_FINAL_STATUSES],
        needsStatuses: [...RECORD_NEEDS_UPDATE_STATUSES],
        completedStatus: 'COMPLETED',
      });
    const row = await qb.getRawOne<Record<string, string>>();
    return {
      open: Number(row?.open ?? 0),
      needsUpdate: Number(row?.needsUpdate ?? 0),
      completed: Number(row?.completed ?? 0),
      total: Number(row?.total ?? 0),
      asOf: new Date(),
    };
  }

  /** Record + history for the detail screen; another building's record answers 404. */
  async getDetail(actor: AuthenticatedUser, id: string): Promise<RecordDetailView> {
    const record = await this.dataSource.getRepository(RepairRecord).findOneBy({ id });
    if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
    const [confirmations, attachments, proposal, proposalAttachments, execution, payment, audit, config] =
      await Promise.all([
        this.dataSource
          .getRepository(RepairConfirmation)
          .find({ where: { recordId: id }, order: { createdAt: 'ASC', id: 'ASC' } }),
        this.attachmentsOf(record),
        this.proposals.historyOf(record),
        this.dataSource.getRepository(Attachment).find({
          where: { subjectId: id, purpose: In([...PROPOSAL_FILE_PURPOSES]) },
          order: { createdAt: 'ASC', id: 'ASC' },
        }),
        this.construction.historyOf(record),
        this.payments.historyOf(record),
        this.audit.listForSubject(SUBJECT_TYPE.REPAIR_RECORD, id, { page: 1, limit: 100 }),
        this.dataSource.getRepository(BuildingConfig).findOneBy({ buildingId: record.buildingId }),
      ]);
    return {
      record: toRecordView(record),
      confirmations: confirmations.map(toConfirmationView),
      attachments,
      proposal,
      proposalAttachments: proposalAttachments.map(toAttachmentView),
      execution,
      payment,
      emergencyPolicy: config
        ? { limitVnd: String(config.emergencyLimitVnd), docHours: config.emergencyDocHours }
        : null,
      maintenanceItem: await recordItemSummary(this.dataSource.manager, record.maintenanceItemId),
      audit: audit.data,
    };
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
    const errors = new FieldErrors();
    const itemChoice = await resolveItemChoice(manager, errors, record.buildingId, record, dto);
    const requestedLocation = dto.locationId !== undefined ? dto.locationId : record.locationId;
    // BR-MT-09: an item chosen without a location gives the record the item's location.
    const locationId = requestedLocation ?? itemChoice.itemLocationId;
    const confirmationUserId =
      dto.confirmationUserId !== undefined ? dto.confirmationUserId : record.confirmationUserId;
    await this.validateLocation(manager, errors, record.buildingId, locationId, record.locationId);
    this.validateManager(assignment, errors, record.managerUserId, record.buildingId, locationId);
    const intakeStep = intakeStepOf(record.workflowStageApprovalStepKeys, record.workflowApprovalSteps);
    this.validateConfirmer(assignment, errors, confirmationUserId, intakeStep, record.buildingId, locationId);
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
    record.noMaintenanceItem = itemChoice.noMaintenanceItem;
    record.maintenanceItemId = itemChoice.maintenanceItemId;
  }

  /** T01 eligibility (title, description, location, active manager and confirmer); also checked by E-T1 from DRAFT. */
  async assertSubmittable(manager: EntityManager, ctx: AssignmentContext, record: RepairRecord): Promise<void> {
    const errors = new FieldErrors();
    validateText(errors, 'title', 'Tên hồ sơ', record.title, TITLE_MIN, TITLE_MAX);
    validateText(errors, 'description', 'Mô tả hư hỏng', record.description, DESCRIPTION_MIN, DESCRIPTION_MAX);
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
    const intakeStep = intakeStepOf(record.workflowStageApprovalStepKeys, record.workflowApprovalSteps);
    errors.when(
      !isValidConfirmer(ctx, record.confirmationUserId, intakeStep, record.buildingId, record.locationId),
      'confirmationUserId',
      'Người xác nhận đã ngừng hoạt động, sai khu vực hoặc không hợp lệ. Cần phân công lại.',
    );
    // BR-07a: only the INTAKE holder matters here; proposal-chain holders are checked when the proposal is submitted.
    await validateItemOnSubmit(manager, errors, record);
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

  private async hasSitePhoto(manager: EntityManager, record: RepairRecord): Promise<boolean> {
    if (record.attachmentIds.length === 0) return false;
    const rows = await manager.getRepository(Attachment).findBy({ id: In(record.attachmentIds) });
    return rows.some((row) => row.purpose === 'SITE_PHOTO' && row.mimeType.startsWith('image/'));
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
    intakeStep: WorkflowApprovalStep,
    buildingId: string,
    locationId: string | null,
  ): void {
    if (!userId) return;
    errors.when(
      !isValidConfirmer(ctx, userId, intakeStep, buildingId, locationId),
      'confirmationUserId',
      'Người được chọn phải đúng vai trò, cùng tòa, đúng khu vực và còn hoạt động.',
    );
  }
}
