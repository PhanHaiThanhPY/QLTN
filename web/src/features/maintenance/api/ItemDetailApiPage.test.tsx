// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppError, ERROR_CODE } from '@/domain/errors';
import ItemDetailApiPage from './ItemDetailApiPage';
import { BQL_A, READ_ONLY, detailOf } from './__fixtures__/api-items';

const mockState = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  viewer: undefined as unknown,
}));

vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mockState.query }));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ data: { viewer: mockState.viewer, users: [], items: [] }, userName: () => 'BQL A' }),
}));
vi.mock('../hooks/useMaintenanceScreen', () => ({
  useMaintenanceScreen: () => ({
    data: { viewer: mockState.viewer, buildings: [], items: [] },
    buildingName: () => 'Tòa A',
    locationName: () => 'Phòng bơm',
    userName: () => 'BQL A',
  }),
}));
vi.mock('@/services/runtime', async (original) => ({ ...(await original<object>()), todayVn: () => '2026-10-27' }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/maintenance/items/itm-BOM-A09']}>
        <Routes>
          <Route path="/maintenance/items/:itemId" element={<ItemDetailApiPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('ItemDetailApiPage (MT-S1 BR-MT-08)', () => {
  beforeEach(() => {
    mockState.viewer = BQL_A;
    mockState.query = { data: detailOf(), isLoading: false, error: null, refetch: vi.fn() };
  });

  it('shows the four figures as a description list, money from the integer string (AC-MT.12)', () => {
    renderPage();
    const figures = screen.getByText('Số lần sửa chữa').closest('dl') as HTMLElement;
    const values = within(figures).getAllByRole('definition').map((dd) => dd.textContent);
    expect(values).toContain('2');
    expect(values).toContain('16.500.000 ₫');
    expect(values).toContain('1');
    expect(values).toContain('Còn 20 ngày');
  });

  it('has the four tabs and no "Bảo trì" tab', () => {
    renderPage();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+$/, ''))).toEqual([
      'Tổng quan',
      'Sửa chữa',
      'Tài liệu',
      'Lịch sử thay đổi',
    ]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('BOM-A09 · ');
  });

  it('gives a BQL edit, condition and stop actions, and a read-only account none (AC-MT.5)', () => {
    const { unmount } = renderPage();
    for (const name of ['Sửa', 'Đổi tình trạng', 'Ngừng dùng']) expect(screen.getByRole('button', { name })).toBeTruthy();
    unmount();

    mockState.viewer = READ_ONLY;
    renderPage();
    for (const name of ['Sửa', 'Đổi tình trạng', 'Ngừng dùng', 'Dùng lại']) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('marks a stopped item with its date and reason, and offers "Dùng lại" instead of edits (AC-MT.6)', () => {
    mockState.query.data = detailOf({}, { active: false, deactivatedAt: '2026-10-25T02:00:00.000Z', deactivationReason: 'Thay bơm mới.' });
    renderPage();
    expect(screen.getByText(/Thiết bị đã ngừng dùng từ 25\/10\/2026\. Lý do: Thay bơm mới\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dùng lại' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull();
  });

  it('answers "Không tìm thấy thiết bị" with a way back, and nothing else (AC-MT.4)', () => {
    mockState.query = { data: undefined, isLoading: false, error: new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy thiết bị.'), refetch: vi.fn() };
    renderPage();
    expect(screen.getByText('Không tìm thấy thiết bị')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về danh sách thiết bị' }).getAttribute('href')).toBe('/maintenance/items');
    expect(screen.queryByText('Số lần sửa chữa')).toBeNull();
  });
});
