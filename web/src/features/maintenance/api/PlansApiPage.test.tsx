// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import PlansApiPage from './PlansApiPage';
import { BQL_A, READ_ONLY } from './__fixtures__/api-items';
import { planRowOf } from './__fixtures__/api-plans';

const mockState = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  viewer: undefined as unknown,
}));

vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mockState.query }));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ data: { viewer: mockState.viewer, buildings: [] }, userName: () => 'Người A', buildingName: () => 'Tòa A', locationName: () => 'Phòng bơm' }),
}));
vi.mock('@/services/runtime', async (original) => ({ ...(await original<object>()), todayVn: () => '2026-10-27' }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PlansApiPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('PlansApiPage (SPEC MT-S2, ui-brief §2.1)', () => {
  beforeEach(() => {
    mockState.viewer = BQL_A;
    mockState.query = {
      data: [planRowOf(), planRowOf({ id: 'pl-2', code: 'KH-008', status: 'PAUSED', nextDate: null, needsReassignment: true, schedule: null })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('shows the schedule in words, the next occurrence and the flags', () => {
    renderPage();
    expect(screen.getAllByText('Mỗi tháng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12/11/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cần giao lại').length).toBeGreaterThan(0);
    // The status filter starts on "Chưa kết thúc": ended plans are hidden by default.
    expect(screen.getAllByText('Chưa kết thúc').length).toBeGreaterThan(0);
  });

  it('offers "Tạo kế hoạch" to a BQL only', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: 'Tạo kế hoạch' })).toBeTruthy();
    unmount();
    mockState.viewer = READ_ONLY;
    renderPage();
    expect(screen.queryByRole('button', { name: 'Tạo kế hoạch' })).toBeNull();
  });

  it('says when there is no plan', () => {
    mockState.query.data = [];
    renderPage();
    expect(screen.getByText('Chưa có kế hoạch bảo trì.')).toBeTruthy();
  });
});
