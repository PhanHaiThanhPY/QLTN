import { apiRequest } from './http/client';
import { getMyTaskBoard } from './my-tasks-service';

vi.mock('@/config/data-source', () => ({ DATA_SOURCE: 'api', IS_API_MODE: true, API_BASE_URL: '/api' }));
vi.mock('./http/client', () => ({ apiRequest: vi.fn() }));

/** F-TK-S1-01: the API caps the done rows at 200; the board keeps its uncapped count. */
describe('my task board, api mode', () => {
  it('takes the done count from the API counters, not from the rows', async () => {
    const done = Array.from({ length: 200 }, (_, index) => ({
      id: `a${index}`,
      label: 'Xác nhận hồ sơ',
      result: 'Đã xác nhận cần sửa',
      at: '2026-11-11T07:20:00.000Z',
      record: { id: `r${index}`, code: `SC-${index}`, title: 'Hồ sơ', buildingId: 'bld-a' },
    }));
    vi.mocked(apiRequest).mockResolvedValue({ today: '2026-11-12', open: [], done, counts: { open: 0, overdue: 0, dueToday: 0, done: 217 } });
    const board = await getMyTaskBoard();
    expect(board.done).toHaveLength(200);
    expect(board.doneCount).toBe(217);
  });
});
