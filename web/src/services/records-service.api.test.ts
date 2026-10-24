// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecordSummary, listRecords } from './records-service';

/** The API branch of the record list: server-side paging/search/filters, no IndexedDB. */
vi.mock('@/config/data-source', () => ({
  DATA_SOURCE: 'api',
  IS_API_MODE: true,
  API_BASE_URL: '/api',
}));

const successBody = (data: unknown): unknown => ({
  success: true,
  data,
  timestamp: '2026-01-01T00:00:00.000Z',
  correlationId: null,
});

const jsonResponse = (status: number, body: unknown): Response =>
  ({ status, text: async () => (body === null ? '' : JSON.stringify(body)) }) as unknown as Response;

const mockFetch = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn(handler);
  vi.stubGlobal('fetch', mock);
  return mock;
};

const API_ROW = {
  id: 'rec-1',
  code: 'SC-001',
  buildingId: 'bld-a',
  locationId: 'loc-1',
  noMaintenanceItem: true,
  title: 'Thấm trần hành lang',
  description: 'Nước nhỏ giọt xuống hành lang, cần kiểm tra ống cấp.',
  priority: 'HIGH',
  status: 'DRAFT',
  managerUserId: 'usr-bql',
  confirmationUserId: 'usr-kt',
  consultantUserId: null,
  boardUserId: null,
  approvalStepKeys: ['TECH_CONFIRM'],
  attachmentIds: [],
  createdBy: 'usr-bql',
  version: 1,
  createdAt: '2026-10-24T02:00:00.000Z',
  updatedAt: '2026-10-24T03:00:00.000Z',
};

describe('record list (api mode)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should GET /records with page, limit, search and every server-side filter', async () => {
    const mock = mockFetch(() =>
      jsonResponse(
        200,
        successBody({
          data: [API_ROW],
          meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
        }),
      ),
    );

    const page = await listRecords({
      q: '  tham tran ',
      buildingId: 'bld-a',
      statusGroup: 'INTAKE',
      status: 'DRAFT',
      locationId: 'loc-1',
      assigneeId: 'usr-kt',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      page: 2,
      pageSize: 10,
    });

    const url = new URL(String(mock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/records');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      limit: '10',
      search: 'tham tran',
      buildingId: 'bld-a',
      statusGroup: 'INTAKE',
      status: 'DRAFT',
      locationId: 'loc-1',
      assigneeId: 'usr-kt',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });
    expect(page.total).toBe(25);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(10);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.record.id).toBe('rec-1');
    expect(page.items[0]?.isOverdue).toBe(false);
    expect(page.items[0]?.needsReassignment).toBe(false);
  });

  it('should send open and attention as the card links do', async () => {
    const mock = mockFetch(() =>
      jsonResponse(200, successBody({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })),
    );

    await listRecords({ open: true, attention: 'needs_update', page: 1 });

    const url = new URL(String(mock.mock.calls[0]?.[0]), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '10', open: '1', attention: 'needs_update' });
  });

  it('should not send filters the backend does not have and should use the defaults', async () => {
    const mock = mockFetch(() =>
      jsonResponse(200, successBody({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })),
    );

    await listRecords({
      q: '',
      overdue: true,
      maintenanceItemId: 'item-1',
      itemLink: 'UNLINKED',
      page: 1,
    });

    const url = new URL(String(mock.mock.calls[0]?.[0]), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '10' });
  });

  it('should GET /records/summary in the building scope and return its counters', async () => {
    const mock = mockFetch(() =>
      jsonResponse(
        200,
        successBody({ open: 12, needsUpdate: 3, completed: 25, total: 40, asOf: '2026-10-24T03:00:00.000Z' }),
      ),
    );

    const summary = await getRecordSummary({ buildingId: 'bld-a' });

    const url = new URL(String(mock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/records/summary');
    expect(Object.fromEntries(url.searchParams)).toEqual({ buildingId: 'bld-a' });
    expect(summary).toEqual({ open: 12, needsUpdate: 3, completed: 25, total: 40, asOf: '2026-10-24T03:00:00.000Z' });
  });

  it('should omit the building filter when the list is not narrowed to one building', async () => {
    const mock = mockFetch(() =>
      jsonResponse(
        200,
        successBody({ open: 0, needsUpdate: 0, completed: 0, total: 0, asOf: '2026-10-24T03:00:00.000Z' }),
      ),
    );

    await getRecordSummary();

    const url = new URL(String(mock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.search).toBe('');
  });
});
