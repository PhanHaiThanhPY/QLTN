// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppError, ERROR_CODE } from '@/domain/errors';
import PlanDetailApiPage from './PlanDetailApiPage';
import { BQL_A, READ_ONLY } from './__fixtures__/api-items';
import { occurrenceOf, planDetailOf } from './__fixtures__/api-plans';

const mockState = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  viewer: undefined as unknown,
}));

vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mockState.query }));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({
    data: { viewer: mockState.viewer, users: [] },
    userName: () => 'Người A',
    buildingName: () => 'Tòa A',
    locationName: () => 'Phòng bơm',
  }),
}));
vi.mock('@/services/runtime', async (original) => ({ ...(await original<object>()), todayVn: () => '2026-10-27' }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/maintenance/plans/pl-1']}>
        <Routes>
          <Route path="/maintenance/plans/:planId" element={<PlanDetailApiPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const buttons = () => screen.getAllByRole('button').map((button) => button.textContent ?? '');

describe('PlanDetailApiPage (SPEC MT-S2, ui-brief §2.3)', () => {
  beforeEach(() => {
    mockState.viewer = BQL_A;
    mockState.query = { data: planDetailOf(), isLoading: false, error: null, refetch: vi.fn() };
  });

  it('titles the page "code · name" and gives the manager the running-plan actions', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('KH-007 · Kiểm tra bơm hằng tháng');
    expect(buttons()).toEqual(expect.arrayContaining(['Sửa', 'Đổi chu kỳ', 'Tạo lượt bù']));
    expect(buttons()).not.toContain('Kích hoạt');
    expect(screen.getByRole('button', { name: 'Thao tác khác cho KH-007' })).toBeTruthy();
  });

  it('offers "Kích hoạt" on a draft and says how occurrences start', () => {
    mockState.query.data = planDetailOf({ occurrences: [] }, { status: 'DRAFT' });
    renderPage();
    expect(buttons()).toContain('Kích hoạt');
    expect(buttons()).not.toContain('Đổi chu kỳ');
    expect(screen.getByText('Kích hoạt kế hoạch để hệ thống bắt đầu sinh lượt.')).toBeTruthy();
  });

  it('gives no action to an account that does not manage the plan, nor on an ended plan', () => {
    mockState.viewer = READ_ONLY;
    const { unmount } = renderPage();
    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Thao tác cho lượt/ })).toBeNull();
    unmount();

    mockState.viewer = BQL_A;
    mockState.query.data = planDetailOf({}, { status: 'ENDED', statusReason: 'Thay thiết bị.' });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull();
    expect(screen.getByText('Kế hoạch đã kết thúc. Lý do: Thay thiết bị..')).toBeTruthy();
  });

  it('lists skipped periods, flags and the named occurrence menu', () => {
    mockState.query.data = planDetailOf({
      occurrences: [
        occurrenceOf('BT-0042', { scheduleChanged: true }),
        occurrenceOf('BT-0031', { scheduledDate: '2026-10-12', periodDate: '2026-10-12', status: 'CANCELLED', cancelReason: 'Tạm dừng kế hoạch: Chờ bơm.' }),
      ],
      skipped: ['2026-09-12'],
    });
    renderPage();
    expect(screen.getByText('1 lượt có lịch đã đổi. Chọn “Giữ lượt này” hoặc “Hủy” cho từng lượt.')).toBeTruthy();
    expect(screen.getAllByText('Lịch đã đổi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bỏ qua do tạm dừng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tạm dừng kế hoạch: Chờ bơm.').length).toBeGreaterThan(0);
    // The cancelled occurrence has no menu; the scheduled one has a named one.
    expect(screen.getAllByRole('button', { name: 'Thao tác cho lượt BT-0042, 12/11' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Thao tác cho lượt BT-0031/ })).toBeNull();
  });

  it('marks "Cần giao lại" and a stopped item', () => {
    mockState.query.data = planDetailOf(
      { item: { id: 'itm-BOM-A09', code: 'BOM-A09', name: 'Bơm nước', locationId: 'loc-a-b2', active: false } },
      { needsReassignment: true },
    );
    renderPage();
    expect(screen.getByText('Cần giao lại')).toBeTruthy();
    expect(screen.getByText('Thiết bị đã ngừng dùng; không tạo được lượt bù.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tạo lượt bù' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('answers "Không tìm thấy kế hoạch" with a way back', () => {
    mockState.query = { data: undefined, isLoading: false, error: new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy kế hoạch.'), refetch: vi.fn() };
    renderPage();
    expect(screen.getByText('Không tìm thấy kế hoạch')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về danh sách kế hoạch' }).getAttribute('href')).toBe('/maintenance/plans');
  });
});
