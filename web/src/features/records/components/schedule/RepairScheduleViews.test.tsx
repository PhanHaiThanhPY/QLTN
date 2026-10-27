// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Page } from '@/services/records-service';
import type { ScheduleEntry } from '@/services/schedule-service';
import { entry } from './__fixtures__/schedule-entries';
import { RepairScheduleMonthView } from './RepairScheduleMonthView';
import { RepairScheduleWeekView } from './RepairScheduleWeekView';
import { entryLabel } from './repair-schedule-ui';

const mockState = vi.hoisted(() => ({
  range: { data: undefined as unknown, isLoading: false, error: null as Error | null, refetch: vi.fn() },
}));

vi.mock('./useScheduleRange', () => ({ useScheduleRange: () => mockState.range }));

const WEEK_START = '2026-11-24';
const TODAY = '2026-11-25';

const pageOf = (items: ScheduleEntry[], total = items.length): Page<ScheduleEntry> => ({ items, total, page: 1, pageSize: 200 });
const load = (page: Page<ScheduleEntry>) => {
  mockState.range = { data: page, isLoading: false, error: null, refetch: vi.fn() };
};

const renderWeek = () =>
  render(
    <MemoryRouter>
      <RepairScheduleWeekView filters={{}} weekStart={WEEK_START} today={TODAY} onWeekChange={vi.fn()} />
    </MemoryRouter>,
  );

const renderMonth = () =>
  render(
    <MemoryRouter>
      <RepairScheduleMonthView filters={{}} month="2026-11" today={TODAY} onMonthChange={vi.fn()} />
    </MemoryRouter>,
  );

describe('RepairScheduleWeekView (B4-S1)', () => {
  // Started before the week (AC-B4.2), late and stretched to today (AC-B4.3), and four days long (AC-B4.6).
  const before = entry('SC-031', '2026-11-20', '2026-11-26');
  const late = entry('SC-034', '2026-11-20', TODAY, { isLate: true, plannedEndDate: '2026-11-22' });
  const fourDays = entry('SC-036', '2026-11-27', '2026-11-30');

  it('shows a multi-day entry on each day it occupies, reachable by Tab once', () => {
    load(pageOf([before, late, fourDays]));
    renderWeek();
    const grid = within(screen.getByTestId('week-grid'));

    expect(grid.getAllByText('SC-031')).toHaveLength(3);
    expect(grid.getAllByText('SC-036')).toHaveLength(4);
    const focusable = grid.getAllByRole('link').filter((link) => link.getAttribute('tabindex') !== '-1');
    expect(focusable.map((link) => link.getAttribute('aria-label'))).toEqual([entryLabel(before), entryLabel(late), entryLabel(fourDays)]);
  });

  it('counts distinct records, not cells, and flags only the late one (AC-B4.6, BR-B4-04)', () => {
    load(pageOf([before, late, fourDays]));
    renderWeek();

    expect(screen.getByText('3 hồ sơ trong tuần')).toBeTruthy();
    const grid = within(screen.getByTestId('week-grid'));
    expect(grid.getAllByText('Trễ thi công')).toHaveLength(1);
    expect(screen.queryByText('Quá hạn')).toBeNull();
    expect(grid.getAllByText('SC-034')[0].closest('a')?.getAttribute('aria-label')).toContain('trễ thi công');
  });

  it('marks today and lists empty days on the phone layout', () => {
    load(pageOf([fourDays]));
    renderWeek();

    expect(screen.getAllByText('Không có việc')).toHaveLength(3);
    expect(document.querySelectorAll('[aria-current="date"]').length).toBeGreaterThan(0);
  });

  it('draws the empty grid with a 0 count and the hint line', () => {
    load(pageOf([]));
    renderWeek();

    expect(screen.getByText('0 hồ sơ trong tuần')).toBeTruthy();
    expect(screen.getByText('Hồ sơ xuất hiện trên lịch khi bắt đầu thi công.')).toBeTruthy();
  });

  it('says when the page is cut instead of hiding records (BR-B4-06)', () => {
    load(pageOf([before, late], 250));
    renderWeek();

    expect(screen.getByText(/Đang hiện 2 trên 250 hồ sơ/)).toBeTruthy();
  });

  it('offers a retry when the schedule fails', () => {
    const refetch = vi.fn();
    mockState.range = { data: undefined, isLoading: false, error: new Error('503'), refetch };
    renderWeek();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('RepairScheduleMonthView (B4-S1)', () => {
  it('lists three records a day and opens the rest behind "+n"', () => {
    const busy = ['SC-041', 'SC-042', 'SC-043', 'SC-044', 'SC-045'].map((code) => entry(code, '2026-11-10', '2026-11-10'));
    load(pageOf([...busy, entry('SC-046', '2026-11-09', '2026-11-12')]));
    renderMonth();

    expect(screen.getByText('6 hồ sơ trong tháng')).toBeTruthy();
    const grid = within(screen.getByTestId('month-grid'));
    fireEvent.click(grid.getByRole('button', { name: 'Xem thêm 3 hồ sơ ngày 10/11' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getAllByRole('link')).toHaveLength(6);
    expect(dialog.getByRole('button', { name: 'Đóng' })).toBeTruthy();
  });

  it('shows a multi-day record on each of its days', () => {
    load(pageOf([entry('SC-046', '2026-11-09', '2026-11-12')]));
    renderMonth();

    expect(within(screen.getByTestId('month-grid')).getAllByText(/SC-046/)).toHaveLength(4);
  });
});
