import { mondayOf, weekRangeLabel } from './week';

describe('week helpers', () => {
  it('should return the Monday of the week', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
  });

  it('should label ranges inside one month and across months', () => {
    expect(weekRangeLabel('2026-10-12', '2026-10-18')).toBe('12 – 18 tháng 10, 2026');
    expect(weekRangeLabel('2026-09-28', '2026-10-04')).toBe('28/9 – 4/10/2026');
  });
});
