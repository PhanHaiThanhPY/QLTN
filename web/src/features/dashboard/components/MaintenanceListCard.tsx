import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { MaintenanceOccurrence } from '@/domain/types';
import { formatDate } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

const MAX_ROWS = 6;

interface MaintenanceListCardProps {
  title: string;
  description?: string;
  emptyTitle: string;
  occurrences: MaintenanceOccurrence[];
  itemName: (id?: string) => string;
  isOverdue?: boolean;
  /** Filtered schedule list behind the "Mở lịch" link. */
  linkTo?: string;
}

/** Upcoming or overdue maintenance occurrences (spec 6.2 indicators). */
export const MaintenanceListCard = ({ title, description, emptyTitle, occurrences, itemName, isOverdue = false, linkTo = '/maintenance/schedule' }: MaintenanceListCardProps) => (
  <Card>
    <CardHeader
      title={title}
      description={occurrences.length > MAX_ROWS ? `${description ?? ''} Hiển thị ${MAX_ROWS}/${occurrences.length} lượt.`.trim() : description}
      actions={
        <Link to={linkTo} className="text-sm font-medium text-accent hover:underline">
          Mở lịch
        </Link>
      }
    />
    <CardBody>
      {occurrences.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <ul className="divide-y divide-line">
          {occurrences.slice(0, MAX_ROWS).map((occurrence) => (
            <li key={occurrence.id}>
              <Link
                to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)}
                className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2.5 hover:bg-surface-2"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{occurrence.code}</span>
                  <OccurrenceStatusBadge status={occurrence.status} />
                </span>
                <span className="truncate text-sm text-ink">{itemName(occurrence.itemId)}</span>
                <span className={isOverdue ? 'text-xs font-medium text-crit' : 'text-xs text-ink-2'}>
                  Ngày dự kiến: {formatDate(occurrence.scheduledDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CardBody>
  </Card>
);
