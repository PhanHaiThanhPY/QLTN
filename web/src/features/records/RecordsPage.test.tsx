// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import RecordsPage from './index';

/**
 * A missing page (`undefined`) is "unknown", never "empty": the screen must show the error branch with a
 * retry, otherwise a paused/failed query looks like a building without records.
 */
const mockState = vi.hoisted(() => ({
  list: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  summary: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
}));

vi.mock('@/hooks/useServiceQuery', () => ({
  useServiceQuery: (key: unknown[]) => (key[1] === 'summary' ? mockState.summary : mockState.list),
}));

vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ data: undefined, isLoading: false }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/records']}>
      <RecordsPage />
    </MemoryRouter>,
  );

describe('RecordsPage states', () => {
  beforeEach(() => {
    mockState.list = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    mockState.summary = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
  });

  it('should show the error branch and retry when the page data is undefined', () => {
    renderPage();

    expect(screen.getByText('Không tải được dữ liệu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(screen.queryByText('Chưa có hồ sơ sửa chữa')).toBeNull();
  });

  it('should show "Chưa có hồ sơ sửa chữa" only for a successful empty page', () => {
    mockState.list = {
      data: { items: [], total: 0, page: 1, pageSize: 10 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.getByText('Chưa có hồ sơ sửa chữa')).toBeTruthy();
    expect(screen.queryByText('Không tải được dữ liệu')).toBeNull();
  });
});
