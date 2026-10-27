import { SEED_USERS, USER_ID, BUILDING_A } from '@/mock/seed-reference';
import { occurrenceOf, planRowOf, versionOf } from './__fixtures__/api-plans';
import { eligiblePerformers, eligibleReviewers, flaggedByChange, latestRescheduleDay, planKpis, planTimeline, previewDates } from './plan-api-ui';

describe('plan-api-ui (SPEC MT-S2)', () => {
  it('previews the first dates from the start, month ends clamped (BR-MT2-01)', () => {
    expect(previewDates('MONTH', 1, '2027-01-31')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(previewDates('WEEK', 2, '2026-11-02')).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
    expect(previewDates('WEEK', 9, '2026-11-02')).toEqual([]);
  });

  it('counts running, due within 7 days, paused and drafts', () => {
    const rows = [
      planRowOf({ id: 'a', nextDate: '2026-10-30' }),
      planRowOf({ id: 'b', nextDate: '2026-11-20' }),
      planRowOf({ id: 'c', status: 'PAUSED', nextDate: null }),
      planRowOf({ id: 'd', status: 'DRAFT', nextDate: null }),
    ];
    expect(planKpis(rows, '2026-10-27')).toEqual({ active: 2, dueSoon: 1, paused: 1, draft: 1 });
  });

  it('offers KT or BQL as performer, and another KT as reviewer (BR-MT2-02)', () => {
    const item = { locationId: 'loc-a-b2' };
    const performers = eligiblePerformers(SEED_USERS, item, BUILDING_A).map((user) => user.id);
    expect(performers).toEqual(expect.arrayContaining([USER_ID.BQL_A, USER_ID.KT_A, USER_ID.KT_A2]));
    expect(performers).not.toContain(USER_ID.TVKT);
    const reviewers = eligibleReviewers(SEED_USERS, item, BUILDING_A, USER_ID.KT_A).map((user) => user.id);
    expect(reviewers).toContain(USER_ID.KT_A2);
    expect(reviewers).not.toContain(USER_ID.KT_A);
    expect(reviewers).not.toContain(USER_ID.BQL_A);
  });

  it('merges occurrences and skipped periods, newest first', () => {
    const rows = planTimeline({ occurrences: [occurrenceOf('BT-1', { scheduledDate: '2026-11-12' })], skipped: ['2026-09-12', '2026-12-12'] });
    expect(rows.map((row) => [row.kind, row.date])).toEqual([
      ['skipped', '2026-12-12'],
      ['occurrence', '2026-11-12'],
      ['skipped', '2026-09-12'],
    ]);
  });

  it('allows a reschedule up to the day before the next period (BR-MT2-07)', () => {
    expect(latestRescheduleDay({ versions: [versionOf()] }, occurrenceOf('BT-1'))).toBe('2026-12-11');
  });

  it('counts the occurrences a schedule change would flag', () => {
    const rows = [
      occurrenceOf('BT-1', { periodDate: '2026-11-12' }),
      occurrenceOf('BT-2', { periodDate: '2026-12-12' }),
      occurrenceOf('BT-3', { periodDate: null, isMakeup: true, scheduledDate: '2026-12-01' }),
      occurrenceOf('BT-4', { periodDate: '2026-12-20', status: 'CANCELLED' }),
    ];
    expect(flaggedByChange(rows, '2026-12-01')).toBe(1);
  });
});
