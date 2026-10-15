import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { MaintenanceOccurrence } from '@/domain/types';
import { formatDate } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

interface DashboardScheduleCardProps {
  upcoming: MaintenanceOccurrence[];
  overdue: MaintenanceOccurrence[];
  itemName: (id?: string) => string;
}

const dayParts = (date: string): { day: string; month: string } => {
  const [year, month, day] = date.split('-');
  return { day: day ?? '—', month: year && month ? `Tháng ${month}` : 'Lịch' };
};

/** Upcoming maintenance list with a compact calendar treatment. */
export const DashboardScheduleCard = ({ upcoming, overdue, itemName }: DashboardScheduleCardProps) => {
  const rows = [...overdue, ...upcoming].slice(0, 4);
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Lịch bảo trì sắp tới"
        actions={<Link to="/maintenance/schedule" className="text-sm font-semibold text-accent hover:underline">Xem tất cả <ArrowUpRight className="inline size-4" aria-hidden /></Link>}
      />
      <CardBody className="pt-0">
        {rows.length === 0 ? <EmptyState title="Chưa có lịch bảo trì" /> : <ul className="space-y-2">
          {rows.map((occurrence) => {
            const date = dayParts(occurrence.scheduledDate);
            const isOverdue = overdue.some((row) => row.id === occurrence.id);
            return (
              <li key={occurrence.id} className="rounded-lg border border-line/80 bg-surface-2/55 px-2.5 transition-colors hover:border-accent/30 hover:bg-surface-2">
                <Link to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)} className="group flex items-center gap-3 py-2.5">
                  <span className={isOverdue ? 'flex w-14 shrink-0 flex-col items-center rounded-lg bg-crit-soft px-1.5 py-1.5 text-crit' : 'flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-3 px-1.5 py-1.5 text-accent'}>
                    <span className="text-[0.625rem] font-semibold leading-3">{date.month}</span>
                    <span className="text-xl font-bold leading-5">{date.day}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink group-hover:text-accent">{itemName(occurrence.itemId)}</span>
                    <span className={isOverdue ? 'mt-0.5 block text-xs font-medium text-crit' : 'mt-0.5 block text-xs text-ink-2'}>{isOverdue ? 'Đã quá hạn' : `Dự kiến ${formatDate(occurrence.scheduledDate)}`}</span>
                  </span>
                  <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>}
      </CardBody>
    </Card>
  );
};
