import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { MaintenanceOccurrence } from '@/domain/types';
import { formatDate } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

interface MaintenanceAttentionCardProps {
  overdue: MaintenanceOccurrence[];
  upcoming: MaintenanceOccurrence[];
  itemName: (id?: string) => string;
}

/** Combines overdue and upcoming maintenance into one priority list. */
export const MaintenanceAttentionCard = ({ overdue, upcoming, itemName }: MaintenanceAttentionCardProps) => {
  const rows = [
    ...overdue.map((occurrence) => ({ occurrence, isOverdue: true })),
    ...upcoming.map((occurrence) => ({ occurrence, isOverdue: false })),
  ].slice(0, 5);

  return (
    <Card>
      <CardHeader title="Bảo trì cần chú ý" description="Ưu tiên theo mức độ và ngày dự kiến" actions={<Link to="/maintenance/schedule" className="text-sm font-semibold text-accent hover:underline">Mở lịch</Link>} />
      <CardBody>
        {rows.length === 0 ? <EmptyState title="Không có lượt bảo trì cần chú ý" /> : <ul className="divide-y divide-line">
          {rows.map(({ occurrence, isOverdue }) => (
            <li key={occurrence.id}>
              <Link to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)} className="flex items-center gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-surface-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isOverdue ? 'bg-crit-soft text-crit' : 'bg-warn-soft text-warn'}`}><CalendarClock className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{occurrence.code} · {itemName(occurrence.itemId)}</span><span className={isOverdue ? 'mt-1 block text-xs font-medium text-crit' : 'mt-1 block text-xs text-ink-2'}>Dự kiến: {formatDate(occurrence.scheduledDate)}</span></span>
                <OccurrenceStatusBadge status={occurrence.status} />
              </Link>
            </li>
          ))}
        </ul>}
      </CardBody>
    </Card>
  );
};
