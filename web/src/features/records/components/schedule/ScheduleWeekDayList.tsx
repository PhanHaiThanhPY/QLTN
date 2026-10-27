import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ScheduleEntry } from '@/services/schedule-service';
import { ScheduleFlags } from './ScheduleFlags';
import { entriesOnDay, entryLabel, entryTone, recordTitle, shortDate, WEEKDAY_NAMES } from './repair-schedule-ui';

interface ScheduleWeekDayListProps {
  entries: readonly ScheduleEntry[];
  days: readonly IsoDate[];
  today: IsoDate;
}

/** Phone layout of the week (< 768px): Monday to Sunday, each day with the records present that day (ui-brief §3). */
export const ScheduleWeekDayList = ({ entries, days, today }: ScheduleWeekDayListProps) => (
  <ol className="space-y-2 md:hidden">
    {days.map((day, index) => {
      const rows = entriesOnDay(entries, day);
      return (
        <li key={day} className="rounded-lg border border-line p-3" aria-current={day === today ? 'date' : undefined}>
          <p className={cn('mb-2 text-xs font-bold uppercase tracking-[0.08em]', day === today ? 'text-accent' : 'text-ink-2')}>
            {WEEKDAY_NAMES[index]} {shortDate(day)}
          </p>
          {rows.length === 0 ? <p className="text-sm text-ink-3">Không có việc</p> : null}
          <div className="space-y-2">
            {rows.map((entry) => (
              <Link
                key={entry.record.id}
                to={`/records/${entry.record.id}`}
                aria-label={entryLabel(entry)}
                className={cn('block rounded-md border-l-[3px] px-2.5 py-2', entryTone(entry))}
              >
                <p className="text-xs font-bold">{entry.record.code} · {recordTitle(entry)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <RepairStatusBadge status={entry.record.status} />
                  <ScheduleFlags entry={entry} />
                </div>
              </Link>
            ))}
          </div>
        </li>
      );
    })}
  </ol>
);
