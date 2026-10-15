import { Badge } from '@/components/ui/badge';
import type { TaskView } from '@/services/tasks-service';

/** Open / overdue / done marker of one task. */
export const TaskStatusBadge = ({ row }: { row: TaskView }) => {
  if (row.task.status === 'DONE') return <Badge tone="outline">Đã xong</Badge>;
  if (row.isOverdue) return <Badge tone="crit">Quá hạn</Badge>;
  return <Badge tone="warn">Chờ xử lý</Badge>;
};
