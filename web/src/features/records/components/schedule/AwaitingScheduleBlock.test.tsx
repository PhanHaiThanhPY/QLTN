// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { entry } from './__fixtures__/schedule-entries';
import { AwaitingScheduleBlock } from './AwaitingScheduleBlock';

const mockState = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as Error | null, refetch: vi.fn() },
}));

vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mockState.query }));
vi.mock('@/hooks/useReferenceData', () => ({ useReferenceData: () => ({ data: undefined }) }));

const ready = (count: number, total = count) => ({
  items: Array.from({ length: count }, (_, index) => ({
    record: entry(`SC-${100 + index}`, '2026-11-20', '2026-11-20', { status: 'READY_FOR_CONSTRUCTION' }).record,
    readySince: '2026-11-18T03:00:00.000Z',
    contractorName: index === 0 ? 'Hòa Phát' : undefined,
  })),
  total,
  page: 1,
  pageSize: 10,
});

const renderBlock = (buildingId = 'bld-a') =>
  render(
    <MemoryRouter>
      <AwaitingScheduleBlock filters={{ buildingId, locationId: '' }} />
    </MemoryRouter>,
  );

describe('AwaitingScheduleBlock (B4-S1 BR-B4-05)', () => {
  it('opens by default when records wait, with approval date and contractor', () => {
    mockState.query = { data: ready(2), isLoading: false, error: null, refetch: vi.fn() };
    renderBlock();

    const toggle = screen.getByRole('button', { name: /Chờ xếp lịch \(2\)/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Duyệt xong 18/11 · Nhà thầu: Hòa Phát')).toBeTruthy();
    expect(screen.getByRole('link', { name: /SC-100/ }).getAttribute('href')).toBe('/records/rec-SC-100');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/SC-100/)).toBeNull();
  });

  it('stays collapsed when empty and says so once opened', () => {
    mockState.query = { data: ready(0), isLoading: false, error: null, refetch: vi.fn() };
    renderBlock();

    const toggle = screen.getByRole('button', { name: /Chờ xếp lịch \(0\)/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByText('Không có hồ sơ nào đang chờ xếp lịch.')).toBeTruthy();
  });

  it('links to the filtered record list beyond 10 records', () => {
    mockState.query = { data: ready(10, 14), isLoading: false, error: null, refetch: vi.fn() };
    renderBlock();

    expect(screen.getByRole('link', { name: 'Xem tất cả 14 hồ sơ' }).getAttribute('href')).toBe(
      '/records?status=READY_FOR_CONSTRUCTION&buildingId=bld-a',
    );
  });

  it('opens on its own error with a retry', () => {
    const refetch = vi.fn();
    mockState.query = { data: undefined, isLoading: false, error: new Error('503'), refetch };
    renderBlock();

    expect(screen.getByRole('button', { name: /Chờ xếp lịch/ }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalled();
  });
});
