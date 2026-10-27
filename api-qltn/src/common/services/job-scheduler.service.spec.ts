import { msUntilVnMinute } from './job-scheduler.service';

describe('msUntilVnMinute', () => {
  const at = (iso: string) => new Date(iso);
  const MINUTE = 60_000;

  it('waits until the next 00:15 in Vietnam (17:15 UTC)', () => {
    expect(msUntilVnMinute(at('2026-10-27T17:00:00.000Z'), 15)).toBe(15 * MINUTE);
    expect(msUntilVnMinute(at('2026-10-27T17:14:30.000Z'), 15)).toBe(30_000);
  });

  it('goes to the next day once the minute has passed or is now', () => {
    expect(msUntilVnMinute(at('2026-10-27T17:15:00.000Z'), 15)).toBe(24 * 60 * MINUTE);
    expect(msUntilVnMinute(at('2026-10-27T17:16:00.000Z'), 15)).toBe((24 * 60 - 1) * MINUTE);
  });
});
