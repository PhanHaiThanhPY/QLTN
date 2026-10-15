import { listScheduleSlots } from './schedule';
import type { ScheduleVersion } from './types';

const monthly = (anchorDate: string, effectiveFrom = anchorDate, revision = 1): ScheduleVersion => ({
  revision,
  effectiveFrom,
  anchorDate,
  frequency: 'MONTHLY',
  intervalMonths: 1,
});

describe('listScheduleSlots', () => {
  it('should clamp day 31 to month end without drifting later periods', () => {
    const dates = listScheduleSlots([monthly('2027-01-31')], undefined, '2027-05-31').map((slot) => slot.date);
    expect(dates).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  });

  it('should handle leap years', () => {
    const dates = listScheduleSlots([monthly('2028-01-30')], undefined, '2028-03-31').map((slot) => slot.date);
    expect(dates).toEqual(['2028-01-30', '2028-02-29', '2028-03-30']);
  });

  it('should only return dates after the cursor', () => {
    const dates = listScheduleSlots([monthly('2026-10-05')], '2026-11-05', '2027-01-31').map((slot) => slot.date);
    expect(dates).toEqual(['2026-12-05', '2027-01-05']);
  });

  it('should switch to the new version from its effective date', () => {
    const quarterly: ScheduleVersion = { revision: 2, effectiveFrom: '2027-01-01', anchorDate: '2027-01-15', frequency: 'QUARTERLY', intervalMonths: 3 };
    const slots = listScheduleSlots([monthly('2026-10-10'), quarterly], undefined, '2027-07-31');
    expect(slots.map((slot) => `${slot.date}@${slot.revision}`)).toEqual([
      '2026-10-10@1',
      '2026-11-10@1',
      '2026-12-10@1',
      '2027-01-15@2',
      '2027-04-15@2',
      '2027-07-15@2',
    ]);
  });
});
