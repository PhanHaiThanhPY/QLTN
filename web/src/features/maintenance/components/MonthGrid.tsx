import { cn } from '@/lib/cn';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { addDays } from '@/utils/date';
import { WEEKDAY_LABELS } from '@/utils/week';
import { monthRange } from '../utils/maintenance-ui';
import { CalendarChip } from './CalendarChip';
import { MaintenanceLocationTrail } from './MaintenanceLocationTrail';

interface MonthGridProps {
  month: string;
  rowsByDate: Map<string, OccurrenceListItem[]>;
  today: string;
}

/** Desktop month grid (Monday first); phones use MonthDayList instead. */
export const MonthGrid = ({ month, rowsByDate, today }: MonthGridProps) => {
  const { data, itemName } = useReferenceData();
  const { from, to } = monthRange(month);
  const [year, monthNo] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay() + 6) % 7;
  const start = addDays(from, -offset);
  const totalCells = Math.ceil((offset + Number(to.slice(8))) / 7) * 7;
  const days = Array.from({ length: totalCells }, (_, index) => addDays(start, index));
  return (
    <div className="hidden overflow-hidden rounded-lg border border-line md:block">
      <div className="-mb-px -mr-px grid grid-cols-7 text-xs font-semibold text-ink-2">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-b border-r border-line bg-surface-2 px-2 py-1.5">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = day >= from && day <= to;
          const rows = rowsByDate.get(day) ?? [];
          return (
            <div key={day} className={cn('min-h-24 border-b border-r border-line p-1.5 font-normal', !inMonth && 'bg-surface-2')}>
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
                  <CalendarChip
                    key={row.occurrence.id}
                    row={row}
                    itemLabel={itemName(row.occurrence.itemId)}
                    locationLabel={<MaintenanceLocationTrail data={data} buildingId={row.occurrence.buildingId} itemId={row.occurrence.itemId} compact />}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
