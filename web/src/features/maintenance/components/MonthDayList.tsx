import type { OccurrenceListItem } from '@/services/maintenance-service';
import { formatDate } from '@/utils/date';
import { OccurrenceTable } from './OccurrenceTable';

interface MonthDayListProps {
  rowsByDate: Map<string, OccurrenceListItem[]>;
  today: string;
}

/** Phone variant of the month calendar: occurrences grouped by day (spec 11.1). */
export const MonthDayList = ({ rowsByDate, today }: MonthDayListProps) => {
  const days = [...rowsByDate.keys()].sort();
  if (days.length === 0) return <p className="text-sm text-ink-2 md:hidden">Không có lượt nào trong tháng.</p>;
  return (
    <div className="space-y-4 md:hidden">
      {days.map((day) => (
        <section key={day}>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            {formatDate(day)}
            {day === today ? <span className="ml-2 text-xs font-normal text-accent">Hôm nay</span> : null}
          </h3>
          <OccurrenceTable rows={rowsByDate.get(day) ?? []} />
        </section>
      ))}
    </div>
  );
};
