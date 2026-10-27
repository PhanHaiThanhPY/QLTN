import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { vnDate } from '../../common/utils/vn-date';
import { addDays, LOOKAHEAD_DAYS, periodsBetween } from '../../domain/maintenance-schedule';
import { MaintenanceItem } from './entities/maintenance-item.entity';
import { MaintenanceOccurrence } from './entities/maintenance-occurrence.entity';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import { MaintenanceScheduleVersion } from './entities/maintenance-schedule-version.entity';

export const OCCURRENCE_CODE_PREFIX = 'BT';
const OCCURRENCE_CODE_WIDTH = 4;
/** BR-MT2-06 / D-MT2-6: the daily run at 00:15 Vietnam time (UTC+7, no daylight saving). */
const RUN_MINUTE_UTC = (24 * 60 + 15 - 7 * 60) % (24 * 60);

export interface GenerationResult {
  created: number;
  failedPlans: string[];
}

/** Milliseconds from `now` to the next 00:15 in Vietnam. */
export const msUntilNextRun = (now: Date): number => {
  const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startOfMinute = now.getTime() - (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds());
  const minutes = (RUN_MINUTE_UTC - minuteOfDay + 24 * 60) % (24 * 60) || 24 * 60;
  return startOfMinute + minutes * 60_000 - now.getTime();
};

/**
 * Occurrence generation on the server (SPEC MT-S2 BR-MT2-06): every active plan gets its periods up to today + 30
 * days, at most one occurrence per period thanks to the partial unique index (repeated or parallel runs add nothing).
 * Each plan runs in its own transaction, so one broken plan never stops the others.
 */
@Injectable()
export class MaintenanceGenerationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MaintenanceGenerationService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly codes: CodeCounterService,
  ) {}

  /** The boot run and the daily timer are off under tests and when MAINTENANCE_SCHEDULER=off; runDaily stays callable. */
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test' || process.env.MAINTENANCE_SCHEDULER === 'off') return;
    // Catch-up at boot: periods missed while the server was down, and plans just seeded, need no wait until 00:15.
    this.runDaily().catch((error: unknown) =>
      this.logger.error(`Boot maintenance generation failed: ${(error as Error).message}`),
    );
    this.schedule();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.runDaily()
        .catch((error: unknown) =>
          this.logger.error(`Daily maintenance generation failed: ${(error as Error).message}`),
        )
        .finally(() => this.schedule());
    }, msUntilNextRun(new Date()));
    this.timer.unref();
  }

  /** The daily run (AC-MT2.8): every active plan, today in Vietnam unless given. */
  async runDaily(today = vnDate(new Date())): Promise<GenerationResult> {
    const plans = await this.dataSource
      .getRepository(MaintenancePlan)
      .find({ where: { status: 'ACTIVE' }, select: ['id', 'code'] });
    let created = 0;
    const failedPlans: string[] = [];
    for (const plan of plans) {
      try {
        created += await this.dataSource.transaction((manager) => this.generateForPlan(manager, plan.id, today));
      } catch (error) {
        failedPlans.push(plan.code);
        this.logger.warn(`Maintenance plan ${plan.code} not generated: ${(error as Error).message}`);
      }
    }
    this.logger.log(`Maintenance generation ${today}: +${created} occurrences, ${failedPlans.length} plan(s) failed`);
    return { created, failedPlans };
  }

  /**
   * Periods of one active plan from max(today, active since) to today + 30 days that have no occurrence yet, each
   * inserted with the plan's checklist, people and contractor (snapshot). Inside the caller's transaction.
   */
  async generateForPlan(manager: EntityManager, planId: string, today: string): Promise<number> {
    const plan = await manager.getRepository(MaintenancePlan).findOneBy({ id: planId });
    if (!plan || plan.status !== 'ACTIVE') return 0;
    const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: plan.itemId });
    if (!item || item.buildingId !== plan.buildingId) throw new Error('thiết bị không còn thuộc tòa của kế hoạch');
    const versions = await manager.getRepository(MaintenanceScheduleVersion).findBy({ planId });
    const from = plan.activeSince && plan.activeSince > today ? plan.activeSince : today;
    const dates = periodsBetween(versions, from, addDays(today, LOOKAHEAD_DAYS));
    if (dates.length === 0) return 0;
    const taken = await manager
      .getRepository(MaintenanceOccurrence)
      .createQueryBuilder('o')
      .select('o.period_key', 'periodKey')
      .where('o.plan_id = :planId AND o.period_key IN (:...dates)', { planId, dates })
      .getRawMany<{ periodKey: string }>();
    const takenKeys = new Set(taken.map((row) => vnDateOf(row.periodKey)));
    let created = 0;
    for (const date of dates.filter((day) => !takenKeys.has(day))) {
      const code = await this.codes.next(manager, OCCURRENCE_CODE_PREFIX, OCCURRENCE_CODE_WIDTH);
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(MaintenanceOccurrence)
        .values({
          code,
          planId,
          itemId: plan.itemId,
          buildingId: plan.buildingId,
          scheduledDate: date,
          periodDate: date,
          periodKey: date,
          status: 'SCHEDULED',
          performerUserId: plan.performerUserId,
          reviewerUserId: plan.reviewerUserId,
          contractorName: plan.contractorName,
          checklist: plan.checklist,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      created += inserted.identifiers.filter(Boolean).length;
    }
    return created;
  }
}

/** A `date` column read raw may come back as a Date or a string; both end up `YYYY-MM-DD`. */
const vnDateOf = (value: unknown): string =>
  value instanceof Date
    ? new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
    : String(value).slice(0, 10);
