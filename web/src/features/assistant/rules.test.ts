import type { DashboardData } from '@/services/report-service';
import { buildDailyBrief, buildOperationalSuggestions } from './rules';

const dashboard = (overrides: Partial<DashboardData> = {}): DashboardData => ({
  openRepairCount: 4,
  overdueRepairCount: 0,
  completedRepairCount: 2,
  myOpenTaskCount: 0,
  recentRecords: [],
  upcomingMaintenance: [],
  overdueMaintenance: [],
  pendingReviewCount: 0,
  needsInformationCount: 0,
  pendingProposalCount: 0,
  unresolvedCount: 0,
  pendingApprovalCount: 0,
  approvedTotal: 0,
  paidTotal: 0,
  unreadNotificationCount: 0,
  ...overrides,
});

describe('operational guidance rules', () => {
  it('should prioritize overdue work and expose actionable links', () => {
    const suggestions = buildOperationalSuggestions(
      dashboard({
        overdueRepairCount: 2,
        overdueMaintenance: [{ id: 'occ-1' } as DashboardData['overdueMaintenance'][number]],
        pendingApprovalCount: 1,
      }),
    );

    expect(suggestions.map((suggestion) => suggestion.key)).toEqual(['overdue-repairs', 'overdue-maintenance', 'pending-approvals']);
    expect(suggestions[0]).toMatchObject({ count: 2, href: '/records?overdue=1', tone: 'crit' });
  });

  it('should show a clear state when no rule is triggered', () => {
    expect(buildOperationalSuggestions(dashboard())).toEqual([
      expect.objectContaining({ key: 'all-clear', count: 0, tone: 'good' }),
    ]);
  });

  it('should explain when the day is clear without inventing work', () => {
    expect(buildDailyBrief(dashboard(), 'Minh')).toMatchObject({
      hasPriority: false,
      headline: 'Hôm nay bạn có thể yên tâm, Minh',
      nextStep: null,
    });
  });

  it('should lead with the first actionable suggestion', () => {
    const brief = buildDailyBrief(dashboard({ overdueRepairCount: 2 }), 'Minh');
    expect(brief).toMatchObject({
      hasPriority: true,
      nextStep: expect.objectContaining({ key: 'overdue-repairs', count: 2 }),
    });
  });
});
