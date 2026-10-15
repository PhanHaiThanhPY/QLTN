import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { TASK_KIND_LABEL } from '@/domain/constants';
import type { TaskView } from '@/services/tasks-service';
import { formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';
import { COMPLETION_REASON_LABEL } from '../task-labels';
import { SubjectTypeBadge } from './SubjectTypeBadge';
import { TaskStatusBadge } from './TaskStatusBadge';

interface TaskCardProps {
  row: TaskView;
  buildingName?: (id?: string) => string;
}

/** Touch-friendly task row; used on phones and in the dashboard widget. */
export const TaskCard = ({ row, buildingName }: TaskCardProps) => (
  <Link
    to={subjectPath(row.task.subjectType, row.task.subjectId, row.tab)}
    className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 hover:border-accent/40 hover:bg-surface-2"
  >
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <SubjectTypeBadge subjectType={row.task.subjectType} />
        <TaskStatusBadge row={row} />
      </div>
      <p className="mt-1.5 font-medium text-ink">{TASK_KIND_LABEL[row.task.kind]}</p>
      <p className="truncate text-sm text-ink-2">
        {row.subjectCode || '—'}
        {row.subjectTitle ? ` · ${row.subjectTitle}` : ''}
      </p>
      <p className={row.isOverdue ? 'mt-0.5 text-xs font-medium text-crit' : 'mt-0.5 text-xs text-ink-2'}>
        Hạn: {formatDateTime(row.task.dueAt)}
        {buildingName ? ` · ${buildingName(row.task.buildingId)}` : ''}
      </p>
      {row.task.completionReason ? (
        <p className="mt-0.5 text-xs text-ink-2">{COMPLETION_REASON_LABEL[row.task.completionReason]}</p>
      ) : null}
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
  </Link>
);
