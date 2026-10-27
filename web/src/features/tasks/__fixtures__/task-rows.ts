import type { MyTaskRow } from '@/services/my-tasks-service';

export const NOW = new Date('2026-11-12T01:00:00.000Z'); // 08:00 on 12/11 in Vietnam
export const TODAY = '2026-11-12';

export const taskRow = (code: string, overrides: Partial<MyTaskRow> = {}): MyTaskRow => ({
  id: `task-${code}`,
  label: 'Xác nhận hồ sơ',
  href: `/records/rec-${code}?tab=overview`,
  subjectType: 'REPAIR_RECORD',
  code,
  title: `Hồ sơ ${code}`,
  buildingId: 'bld-a',
  status: 'PENDING_CONFIRMATION',
  priority: 'NORMAL',
  isEmergency: false,
  isOverdue: false,
  startedAt: '2026-11-10T02:00:00.000Z',
  ...overrides,
});
