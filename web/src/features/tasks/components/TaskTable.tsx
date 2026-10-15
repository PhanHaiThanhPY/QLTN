import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { TASK_KIND_LABEL } from '@/domain/constants';
import type { TaskView } from '@/services/tasks-service';
import { formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';
import { COMPLETION_REASON_LABEL } from '../task-labels';
import { SubjectTypeBadge } from './SubjectTypeBadge';
import { TaskStatusBadge } from './TaskStatusBadge';

interface TaskTableProps {
  rows: TaskView[];
  buildingName: (id?: string) => string;
}

/** Desktop task table (hidden below md). */
export const TaskTable = ({ rows, buildingName }: TaskTableProps) => (
  <Table>
    <thead>
      <tr>
        <Th>Loại</Th>
        <Th>Việc cần làm</Th>
        <Th>Hồ sơ / lượt</Th>
        <Th>Tòa nhà</Th>
        <Th>Hạn xử lý</Th>
        <Th>Trạng thái</Th>
        <Th>Thao tác</Th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <Tr key={row.task.id}>
          <Td>
            <SubjectTypeBadge subjectType={row.task.subjectType} />
          </Td>
          <Td className="font-medium text-ink">
            <Link to={subjectPath(row.task.subjectType, row.task.subjectId, row.tab)} className="hover:text-accent hover:underline">
              {TASK_KIND_LABEL[row.task.kind]}
            </Link>
          </Td>
          <Td>
            <p className="font-medium text-ink">{row.subjectCode || '—'}</p>
            <p className="text-xs text-ink-2">{row.subjectTitle}</p>
          </Td>
          <Td className="text-ink-2">{buildingName(row.task.buildingId)}</Td>
          <Td>
            <span className={row.isOverdue ? 'font-medium text-crit' : undefined}>{formatDateTime(row.task.dueAt)}</span>
          </Td>
          <Td>
            <TaskStatusBadge row={row} />
            {row.task.completionReason ? (
              <p className="mt-1 text-xs text-ink-2">{COMPLETION_REASON_LABEL[row.task.completionReason]}</p>
            ) : null}
          </Td>
          <Td>
            <Link to={subjectPath(row.task.subjectType, row.task.subjectId, row.tab)} className="inline-flex items-center gap-1.5 rounded-lg border border-accent/35 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-fg">
              Mở việc <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </Td>
        </Tr>
      ))}
    </tbody>
  </Table>
);
