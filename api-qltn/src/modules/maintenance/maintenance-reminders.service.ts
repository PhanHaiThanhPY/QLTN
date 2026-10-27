import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThan, LessThanOrEqual } from 'typeorm';
import { Clock } from '../../common/services/clock.service';
import { JobScheduler } from '../../common/services/job-scheduler.service';
import { vnDate } from '../../common/utils/vn-date';
import { addDays } from '../../domain/maintenance-schedule';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { notify } from '../notifications/notify';
import { MaintenanceOccurrence } from './entities/maintenance-occurrence.entity';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import { MaintenanceReminder, type ReminderKind } from './entities/maintenance-reminder.entity';

const TO_DO = ['SCHEDULED', 'IN_PROGRESS', 'REWORK'];
/** Review deadlines are instants: checked every 10 minutes. */
const CHECK_INTERVAL_MS = 10 * 60_000;
/** Day reminders go out with the 00:15 run (BR-MT3-10), not before. */
const DAY_REMINDER_MINUTE_VN = 15;
const VN_OFFSET_MINUTES = 7 * 60;

export type ReminderRun = Record<ReminderKind, number>;

/**
 * SPEC MT-S3 BR-MT3-10, D-MT3-7: "đến hạn hôm nay", "quá hạn" and "quá hạn xác nhận", each kind once per
 * occurrence (a row in maintenance_reminders claims it), so repeated or parallel runs send nothing twice.
 */
@Injectable()
export class MaintenanceRemindersService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceRemindersService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scheduler: JobScheduler,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.scheduler.daily('maintenance-reminders-day', DAY_REMINDER_MINUTE_VN, () => this.run());
    this.scheduler.every('maintenance-reminders-review', CHECK_INTERVAL_MS, () => this.run());
  }

  /** One pass at `now` (tests pin it). Day reminders only from 00:15 Vietnam time. */
  async run(now: Date = this.clock.now()): Promise<ReminderRun> {
    const today = vnDate(now);
    const minuteVn = (now.getUTCHours() * 60 + now.getUTCMinutes() + VN_OFFSET_MINUTES) % (24 * 60);
    const dayRun = minuteVn >= DAY_REMINDER_MINUTE_VN;
    const repo = this.dataSource.getRepository(MaintenanceOccurrence);
    const sent: ReminderRun = { DUE_TODAY: 0, OVERDUE: 0, REVIEW_OVERDUE: 0 };
    if (dayRun) {
      const due = await repo.findBy({ status: In(TO_DO), scheduledDate: today });
      sent.DUE_TODAY = await this.send(due, 'DUE_TODAY', false, (row) => ({
        title: `Đến hạn hôm nay: ${row.code}`,
        body: 'Lượt bảo trì đến hạn hôm nay.',
      }));
      const late = await repo.findBy({ status: In(TO_DO), scheduledDate: LessThanOrEqual(addDays(today, -1)) });
      sent.OVERDUE = await this.send(late, 'OVERDUE', true, (row) => ({
        title: `Quá hạn: ${row.code}`,
        body: `Lượt bảo trì ngày ${row.scheduledDate.slice(8)}/${row.scheduledDate.slice(5, 7)} chưa xong.`,
      }));
    }
    const reviewLate = await repo.findBy({ status: 'PENDING_REVIEW', reviewDueAt: LessThan(now) });
    sent.REVIEW_OVERDUE = await this.send(reviewLate, 'REVIEW_OVERDUE', true, (row) => ({
      title: `Quá hạn xác nhận: ${row.code}`,
      body: 'Lượt bảo trì đã quá hạn xác nhận.',
    }));
    if (sent.DUE_TODAY || sent.OVERDUE || sent.REVIEW_OVERDUE)
      this.logger.log(`Maintenance reminders ${JSON.stringify(sent)}`);
    return sent;
  }

  /** Claims each reminder in its own transaction, then notifies; a claimed one is skipped (no repeat). */
  private async send(
    rows: readonly MaintenanceOccurrence[],
    kind: ReminderKind,
    toManager: boolean,
    text: (row: MaintenanceOccurrence) => { title: string; body: string },
  ): Promise<number> {
    let count = 0;
    for (const row of rows) {
      const claimed = await this.dataSource.transaction(async (manager) => {
        const inserted = await manager
          .createQueryBuilder()
          .insert()
          .into(MaintenanceReminder)
          .values({ occurrenceId: row.id, kind })
          .orIgnore()
          .returning(['occurrenceId'])
          .execute();
        if ((inserted.raw as unknown[]).length === 0) return false;
        const recipient = kind === 'REVIEW_OVERDUE' ? row.reviewerUserId : row.performerUserId;
        const managerId = toManager ? await this.planManager(manager, row.planId) : null;
        await notify(manager, {
          recipientIds: managerId ? [recipient, managerId] : [recipient],
          kind: `MAINTENANCE_${kind}`,
          ...text(row),
          subjectType: SUBJECT_TYPE.MAINTENANCE_OCCURRENCE,
          subjectId: row.id,
          buildingId: row.buildingId,
        });
        return true;
      });
      if (claimed) count += 1;
    }
    return count;
  }

  private async planManager(manager: EntityManager, planId: string): Promise<string | null> {
    return (await manager.getRepository(MaintenancePlan).findOneBy({ id: planId }))?.managerUserId ?? null;
  }
}
