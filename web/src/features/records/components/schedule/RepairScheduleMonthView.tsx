import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ScheduleEntry, ScheduleFilters } from '@/services/schedule-service';
import { ScheduleDayDialog } from './ScheduleDayDialog';
import { ScheduleGridNotices } from './ScheduleGridNotices';
import { ScheduleLoadState } from './ScheduleLoadState';
import { useScheduleRange } from './useScheduleRange';
import {
  addDays,
  daysFrom,
  EMPTY_SCHEDULE_HINT,
  entriesOnDay,
  entryLabel,
  entryTone,
  monthLabel,
  monthRange,
  recordTitle,
  shiftMonth,
  shortDate,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from './repair-schedule-ui';

interface RepairScheduleMonthViewProps {
  filters: ScheduleFilters;
  month: string;
  today: IsoDate;
  onMonthChange: (month: string) => void;
}

/** Lines a day cell lists before "+n" (ui-brief §2.4). */
const LINES_PER_DAY = 3;

/** An entry is a Tab stop on its first day in each grid week, so one record is reached once per week row. */
const isTabStop = (entry: ScheduleEntry, day: IsoDate, gridStart: IsoDate, index: number): boolean =>
  day === entry.span.start || index % 7 === 0 || day === gridStart;

const MonthLine = ({ entry, focusable }: { entry: ScheduleEntry; focusable: boolean }) => (
  <Link
    to={`/records/${entry.record.id}`}
    aria-label={focusable ? entryLabel(entry) : undefined}
    aria-hidden={focusable ? undefined : true}
    tabIndex={focusable ? undefined : -1}
    className={cn('block truncate rounded-md border-l-2 px-2 py-1 text-[0.68rem] font-bold transition hover:shadow-sm', entryTone(entry))}
  >
    {entry.record.code} · {recordTitle(entry)}
  </Link>
);

/** Monthly construction calendar: each day lists the records present that day (B4-S1 BR-B4-01, BR-B4-06). */
export const RepairScheduleMonthView = ({ filters, month, today, onMonthChange }: RepairScheduleMonthViewProps) => {
  const range = monthRange(month);
  const query = useScheduleRange(filters, range.from, range.to);
  const [openDay, setOpenDay] = useState<IsoDate | null>(null);
  const entries = query.data?.items ?? [];
  const [year, monthNo] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay() + 6) % 7;
  const gridStart = addDays(range.from, -offset);
  const days = daysFrom(gridStart, Math.ceil((offset + Number(range.to.slice(8))) / 7) * 7);
  const monthDays = days.filter((day) => day >= range.from && day <= range.to);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label="Tháng trước" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft className="size-4" aria-hidden /></Button>
          <span className="min-w-32 text-center font-semibold text-ink">{monthLabel(month)}</span>
          <Button variant="secondary" size="icon" aria-label="Tháng sau" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight className="size-4" aria-hidden /></Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-2">{entries.length} hồ sơ trong tháng</span>
          <Button variant="ghost" size="sm" onClick={() => onMonthChange(today.slice(0, 7))}>Tháng này</Button>
        </div>
      </div>
      <ScheduleLoadState isLoading={query.isLoading} error={query.error} hasData={Boolean(query.data)} rows={3} onRetry={() => void query.refetch()} />
      {query.data ? (
        <>
          <ScheduleGridNotices shown={entries.length} total={query.data.total} />
          <div className="hidden overflow-hidden rounded-lg border border-line md:block" data-testid="month-grid">
            <div className="-mb-px -mr-px grid grid-cols-7 text-xs font-semibold text-ink-2">
              {WEEKDAY_LABELS.map((label, index) => (
                <div key={label} className="border-b border-r border-line bg-surface-2 px-2 py-1.5">
                  <abbr title={WEEKDAY_NAMES[index]} className="no-underline">{label}</abbr>
                </div>
              ))}
              {days.map((day, index) => {
                const inMonth = day >= range.from && day <= range.to;
                const rows = entriesOnDay(entries, day);
                const hidden = rows.length - LINES_PER_DAY;
                return (
                  <div key={day} className={cn('min-h-28 border-b border-r border-line p-1.5 font-normal', !inMonth && 'bg-surface-2')}>
                    <div
                      aria-current={day === today ? 'date' : undefined}
                      className={cn(
                        'mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        inMonth ? 'text-ink' : 'text-ink-3',
                        day === today && 'bg-accent text-accent-fg',
                      )}
                    >
                      {Number(day.slice(8))}
                    </div>
                    <div className="space-y-1">
                      {rows.slice(0, LINES_PER_DAY).map((entry) => (
                        <MonthLine key={entry.record.id} entry={entry} focusable={isTabStop(entry, day, gridStart, index)} />
                      ))}
                      {hidden > 0 ? (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[0.68rem]" aria-label={`Xem thêm ${hidden} hồ sơ ngày ${shortDate(day)}`} onClick={() => setOpenDay(day)}>
                          +{hidden}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-2 md:hidden">
            {monthDays.map((day) => {
              const rows = entriesOnDay(entries, day);
              if (rows.length === 0) return null;
              const weekday = WEEKDAY_LABELS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7];
              return (
                <div key={day} className="rounded-lg border border-line p-3">
                  <p className={cn('mb-2 text-xs font-bold uppercase tracking-[0.08em]', day === today ? 'text-accent' : 'text-ink-2')}>{weekday} {shortDate(day)}</p>
                  <div className="space-y-2">{rows.map((entry) => <MonthLine key={entry.record.id} entry={entry} focusable />)}</div>
                </div>
              );
            })}
          </div>
          {entries.length === 0 ? <p className="text-sm text-ink-3">{EMPTY_SCHEDULE_HINT}</p> : null}
          <ScheduleDayDialog day={openDay} entries={openDay ? entriesOnDay(entries, openDay) : []} onClose={() => setOpenDay(null)} />
        </>
      ) : null}
    </div>
  );
};
