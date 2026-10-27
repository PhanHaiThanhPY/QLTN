import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';

/** Vietnam is UTC+7 all year (no daylight saving). */
const VN_OFFSET_MINUTES = 7 * 60;
const DAY_MINUTES = 24 * 60;

type JobRun = () => Promise<unknown>;

interface Job {
  name: string;
  run: JobRun;
  /** Milliseconds until the next run, from `now`. */
  delay: (now: Date) => number;
}

/** Milliseconds from `now` to the next `minuteOfDay` (minutes after midnight) in Vietnam; never 0. */
export const msUntilVnMinute = (now: Date, minuteOfDay: number): number => {
  const target = (minuteOfDay - VN_OFFSET_MINUTES + DAY_MINUTES) % DAY_MINUTES;
  const minuteNow = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startOfMinute = now.getTime() - (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds());
  const minutes = (target - minuteNow + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES;
  return startOfMinute + minutes * 60_000 - now.getTime();
};

/**
 * The one place where server jobs run on their own (MT-S2 daily generation, F-S1 deadlines). Modules register their
 * jobs while initialising; at boot every job runs once (catch-up for time the server was down), then on its timer.
 * Off under tests and with SCHEDULER=off: tests call the job functions directly.
 */
@Injectable()
export class JobScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobScheduler.name);
  private readonly jobs: Job[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private stopped = false;

  /** Daily at `minuteOfDay` (minutes after midnight, Vietnam time). */
  daily(name: string, minuteOfDay: number, run: JobRun): void {
    this.jobs.push({ name, run, delay: (now) => msUntilVnMinute(now, minuteOfDay) });
  }

  /** Every `intervalMs` milliseconds. */
  every(name: string, intervalMs: number, run: JobRun): void {
    this.jobs.push({ name, run, delay: () => intervalMs });
  }

  get enabled(): boolean {
    return process.env.NODE_ENV !== 'test' && process.env.SCHEDULER !== 'off';
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    for (const job of this.jobs) {
      void this.runOnce(job).finally(() => this.arm(job));
    }
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
  }

  private arm(job: Job): void {
    if (this.stopped) return;
    const timer = setTimeout(() => {
      void this.runOnce(job).finally(() => this.arm(job));
    }, job.delay(new Date()));
    timer.unref();
    this.timers.set(job.name, timer);
  }

  /** A failed run is logged and the job stays scheduled. */
  private async runOnce(job: Job): Promise<void> {
    try {
      await job.run();
    } catch (error) {
      this.logger.error(`Job ${job.name} failed: ${(error as Error).message}`);
    }
  }
}
