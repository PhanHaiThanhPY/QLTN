import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { OCCURRENCE_STATUS_LABEL } from '@/domain/constants';
import type { OccurrenceStatus } from '@/domain/constants';
import { cn } from '@/lib/cn';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { subjectPath } from '@/utils/subject-link';

const STATUS_CHIP: Record<OccurrenceStatus, string> = {
  SCHEDULED: 'bg-surface-3 text-ink-2',
  IN_PROGRESS: 'bg-accent-soft text-accent',
  PENDING_REVIEW: 'bg-warn-soft text-warn',
  REWORK: 'bg-warn-soft text-warn',
  COMPLETED: 'bg-good-soft text-good',
  CANCELLED: 'bg-surface-2 text-ink-2 line-through',
};

interface CalendarChipProps {
  row: OccurrenceListItem;
  itemLabel: string;
  locationLabel?: ReactNode;
}

/** Compact occurrence chip inside a calendar day. */
export const CalendarChip = ({ row, itemLabel, locationLabel }: CalendarChipProps) => {
  const { occurrence, indicator } = row;
  return (
    <Link
      to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)}
      title={`${occurrence.code} · ${itemLabel} · ${OCCURRENCE_STATUS_LABEL[occurrence.status]}`}
      className={cn(
        'block truncate rounded px-1.5 py-0.5 text-xs hover:ring-1 hover:ring-accent',
        STATUS_CHIP[occurrence.status],
        indicator === 'OVERDUE' && 'ring-1 ring-crit',
        indicator === 'UPCOMING' && 'ring-1 ring-warn',
      )}
    >
      <span className="font-medium">{occurrence.code}</span> {itemLabel}
      {locationLabel ? <span className="mt-0.5 block truncate text-[0.62rem] opacity-75">{locationLabel}</span> : null}
    </Link>
  );
};
