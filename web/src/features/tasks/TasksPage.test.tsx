// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { MyTaskBoard } from '@/services/my-tasks-service';
import TasksPage from './index';
import { TODAY, taskRow } from './__fixtures__/task-rows';

const mockState = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as Error | null, refetch: vi.fn(), dataUpdatedAt: Date.parse('2026-11-12T01:00:00.000Z') },
}));

vi.mock('@/config/data-source', () => ({ DATA_SOURCE: 'api', IS_API_MODE: true, API_BASE_URL: '/api' }));
vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mockState.query }));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({
    data: { viewer: { buildingIds: ['bld-a'] }, buildings: [{ id: 'bld-a', name: 'Tòa A' }] },
    buildingName: () => 'Tòa A',
    locationName: () => 'Tầng 5',
  }),
}));
vi.mock('@/components/assistant/AssistantInsight', () => ({ AssistantInsight: () => null }));

const board = (overrides: Partial<MyTaskBoard> = {}): MyTaskBoard => ({
  today: TODAY,
  open: [
    taskRow('SC-028', { label: 'Duyệt tờ trình', dueAt: '2026-11-12T09:00:00.000Z' }),
    taskRow('SC-031', { title: 'Rò ống cấp tầng 5', dueAt: '2026-11-10T00:00:00.000Z', isOverdue: true, priority: 'HIGH' }),
    taskRow('SC-020', { label: 'Cần phân công lại', detail: 'Bước BQT duyệt · Nguyễn Văn X (đã khóa)', status: 'PENDING_BOARD_APPROVAL' }),
  ],
  done: [{ id: 'd1', label: 'Xác nhận hồ sơ', result: 'Đã xác nhận cần sửa', at: '2026-11-11T07:20:00.000Z', href: '/records/rec-1', code: 'SC-010', title: 'Sửa đèn', buildingId: 'bld-a' }],
  ...overrides,
});

const load = (data: MyTaskBoard) => {
  mockState.query = { ...mockState.query, data, isLoading: false, error: null, refetch: vi.fn() };
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <TasksPage />
    </MemoryRouter>,
  );

describe('TasksPage (TK-S1)', () => {
  it('heads with today, not a fixed month, and counts open, overdue, due today and done (AC-TK.14, TD-01, TD-02)', () => {
    load(board());
    renderPage();
    expect(screen.getByText('Hôm nay, 12/11/2026')).toBeTruthy();
    expect(screen.queryByText(/Tháng 10, 2026/)).toBeNull();
    expect(screen.getByText('3 việc đang chờ bạn tại 1 tòa nhà')).toBeTruthy();
    const cards = screen.getAllByRole('button', { pressed: false }).concat(screen.getAllByRole('button', { pressed: true }));
    const value = (label: string) => cards.find((card) => card.textContent?.includes(label))?.textContent;
    expect(value('Đang mở')).toContain('3');
    expect(value('Quá hạn')).toContain('1');
    expect(value('Đến hạn hôm nay')).toContain('1');
    expect(value('Đã hoàn thành (30 ngày)')).toContain('1');
  });

  it('filters by a card and marks it pressed', () => {
    load(board());
    renderPage();
    const overdue = screen.getAllByRole('button').find((button) => button.textContent?.startsWith('Quá hạn')) as HTMLElement;
    fireEvent.click(overdue);
    expect(overdue.getAttribute('aria-pressed')).toBe('true');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual(['Xác nhận hồ sơ SC-031, quá hạn 2 ngày, ưu tiên cao']);
  });

  it('shows the first task by BR-TK-07 in "Tiếp tục công việc" and the reassignment line (AC-TK.15)', () => {
    load(board());
    renderPage();
    const continueCard = within(screen.getByRole('region', { name: 'Tiếp tục công việc' }));
    expect(continueCard.getByText(/SC-031/)).toBeTruthy();
    expect(continueCard.getByRole('link', { name: 'Mở hồ sơ' }).getAttribute('href')).toBe('/records/rec-SC-031?tab=overview');
    expect(screen.getAllByText('Bước BQT duyệt · Nguyễn Văn X (đã khóa)').length).toBeGreaterThan(0);
  });

  it('lists done tasks with their result, and says when there are none', () => {
    load(board());
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Đã hoàn thành/ }));
    expect(screen.getAllByText('Đã xác nhận cần sửa').length).toBeGreaterThan(0);
    unmount();
    load(board({ done: [] }));
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Đã hoàn thành/ }));
    expect(screen.getByText('Bạn chưa hoàn thành việc nào trong 30 ngày qua.')).toBeTruthy();
  });

  it('separates "nothing waits" from "nothing matches", and has no repair/maintenance filter in api mode', () => {
    load(board({ open: [] }));
    const { unmount } = renderPage();
    // The header line and the empty state both say it (ui-brief §2.1, §4).
    expect(screen.getAllByText('Không có việc nào đang chờ bạn')).toHaveLength(2);
    expect(screen.getByText('Khi một hồ sơ sửa chữa đến bước của bạn, việc sẽ xuất hiện ở đây.')).toBeTruthy();
    unmount();
    load(board());
    renderPage();
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'không có gì như vậy' } });
    expect(screen.getByText('Không có việc phù hợp.')).toBeTruthy();
    expect(screen.queryByLabelText('Nhóm')).toBeNull();
  });

  it('offers a retry when loading fails', () => {
    const refetch = vi.fn();
    mockState.query = { ...mockState.query, data: undefined, error: new Error('503'), refetch };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalled();
  });
});
