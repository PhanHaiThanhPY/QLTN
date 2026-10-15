import type { MaintenanceOccurrence } from '@/domain/types';
import { formatDate } from '@/utils/date';

/** Scheduled date, plus the original period date when the occurrence was rescheduled. */
export const OccurrenceDate = ({ occurrence }: { occurrence: MaintenanceOccurrence }) => {
  const isMoved = Boolean(occurrence.originalScheduledDate) && occurrence.originalScheduledDate !== occurrence.scheduledDate;
  return (
    <span className="inline-flex flex-col">
      <span>{formatDate(occurrence.scheduledDate)}</span>
      {isMoved ? <span className="text-xs text-ink-2">Ngày gốc {formatDate(occurrence.originalScheduledDate)}</span> : null}
    </span>
  );
};
