import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listOccurrences } from '@/services/maintenance-service';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { todayVn } from '@/services/runtime';
import { monthLabel, monthRange, shiftMonth } from '../utils/maintenance-ui';
import { MonthDayList } from './MonthDayList';
import { MonthGrid } from './MonthGrid';
import type { ScheduleFilterValues } from './ScheduleFilters';

interface ScheduleCalendarViewProps {
  filters: ScheduleFilterValues;
  month: string;
  onMonthChange: (month: string) => void;
}

const CALENDAR_PAGE_SIZE = 1000;

const groupByDate = (rows: OccurrenceListItem[]): Map<string, OccurrenceListItem[]> => {
  const map = new Map<string, OccurrenceListItem[]>();
  rows.forEach((row) => {
    const list = map.get(row.occurrence.scheduledDate) ?? [];
    list.push(row);
    map.set(row.occurrence.scheduledDate, list);
  });
  return map;
};

/** Month calendar; the date range filter is the visible month. */
export const ScheduleCalendarView = ({ filters, month, onMonthChange }: ScheduleCalendarViewProps) => {
  const range = monthRange(month);
  const today = todayVn();
  const query = useServiceQuery(['maintenance', 'occurrences', 'calendar', filters, month], () =>
    listOccurrences({ ...filters, dateFrom: range.from, dateTo: range.to, page: 1, pageSize: CALENDAR_PAGE_SIZE }),
  );
  const rowsByDate = groupByDate(query.data?.items ?? []);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label="Tháng trước" onClick={() => onMonthChange(shiftMonth(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center font-semibold text-ink">{monthLabel(month)}</span>
          <Button variant="secondary" size="icon" aria-label="Tháng sau" onClick={() => onMonthChange(shiftMonth(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-2">{query.data?.total ?? 0} lượt</span>
          <Button variant="ghost" size="sm" onClick={() => onMonthChange(today.slice(0, 7))}>
            Tháng này
          </Button>
        </div>
      </div>
      {query.isLoading ? <LoadingState rows={3} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <MonthGrid month={month} rowsByDate={rowsByDate} today={today} />
          <MonthDayList rowsByDate={rowsByDate} today={today} />
        </>
      ) : null}
    </div>
  );
};
