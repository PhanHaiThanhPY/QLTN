import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Clock } from '../../common/services/clock.service';
import { JobScheduler } from '../../common/services/job-scheduler.service';
import { DepositInvitationsService } from './deposit-invitations.service';

/** Checked every minute, so a 17:00 deadline closes by 17:01 at the latest (as F-S1). */
const CHECK_INTERVAL_MS = 60_000;

/** T-S1 BR-T1-04 / AC-T1.4: invitations stop taking offers at their deadline on the shared JobScheduler. */
@Injectable()
export class DepositDeadlinesService implements OnModuleInit {
  private readonly logger = new Logger(DepositDeadlinesService.name);

  constructor(
    private readonly scheduler: JobScheduler,
    private readonly invitations: DepositInvitationsService,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.scheduler.every('deposit-deadlines', CHECK_INTERVAL_MS, () => this.run());
  }

  /** One pass; tests call it directly with "now" pinned on the Clock. */
  async run(now: Date = this.clock.now()): Promise<string[]> {
    const closed = await this.invitations.closeDue(now);
    if (closed.length) this.logger.log(`Deposit invitations closed: ${closed.join(', ')}`);
    return closed;
  }
}
