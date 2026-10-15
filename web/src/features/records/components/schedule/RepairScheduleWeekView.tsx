import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import type { IsoDate } from '@/domain/types';
import { MaintenanceLocationTrail } from '@/features/maintenance/components/MaintenanceLocationTrail';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listRepairSchedule } from '@/services/records-service';
import type { RepairScheduleFilters, RepairScheduleListItem } from '@/services/records-service';
import { cn } from '@/lib/cn';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { addDays, groupByDate, mondayOf, weekRangeLabel, WEEKDAY_LABELS } from './repair-schedule-ui';

interface RepairScheduleWeekViewProps {
  filters: RepairScheduleFilters;
  weekStart: IsoDate;
  today: IsoDate;
  onWeekChange: (weekStart: IsoDate) => void;
}

const PAGE_SIZE = 1000;

const eventStyle = (row: RepairScheduleListItem): string => {
  if (row.isOverdue) return 'border-crit/30 bg-crit-soft text-ink';
  if (row.record.status === 'COMPLETED') return 'border-good/30 bg-good-soft text-ink';
  return 'border-accent/30 bg-accent-soft/70 text-ink';
};

/** Weekly repair calendar using the same location trail as maintenance. */
export const RepairScheduleWeekView = ({ filters, weekStart, today, onWeekChange }: RepairScheduleWeekViewProps) => {
  const { data } = useReferenceData();
  const weekEnd = addDays(weekStart, 6);
  const query = useServiceQuery(['repair-schedule', 'week', filters, weekStart], () =>
    listRepairSchedule({ ...filters, dateFrom: weekStart, dateTo: weekEnd, page: 1, pageSize: PAGE_SIZE }),
  );
  const rowsByDate = groupByDate(query.data?.items ?? []);
  const days = WEEKDAY_LABELS.map((_, index) => addDays(weekStart, index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onWeekChange(mondayOf(today))}>Hôm nay</Button>
          <Button variant="secondary" size="icon-sm" aria-label="Tuần trước" onClick={() => onWeekChange(addDays(weekStart, -7))}><ChevronLeft className="size-4" aria-hidden /></Button>
          <Button variant="secondary" size="icon-sm" aria-label="Tuần sau" onClick={() => onWeekChange(addDays(weekStart, 7))}><ChevronRight className="size-4" aria-hidden /></Button>
        </div>
        <div className="text-base font-bold tracking-[-0.02em] text-ink">{weekRangeLabel(weekStart, weekEnd)}</div>
        <p className="text-xs text-ink-3">{query.data?.total ?? 0} lịch sửa chữa trong tuần</p>
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
                <div
                  key={day}
                  className={cn('border-b border-r border-line bg-surface-2 px-2 py-2.5 text-center last:border-r-0', isToday && 'bg-accent-soft/70')}
                >
                  <p className={cn('text-[0.7rem] font-semibold uppercase tracking-[0.08em]', isToday ? 'text-accent' : 'text-ink-2')}>
                    {WEEKDAY_LABELS[index]}
                  </p>
                  <span
                    className={cn(
                      'mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-bold',
                      isToday ? 'bg-accent text-accent-fg' : 'text-ink',
                    )}
                  >
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
                    {rows.map((row) => (
                      <Link
                        key={row.record.id}
                        to={`/records/${row.record.id}`}
                        className={cn('block rounded-lg border-l-[3px] p-2.5 shadow-sm transition hover:-translate-y-px hover:shadow-md', eventStyle(row))}
                      >
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] opacity-70">{row.record.code}</span>
                        <p className="mt-1 line-clamp-2 text-xs font-bold leading-4">{row.record.title || '(Chưa đặt tên)'}</p>
                        <MaintenanceLocationTrail data={data} buildingId={row.record.buildingId} locationId={row.record.locationId} compact />
                        <div className="mt-1">
                          <RepairStatusBadge status={row.record.status} />
                        </div>
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
