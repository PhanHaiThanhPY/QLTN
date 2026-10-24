// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import RecordsPage from './index';

/**
 * api mode: the count row is a secondary query. When it fails it disappears silently (no zeros), while the
 * list below keeps working; when it succeeds every card links to its filtered URL.
 */
const mockState = vi.hoisted(() => ({
  list: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  summary: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
}));

vi.mock('@/config/data-source', () => ({
  DATA_SOURCE: 'api',
  IS_API_MODE: true,
  API_BASE_URL: '/api',
}));

vi.mock('@/hooks/useServiceQuery', () => ({
  useServiceQuery: (key: unknown[]) => (key[1] === 'summary' ? mockState.summary : mockState.list),
}));

vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/services/records-service', () => ({
  listRecords: vi.fn(),
  getRecordSummary: vi.fn(),
}));

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 10 };

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/records']}>
      <RecordsPage />
    </MemoryRouter>,
  );

describe('RecordsPage cards (api mode)', () => {
  beforeEach(() => {
    mockState.list = { data: EMPTY_PAGE, isLoading: false, error: null, refetch: vi.fn() };
    mockState.summary = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
  });

  it('should hide the count row when the counter query fails and keep the list', () => {
    mockState.summary = {
      data: undefined,
      isLoading: false,
      error: new Error('503'),
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.queryByText('hồ sơ đang mở')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByText('Chưa có hồ sơ sửa chữa')).toBeTruthy();
  });

  it('should hide cached numbers when a later counter call fails instead of showing stale counts', () => {
    mockState.summary = {
      data: { open: 12, needsUpdate: 3, completed: 25, total: 40, asOf: '2026-10-24T03:00:00.000Z' },
      isLoading: false,
      error: new Error('503'),
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.queryByText('hồ sơ đang mở')).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.getByText('Chưa có hồ sơ sửa chữa')).toBeTruthy();
  });

  it('should render the cards from the server summary and link each to its filtered list', () => {
    mockState.summary = {
      data: { open: 12, needsUpdate: 3, completed: 25, total: 40, asOf: '2026-10-24T03:00:00.000Z' },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };

    renderPage();

    expect(screen.getByText('hồ sơ cần bổ sung')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toEqual(
      expect.arrayContaining(['/records?open=1', '/records?attention=needs_update', '/records?status=COMPLETED']),
    );
  });
});
