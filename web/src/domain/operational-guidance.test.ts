import { describe, expect, it } from 'vitest';
import { buildOperationalRiskGuidance, buildProposalGuidance, suggestIncidentPriority } from './operational-guidance';

describe('rule-based operational guidance', () => {
  it('suggests urgent priority for a safety-related incident without mutating data', () => {
    expect(suggestIncidentPriority('Rò rỉ nước lớn', 'Nước đang ngập khu vực sảnh')).toMatchObject({ priority: 'URGENT' });
  });

  it('checks proposal completeness and keeps the summary grounded in typed content', () => {
    expect(buildProposalGuidance({ proposal: 'Thay bơm nước tầng hầm', contractorName: '', amountVnd: 0, attachmentCount: 0, priceAlertCount: 1 })).toEqual({
      missing: ['Nội dung và phạm vi phương án', 'Tên nhà thầu thực hiện', 'Giá trị đề nghị', 'Tài liệu tờ trình'],
      warnings: ['Có cảnh báo giá hoặc hạn mức cần giải trình trước khi trình.'],
      summary: 'Thay bơm nước tầng hầm',
    });
  });

  it('prioritizes unresolved records before lower-risk operational queues', () => {
    expect(buildOperationalRiskGuidance({ overdueRepairCount: 0, overdueMaintenanceCount: 2, pendingApprovalCount: 3, pendingReviewCount: 1, unresolvedCount: 1 })).toMatchObject({
      tone: 'crit',
      count: 1,
      href: '/records?status=UNRESOLVED',
    });
  });
});
