import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { MaintenanceLocationTrail } from '@/features/maintenance/components/MaintenanceLocationTrail';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listRepairSchedule } from '@/services/records-service';
import type { RepairScheduleFilters, RepairScheduleListItem } from '@/services/records-service';
import { cn } from '@/lib/cn';
import { addDays, monthLabel, monthRange, shiftMonth, groupByDate, WEEKDAY_LABELS } from './repair-schedule-ui';

interface RepairScheduleMonthViewProps {
  filters: RepairScheduleFilters;
  month: string;
  today: string;
  onMonthChange: (month: string) => void;
}

const PAGE_SIZE = 1000;

const eventStyle = (row: RepairScheduleListItem): string => {
  if (row.isOverdue) return 'border-crit/25 bg-crit-soft text-ink';
  if (row.record.status === 'COMPLETED') return 'border-good/25 bg-good-soft text-ink';
  return 'border-accent/25 bg-accent-soft text-ink';
};

/** Monthly repair calendar using the same location trail as maintenance. */
export const RepairScheduleMonthView = ({ filters, month, today, onMonthChange }: RepairScheduleMonthViewProps) => {
  const { data } = useReferenceData();
  const range = monthRange(month);
  const query = useServiceQuery(['repair-schedule', 'month', filters, month], () =>
    listRepairSchedule({ ...filters, dateFrom: range.from, dateTo: range.to, page: 1, pageSize: PAGE_SIZE }),
  );
  const rowsByDate = groupByDate(query.data?.items ?? []);
  const [year, monthNo] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay() + 6) % 7;
  const start = addDays(range.from, -offset);
  const totalCells = Math.ceil((offset + Number(range.to.slice(8))) / 7) * 7;
  const days = Array.from({ length: totalCells }, (_, index) => addDays(start, index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label="Tháng trước" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft className="size-4" aria-hidden /></Button>
          <span className="min-w-32 text-center font-semibold text-ink">{monthLabel(month)}</span>
          <Button variant="secondary" size="icon" aria-label="Tháng sau" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight className="size-4" aria-hidden /></Button>
        </div>
        <div className="flex items-center gap-3"><span className="text-sm text-ink-2">{query.data?.total ?? 0} lịch sửa chữa</span><Button variant="ghost" size="sm" onClick={() => onMonthChange(today.slice(0, 7))}>Tháng này</Button></div>
      </div>
      {query.isLoading ? <LoadingState rows={3} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-line md:block">
            <div className="-mb-px -mr-px grid grid-cols-7 text-xs font-semibold text-ink-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="border-b border-r border-line bg-surface-2 px-2 py-1.5">{label}</div>
              ))}
              {days.map((day) => {
                const inMonth = day >= range.from && day <= range.to;
                const rows = rowsByDate.get(day) ?? [];
                return (
                  <div key={day} className={cn('min-h-28 border-b border-r border-line p-1.5 font-normal', !inMonth && 'bg-surface-2')}>
                    <div
                      className={cn(
                        'mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        inMonth ? 'text-ink' : 'text-ink-3',
                        day === today && 'bg-accent text-accent-fg',
                      )}
                    >
                      {Number(day.slice(8))}
                    </div>
                    <div className="space-y-1">
                      {rows.map((row) => (
                        <Link
                          key={row.record.id}
                          to={`/records/${row.record.id}`}
                          className={cn('block rounded-md border-l-2 px-2 py-1.5 text-[0.68rem] transition hover:shadow-sm', eventStyle(row))}
                        >
                          <p className="truncate font-bold">{row.record.code} · {row.record.title || 'Chưa đặt tên'}</p>
                          <MaintenanceLocationTrail data={data} buildingId={row.record.buildingId} locationId={row.record.locationId} compact />
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-2 md:hidden">{days.filter((day) => day >= range.from && day <= range.to).map((day) => { const rows = rowsByDate.get(day) ?? []; if (rows.length === 0) return null; return <div key={day} className="rounded-lg border border-line p-3"><p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-accent">{day}</p><div className="space-y-2">{rows.map((row) => <Link key={row.record.id} to={`/records/${row.record.id}`} className={cn('block rounded-md border-l-2 px-2.5 py-2', eventStyle(row))}><p className="text-xs font-bold">{row.record.code} · {row.record.title || 'Chưa đặt tên'}</p><MaintenanceLocationTrail data={data} buildingId={row.record.buildingId} locationId={row.record.locationId} compact /></Link>)}</div></div>;})}</div>
        </>
      ) : null}
    </div>
  );
};
