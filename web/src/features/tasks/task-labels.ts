import type { SubjectType } from '@/domain/constants';
import type { TaskCompletionReason } from '@/domain/types';

export const COMPLETION_REASON_LABEL: Record<TaskCompletionReason, string> = {
  COMPLETED: 'Đã hoàn thành',
  REASSIGNED: 'Đã giao lại người khác',
  CANCELLED: 'Đã hủy',
  CLOSED: 'Hồ sơ/lượt đã đóng',
} as const;

/** Task list filter: repair vs. every maintenance subject type. */
export type TaskTypeFilter = 'ALL' | 'REPAIR' | 'MAINTENANCE';

export const TASK_TYPE_FILTER_LABEL: Record<TaskTypeFilter, string> = {
  ALL: 'Tất cả loại',
  REPAIR: 'Sửa chữa',
  MAINTENANCE: 'Bảo trì',
} as const;

export const matchesTypeFilter = (subjectType: SubjectType, filter: TaskTypeFilter): boolean => {
  if (filter === 'ALL') return true;
  if (filter === 'REPAIR') return subjectType === 'REPAIR_RECORD';
  return subjectType !== 'REPAIR_RECORD';
};

/** Short type label shown on mixed lists ("Sửa chữa"/"Bảo trì"). */
export const subjectKindLabel = (subjectType: SubjectType): string => (subjectType === 'REPAIR_RECORD' ? 'Sửa chữa' : 'Bảo trì');
