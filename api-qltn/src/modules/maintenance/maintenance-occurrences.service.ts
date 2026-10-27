import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { nextPeriodAfter } from '../../domain/maintenance-schedule';
import type { OccurrenceReasonDto, PlanVersionDto, RescheduleOccurrenceDto } from './dto/maintenance-plan.dto';
import { MaintenanceOccurrence } from './entities/maintenance-occurrence.entity';
import { MaintenanceScheduleVersion } from './entities/maintenance-schedule-version.entity';
import { MaintenanceGenerationService } from './maintenance-generation.service';
import { validateDateFrom, validateReason } from './maintenance-plan-rules';
import { toOccurrenceView, type OccurrenceView } from './maintenance-plan-views';
import { MaintenancePlansService } from './maintenance-plans.service';

const NOT_FOUND = 'Không tìm thấy lượt bảo trì.';
const ddmm = (date: string): string => `${date.slice(8)}/${date.slice(5, 7)}`;

/** Actions on a scheduled occurrence (SPEC MT-S2 BR-MT2-07), by the plan's manager; each audited with its reason. */
@Injectable()
export class MaintenanceOccurrencesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly plans: MaintenancePlansService,
    private readonly generation: MaintenanceGenerationService,
  ) {}

  /** New date ≥ today, different, and before the plan's next period (MD-09); the period date stays. */
  async reschedule(actor: AuthenticatedUser, id: string, dto: RescheduleOccurrenceDto): Promise<OccurrenceView> {
    return this.dataSource.transaction(async (manager) => {
      const occurrence = await this.loadScheduled(manager, actor, id, dto.version);
      const errors = new FieldErrors();
      validateDateFrom(errors, 'date', dto.date, vnDate(new Date()), 'Ngày mới không được trước hôm nay.');
      errors.when(dto.date === occurrence.scheduledDate, 'date', 'Ngày mới phải khác ngày hiện tại.');
      const versions = await manager.getRepository(MaintenanceScheduleVersion).findBy({ planId: occurrence.planId });
      const next = nextPeriodAfter(versions, occurrence.periodDate ?? occurrence.scheduledDate);
      errors.when(Boolean(next && dto.date >= next), 'date', `Phải trước ${next ? ddmm(next) : ''} (kỳ kế tiếp).`);
      validateReason(errors, 'reason', dto.reason);
      errors.throwIfAny();
      const from = occurrence.scheduledDate;
      occurrence.scheduledDate = dto.date;
      return this.save(manager, actor, occurrence, 'rescheduleOccurrence', {
        reason: `${ddmm(from)} → ${ddmm(dto.date)}: ${dto.reason}`,
      });
    });
  }

  /**
   * Cancel with a reason. A plain cancel keeps the period (the generator does not bring it back); cancelling a
   * "Lịch đã đổi" occurrence frees the period so the new schedule may use that day (BR-MT2-05).
   */
  async cancel(actor: AuthenticatedUser, id: string, dto: OccurrenceReasonDto): Promise<OccurrenceView> {
    return this.dataSource.transaction(async (manager) => {
      const occurrence = await this.loadScheduled(manager, actor, id, dto.version);
      const errors = new FieldErrors();
      validateReason(errors, 'reason', dto.reason);
      errors.throwIfAny();
      const changed = occurrence.scheduleChanged;
      Object.assign(occurrence, {
        status: 'CANCELLED',
        cancelReason: dto.reason,
        scheduleChanged: false,
        ...(changed ? { periodKey: null } : {}),
      });
      const view = await this.save(manager, actor, occurrence, 'cancelOccurrence', {
        fromStatus: 'SCHEDULED',
        toStatus: 'CANCELLED',
        reason: dto.reason,
      });
      if (changed) await this.generation.generateForPlan(manager, occurrence.planId, vnDate(new Date()));
      return view;
    });
  }

  /** "Giữ lượt này": only on a "Lịch đã đổi" occurrence; it keeps its date. */
  async keep(actor: AuthenticatedUser, id: string, dto: PlanVersionDto): Promise<OccurrenceView> {
    return this.dataSource.transaction(async (manager) => {
      const occurrence = await this.loadScheduled(manager, actor, id, dto.version);
      if (!occurrence.scheduleChanged)
        throw conflictWithReason('occurrence_not_flagged', 'Lượt này không bị đánh dấu "Lịch đã đổi".');
      occurrence.scheduleChanged = false;
      return this.save(manager, actor, occurrence, 'keepOccurrence');
    });
  }

  /** Locks the occurrence; its plan's write rules apply (scope 404, manager 403); only "Đã lên lịch" may change. */
  private async loadScheduled(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    version: number,
  ): Promise<MaintenanceOccurrence> {
    const occurrence = await manager
      .getRepository(MaintenanceOccurrence)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!occurrence || !actor.buildingIds.includes(occurrence.buildingId)) throw notFound(NOT_FOUND);
    await this.plans.lockForManager(manager, actor, occurrence.planId);
    assertVersion(occurrence.version, version);
    if (occurrence.status !== 'SCHEDULED')
      throw conflictWithReason('occurrence_not_scheduled', 'Chỉ thao tác được với lượt "Đã lên lịch".');
    return occurrence;
  }

  private async save(
    manager: EntityManager,
    actor: AuthenticatedUser,
    occurrence: MaintenanceOccurrence,
    action: string,
    extra: { fromStatus?: string; toStatus?: string; reason?: string } = {},
  ): Promise<OccurrenceView> {
    occurrence.version += 1;
    const saved = await manager.getRepository(MaintenanceOccurrence).save(occurrence);
    await this.plans.recordOccurrence(manager, actor, saved, action, extra);
    return toOccurrenceView(saved);
  }
}
