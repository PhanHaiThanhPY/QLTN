import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getMyTasks } from '@/services/tasks-service';
import { TaskCard } from '@/features/tasks/components/TaskCard';

const TOP_COUNT = 5;

/** Top open tasks of the viewer, nearest due date first. */
export const MyTasksCard = ({ className }: { className?: string }) => {
  const query = useServiceQuery(['tasks', 'mine', false], () => getMyTasks(false));
  const rows = query.data ?? [];

  const renderBody = () => {
    if (query.isLoading) return <LoadingState rows={3} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) return <EmptyState title="Không có việc nào đang chờ bạn" />;
    return (
      <div className="space-y-2">
        {rows.slice(0, TOP_COUNT).map((row) => (
          <TaskCard key={row.task.id} row={row} />
        ))}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader
        title="Công việc của tôi"
        description={rows.length > TOP_COUNT ? `Hiển thị ${TOP_COUNT}/${rows.length} việc gần hạn nhất` : undefined}
        actions={
          <Link to="/tasks" className="text-sm font-medium text-accent hover:underline">
            Xem tất cả
          </Link>
        }
      />
      <CardBody>{renderBody()}</CardBody>
    </Card>
  );
};
