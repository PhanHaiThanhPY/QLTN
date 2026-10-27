// @vitest-environment jsdom
import type { Command } from '../command-engine';
import { executeApiCommand, isApiAction } from './command-adapter';
import { saveApiSession } from './token-store';

const ok = (data: unknown): Response =>
  ({ status: 200, text: async () => JSON.stringify({ success: true, data, timestamp: '2026-10-27T00:00:00.000Z', correlationId: null }) }) as unknown as Response;

const command = (action: string, subjectType: Command['subjectType'], payload: unknown, subjectId?: string): Command => ({
  commandId: 'cmd-1',
  subjectType,
  subjectId,
  expectedVersion: subjectId ? 3 : undefined,
  action,
  payload,
});

/** SPEC MT-S2: the plan screens' commands become REST calls carrying the version. */
describe('maintenance plan commands (api mode)', () => {
  beforeEach(() => saveApiSession({ accessToken: 'tok-1', refreshToken: 'ref-1' }));

  it.each([
    ['activateMaintenancePlan', 'MAINTENANCE_PLAN', 'pl-1', '/api/maintenance-plans/pl-1/activate', {}],
    ['pauseMaintenancePlan', 'MAINTENANCE_PLAN', 'pl-1', '/api/maintenance-plans/pl-1/pause', { reason: 'Chờ thay bơm.' }],
    ['changeMaintenanceSchedule', 'MAINTENANCE_PLAN', 'pl-1', '/api/maintenance-plans/pl-1/change-schedule', { unit: 'WEEK', every: 2 }],
    ['rescheduleMaintenanceOccurrence', 'MAINTENANCE_OCCURRENCE', 'oc-1', '/api/maintenance-occurrences/oc-1/reschedule', { date: '2026-11-02', reason: 'Nhà thầu bận.' }],
    ['keepMaintenanceOccurrence', 'MAINTENANCE_OCCURRENCE', 'oc-1', '/api/maintenance-occurrences/oc-1/keep', {}],
  ] as const)('%s posts to its route with version', async (action, subjectType, id, url, payload) => {
    expect(isApiAction(action)).toBe(true);
    const fetchMock = vi.fn(async () => ok({ id }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(executeApiCommand(command(action, subjectType, payload, id))).resolves.toEqual({ ok: true, subjectId: id });
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(url);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ ...payload, version: 3 });
  });

  it('creates a plan without a version and answers its id', async () => {
    const fetchMock = vi.fn(async () => ok({ id: 'pl-9' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(executeApiCommand(command('createMaintenancePlan', 'MAINTENANCE_PLAN', { name: 'Bơm' }))).resolves.toEqual({ ok: true, subjectId: 'pl-9' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/maintenance-plans');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Bơm' });
  });

  it('keeps the plan as subject after a make-up occurrence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ id: 'oc-77' })));
    await expect(
      executeApiCommand(command('createMakeupOccurrence', 'MAINTENANCE_PLAN', { date: '2026-11-01', reason: 'Sau mưa lớn.' }, 'pl-1')),
    ).resolves.toEqual({ ok: true, subjectId: 'pl-1' });
  });
});
