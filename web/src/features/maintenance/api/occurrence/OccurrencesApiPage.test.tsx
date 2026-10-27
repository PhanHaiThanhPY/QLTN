// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { OccurrenceRow } from '@/services/maintenance-occurrences-api';
import OccurrencesApiPage from './OccurrencesApiPage';

const calls: unknown[] = [];
const row = (overrides: Partial<OccurrenceRow> = {}): OccurrenceRow => ({
  id: 'occ-1',
  code: 'BT-0042',
  status: 'IN_PROGRESS',
  scheduledDate: '2026-11-12',
  reviewDueAt: null,
  isMakeup: false,
  performerUserId: 'usr-kt-a',
  reviewerUserId: 'usr-kt-a2',
  buildingId: 'bld-a',
  plan: { id: 'pl-1', code: 'KH-007', name: 'Kiểm tra bơm' },
  item: { id: 'itm-1', code: 'BOM-A01', name: 'Bơm B01', locationId: 'loc-1' },
  overdueDays: 1,
  reviewOverdue: false,
  version: 3,
  ...overrides,
});

vi.mock('@/hooks/useServiceQuery', () => ({
  useServiceQuery: (key: readonly unknown[]) => {
    calls.push(key[3]);
    return { data: { rows: [row()], counts: { overdue: 1, today: 2, next7: 5, pendingReview: 1 } }, isLoading: false, error: null, refetch: vi.fn() };
  },
}));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ data: { buildings: [] }, userName: (id?: string) => (id === 'usr-kt-a' ? 'KT01' : 'KT02'), locationName: () => 'Tầng hầm' }),
}));

describe('OccurrencesApiPage (SPEC MT-S3 AC-MT3.16, ui-brief §2.5)', () => {
  it('starts on "Việc của tôi", shows the server counts and late rows with their people', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <OccurrencesApiPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Việc của tôi' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /7 ngày tới/ }).textContent).toContain('5');
    expect(screen.getAllByText('Quá hạn 1 ngày').length).toBeGreaterThan(0);
    expect(screen.getAllByText('KT01 → KT02').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Quá hạn/ }));
    expect(calls.at(-1)).toMatchObject({ scope: 'mine', bucket: 'OVERDUE' });
  });
});
