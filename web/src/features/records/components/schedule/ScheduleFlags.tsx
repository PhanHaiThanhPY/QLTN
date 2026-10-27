import { Badge } from '@/components/ui/badge';
import type { ScheduleEntry } from '@/services/schedule-service';

/** "Trễ thi công" (BR-B4-04, never the step "Quá hạn") and "Khẩn cấp" of a calendar entry (ui-brief §1). */
export const ScheduleFlags = ({ entry }: { entry: ScheduleEntry }) => {
  if (!entry.isLate && !entry.record.emergency) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {entry.record.emergency ? <Badge tone="crit">Khẩn cấp</Badge> : null}
      {entry.isLate ? <Badge tone="crit">Trễ thi công</Badge> : null}
    </span>
  );
};
