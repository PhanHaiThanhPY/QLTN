import { Badge } from '@/components/ui/badge';
import type { ApiOccurrence } from '@/services/maintenance-plans-api';
import { ddmm } from './plan-api-ui';

/** Flags and the cancel reason of an occurrence, always as text (ui-brief §1). */
export const OccurrenceApiNote = ({ occurrence }: { occurrence: ApiOccurrence }) => {
  const moved = occurrence.periodDate && occurrence.periodDate !== occurrence.scheduledDate ? occurrence.periodDate : null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {occurrence.scheduleChanged ? <Badge tone="warn">Lịch đã đổi</Badge> : null}
      {occurrence.isMakeup ? <Badge tone="info">Lượt bù</Badge> : null}
      {moved ? <Badge tone="neutral">Đã đổi lịch từ {ddmm(moved)}</Badge> : null}
      {occurrence.cancelReason ? <span className="text-xs text-ink-2">{occurrence.cancelReason}</span> : null}
    </div>
  );
};
