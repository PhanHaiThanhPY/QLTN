/**
 * Period math of maintenance plans, the same as api-qltn `src/domain/maintenance-schedule.ts` (SPEC MT-S2
 * BR-MT2-05..07): the screens preview first dates and the latest reschedule day with it; the server stays the judge.
 */
export type ScheduleUnit = 'WEEK' | 'MONTH';

export interface ScheduleVersionLike {
  id: string;
  unit: ScheduleUnit;
  every: number;
  effectiveFrom: string;
  anchorDate: string;
  supersededBy: string | null;
}

/** BR-MT2-06: look-ahead of the generator. */
export const LOOKAHEAD_DAYS = 30;

const parse = (date: string): [number, number, number] => date.split('-').map(Number) as [number, number, number];
const format = (at: Date): string => at.toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => {
  const [year, month, day] = parse(date);
  return format(new Date(Date.UTC(year, month - 1, day + days)));
};

/** Months from the anchor, the day clamped to the month's last day (31/01 + 1 month = 28/02 or 29/02). */
export const addMonthsClamped = (date: string, months: number): string => {
  const [year, month, day] = parse(date);
  const last = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, month - 1 + months, Math.min(day, last))));
};

/** Period n of a schedule: always from the anchor, so a clamped month never drifts the next ones. */
export const periodDate = (version: Pick<ScheduleVersionLike, 'unit' | 'every' | 'anchorDate'>, n: number): string =>
  version.unit === 'WEEK'
    ? addDays(version.anchorDate, n * 7 * version.every)
    : addMonthsClamped(version.anchorDate, n * version.every);

/** The versions still in force, ordered by effective date. */
export const liveVersions = <T extends ScheduleVersionLike>(versions: readonly T[]): T[] =>
  versions.filter((version) => !version.supersededBy).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

/** BR-MT2-05: the schedule of a day is the live version with the latest effective date on or before it. */
export const versionOn = <T extends ScheduleVersionLike>(versions: readonly T[], date: string): T | undefined =>
  liveVersions(versions)
    .filter((version) => version.effectiveFrom <= date)
    .at(-1);

/**
 * Period dates in [from, to] (both inclusive). Each live version covers its effective date up to the next version's,
 * so two schedules never produce a period for the same stretch of days (MD-02).
 */
export const periodsBetween = (versions: readonly ScheduleVersionLike[], from: string, to: string): string[] => {
  const live = liveVersions(versions);
  const dates: string[] = [];
  live.forEach((version, index) => {
    const end = live[index + 1]?.effectiveFrom;
    for (let n = 0; ; n += 1) {
      const date = periodDate(version, n);
      if (date > to || (end && date >= end)) break;
      if (date >= from && date >= version.effectiveFrom) dates.push(date);
    }
  });
  return [...new Set(dates)].sort();
};

/** First period strictly after `date` (the next period limits a reschedule, BR-MT2-07); none within ten years. */
export const nextPeriodAfter = (versions: readonly ScheduleVersionLike[], date: string): string | undefined =>
  periodsBetween(versions, addDays(date, 1), addDays(date, 3660))[0];

/** "Mỗi 2 tuần", "Mỗi tháng", "Mỗi 3 tháng". */
export const scheduleLabel = (version: Pick<ScheduleVersionLike, 'unit' | 'every'>): string => {
  const unit = version.unit === 'WEEK' ? 'tuần' : 'tháng';
  return version.every === 1 ? `Mỗi ${unit}` : `Mỗi ${version.every} ${unit}`;
};
