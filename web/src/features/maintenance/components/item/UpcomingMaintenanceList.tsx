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

/** Open occurrences in date order with a large date block, easy to scan on site. */
export const UpcomingMaintenanceList = ({ rows, today, userName }: UpcomingMaintenanceListProps) => {
  if (rows.length === 0) return <p className="text-sm text-ink-2">Không có lượt bảo trì nào đang chờ.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ occurrence, indicator }) => {
        const [, month, day] = occurrence.scheduledDate.split('-');
        const isOverdue = indicator === 'OVERDUE';
        return (
          <li key={occurrence.id}>
            <Link to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)} className="flex items-center gap-3 py-2.5 hover:bg-surface-2">
              <span
                className={cn(
                  'flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none',
                  isOverdue ? 'border-crit/30 bg-crit-soft text-crit' : 'border-line bg-surface-2 text-ink',
                )}
                aria-hidden
              >
                <span className="text-base font-bold">{day}</span>
                <span className="mt-0.5 text-[0.625rem] font-semibold uppercase">Th{Number(month)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-semibold text-accent">{occurrence.code}</span>
                <span className="block text-xs text-ink-2">
                  {formatDate(occurrence.scheduledDate)} · KT {userName(occurrence.confirmationUserId)}
                </span>
                <span className={cn('block text-xs font-medium', isOverdue ? 'text-crit' : 'text-ink-2')}>{occurrenceDue(occurrence, today).text}</span>
              </span>
              <OccurrenceStatusBadge status={occurrence.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
