import {
  addMonthsClamped,
  nextPeriodAfter,
  periodsBetween,
  scheduleLabel,
  versionOn,
  type ScheduleVersionLike,
} from './maintenance-schedule';

const version = (
  id: string,
  unit: 'WEEK' | 'MONTH',
  every: number,
  effectiveFrom: string,
  anchorDate = effectiveFrom,
  supersededBy: string | null = null,
): ScheduleVersionLike => ({
  id,
  unit,
  every,
  effectiveFrom,
  anchorDate,
  supersededBy,
});

describe('maintenance schedule (MT-S2 BR-MT2-05, BR-MT2-06)', () => {
  it('lists monthly periods within the 30-day window (AC-MT2.3)', () => {
    expect(periodsBetween([version('v1', 'MONTH', 1, '2026-11-12')], '2026-10-27', '2026-11-26')).toEqual([
      '2026-11-12',
    ]);
  });

  it('lists two-week periods (AC-MT2.5)', () => {
    expect(periodsBetween([version('v1', 'WEEK', 2, '2026-10-28')], '2026-10-27', '2026-11-26')).toEqual([
      '2026-10-28',
      '2026-11-11',
      '2026-11-25',
    ]);
  });

  it('clamps to the month end without drifting (AC-MT2.7)', () => {
    expect(periodsBetween([version('v1', 'MONTH', 1, '2027-01-31')], '2027-01-01', '2027-03-31')).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ]);
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('switches schedule on the effective date and never mixes two for one stretch (AC-MT2.12)', () => {
    const versions = [version('v1', 'MONTH', 1, '2026-10-12'), version('v2', 'WEEK', 2, '2026-11-10')];
    expect(periodsBetween(versions, '2026-10-27', '2026-11-26')).toEqual(['2026-11-10', '2026-11-24']);
    expect(versionOn(versions, '2026-11-09')?.id).toBe('v1');
    expect(versionOn(versions, '2026-11-10')?.id).toBe('v2');
  });

  it('chooses by effective date, ignoring superseded versions (AC-MT2.13, MD-02)', () => {
    const versions = [
      version('v1', 'MONTH', 1, '2026-10-12'),
      version('v2', 'WEEK', 1, '2026-12-01', '2026-12-01', 'v3'),
      version('v3', 'WEEK', 2, '2026-11-15'),
    ];
    expect(periodsBetween(versions, '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-12',
      '2026-11-15',
      '2026-11-29',
      '2026-12-13',
      '2026-12-27',
    ]);
    expect(versionOn(versions, '2026-12-05')?.id).toBe('v3');
  });

  it('finds the next period after a date (BR-MT2-07)', () => {
    expect(nextPeriodAfter([version('v1', 'MONTH', 1, '2026-11-12')], '2026-11-12')).toBe('2026-12-12');
  });

  it('names a schedule in words', () => {
    expect(scheduleLabel({ unit: 'WEEK', every: 2 })).toBe('Mỗi 2 tuần');
    expect(scheduleLabel({ unit: 'MONTH', every: 1 })).toBe('Mỗi tháng');
    expect(scheduleLabel({ unit: 'MONTH', every: 3 })).toBe('Mỗi 3 tháng');
  });
});
