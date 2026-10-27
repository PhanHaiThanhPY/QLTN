import { USER_ID } from '@/mock/seed-reference';
import { NO_FILTERS, matchesFilters } from '@/features/tasks/task-list';
import { asUser, seedAt } from '@/test/helpers';
import { getMyTaskBoard } from './my-tasks-service';

/** TK-S1 in mock mode: the demo's stored tasks in the shared shape, searchable without marks (AC-TK.12, TD-03). */
describe('my task board, mock mode', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('maps the demo tasks of the viewer and finds them by a folded code or title', async () => {
    asUser(USER_ID.BQL_A);
    const board = await getMyTaskBoard();
    expect(board.open.length).toBeGreaterThan(0);
    const repair = board.open.find((row) => row.subjectType === 'REPAIR_RECORD');
    if (!repair) throw new Error('BQL-A has a repair task in the demo seed');
    expect(repair.href).toMatch(/^\/records\//);
    expect(repair.status).toBeDefined();
    const search = (text: string) => board.open.filter((row) => matchesFilters(row, { ...NO_FILTERS, search: text }, board.today));
    expect(search(repair.code.toLowerCase()).map((row) => row.id)).toContain(repair.id);
    const word = repair.title.split(' ')[0];
    const folded = word.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
    expect(search(folded).map((row) => row.id)).toContain(repair.id);
  });
});
