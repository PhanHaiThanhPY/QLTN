import { Badge } from '@/components/ui/badge';
import type { MaintenanceOccurrence } from '@/domain/types';
import type { OccurrenceIndicator } from '@/services/maintenance-service';
import { todayVn } from '@/services/runtime';
import { diffDays, toVnDate } from '@/utils/date';

interface OccurrenceFlagsProps {
  occurrence: MaintenanceOccurrence;
  indicator: OccurrenceIndicator;
  needsReassignment?: boolean;
  /** Submission time while PENDING_REVIEW; shows how long it has waited. */
  pendingSince?: string;
}

/** Indicator badges (not statuses, spec 6.2) plus review/reassignment/manual markers. */
export const OccurrenceFlags = ({ occurrence, indicator, needsReassignment = false, pendingSince }: OccurrenceFlagsProps) => (
  <span className="inline-flex flex-wrap gap-1">
    {pendingSince ? <Badge tone="info">Chờ kiểm tra {Math.max(0, diffDays(toVnDate(pendingSince), todayVn()))} ngày</Badge> : null}
    {indicator === 'OVERDUE' ? <Badge tone="crit">Quá hạn</Badge> : null}
    {indicator === 'UPCOMING' ? <Badge tone="warn">Sắp đến hạn</Badge> : null}
    {indicator === 'LATE_COMPLETION' ? <Badge tone="outline">Hoàn thành trễ</Badge> : null}
    {occurrence.reviewFlag === 'SCHEDULE_CHANGED' ? <Badge tone="warn">Cần rà soát</Badge> : null}
    {needsReassignment ? <Badge tone="crit">Cần phân công lại</Badge> : null}
    {occurrence.occurrenceKind === 'MANUAL' ? <Badge tone="accent">Lượt bù</Badge> : null}
  </span>
);
