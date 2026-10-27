// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ItemsApiPage from './ItemsApiPage';
import { BQL_A, READ_ONLY, rowOf } from './__fixtures__/api-items';

const mockState = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as Error | null, refetch: vi.fn() },
  viewer: undefined as unknown,
}));

vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mockState.query }));
vi.mock('../hooks/useMaintenanceScreen', () => ({
  useMaintenanceScreen: () => ({
    data: { viewer: mockState.viewer, buildings: [], items: [] },
    buildingName: () => 'Tòa A',
    locationName: () => 'Phòng bơm',
    userName: () => 'BQL A',
  }),
}));

const load = (rows: unknown) => {
  mockState.query = { data: rows, isLoading: false, error: null, refetch: vi.fn() };
};

const renderPage = (url = '/maintenance/items') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ItemsApiPage />
    </MemoryRouter>,
  );

describe('ItemsApiPage (MT-S1 BR-MT-07)', () => {
  beforeEach(() => {
    mockState.viewer = BQL_A;
  });

  it('shows three cards and four quick views, no maintenance-plan parts', () => {
    load([rowOf('BOM-A01', { openRepairCount: 1, needsAttention: true }), rowOf('CAM-A01', { warranty: 'EXPIRING', needsAttention: true })]);
    renderPage();

    expect(screen.queryByText('Quá hạn bảo trì')).toBeNull();
    expect(screen.queryByText(/Bảo trì kế tiếp/)).toBeNull();
    const views = within(screen.getByRole('radiogroup', { name: 'Lọc nhanh thiết bị' }));
    expect(views.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Tất cả2', 'Cần xử lý2', 'Đang sửa chữa1', 'Sắp hết bảo hành1']);
    expect(screen.getByLabelText('Gồm thiết bị đã ngừng')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'BOM-A01' })[0].getAttribute('href')).toBe('/maintenance/items/itm-BOM-A01');
    expect(screen.getAllByText('Đang sửa chữa').length).toBeGreaterThan(1);
  });

  it('applies the quick view from the URL', () => {
    load([rowOf('BOM-A01', { openRepairCount: 1, needsAttention: true }), rowOf('BC-A01')]);
    renderPage('/maintenance/items?view=repairing');

    expect(screen.getByText('Hiển thị 1/2 thiết bị')).toBeTruthy();
    expect(screen.queryAllByRole('link', { name: 'BC-A01' })).toHaveLength(0);
  });

  it('offers "Thêm thiết bị" to a BQL only (AC-MT.5)', () => {
    load([rowOf('BOM-A01')]);
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: /Thêm thiết bị/ })).toBeTruthy();
    unmount();

    mockState.viewer = READ_ONLY;
    renderPage();
    expect(screen.queryByRole('button', { name: /Thêm thiết bị/ })).toBeNull();
  });

  it('says when there is no equipment, and when a filter finds none', () => {
    load([]);
    const { unmount } = renderPage();
    expect(screen.getByText('Chưa có thiết bị nào.')).toBeTruthy();
    unmount();

    load([rowOf('BC-A01')]);
    renderPage('/maintenance/items?view=warranty');
    expect(screen.getByText('Không có thiết bị phù hợp.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  });

  it('offers a retry when the list fails', () => {
    const refetch = vi.fn();
    mockState.query = { data: undefined, isLoading: false, error: new Error('503'), refetch };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalled();
  });
});
