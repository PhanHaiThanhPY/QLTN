import { Badge } from '@/components/ui/badge';
import type { EmergencyInfo } from '@/domain/types';

/** Post-review outcome of an emergency record (B06-S1 ui-brief §2.3); api mode only. */
export const PostReviewBadge = ({ outcome }: { outcome: EmergencyInfo['postReviewOutcome'] }) => {
  if (outcome === 'APPROVED') return <Badge tone="good">Đã duyệt hậu kiểm</Badge>;
  if (outcome === 'REJECTED') return <Badge tone="crit">Không được duyệt hậu kiểm</Badge>;
  return <Badge tone="warn">Chờ duyệt hậu kiểm</Badge>;
};
