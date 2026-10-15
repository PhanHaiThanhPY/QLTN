import { describe, expect, it } from 'vitest';
import { getAssistantContext, getAssistantReply } from './assistant-context';

describe('rule-based assistant answers', () => {
  const dashboard = {
    openRepairCount: 6,
    overdueRepairCount: 2,
    completedRepairCount: 4,
    myOpenTaskCount: 3,
    upcomingMaintenanceCount: 5,
    overdueMaintenanceCount: 1,
    pendingApprovalCount: 2,
    pendingReviewCount: 1,
    needsInformationCount: 1,
    pendingProposalCount: 1,
    unresolvedCount: 0,
  };

  it('answers a count question with a source in the permitted scope', () => {
    const reply = getAssistantReply(getAssistantContext('/'), 'Có bao nhiêu hồ sơ quá hạn?', { dashboard });
    expect(reply).toContain('2 hồ sơ sửa chữa quá hạn');
    expect(reply).toContain('Nguồn: Tổng quan vận hành');
  });

  it('answers approval counts without taking action', () => {
    const reply = getAssistantReply(getAssistantContext('/'), 'Có bao nhiêu hồ sơ chờ phê duyệt?', { dashboard });
    expect(reply).toContain('2 hồ sơ đang chờ phê duyệt');
    expect(reply).toContain('chuỗi phê duyệt');
  });
});
