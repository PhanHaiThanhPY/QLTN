// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { User } from '@/domain/types';
import AuditLogPage from './index';

/** SPEC AD-S1 AC-8/AC-9: default 7-day filter, Vietnamese labels (raw code when unknown), links by right. */
const state = vi.hoisted(() => ({ viewer: undefined as unknown, listAuditEvents: vi.fn() }));

vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => state.viewer }));
vi.mock('@/hooks/useReferenceData', () => ({ useReferenceData: () => ({ data: undefined, isLoading: false }) }));
vi.mock('@/services/runtime', () => ({ todayVn: () => '2026-10-26' }));
vi.mock('@/services/http/audit-log-api', () => ({
  AUDIT_PAGE_SIZE: 50,
  listAuditEvents: state.listAuditEvents,
  exportAuditEvents: vi.fn(),
}));

const BQL: User = {
  id: 'usr-bql',
  code: 'BQL-A',
  username: 'bql-a',
  fullName: 'Nguyễn Thu Hà',
  role: 'BQL',
  buildingIds: ['bld-a'],
  active: true,
  version: 1,
};

const row = (id: string, overrides: Record<string, unknown>) => ({
  id,
  subjectType: 'REPAIR_RECORD',
  subjectId: `sub-${id}`,
  subjectCode: 'SC-001',
  buildingId: 'bld-a',
  buildingCode: 'A',
  action: 'confirmRepair',
  actorId: 'usr-kt',
  actorName: 'Trần Minh Khoa',
  actorCode: 'KT-A',
  fromStatus: 'PENDING_CONFIRMATION',
  toStatus: 'PENDING_PROPOSAL',
  reason: 'Đúng hiện trạng',
  createdAt: '2026-10-26T08:00:00.000Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AuditLogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('AuditLogPage', () => {
  beforeEach(() => {
    state.viewer = BQL;
    state.listAuditEvents.mockReset();
  });

  it('AC-8: asks for the last 7 days and shows Vietnamese labels, the raw code of an unknown action', async () => {
    state.listAuditEvents.mockResolvedValue({
      rows: [
        row('r1', {}),
        row('r2', { action: 'mergeRecords', fromStatus: null, toStatus: null, actorId: null, actorName: null, actorCode: null }),
      ],
      total: 2,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Xác nhận cần sửa')).toBeTruthy());
    expect(state.listAuditEvents).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: '2026-10-20', dateTo: '2026-10-26' }), 1);
    expect(screen.getByText('mergeRecords')).toBeTruthy();
    expect(screen.getByText('Hệ thống')).toBeTruthy();
    expect(screen.getByText('Chờ xác nhận → Chờ lập tờ trình')).toBeTruthy();
  });

  it('AC-9: BQL gets a link on a repair record but only text on an account', async () => {
    state.listAuditEvents.mockResolvedValue({
      rows: [row('r1', {}), row('r2', { subjectType: 'ACCOUNT', subjectId: 'usr-x', subjectCode: 'KT-A2', buildingCode: null })],
      total: 2,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('KT-A2')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'SC-001' }).getAttribute('href')).toBe('/records/sub-r1');
    expect(screen.queryByRole('link', { name: 'KT-A2' })).toBeNull();
    expect(screen.getByText('Toàn hệ thống')).toBeTruthy();
  });
});
