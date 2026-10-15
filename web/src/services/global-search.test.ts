import { USER_ID } from '@/mock/seed-reference';
import { asUser, seedAt } from '@/test/helpers';
import { searchGlobal } from './global-search-service';

describe('global search', () => {
  beforeEach(async () => {
    await seedAt();
    asUser(USER_ID.BQL_A);
  });

  it('should search scoped records and maintenance items', async () => {
    const results = await searchGlobal('TM-A01');
    expect(results.some((result) => result.kind === 'REPAIR_RECORD')).toBe(true);
    expect(results.some((result) => result.kind === 'MAINTENANCE_ITEM')).toBe(true);
  });

  it('should return no results for short queries', async () => {
    await expect(searchGlobal('A')).resolves.toEqual([]);
  });
});
