import { Link } from 'react-router';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ItemListRow } from '@/services/maintenance-service';
import { formatDate } from '@/utils/date';
import { occurrenceDue } from '../../utils/item-insights';
import type { DueTone } from '../../utils/item-insights';

interface NextMaintenanceCellProps {
  row: ItemListRow;
  today: IsoDate;
}

const DUE_CLASS = { crit: 'font-semibold text-crit', warn: 'text-warn', muted: 'text-ink-2' } as const satisfies Record<DueTone, string>;

/** Next maintenance visit with how far away (or overdue) it is. */
export const NextMaintenanceCell = ({ row, today }: NextMaintenanceCellProps) => {
  const next = row.nextOccurrence;
  if (!next) {
    return (
      <span className="text-xs text-ink-3">
        Chưa có lịch{row.lastCompletedDate ? ` · gần nhất ${formatDate(row.lastCompletedDate)}` : ''}
      </span>
    );
  }
  const due = occurrenceDue(next, today);
  return (
    <span className="block">
      <Link to={`/maintenance/occurrences/${next.id}`} className="tnum font-medium text-ink hover:text-accent hover:underline">
        {formatDate(next.scheduledDate)}
      </Link>
      <span className={cn('block text-xs', DUE_CLASS[due.tone])}>
        {due.text} · {next.code}
        {row.overdueCount > 1 ? ` (+${row.overdueCount - 1} lượt quá hạn)` : ''}
      </span>
    </span>
  );
};
