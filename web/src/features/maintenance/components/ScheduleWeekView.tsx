import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import type { OccurrenceStatus } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { listOccurrences } from '@/services/maintenance-service';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { addDays } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';
import { mondayOf, WEEKDAY_LABELS, weekRangeLabel } from '@/utils/week';
import type { ScheduleFilterValues } from './ScheduleFilters';
import { MaintenanceLocationTrail } from './MaintenanceLocationTrail';

interface ScheduleWeekViewProps {
  filters: ScheduleFilterValues;
  weekStart: IsoDate;
  today: IsoDate;
  onWeekChange: (weekStart: IsoDate) => void;
}

const PAGE_SIZE = 1000;

const EVENT_STYLES: Record<OccurrenceStatus, string> = {
  SCHEDULED: 'border-accent/25 bg-accent-soft/75 text-ink',
  IN_PROGRESS: 'border-accent/35 bg-accent-soft text-accent',
  PENDING_REVIEW: 'border-warn/25 bg-warn-soft text-ink',
  REWORK: 'border-warn/25 bg-warn-soft text-ink',
  COMPLETED: 'border-good/25 bg-good-soft text-ink',
  CANCELLED: 'border-line bg-surface-2 text-ink-3 line-through',
};

const groupByDate = (rows: OccurrenceListItem[]): Map<string, OccurrenceListItem[]> => {
  const map = new Map<string, OccurrenceListItem[]>();
  rows.forEach((row) => map.set(row.occurrence.scheduledDate, [...(map.get(row.occurrence.scheduledDate) ?? []), row]));
  return map;
};

/** Weekly work calendar for date-based maintenance occurrences. */
export const ScheduleWeekView = ({ filters, weekStart, today, onWeekChange }: ScheduleWeekViewProps) => {
  const { data, itemName, userName } = useReferenceData();
  const weekEnd = addDays(weekStart, 6);
  const query = useServiceQuery(['maintenance', 'occurrences', 'week', filters, weekStart], () =>
    listOccurrences({ ...filters, dateFrom: weekStart, dateTo: weekEnd, page: 1, pageSize: PAGE_SIZE }),
  );
  const rowsByDate = groupByDate(query.data?.items ?? []);
  const days = WEEKDAY_LABELS.map((_, index) => addDays(weekStart, index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onWeekChange(mondayOf(today))}>Hôm nay</Button>
          <Button variant="secondary" size="icon-sm" aria-label="Tuần trước" onClick={() => onWeekChange(addDays(weekStart, -7))}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon-sm" aria-label="Tuần sau" onClick={() => onWeekChange(addDays(weekStart, 7))}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="text-base font-bold tracking-[-0.02em] text-ink">{weekRangeLabel(weekStart, weekEnd)}</div>
        <p className="text-xs text-ink-3">{query.data?.total ?? 0} lịch trong tuần</p>
      </div>

      {query.isLoading ? <LoadingState rows={4} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <div className="grid min-w-[980px] grid-cols-[72px_repeat(7,minmax(0,1fr))]">
            <div className="border-b border-r border-line bg-surface-2 px-3 py-3 text-xs font-semibold text-ink-2">Ngày</div>
            {days.map((day, index) => {
              const isToday = day === today;
              return (
                <div key={day} className={cn('border-b border-r border-line bg-surface-2 px-2 py-2.5 text-center last:border-r-0', isToday && 'bg-accent-soft/70')}>
                  <p className={cn('text-[0.7rem] font-semibold uppercase tracking-[0.08em]', isToday ? 'text-accent' : 'text-ink-2')}>{WEEKDAY_LABELS[index]}</p>
                  <span className={cn('mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-bold', isToday ? 'bg-accent text-accent-fg' : 'text-ink')}>
                    {Number(day.slice(8))}
                  </span>
                </div>
              );
            })}

            <div className="min-h-[430px] border-r border-line bg-surface-2/55 px-2 py-3 text-center text-[0.7rem] font-semibold text-ink-3">Cả ngày</div>
            {days.map((day) => {
              const rows = rowsByDate.get(day) ?? [];
              return (
                <div key={day} className="min-h-[430px] border-r border-line bg-surface/70 p-2 last:border-r-0">
                  <div className="space-y-2">
                    {rows.map(({ occurrence, indicator }) => (
                      <Link
                        key={occurrence.id}
                        to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)}
                        className={cn('block rounded-lg border-l-[3px] p-2.5 shadow-sm transition hover:-translate-y-px hover:shadow-md', EVENT_STYLES[occurrence.status], indicator === 'OVERDUE' && 'border-l-crit', indicator === 'UPCOMING' && 'border-l-warn')}
                      >
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] opacity-70">{occurrence.occurrenceKind === 'MANUAL' ? 'Lịch hẹn' : 'Bảo trì'}</span>
                        <p className="mt-1 line-clamp-2 text-xs font-bold leading-4">{itemName(occurrence.itemId)}</p>
                        <MaintenanceLocationTrail data={data} buildingId={occurrence.buildingId} itemId={occurrence.itemId} compact />
                        <p className="mt-1 truncate text-[0.68rem] text-ink-2">KT: {userName(occurrence.confirmationUserId)}</p>
                        <p className="mt-1 text-[0.65rem] font-medium text-ink-3">{occurrence.code}</p>
                      </Link>
                    ))}
                    {rows.length === 0 ? <div className="h-24 rounded-lg border border-dashed border-line-2 bg-surface/50" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
