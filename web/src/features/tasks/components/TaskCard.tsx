import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import type { IsoDate } from '@/domain/types';
import type { MyTaskRow } from '@/services/my-tasks-service';
import { taskAriaLabel } from '../task-list';
import { TaskDue } from './TaskDue';
import { TaskFlags } from './TaskFlags';

interface TaskCardProps {
  row: MyTaskRow;
  now: Date;
  today: IsoDate;
  buildingName?: (id?: string) => string;
}

/** Touch-friendly task (the whole card, at least 44px, opens the record tab); used on phones and on the dashboard. */
export const TaskCard = ({ row, now, today, buildingName }: TaskCardProps) => (
  <Link
    to={row.href}
    aria-label={taskAriaLabel(row, now, today)}
    className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 hover:border-accent/40 hover:bg-surface-2"
  >
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-ink">{row.label}</span>
        <TaskDue row={row} now={now} today={today} />
      </div>
      <p className="mt-0.5 truncate text-sm text-ink-2">
        {row.code || '—'}
        {row.title ? ` ${row.title}` : ''}
        {buildingName ? ` · ${buildingName(row.buildingId)}` : ''}
      </p>
      {row.detail ? <p className="mt-0.5 text-xs text-ink-2">{row.detail}</p> : null}
      <div className="mt-1"><TaskFlags row={row} /></div>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
  </Link>
);
