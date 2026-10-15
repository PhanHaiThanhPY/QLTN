import type { MaintenanceChecklistEntry } from './maintenance-types';

/** A linked repair resolves one checklist issue for the purpose of maintenance confirmation. */
export const countIssueEntries = (entries: readonly Pick<MaintenanceChecklistEntry, 'result'>[]): number =>
  entries.filter((entry) => entry.result === 'ISSUE').length;

/** Every remaining issue must have a written handling direction before confirmation. */
export const needsIssueResolution = (
  entries: readonly Pick<MaintenanceChecklistEntry, 'result'>[],
  linkedRepairCount: number,
): boolean => countIssueEntries(entries) > linkedRepairCount;
