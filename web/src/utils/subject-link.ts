import type { SubjectType } from '@/domain/constants';

/** Route of a subject's detail screen, optionally opening a business tab (?tab=). */
export const subjectPath = (subjectType: SubjectType, subjectId: string, tab?: string): string => {
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : '';
  if (subjectType === 'REPAIR_RECORD') return `/records/${subjectId}${query}`;
  if (subjectType === 'MAINTENANCE_OCCURRENCE') return `/maintenance/occurrences/${subjectId}${query}`;
  if (subjectType === 'MAINTENANCE_PLAN') return `/maintenance/plans/${subjectId}`;
  return `/maintenance/items/${subjectId}`;
};
