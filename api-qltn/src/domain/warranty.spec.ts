import { warrantyState, WARRANTY_SOON_DAYS } from './warranty';

describe('warranty state (MT-S1 BR-MT-11)', () => {
  const today = '2026-10-27';

  it('is none without a date', () => {
    expect(warrantyState(null, today)).toBe('NONE');
  });

  it('is expiring up to 30 days ahead, today included', () => {
    expect(WARRANTY_SOON_DAYS).toBe(30);
    expect(warrantyState('2026-10-27', today)).toBe('EXPIRING');
    expect(warrantyState('2026-11-26', today)).toBe('EXPIRING');
    expect(warrantyState('2026-11-27', today)).toBe('ACTIVE');
  });

  it('is expired once the date has passed', () => {
    expect(warrantyState('2026-10-26', today)).toBe('EXPIRED');
  });
});
