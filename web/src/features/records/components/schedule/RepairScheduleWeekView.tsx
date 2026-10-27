import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ScheduleEntry, ScheduleFilters } from '@/services/schedule-service';
import { ScheduleFlags } from './ScheduleFlags';
import { ScheduleGridNotices } from './ScheduleGridNotices';
import { ScheduleLoadState } from './ScheduleLoadState';
import { ScheduleWeekDayList } from './ScheduleWeekDayList';
import { useScheduleRange } from './useScheduleRange';
import {
  addDays,
  daysFrom,
  EMPTY_SCHEDULE_HINT,
  entryLabel,
  entryTone,
  isOnDay,
  mondayOf,
  recordTitle,
  shortDate,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  weekRangeLabel,
} from './repair-schedule-ui';

interface RepairScheduleWeekViewProps {
  filters: ScheduleFilters;
  weekStart: IsoDate;
  today: IsoDate;
  onWeekChange: (weekStart: IsoDate) => void;
}

interface WeekCellProps {
  entry: ScheduleEntry;
  day: IsoDate;
  weekStart: IsoDate;
  weekEnd: IsoDate;
}

/**
 * One day of an entry. The first day it shows in the week carries the full card and is the only Tab stop; later days
 * repeat the code on the same background and stay out of the Tab order and the accessibility tree (ui-brief §2.3, §4).
 */
const WeekCell = ({ entry, day, weekStart, weekEnd }: WeekCellProps) => {
  if (!isOnDay(entry, day)) return <div className="border-r border-line p-1 last:border-r-0" />;
  const isFirst = day === (entry.span.start > weekStart ? entry.span.start : weekStart);
  const fromEarlier = isFirst && entry.span.start < weekStart;
  const goesOn = day === weekEnd && entry.span.end > weekEnd;
  const ends = day === entry.span.end;
  return (
    <div className="border-r border-line p-1 last:border-r-0">
      <Link
        to={`/records/${entry.record.id}`}
        aria-label={isFirst ? entryLabel(entry) : undefined}
        aria-hidden={isFirst ? undefined : true}
        tabIndex={isFirst ? undefined : -1}
        className={cn('block h-full rounded-md border-l-[3px] px-2 py-1.5 shadow-sm transition hover:shadow-md', entryTone(entry))}
      >
        <span className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] opacity-80">
          {fromEarlier ? <span aria-hidden>◂</span> : null}
          {entry.record.code}
          {ends && !isFirst ? <span aria-hidden>▸</span> : null}
          {goesOn ? <span aria-hidden>…</span> : null}
        </span>
        {isFirst ? (
          <>
            <p className="mt-1 line-clamp-2 text-xs font-bold leading-4">{recordTitle(entry)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <RepairStatusBadge status={entry.record.status} />
              <ScheduleFlags entry={entry} />
            </div>
          </>
        ) : null}
      </Link>
    </div>
  );
};

/** Weekly construction calendar: every record on one row, present on each day of its span (B4-S1 BR-B4-01, BR-B4-02). */
export const RepairScheduleWeekView = ({ filters, weekStart, today, onWeekChange }: RepairScheduleWeekViewProps) => {
  const weekEnd = addDays(weekStart, 6);
  const query = useScheduleRange(filters, weekStart, weekEnd);
  const entries = query.data?.items ?? [];
  const days = daysFrom(weekStart, 7);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onWeekChange(mondayOf(today))}>Hôm nay</Button>
          <Button variant="secondary" size="icon-sm" aria-label="Tuần trước" onClick={() => onWeekChange(addDays(weekStart, -7))}><ChevronLeft className="size-4" aria-hidden /></Button>
          <Button variant="secondary" size="icon-sm" aria-label="Tuần sau" onClick={() => onWeekChange(addDays(weekStart, 7))}><ChevronRight className="size-4" aria-hidden /></Button>
        </div>
        <div className="text-base font-bold tracking-[-0.02em] text-ink">{weekRangeLabel(weekStart, weekEnd)}</div>
        <p className="text-xs text-ink-3">{entries.length} hồ sơ trong tuần</p>
      </div>

      <ScheduleLoadState isLoading={query.isLoading} error={query.error} hasData={Boolean(query.data)} rows={4} onRetry={() => void query.refetch()} />
      {query.data ? (
        <>
          <ScheduleGridNotices shown={entries.length} total={query.data.total} />
          <div className="hidden overflow-x-auto rounded-xl border border-line md:block" data-testid="week-grid">
            <div className="grid min-w-[980px] grid-cols-[72px_repeat(7,minmax(0,1fr))]">
              <div className="border-b border-r border-line bg-surface-2 px-3 py-3 text-xs font-semibold text-ink-2">Ngày</div>
              {days.map((day, index) => {
                const isToday = day === today;
                return (
                  <div
                    key={day}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn('border-b border-r border-line bg-surface-2 px-2 py-2.5 text-center last:border-r-0', isToday && 'bg-accent-soft/70')}
                  >
                    <p className={cn('text-[0.7rem] font-semibold uppercase tracking-[0.08em]', isToday ? 'text-accent' : 'text-ink-2')}>
                      <abbr title={`${WEEKDAY_NAMES[index]} ${shortDate(day)}`} className="no-underline">{WEEKDAY_LABELS[index]}</abbr>
                    </p>
                    <span className={cn('mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-bold', isToday ? 'bg-accent text-accent-fg' : 'text-ink')}>
                      {Number(day.slice(8))}
                    </span>
                  </div>
                );
              })}
              <div
                className="border-r border-line bg-surface-2/55 px-2 py-3 text-center text-[0.7rem] font-semibold text-ink-3"
                style={{ gridColumn: 1, gridRow: `2 / span ${Math.max(entries.length, 1)}` }}
              >
                Cả ngày
              </div>
              {entries.map((entry) =>
                days.map((day) => <WeekCell key={`${entry.record.id}-${day}`} entry={entry} day={day} weekStart={weekStart} weekEnd={weekEnd} />),
              )}
              {entries.length === 0
                ? days.map((day) => (
                    <div key={day} className="h-24 border-r border-line p-2 last:border-r-0">
                      <div className="h-full rounded-lg border border-dashed border-line-2 bg-surface/50" />
                    </div>
                  ))
                : null}
            </div>
          </div>
          <ScheduleWeekDayList entries={entries} days={days} today={today} />
          {entries.length === 0 ? <p className="text-sm text-ink-3">{EMPTY_SCHEDULE_HINT}</p> : null}
        </>
      ) : null}
    </div>
  );
};
