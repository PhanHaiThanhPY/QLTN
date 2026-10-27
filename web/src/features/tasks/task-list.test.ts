import { NOW, TODAY, taskRow } from './__fixtures__/task-rows';
import { NO_FILTERS, compareTasks, countTasks, dueText, matchesFilters, overdueText, taskAriaLabel, todayText } from './task-list';

describe('my tasks list helpers (TK-S1)', () => {
  it('finds without marks or case, by code, title or task name (AC-TK.12, TD-03)', () => {
    const pump = taskRow('SC-031', { title: 'Sửa máy bơm tăng áp' });
    expect(matchesFilters(pump, { ...NO_FILTERS, search: 'bom' }, TODAY)).toBe(true);
    expect(matchesFilters(pump, { ...NO_FILTERS, search: 'sc-031' }, TODAY)).toBe(true);
    expect(matchesFilters(pump, { ...NO_FILTERS, search: 'xac nhan' }, TODAY)).toBe(true);
    expect(matchesFilters(pump, { ...NO_FILTERS, search: 'thang máy' }, TODAY)).toBe(false);
  });

  it('counts "Đến hạn hôm nay" only for today and not yet overdue (AC-TK.6, TD-02)', () => {
    const today = taskRow('A', { dueAt: '2026-11-12T02:00:00.000Z' });
    const late = taskRow('B', { dueAt: '2026-11-12T00:30:00.000Z', isOverdue: true });
    const tomorrow = taskRow('C', { dueAt: '2026-11-13T02:00:00.000Z' });
    expect(countTasks([today, late, tomorrow], 4, TODAY)).toEqual({ open: 3, overdue: 1, dueToday: 1, done: 4 });
    expect(matchesFilters(today, { ...NO_FILTERS, due: 'TODAY' }, TODAY)).toBe(true);
    expect(matchesFilters(late, { ...NO_FILTERS, due: 'TODAY' }, TODAY)).toBe(false);
    expect(matchesFilters(taskRow('D'), { ...NO_FILTERS, due: 'NO_DUE' }, TODAY)).toBe(true);
  });

  it('orders overdue, urgent, dated then undated (AC-TK.11)', () => {
    const rows = [
      taskRow('NO-DUE'),
      taskRow('TOMORROW', { dueAt: '2026-11-13T02:00:00.000Z' }),
      taskRow('URGENT', { dueAt: '2026-11-15T02:00:00.000Z', priority: 'URGENT' }),
      taskRow('OVERDUE', { dueAt: '2026-11-11T02:00:00.000Z', isOverdue: true }),
    ];
    expect(rows.sort(compareTasks).map((row) => row.code)).toEqual(['OVERDUE', 'URGENT', 'TOMORROW', 'NO-DUE']);
  });

  it('prints deadlines in Vietnam time and lateness in days or hours', () => {
    expect(dueText('2026-11-12T02:00:00.000Z')).toBe('12/11 · 09:00');
    expect(todayText('2026-11-12T09:00:00.000Z')).toBe('Hôm nay 16:00');
    expect(overdueText('2026-11-10T00:00:00.000Z', NOW)).toBe('Quá hạn 2 ngày');
    expect(overdueText('2026-11-11T22:00:00.000Z', NOW)).toBe('Quá hạn 3 giờ');
  });

  it('names a row for screen readers (ui-brief §4)', () => {
    const row = taskRow('SC-031', { dueAt: '2026-11-10T00:00:00.000Z', isOverdue: true, priority: 'HIGH' });
    expect(taskAriaLabel(row, NOW, TODAY)).toBe('Xác nhận hồ sơ SC-031, quá hạn 2 ngày, ưu tiên cao');
  });
});
