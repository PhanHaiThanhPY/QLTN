import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { conflictWithReason } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import {
  canStartOn,
  effectiveResult,
  entryField,
  RESOLUTION_MIN,
  REWORK_REASON_MIN,
  reviewDueAt,
  submitProblems,
  unresolvedFailures,
  type WorkEntry,
} from '../../domain/maintenance-execution';
import { Attachment } from '../attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { BuildingConfig } from '../buildings/entities/building-config.entity';
import { notify } from '../notifications/notify';
import { RepairRecord } from '../records/entities/repair-record.entity';
import { loadAssignmentContext } from '../records/record-assignment';
import type { ConfirmDto, ReassignOccurrenceDto, ReworkDto, WorkDto } from './dto/maintenance-execution.dto';
import type { PlanVersionDto } from './dto/maintenance-plan.dto';
import { MaintenanceItem } from './entities/maintenance-item.entity';
import { MaintenanceOccurrence, type OccurrenceStatus } from './entities/maintenance-occurrence.entity';
import { MaintenanceSubmission } from './entities/maintenance-submission.entity';
import { isValidPerformer, isValidReviewer, validateReason } from './maintenance-plan-rules';
import { lockOccurrenceFor, type LockedOccurrence } from './occurrence-access';
import { normalizeEntries } from './occurrence-work';

export const RESULT_FILE_PURPOSE = 'MAINTENANCE_RESULT';
/** BR-MT3-06: building config default of "Kiểm tra kết quả bảo trì". */
const DEFAULT_REVIEW_DAYS = 2;
const WORKING: readonly OccurrenceStatus[] = ['IN_PROGRESS', 'REWORK'];
const OPEN: readonly OccurrenceStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'REWORK'];
/** A record withdrawn or closed as "no repair" no longer answers for its item (D-MT3-5). */
export const INACTIVE_RECORD_STATUSES = ['CLOSED_WITHDRAWN', 'CLOSED_NO_REPAIR'] as const;
const SUMMARY_MAX = 2000;
const CONTRACTOR_MAX = 200;
const WORKER_MAX = 120;

type AuditExtra = { fromStatus?: string; toStatus?: string; reason?: string };

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Running an occurrence (SPEC MT-S3 BR-MT3-01..07, BR-MT3-09, BR-MT3-10); every write audited and version-locked. */
@Injectable()
export class MaintenanceExecutionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  /** BR-MT3-02: from 3 days before the scheduled day; the occurrence keeps the plan's checklist and people from now. */
  async start(actor: AuthenticatedUser, id: string, dto: PlanVersionDto): Promise<MaintenanceOccurrence> {
    return this.dataSource.transaction(async (manager) => {
      const { occurrence } = await lockOccurrenceFor(manager, actor, id, dto.version, 'PERFORMER', ['SCHEDULED']);
      if (!canStartOn(occurrence.scheduledDate, vnDate(this.clock.now()))) {
        throw conflictWithReason(
          'occurrence_too_early',
          'Chưa đến lúc làm lượt này. Nhờ BQL đổi lịch nếu cần làm sớm.',
        );
      }
      occurrence.status = 'IN_PROGRESS';
      occurrence.startedAt = this.clock.now();
      occurrence.scheduleChanged = false;
      occurrence.work = {
        entries: occurrence.checklist.map((item) => ({
          itemId: item.id,
          result: null,
          value: null,
          note: null,
          attachmentIds: [],
        })),
        summary: null,
        actualWorker: null,
        attachmentIds: [],
      };
      await this.save(manager, actor, occurrence, 'startMaintenance', {
        fromStatus: 'SCHEDULED',
        toStatus: 'IN_PROGRESS',
      });
      return occurrence;
    });
  }

  /** BR-MT3-03: saved as often as needed while in progress or sent back. */
  async saveWork(actor: AuthenticatedUser, id: string, dto: WorkDto): Promise<MaintenanceOccurrence> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await lockOccurrenceFor(manager, actor, id, dto.version, 'PERFORMER', WORKING);
      await this.applyWork(manager, locked, dto);
      await this.save(manager, actor, locked.occurrence, 'saveMaintenanceProgress');
      return locked.occurrence;
    });
  }

  /**
   * BR-MT3-04, BR-MT3-05: checks every item, then stores an immutable submission; the reviewer's due time comes
   * from the building's configuration (MD-01).
   */
  async submit(actor: AuthenticatedUser, id: string, dto: WorkDto): Promise<MaintenanceOccurrence> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await lockOccurrenceFor(manager, actor, id, dto.version, 'PERFORMER', WORKING);
      const { occurrence } = locked;
      const images = await this.applyWork(manager, locked, dto);
      const problems = submitProblems(occurrence.checklist, occurrence.work.entries, occurrence.work, (fileId) =>
        images.has(fileId),
      );
      if (problems.length) {
        const errors = new FieldErrors();
        for (const problem of problems) errors.add(problem.field, problem.message);
        errors.throwIfAny();
      }
      const now = this.clock.now();
      const dueAt = reviewDueAt(now, await this.reviewDays(manager, occurrence.buildingId));
      const from = occurrence.status;
      occurrence.round += 1;
      await manager.getRepository(MaintenanceSubmission).insert({
        occurrenceId: occurrence.id,
        round: occurrence.round,
        entries: occurrence.work.entries,
        summary: occurrence.work.summary ?? '',
        contractorName: occurrence.contractorName,
        actualWorker: occurrence.work.actualWorker,
        attachmentIds: occurrence.work.attachmentIds,
        submittedBy: actor.id,
        submittedAt: now,
        reviewDueAt: dueAt,
      });
      Object.assign(occurrence, { status: 'PENDING_REVIEW', submittedAt: now, reviewDueAt: dueAt, rework: {} });
      await this.save(manager, actor, occurrence, 'submitMaintenance', {
        fromStatus: from,
        toStatus: 'PENDING_REVIEW',
        reason: `Lần gửi ${occurrence.round}`,
      });
      await this.tell(
        manager,
        actor,
        occurrence,
        [occurrence.reviewerUserId],
        'MAINTENANCE_SUBMITTED',
        `Chờ xác nhận ${occurrence.code}`,
        `Lần gửi ${occurrence.round} cần bạn xác nhận.`,
      );
      return occurrence;
    });
  }

  /** BR-MT3-06: at least one item sent back, each with its reason; the other items keep their results. */
  async requestRework(actor: AuthenticatedUser, id: string, dto: ReworkDto): Promise<MaintenanceOccurrence> {
    return this.dataSource.transaction(async (manager) => {
      const { occurrence } = await lockOccurrenceFor(manager, actor, id, dto.version, 'REVIEWER', ['PENDING_REVIEW']);
      const submission = await this.currentSubmission(manager, occurrence, dto.round);
      const errors = new FieldErrors();
      validateReason(errors, 'reason', dto.reason);
      const marks: Record<string, string> = {};
      for (const raw of dto.items.map(record)) {
        const item = occurrence.checklist.find((row) => row.id === raw.itemId);
        if (!item) {
          errors.add('items', 'Mục không thuộc danh mục kiểm của lượt.');
          continue;
        }
        const reason = text(raw.reason);
        errors.when(
          reason.length < REWORK_REASON_MIN,
          entryField(item.id),
          `${item.label}: lý do làm lại cần tối thiểu ${REWORK_REASON_MIN} ký tự.`,
        );
        marks[item.id] = reason;
      }
      errors.when(Object.keys(marks).length === 0, 'items', 'Đánh dấu ít nhất một mục "Cần làm lại".');
      errors.throwIfAny();
      Object.assign(submission, {
        decision: 'REWORK',
        decisionReason: dto.reason,
        reworkItems: marks,
        decidedBy: actor.id,
        decidedAt: this.clock.now(),
      });
      await manager.getRepository(MaintenanceSubmission).save(submission);
      Object.assign(occurrence, { status: 'REWORK', rework: marks, reviewDueAt: null });
      await this.save(manager, actor, occurrence, 'requestMaintenanceRework', {
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'REWORK',
        reason: dto.reason,
      });
      await this.tell(
        manager,
        actor,
        occurrence,
        [occurrence.performerUserId],
        'MAINTENANCE_REWORK',
        `Làm lại ${occurrence.code}`,
        dto.reason,
      );
      return occurrence;
    });
  }

  /**
   * BR-MT3-06, BR-MT3-09: every failed item of the submission needs its own active repair record or the reviewer's
   * resolution (≥ 10 characters); the reviewer may change the item's condition, kept in its history.
   */
  async confirm(actor: AuthenticatedUser, id: string, dto: ConfirmDto): Promise<MaintenanceOccurrence> {
    return this.dataSource.transaction(async (manager) => {
      const { occurrence, plan, item } = await lockOccurrenceFor(manager, actor, id, dto.version, 'REVIEWER', [
        'PENDING_REVIEW',
      ]);
      const submission = await this.currentSubmission(manager, occurrence, dto.round);
      const resolutions: Record<string, string> = {};
      for (const raw of (dto.resolutions ?? []).map(record)) {
        const itemId = text(raw.itemId);
        if (itemId && text(raw.text)) resolutions[itemId] = text(raw.text);
      }
      const failed = submission.entries.flatMap((entry) => {
        const rule = occurrence.checklist.find((row) => row.id === entry.itemId);
        return rule && effectiveResult(rule, entry) === 'FAIL' ? [rule] : [];
      });
      const withRecord = await this.itemsWithActiveRecord(manager, occurrence.id);
      const missing = unresolvedFailures(
        failed.map((row) => row.id),
        withRecord,
        resolutions,
      );
      const errors = new FieldErrors();
      for (const itemId of missing) {
        const label = failed.find((row) => row.id === itemId)?.label ?? itemId;
        errors.add(
          entryField(itemId),
          `${label}: mục lỗi cần hồ sơ sửa chữa tạo từ mục này, hoặc hướng xử lý tối thiểu ${RESOLUTION_MIN} ký tự.`,
        );
      }
      if (dto.condition) validateReason(errors, 'conditionNote', dto.conditionNote ?? '');
      errors.when(Boolean(dto.condition) && !item.active, 'condition', 'Thiết bị đã ngừng dùng; không đổi tình trạng.');
      errors.throwIfAny();
      const now = this.clock.now();
      const kept = Object.fromEntries(
        Object.entries(resolutions).filter(([itemId]) => failed.some((row) => row.id === itemId)),
      );
      Object.assign(submission, {
        decision: 'CONFIRMED',
        resolutions: kept,
        conditionAfter: dto.condition ?? null,
        conditionNote: dto.condition ? (dto.conditionNote ?? null) : null,
        decidedBy: actor.id,
        decidedAt: now,
      });
      await manager.getRepository(MaintenanceSubmission).save(submission);
      if (dto.condition && dto.condition !== item.condition)
        await this.changeCondition(manager, actor, item, dto.condition, dto.conditionNote ?? '', occurrence.code);
      Object.assign(occurrence, { status: 'COMPLETED', completedAt: now, reviewDueAt: null, rework: {} });
      await this.save(manager, actor, occurrence, 'confirmMaintenance', {
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'COMPLETED',
      });
      await this.tell(
        manager,
        actor,
        occurrence,
        [plan.managerUserId],
        'MAINTENANCE_COMPLETED',
        `Hoàn thành ${occurrence.code}`,
        'Người xác nhận đã xác nhận hoàn thành lượt bảo trì.',
      );
      return occurrence;
    });
  }

  /** BR-MT3-07: the plan's manager hands the performer or the reviewer to someone else valid; results stay. */
  async reassign(actor: AuthenticatedUser, id: string, dto: ReassignOccurrenceDto): Promise<MaintenanceOccurrence> {
    return this.dataSource.transaction(async (manager) => {
      const statuses: readonly OccurrenceStatus[] =
        dto.slot === 'PERFORMER' ? ['SCHEDULED', 'IN_PROGRESS', 'REWORK'] : OPEN;
      const { occurrence, item } = await lockOccurrenceFor(manager, actor, id, dto.version, 'MANAGER', statuses);
      const ctx = await loadAssignmentContext(manager, occurrence.buildingId);
      const errors = new FieldErrors();
      validateReason(errors, 'reason', dto.reason);
      const current = dto.slot === 'PERFORMER' ? occurrence.performerUserId : occurrence.reviewerUserId;
      errors.when(dto.userId === current, 'userId', 'Người mới phải khác người hiện tại.');
      if (dto.slot === 'PERFORMER') {
        errors.when(
          !isValidPerformer(ctx, dto.userId, item),
          'userId',
          'Người thực hiện phải là KT hoặc BQL đang hoạt động của vị trí thiết bị.',
        );
        errors.when(dto.userId === occurrence.reviewerUserId, 'userId', 'Người thực hiện phải khác người xác nhận.');
      } else {
        errors.when(
          !isValidReviewer(ctx, dto.userId, item),
          'userId',
          'Người xác nhận phải là KT đang hoạt động của vị trí thiết bị.',
        );
        errors.when(dto.userId === occurrence.performerUserId, 'userId', 'Người xác nhận phải khác người thực hiện.');
      }
      errors.throwIfAny();
      if (dto.slot === 'PERFORMER') occurrence.performerUserId = dto.userId;
      else occurrence.reviewerUserId = dto.userId;
      await this.save(
        manager,
        actor,
        occurrence,
        dto.slot === 'PERFORMER' ? 'reassignMaintenancePerformer' : 'reassignMaintenanceReviewer',
        {
          reason: `${current} → ${dto.userId}: ${dto.reason}`,
        },
      );
      const [kind, title] =
        dto.slot === 'PERFORMER'
          ? (['MAINTENANCE_ASSIGNED', `Lượt bảo trì ${occurrence.code} giao cho bạn`] as const)
          : (['MAINTENANCE_SUBMITTED', `Bạn xác nhận lượt ${occurrence.code}`] as const);
      await this.tell(manager, actor, occurrence, [dto.userId], kind, title, dto.reason);
      return occurrence;
    });
  }

  /** Items of the occurrence holding a repair record still in force (BR-MT3-08, BR-MT3-09). */
  async itemsWithActiveRecord(manager: EntityManager, occurrenceId: string): Promise<Set<string>> {
    const rows = await manager.getRepository(RepairRecord).find({
      where: { sourceOccurrenceId: occurrenceId, status: Not(In([...INACTIVE_RECORD_STATUSES])) },
      select: { sourceChecklistItemId: true },
    });
    return new Set(rows.flatMap((row) => (row.sourceChecklistItemId ? [row.sourceChecklistItemId] : [])));
  }

  /** In-app notice to everyone but the actor, opening the occurrence (BR-MT3-10). */
  tell(
    manager: EntityManager,
    actor: AuthenticatedUser | null,
    occurrence: MaintenanceOccurrence,
    recipients: readonly string[],
    kind: string,
    title: string,
    body: string,
  ): Promise<void> {
    return notify(manager, {
      recipientIds: recipients.filter((userId) => userId !== actor?.id),
      kind,
      title,
      body,
      subjectType: SUBJECT_TYPE.MAINTENANCE_OCCURRENCE,
      subjectId: occurrence.id,
      buildingId: occurrence.buildingId,
    });
  }

  async save(
    manager: EntityManager,
    actor: AuthenticatedUser,
    occurrence: MaintenanceOccurrence,
    action: string,
    extra: AuditExtra = {},
  ): Promise<void> {
    occurrence.version += 1;
    await manager.getRepository(MaintenanceOccurrence).save(occurrence);
    await this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.MAINTENANCE_OCCURRENCE,
      subjectId: occurrence.id,
      buildingId: occurrence.buildingId,
      action,
      actorId: actor.id,
      entityVersion: occurrence.version,
      ...extra,
    });
  }

  /** Applies a save to the occurrence; answers the ids of its result photos (images only, D-MT3-3). */
  private async applyWork(
    manager: EntityManager,
    { occurrence }: LockedOccurrence,
    dto: WorkDto,
  ): Promise<Set<string>> {
    const files = await manager.getRepository(Attachment).find({
      where: {
        subjectType: SUBJECT_TYPE.MAINTENANCE_OCCURRENCE,
        subjectId: occurrence.id,
        purpose: RESULT_FILE_PURPOSE,
      },
      select: { id: true, mimeType: true },
    });
    const own = new Set(files.map((file) => file.id));
    const errors = new FieldErrors();
    const entries: WorkEntry[] = normalizeEntries(
      errors,
      occurrence.checklist,
      occurrence.work.entries,
      dto.entries,
      own,
    );
    const general = dto.attachmentIds ?? occurrence.work.attachmentIds;
    errors.when(
      general.some((fileId) => !own.has(fileId)),
      'attachmentIds',
      'Ảnh không thuộc lượt này.',
    );
    errors.when((dto.summary ?? '').length > SUMMARY_MAX, 'summary', `Kết quả chung tối đa ${SUMMARY_MAX} ký tự.`);
    errors.when(
      (dto.contractorName ?? '').length > CONTRACTOR_MAX,
      'contractorName',
      `Nhà thầu tối đa ${CONTRACTOR_MAX} ký tự.`,
    );
    errors.when(
      (dto.actualWorker ?? '').length > WORKER_MAX,
      'actualWorker',
      `Người làm thực tế tối đa ${WORKER_MAX} ký tự.`,
    );
    errors.throwIfAny();
    occurrence.work = {
      entries,
      summary: dto.summary === undefined ? occurrence.work.summary : dto.summary,
      actualWorker: dto.actualWorker === undefined ? occurrence.work.actualWorker : dto.actualWorker,
      attachmentIds: [...new Set(general)],
    };
    if (dto.contractorName !== undefined) occurrence.contractorName = dto.contractorName;
    return new Set(files.filter((file) => file.mimeType.startsWith('image/')).map((file) => file.id));
  }

  /** The submission a decision answers: the latest, undecided one; anything else is stale (AC-MT3.6). */
  private async currentSubmission(
    manager: EntityManager,
    occurrence: MaintenanceOccurrence,
    round: number,
  ): Promise<MaintenanceSubmission> {
    const submission = await manager
      .getRepository(MaintenanceSubmission)
      .findOneBy({ occurrenceId: occurrence.id, round });
    if (!submission || round !== occurrence.round || submission.decision) {
      throw conflictWithReason(
        'stale_submission',
        'Lần gửi này đã cũ hoặc đã được quyết định. Tải lại để xem lần gửi mới.',
      );
    }
    return submission;
  }

  private async reviewDays(manager: EntityManager, buildingId: string): Promise<number> {
    const config = await manager.getRepository(BuildingConfig).findOneBy({ buildingId });
    return config?.taskDueDays?.REVIEW_MAINTENANCE ?? DEFAULT_REVIEW_DAYS;
  }

  /** BR-MT3-06 / MT-S1 BR-MT-04: the condition change joins the item's history (its audit trail). */
  private async changeCondition(
    manager: EntityManager,
    actor: AuthenticatedUser,
    item: MaintenanceItem,
    condition: 'GOOD' | 'NEEDS_ATTENTION',
    note: string,
    code: string,
  ): Promise<void> {
    const previous = item.condition;
    Object.assign(item, { condition, conditionNote: note, version: item.version + 1 });
    await manager.getRepository(MaintenanceItem).save(item);
    await this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.MAINTENANCE_ITEM,
      subjectId: item.id,
      buildingId: item.buildingId,
      action: 'confirmMaintenanceCondition',
      actorId: actor.id,
      entityVersion: item.version,
      fromStatus: previous,
      toStatus: condition,
      reason: `${code}: ${note}`,
    });
  }
}
