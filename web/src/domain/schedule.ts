import { LIMITS } from './constants';
import type { IsoDate, MaintenancePlan, ScheduleVersion } from './types';
import { addDays, addMonthsClamped } from '@/utils/date';

export interface ScheduledSlot {
  date: IsoDate;
  revision: number;
}

/** Upper bound (inclusive) of dates a generation run may create at a given day. */
export const generationWindowEnd = (today: IsoDate): IsoDate => addDays(today, LIMITS.GENERATION_WINDOW_DAYS);

const sortedVersions = (versions: ScheduleVersion[]): ScheduleVersion[] =>
  [...versions].sort((a, b) => a.revision - b.revision);

/**
 * Lists schedule dates in (after, until] produced by all schedule versions.
 * Each version only contributes dates inside [effectiveFrom, nextVersion.effectiveFrom).
 * Period n is computed from the anchor, so short months never shift later periods.
 */
export const listScheduleSlots = (
  versions: ScheduleVersion[],
  after: IsoDate | undefined,
  until: IsoDate,
): ScheduledSlot[] => {
  const ordered = sortedVersions(versions);
  const slots: ScheduledSlot[] = [];
  ordered.forEach((version, index) => {
    const nextFrom = ordered[index + 1]?.effectiveFrom;
    for (let n = 0; ; n += 1) {
      const date = addMonthsClamped(version.anchorDate, n * version.intervalMonths);
      if (date > until) break;
      if (nextFrom && date >= nextFrom) break;
      if (date < version.effectiveFrom) continue;
      if (after && date <= after) continue;
      slots.push({ date, revision: version.revision });
    }
  });
  return slots.sort((a, b) => a.date.localeCompare(b.date));
};

/** First schedule date on or after `from`; computed value shown as "next due" (not a generation source). */
export const nextScheduleDate = (plan: MaintenancePlan, from: IsoDate): IsoDate | undefined => {
  const horizon = addMonthsClamped(from, 24);
  return listScheduleSlots(plan.scheduleVersions, addDays(from, -1), horizon)[0]?.date;
};

export const currentScheduleVersion = (plan: MaintenancePlan): ScheduleVersion => {
  const ordered = sortedVersions(plan.scheduleVersions);
  return ordered[ordered.length - 1];
};

export const scheduleKey = (planId: string, originalDate: IsoDate): string => `${planId}|${originalDate}`;
