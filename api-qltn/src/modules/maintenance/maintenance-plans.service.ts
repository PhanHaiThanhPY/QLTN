import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThanOrEqual, Not } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { assertVersion, conflictWithReason, forbidden, notFound } from '../../common/errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { addDays, periodsBetween } from '../../domain/maintenance-schedule';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { isActiveUserInRole, loadAssignmentContext } from '../records/record-assignment';
import type {
  ChangePlanManagerDto,
  ChangeScheduleDto,
  CreateMaintenancePlanDto,
  ListMaintenancePlansQueryDto,
  MakeupOccurrenceDto,
  PlanReasonDto,
  PlanVersionDto,
  UpdateMaintenancePlanDto,
} from './dto/maintenance-plan.dto';
import { MaintenanceItem } from './entities/maintenance-item.entity';
import { MaintenanceOccurrence } from './entities/maintenance-occurrence.entity';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import { MaintenanceScheduleVersion } from './entities/maintenance-schedule-version.entity';
import { MaintenanceSkippedPeriod } from './entities/maintenance-skipped-period.entity';
import { MaintenanceGenerationService, OCCURRENCE_CODE_PREFIX } from './maintenance-generation.service';
import {
  isValidPerformer,
  isValidReviewer,
  validateDateFrom,
  validateItem,
  validatePlanFields,
  validateReason,
  validateSchedule,
} from './maintenance-plan-rules';
import {
  toOccurrenceView,
  toPlanView,
  toVersionView,
  type MaintenancePlanView,
  type OccurrenceView,
  type ScheduleVersionView,
} from './maintenance-plan-views';

const PLAN_CODE_PREFIX = 'KH';
const PLAN_CODE_WIDTH = 3;
const NOT_FOUND = 'Không tìm thấy kế hoạch.';
const AUDIT_LIMIT = 100;

export interface PlanListRow extends MaintenancePlanView {
  item: { id: string; code: string; name: string; locationId: string; active: boolean };
  /** Date of the nearest scheduled occurrence (active plans). */
  nextDate: string | null;
}

export interface PlanDetailView {
  plan: MaintenancePlanView;
  item: PlanListRow['item'];
  versions: ScheduleVersionView[];
  occurrences: OccurrenceView[];
  /** "Bỏ qua do tạm dừng" periods. */
  skipped: string[];
  audit: AuditEventView[];
}

const itemSummary = (item: MaintenanceItem): PlanListRow['item'] => ({
  id: item.id,
  code: item.code,
  name: item.name,
  locationId: item.locationId,
  active: item.active,
});

/** Maintenance plans of the caller's buildings (SPEC MT-S2). Every write is audited and version-locked. */
@Injectable()
export class MaintenancePlansService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly codes: CodeCounterService,
    private readonly generation: MaintenanceGenerationService,
  ) {}

  async list(actor: AuthenticatedUser, query: ListMaintenancePlansQueryDto): Promise<PlanListRow[]> {
    if (query.buildingId && !actor.buildingIds.includes(query.buildingId)) return [];
    const buildingIds = query.buildingId ? [query.buildingId] : actor.buildingIds;
    if (buildingIds.length === 0) return [];
    const plans = await this.dataSource.getRepository(MaintenancePlan).find({
      where: {
        buildingId: In(buildingIds),
        ...(query.itemId ? { itemId: query.itemId } : {}),
        ...(query.status ? { status: query.status } : query.includeEnded ? {} : { status: Not('ENDED') }),
      },
      order: { code: 'ASC' },
    });
    return this.rows(plans);
  }

  async getDetail(actor: AuthenticatedUser, id: string): Promise<PlanDetailView> {
    const plan = await this.dataSource.getRepository(MaintenancePlan).findOneBy({ id });
    if (!plan || !actor.buildingIds.includes(plan.buildingId)) throw notFound(NOT_FOUND);
    const [row] = await this.rows([plan]);
    const [versions, occurrences, skipped, audit] = await Promise.all([
      this.dataSource
        .getRepository(MaintenanceScheduleVersion)
        .find({ where: { planId: id }, order: { createdAt: 'ASC' } }),
      this.dataSource
        .getRepository(MaintenanceOccurrence)
        .find({ where: { planId: id }, order: { scheduledDate: 'DESC', code: 'DESC' } }),
      this.dataSource
        .getRepository(MaintenanceSkippedPeriod)
        .find({ where: { planId: id }, order: { periodDate: 'DESC' } }),
      this.audit.listForSubject(SUBJECT_TYPE.MAINTENANCE_PLAN, id, { page: 1, limit: AUDIT_LIMIT }),
    ]);
    const { item, ...view } = row;
    return {
      plan: view,
      item,
      versions: versions.map(toVersionView),
      occurrences: occurrences.map(toOccurrenceView),
      skipped: skipped.map((period) => period.periodDate),
      audit: audit.data,
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateMaintenancePlanDto): Promise<MaintenancePlanView> {
    this.assertManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const errors = new FieldErrors();
      const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: dto.itemId });
      if (!validateItem(errors, actor, item)) errors.throwIfAny();
      const scopedItem = item as MaintenanceItem;
      const ctx = await loadAssignmentContext(manager, scopedItem.buildingId);
      const fields = validatePlanFields(errors, ctx, scopedItem, dto);
      validateSchedule(errors, dto.unit, dto.every);
      validateDateFrom(
        errors,
        'startDate',
        dto.startDate,
        vnDate(new Date()),
        'Ngày bắt đầu không được trước hôm nay.',
      );
      errors.throwIfAny();
      const repo = manager.getRepository(MaintenancePlan);
      const plan = await repo.save(
        repo.create({
          ...fields,
          code: await this.codes.next(manager, PLAN_CODE_PREFIX, PLAN_CODE_WIDTH),
          itemId: scopedItem.id,
          buildingId: scopedItem.buildingId,
          status: 'DRAFT',
          managerUserId: actor.id,
          createdBy: actor.id,
          version: 1,
        }),
      );
      await this.saveVersion(manager, actor, plan.id, dto.unit, dto.every, dto.startDate, dto.startDate, null);
      await this.record(manager, actor, plan, 'createMaintenancePlan');
      return this.view(manager, plan);
    });
  }

  /** BR-MT2-04: a draft changes everything; active or paused keeps item and schedule; ended is read-only. */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateMaintenancePlanDto): Promise<MaintenancePlanView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status === 'ENDED') throw conflictWithReason('plan_ended', 'Kế hoạch đã kết thúc, không sửa được.');
      const isDraft = plan.status === 'DRAFT';
      const errors = new FieldErrors();
      const touchesSchedule =
        dto.itemId !== undefined || dto.unit !== undefined || dto.every !== undefined || dto.startDate !== undefined;
      if (!isDraft && touchesSchedule && (dto.itemId ?? plan.itemId) !== plan.itemId) {
        errors.add('itemId', 'Không đổi thiết bị sau khi kích hoạt.');
      }
      const item = await manager
        .getRepository(MaintenanceItem)
        .findOneBy({ id: isDraft && dto.itemId ? dto.itemId : plan.itemId });
      if (!validateItem(errors, actor, item)) errors.throwIfAny();
      const scopedItem = item as MaintenanceItem;
      const ctx = await loadAssignmentContext(manager, scopedItem.buildingId);
      const fields = validatePlanFields(errors, ctx, scopedItem, dto);
      const versions = await manager.getRepository(MaintenanceScheduleVersion).findBy({ planId: plan.id });
      const draftVersion = versions[0];
      if (isDraft && draftVersion) {
        const unit = dto.unit ?? draftVersion.unit;
        const every = dto.every ?? draftVersion.every;
        const startDate = dto.startDate ?? draftVersion.anchorDate;
        validateSchedule(errors, unit, every);
        validateDateFrom(errors, 'startDate', startDate, vnDate(new Date()), 'Ngày bắt đầu không được trước hôm nay.');
        errors.throwIfAny();
        Object.assign(draftVersion, { unit, every, effectiveFrom: startDate, anchorDate: startDate });
        await manager.getRepository(MaintenanceScheduleVersion).save(draftVersion);
        plan.itemId = scopedItem.id;
        plan.buildingId = scopedItem.buildingId;
      }
      errors.throwIfAny();
      Object.assign(plan, fields);
      await this.saveWithAudit(manager, actor, plan, 'updateMaintenancePlan');
      // BR-MT2-04 / D-MT2-4: people, checklist and contractor follow on the occurrences not started yet.
      await manager.getRepository(MaintenanceOccurrence).update(
        { planId: plan.id, status: 'SCHEDULED' },
        {
          performerUserId: plan.performerUserId,
          reviewerUserId: plan.reviewerUserId,
          contractorName: plan.contractorName,
          checklist: plan.checklist,
        },
      );
      return this.view(manager, plan);
    });
  }

  /** Draft → active: the item in use, people valid, the start not in the past (D-MT2-2); generates at once. */
  async activate(actor: AuthenticatedUser, id: string, dto: PlanVersionDto): Promise<MaintenancePlanView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status !== 'DRAFT') throw conflictWithReason('plan_not_draft', 'Chỉ kích hoạt được kế hoạch nháp.');
      const today = vnDate(new Date());
      const errors = new FieldErrors();
      const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: plan.itemId });
      if (!validateItem(errors, actor, item)) errors.throwIfAny();
      const ctx = await loadAssignmentContext(manager, plan.buildingId);
      errors.when(
        !isValidPerformer(ctx, plan.performerUserId, item as MaintenanceItem),
        'performerUserId',
        'Người thực hiện không còn hợp lệ.',
      );
      errors.when(
        !isValidReviewer(ctx, plan.reviewerUserId, item as MaintenanceItem),
        'reviewerUserId',
        'Người xác nhận không còn hợp lệ.',
      );
      const [version] = await manager.getRepository(MaintenanceScheduleVersion).findBy({ planId: plan.id });
      errors.when(
        !version || version.anchorDate < today,
        'startDate',
        'Ngày bắt đầu đã qua. Sửa ngày bắt đầu rồi kích hoạt lại.',
      );
      errors.throwIfAny();
      plan.status = 'ACTIVE';
      plan.activeSince = today;
      plan.statusReason = null;
      await this.saveWithAudit(manager, actor, plan, 'activateMaintenancePlan', {
        fromStatus: 'DRAFT',
        toStatus: 'ACTIVE',
      });
      await this.generation.generateForPlan(manager, plan.id, today);
      return this.view(manager, plan);
    });
  }

  /** Active → paused: every scheduled occurrence is cancelled and frees its period (MQ-04, MD-04). */
  async pause(actor: AuthenticatedUser, id: string, dto: PlanReasonDto): Promise<MaintenancePlanView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status !== 'ACTIVE')
        throw conflictWithReason('plan_not_active', 'Chỉ tạm dừng được kế hoạch đang chạy.');
      this.assertReason(dto.reason);
      await this.cancelScheduled(manager, actor, plan, `Tạm dừng kế hoạch: ${dto.reason}`);
      plan.status = 'PAUSED';
      plan.pausedOn = vnDate(new Date());
      plan.statusReason = dto.reason;
      await this.saveWithAudit(manager, actor, plan, 'pauseMaintenancePlan', {
        fromStatus: 'ACTIVE',
        toStatus: 'PAUSED',
        reason: dto.reason,
      });
      return this.view(manager, plan);
    });
  }

  /** Paused → active: periods of the pause are kept as "Bỏ qua do tạm dừng"; generation restarts from today. */
  async resume(actor: AuthenticatedUser, id: string, dto: PlanVersionDto): Promise<MaintenancePlanView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status !== 'PAUSED')
        throw conflictWithReason('plan_not_paused', 'Chỉ chạy lại được kế hoạch đang tạm dừng.');
      const today = vnDate(new Date());
      const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: plan.itemId });
      if (!item?.active) throw conflictWithReason('item_inactive', 'Thiết bị đã ngừng dùng.');
      const versions = await manager.getRepository(MaintenanceScheduleVersion).findBy({ planId: plan.id });
      const from = plan.pausedOn ?? today;
      const periods = from < today ? periodsBetween(versions, from, addDays(today, -1)) : [];
      const held = await manager.getRepository(MaintenanceOccurrence).find({
        where: {
          planId: plan.id,
          periodDate: In(periods.length ? periods : ['1900-01-01']),
          status: Not('CANCELLED'),
        },
      });
      const skipped = periods.filter((date) => !held.some((row) => row.periodDate === date));
      if (skipped.length) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(MaintenanceSkippedPeriod)
          .values(skipped.map((periodDate) => ({ planId: plan.id, periodDate })))
          .orIgnore()
          .execute();
      }
      plan.status = 'ACTIVE';
      plan.activeSince = today;
      plan.pausedOn = null;
      plan.statusReason = null;
      await this.saveWithAudit(manager, actor, plan, 'resumeMaintenancePlan', {
        fromStatus: 'PAUSED',
        toStatus: 'ACTIVE',
      });
      await this.generation.generateForPlan(manager, plan.id, today);
      return this.view(manager, plan);
    });
  }

  /** Any state but ended → ended (D-MT2-7): scheduled occurrences cancelled; started ones go on; never resumed. */
  async end(actor: AuthenticatedUser, id: string, dto: PlanReasonDto): Promise<MaintenancePlanView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status === 'ENDED') throw conflictWithReason('plan_ended', 'Kế hoạch đã kết thúc.');
      this.assertReason(dto.reason);
      await this.cancelScheduled(manager, actor, plan, `Kết thúc kế hoạch: ${dto.reason}`);
      const from = plan.status;
      plan.status = 'ENDED';
      plan.statusReason = dto.reason;
      await this.saveWithAudit(manager, actor, plan, 'endMaintenancePlan', {
        fromStatus: from,
        toStatus: 'ENDED',
        reason: dto.reason,
      });
      return this.view(manager, plan);
    });
  }

  /**
   * BR-MT2-05: the new schedule replaces every change effective from its date onwards; scheduled occurrences of
   * periods from that date are marked "Lịch đã đổi" for the manager to keep or cancel; new periods are generated.
   */
  async changeSchedule(actor: AuthenticatedUser, id: string, dto: ChangeScheduleDto): Promise<MaintenancePlanView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status !== 'ACTIVE' && plan.status !== 'PAUSED') {
        throw conflictWithReason('plan_not_running', 'Chỉ đổi chu kỳ được kế hoạch đang chạy hoặc tạm dừng.');
      }
      const today = vnDate(new Date());
      const errors = new FieldErrors();
      validateSchedule(errors, dto.unit, dto.every);
      validateDateFrom(errors, 'effectiveFrom', dto.effectiveFrom, today, 'Ngày hiệu lực không được trước hôm nay.');
      validateDateFrom(
        errors,
        'anchorDate',
        dto.anchorDate,
        dto.effectiveFrom,
        'Lượt đầu không được trước ngày hiệu lực.',
      );
      validateReason(errors, 'reason', dto.reason);
      errors.throwIfAny();
      const versionRepo = manager.getRepository(MaintenanceScheduleVersion);
      const created = await this.saveVersion(
        manager,
        actor,
        plan.id,
        dto.unit,
        dto.every,
        dto.effectiveFrom,
        dto.anchorDate,
        dto.reason,
      );
      await versionRepo
        .createQueryBuilder()
        .update()
        .set({ supersededBy: created.id, supersededAt: new Date() })
        .where('plan_id = :planId AND id <> :id AND superseded_by IS NULL AND effective_from >= :from', {
          planId: plan.id,
          id: created.id,
          from: dto.effectiveFrom,
        })
        .execute();
      await manager
        .getRepository(MaintenanceOccurrence)
        .update(
          { planId: plan.id, status: 'SCHEDULED', isMakeup: false, periodDate: MoreThanOrEqual(dto.effectiveFrom) },
          { scheduleChanged: true },
        );
      await this.saveWithAudit(manager, actor, plan, 'changeMaintenanceSchedule', { reason: dto.reason });
      if (plan.status === 'ACTIVE') await this.generation.generateForPlan(manager, plan.id, today);
      return this.view(manager, plan);
    });
  }

  /** BR-MT2-08: a make-up occurrence outside the periods, never while the item is out of use (MD-05). */
  async makeup(actor: AuthenticatedUser, id: string, dto: MakeupOccurrenceDto): Promise<OccurrenceView> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.loadForWrite(manager, actor, id, dto.version);
      if (plan.status !== 'ACTIVE' && plan.status !== 'PAUSED') {
        throw conflictWithReason('plan_not_running', 'Chỉ tạo lượt bù cho kế hoạch đang chạy hoặc tạm dừng.');
      }
      const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: plan.itemId });
      if (!item?.active) throw conflictWithReason('item_inactive', 'Thiết bị đã ngừng dùng, không tạo được lượt bù.');
      const errors = new FieldErrors();
      validateDateFrom(errors, 'date', dto.date, vnDate(new Date()), 'Ngày của lượt bù không được trước hôm nay.');
      validateReason(errors, 'reason', dto.reason);
      errors.throwIfAny();
      const repo = manager.getRepository(MaintenanceOccurrence);
      const occurrence = await repo.save(
        repo.create({
          code: await this.codes.next(manager, OCCURRENCE_CODE_PREFIX, 4),
          planId: plan.id,
          itemId: plan.itemId,
          buildingId: plan.buildingId,
          scheduledDate: dto.date,
          periodDate: null,
          periodKey: null,
          status: 'SCHEDULED',
          isMakeup: true,
          performerUserId: plan.performerUserId,
          reviewerUserId: plan.reviewerUserId,
          contractorName: plan.contractorName,
          checklist: plan.checklist,
        }),
      );
      await this.recordOccurrence(manager, actor, occurrence, 'createMakeupOccurrence', { reason: dto.reason });
      await this.saveWithAudit(manager, actor, plan, 'createMakeupOccurrence', {
        reason: `${occurrence.code}: ${dto.reason}`,
      });
      return toOccurrenceView(occurrence);
    });
  }

  /** BR-MT2-11: an ADMIN hands the plan to another active BQL of the item's area. */
  async changeManager(actor: AuthenticatedUser, id: string, dto: ChangePlanManagerDto): Promise<MaintenancePlanView> {
    if (actor.role !== 'ADMIN') throw forbidden('Chỉ quản trị đổi được người quản lý kế hoạch.');
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager
        .getRepository(MaintenancePlan)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!plan || !actor.buildingIds.includes(plan.buildingId)) throw notFound(NOT_FOUND);
      assertVersion(plan.version, dto.version);
      const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: plan.itemId });
      const ctx = await loadAssignmentContext(manager, plan.buildingId);
      const errors = new FieldErrors().when(
        !isActiveUserInRole(ctx, dto.managerUserId, 'BQL', plan.buildingId, item?.locationId ?? null),
        'managerUserId',
        'Người quản lý phải là BQL đang hoạt động của vị trí thiết bị.',
      );
      errors.throwIfAny();
      const previous = plan.managerUserId;
      plan.managerUserId = dto.managerUserId;
      await this.saveWithAudit(manager, actor, plan, 'changeMaintenancePlanManager', {
        reason: `${previous} → ${dto.managerUserId}`,
      });
      return this.view(manager, plan);
    });
  }

  /** Locks the plan: out of scope 404, no MAINTENANCE_MANAGE or not its manager 403, stale version 409. */
  async loadForWrite(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<MaintenancePlan> {
    const plan = await this.lockForManager(manager, actor, id);
    assertVersion(plan.version, version);
    return plan;
  }

  /** The plan's write rules without its version: occurrence actions carry the occurrence version instead. */
  async lockForManager(manager: EntityManager, actor: AuthenticatedUser, id: string): Promise<MaintenancePlan> {
    const plan = await manager
      .getRepository(MaintenancePlan)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!plan || !actor.buildingIds.includes(plan.buildingId)) throw notFound(NOT_FOUND);
    this.assertManage(actor);
    if (plan.managerUserId !== actor.id) throw forbidden('Chỉ người quản lý kế hoạch thực hiện được thao tác này.');
    return plan;
  }

  async saveWithAudit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    plan: MaintenancePlan,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<void> {
    plan.version += 1;
    await manager.getRepository(MaintenancePlan).save(plan);
    await this.record(manager, actor, plan, action, extra);
  }

  recordOccurrence(
    manager: EntityManager,
    actor: AuthenticatedUser,
    occurrence: MaintenanceOccurrence,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.MAINTENANCE_OCCURRENCE,
      subjectId: occurrence.id,
      buildingId: occurrence.buildingId,
      action,
      actorId: actor.id,
      entityVersion: occurrence.version,
      ...extra,
    });
  }

  private assertManage(actor: AuthenticatedUser): void {
    if (!hasCapability(actor, 'MAINTENANCE_MANAGE')) throw forbidden('Chỉ BQL được quản lý kế hoạch bảo trì.');
  }

  private assertReason(reason: string): void {
    const errors = new FieldErrors();
    validateReason(errors, 'reason', reason);
    errors.throwIfAny();
  }

  /** Cancels the plan's scheduled occurrences and frees their periods, one audit row each. */
  private async cancelScheduled(
    manager: EntityManager,
    actor: AuthenticatedUser,
    plan: MaintenancePlan,
    reason: string,
  ): Promise<void> {
    const repo = manager.getRepository(MaintenanceOccurrence);
    const rows = await repo.findBy({ planId: plan.id, status: 'SCHEDULED' });
    for (const row of rows) {
      Object.assign(row, {
        status: 'CANCELLED',
        cancelReason: reason,
        periodKey: null,
        scheduleChanged: false,
        version: row.version + 1,
      });
      await repo.save(row);
      await this.recordOccurrence(manager, actor, row, 'cancelOccurrence', {
        fromStatus: 'SCHEDULED',
        toStatus: 'CANCELLED',
        reason,
      });
    }
  }

  private saveVersion(
    manager: EntityManager,
    actor: AuthenticatedUser,
    planId: string,
    unit: 'WEEK' | 'MONTH',
    every: number,
    effectiveFrom: string,
    anchorDate: string,
    reason: string | null,
  ): Promise<MaintenanceScheduleVersion> {
    const repo = manager.getRepository(MaintenanceScheduleVersion);
    return repo.save(
      repo.create({
        planId,
        unit,
        every,
        effectiveFrom,
        anchorDate,
        reason,
        supersededBy: null,
        supersededAt: null,
        createdBy: actor.id,
      }),
    );
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    plan: MaintenancePlan,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.MAINTENANCE_PLAN,
      subjectId: plan.id,
      buildingId: plan.buildingId,
      action,
      actorId: actor.id,
      entityVersion: plan.version,
      ...extra,
    });
  }

  private async view(manager: EntityManager, plan: MaintenancePlan): Promise<MaintenancePlanView> {
    const versions = await manager.getRepository(MaintenanceScheduleVersion).findBy({ planId: plan.id });
    return toPlanView(plan, versions, vnDate(new Date()), false);
  }

  /** List rows with item, current schedule, next scheduled date and the "Cần giao lại" flag. */
  private async rows(plans: readonly MaintenancePlan[]): Promise<PlanListRow[]> {
    if (plans.length === 0) return [];
    const ids = plans.map((plan) => plan.id);
    const today = vnDate(new Date());
    const [items, versions, next, contexts] = await Promise.all([
      this.dataSource.getRepository(MaintenanceItem).findBy({ id: In([...new Set(plans.map((plan) => plan.itemId))]) }),
      this.dataSource.getRepository(MaintenanceScheduleVersion).findBy({ planId: In(ids) }),
      this.dataSource
        .getRepository(MaintenanceOccurrence)
        .createQueryBuilder('o')
        .select('o.plan_id', 'planId')
        .addSelect('MIN(o.scheduled_date)::text', 'nextDate')
        .where('o.plan_id IN (:...ids) AND o.status = :status AND o.scheduled_date >= :today', {
          ids,
          status: 'SCHEDULED',
          today,
        })
        .groupBy('o.plan_id')
        .getRawMany<{ planId: string; nextDate: string }>(),
      Promise.all(
        [...new Set(plans.map((plan) => plan.buildingId))].map(
          async (buildingId) => [buildingId, await loadAssignmentContext(this.dataSource.manager, buildingId)] as const,
        ),
      ),
    ]);
    const ctxOf = new Map(contexts);
    return plans.flatMap((plan) => {
      const item = items.find((row) => row.id === plan.itemId);
      if (!item) return [];
      const ctx = ctxOf.get(plan.buildingId);
      const needsReassignment =
        plan.status !== 'ENDED' &&
        Boolean(ctx) &&
        (!isValidPerformer(ctx!, plan.performerUserId, item) || !isValidReviewer(ctx!, plan.reviewerUserId, item));
      return [
        {
          ...toPlanView(
            plan,
            versions.filter((row) => row.planId === plan.id),
            today,
            needsReassignment,
          ),
          item: itemSummary(item),
          nextDate: plan.status === 'ACTIVE' ? (next.find((row) => row.planId === plan.id)?.nextDate ?? null) : null,
        },
      ];
    });
  }
}
