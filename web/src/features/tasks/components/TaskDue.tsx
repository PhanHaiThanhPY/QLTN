import { Badge } from '@/components/ui/badge';
import type { IsoDate } from '@/domain/types';
import type { MyTaskRow } from '@/services/my-tasks-service';
import { dueText, isDueToday, overdueText, todayText } from '../task-list';

interface TaskDueProps {
  row: MyTaskRow;
  now: Date;
  today: IsoDate;
}

/** Deadline of a task (ui-brief §1): "Không có hạn", the date, "Hôm nay HH:mm" or "Quá hạn N ngày". */
export const TaskDue = ({ row, now, today }: TaskDueProps) => {
  if (!row.dueAt) return <span className="text-ink-3">Không có hạn</span>;
  if (row.isOverdue) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-crit">{dueText(row.dueAt)}</span>
        <Badge tone="crit">{overdueText(row.dueAt, now)}</Badge>
      </span>
    );
  }
  if (isDueToday(row, today)) return <Badge tone="warn">{todayText(row.dueAt)}</Badge>;
  return <span className="text-ink-2">{dueText(row.dueAt)}</span>;
};
