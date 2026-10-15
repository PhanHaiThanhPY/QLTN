import type { BadgeTone } from '@/components/ui/badge';
import type { ApprovalOutcome } from '@/domain/types';

export const APPROVAL_OUTCOME: Record<ApprovalOutcome, { label: string; tone: BadgeTone }> = {
  APPROVED: { label: 'Đã duyệt', tone: 'good' },
  NEEDS_UPDATE: { label: 'Yêu cầu bổ sung', tone: 'warn' },
  REJECTED: { label: 'Từ chối', tone: 'crit' },
};
