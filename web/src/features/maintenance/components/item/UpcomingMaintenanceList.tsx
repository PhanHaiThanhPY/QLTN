import { Link } from 'react-router';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { formatDate } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';
import { occurrenceDue } from '../../utils/item-insights';

interface UpcomingMaintenanceListProps {
  rows: OccurrenceListItem[];
  today: IsoDate;
  userName: (id?: string) => string;
}

/** Open occurrences in date order with a compact date block and clear due state. */
export const UpcomingMaintenanceList = ({ rows, today, userName }: UpcomingMaintenanceListProps) => {
  if (rows.length === 0) return <p className="text-sm text-ink-2">Không có lượt bảo trì nào đang chờ.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ occurrence, indicator }) => {
        const [, month, day] = occurrence.scheduledDate.split('-');
        const isOverdue = indicator === 'OVERDUE';
        return (
          <li key={occurrence.id}>
            <Link to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)} className="flex items-center gap-2.5 rounded-lg px-1 py-2 hover:bg-surface-2">
              <span
                className={cn(
                  'flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none',
                  isOverdue ? 'border-crit/30 bg-crit-soft text-crit' : 'border-line bg-surface-2 text-ink',
                )}
                aria-hidden
              >
                <span className="text-sm font-bold">{day}</span>
                <span className="mt-0.5 text-[0.625rem] font-semibold uppercase">Th{Number(month)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-semibold text-accent">{occurrence.code}</span>
                  <span className={cn('truncate text-[0.6875rem] font-medium', isOverdue ? 'text-crit' : 'text-ink-3')}>{occurrenceDue(occurrence, today).text}</span>
                </span>
                <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-2">
                  {formatDate(occurrence.scheduledDate)} · KT {userName(occurrence.confirmationUserId)}
                </span>
              </span>
              <span className="shrink-0 text-[0.625rem]"><OccurrenceStatusBadge status={occurrence.status} /></span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
